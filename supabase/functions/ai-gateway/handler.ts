import {
  gatewayError,
  isPayloadTooLarge,
  parseGatewayRequest,
  type ChatMessage,
} from './contract.ts';
import { checkGatewayRateLimit, extractClientKey } from './rateLimit.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const SYSTEM_PROMPT = `You are Sentinel, an autonomous AI cybersecurity auditor agent.

Your role is to orchestrate infrastructure security audits. You can reason about:
- External attack surface scanning (Nmap, Masscan, Amass)
- Cloud security posture (Prowler, CloudSploit for AWS/GCP/Azure)
- Infrastructure as Code analysis (tfsec, Checkov)
- Vulnerability assessment (OpenVAS, CVE databases)

When a user describes a goal, you:
1. Pick the appropriate scanner toolkit.
2. Explain the plan concisely (steps, estimated duration).
3. Map findings to MITRE ATT&CK and CIS Controls.
4. Offer to generate executive summary or technical deep-dive reports.
5. Provide ready-to-apply remediation as Terraform or Kubernetes patches when relevant.

Keep responses clear, technical, and action-oriented. Use Markdown formatting (bold, bullet points, code blocks). Never invent data you don't have — describe what you would do.`;

async function callGemini(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const userMessages = messages.filter((m) => m.role !== 'system');

  const contents = userMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callAnthropic(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.filter((m) => m.role !== 'system'),
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${res.status}`);
  }

  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}

async function callOpenAI(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

function mockResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('aws') || lower.includes('cloud')) {
    return `I'll initiate a **cloud security assessment**.\n\n**Plan:**\n1. Reconnaissance with Prowler and CloudSploit across IAM, S3, and security groups.\n2. IaC analysis via tfsec and Checkov on your Terraform modules.\n3. Compliance mapping to CIS AWS Foundations and SOC2.\n4. Prioritization by MITRE ATT&CK cloud tactics.\n\n**Estimated duration:** 12-18 minutes. Shall I proceed with a read-only scan?`;
  }
  if (lower.includes('scan') || lower.includes('audit') || lower.includes('pentest')) {
    return `I'll orchestrate an external audit using Amass for subdomain enumeration, Masscan for port discovery, Nmap for service fingerprinting, and OpenVAS for CVE correlation. Findings will be normalized and mapped to MITRE ATT&CK. Would you like an **executive summary** for leadership?`;
  }
  if (lower.includes('report')) {
    return `I can generate two tiers:\n- **Executive Summary** — business risk language, KPIs\n- **Technical Deep Dive** — per-finding remediation with Terraform/Kubernetes patches\n\nWhich one should I produce first?`;
  }
  if (lower.includes('kill_chain_mock')) {
    return JSON.stringify([
      {
        phase: 'Initial Access',
        tactic: 'TA0001',
        description: 'Attacker exploits external vuln',
        exploited_vuln: 'RCE',
        asset: 'Web Server',
      },
      {
        phase: 'Execution',
        tactic: 'TA0002',
        description: 'Attacker drops shell',
        exploited_vuln: 'Weak OS config',
        asset: 'Internal Net',
      },
    ]);
  }

  return `I'm **Sentinel**, your AI security auditor. I can orchestrate external, cloud, IaC, and vulnerability scans, map findings to MITRE ATT&CK and CIS Controls, and generate reports with ready-to-apply remediation.\n\nTry: *"Scan my AWS account for SOC2 compliance"*.`;
}

function jsonResponse(
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function getEnvKey(name: string): string | undefined {
  const denoLike = globalThis as unknown as {
    Deno?: {
      env?: {
        get: (key: string) => string | undefined;
      };
    };
  };

  return denoLike.Deno?.env?.get(name);
}

export async function handleAiGatewayRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      const err = gatewayError('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
      return jsonResponse(err.body, err.status);
    }

    const clientKey = extractClientKey(req);
    const rateLimit = checkGatewayRateLimit(clientKey);
    if (!rateLimit.allowed) {
      const err = gatewayError('RATE_LIMITED', 'Too many requests. Please retry later.', 429);
      return jsonResponse(err.body, err.status, {
        'Retry-After': String(rateLimit.retryAfterSeconds),
      });
    }

    let rawBody: unknown;
    try {
      const bodyText = await req.text();
      if (isPayloadTooLarge(bodyText)) {
        const err = gatewayError('PAYLOAD_TOO_LARGE', 'Request payload is too large.', 413);
        return jsonResponse(err.body, err.status);
      }

      rawBody = JSON.parse(bodyText);
    } catch {
      const err = gatewayError('INVALID_JSON', 'Invalid JSON body.', 400);
      return jsonResponse(err.body, err.status);
    }

    const parsed = parseGatewayRequest(rawBody);
    if (!parsed.ok) {
      return jsonResponse(parsed.error.body, parsed.error.status);
    }

    const { action, messages } = parsed.value;

    const geminiKey = getEnvKey('GEMINI_API_KEY');
    const anthropicKey = getEnvKey('ANTHROPIC_API_KEY');
    const openaiKey = getEnvKey('OPENAI_API_KEY');

    let content = '';
    let provider = 'mock';

    if (geminiKey) {
      try {
        content = await callGemini(geminiKey, messages);
        provider = 'gemini-1.5-pro';
      } catch (err) {
        console.error('Gemini error, trying next provider:', err);
      }
    }

    if (!content && anthropicKey) {
      try {
        content = await callAnthropic(anthropicKey, messages);
        provider = 'anthropic';
      } catch (err) {
        console.error('Anthropic error, trying next provider:', err);
      }
    }

    if (!content && openaiKey) {
      try {
        content = await callOpenAI(openaiKey, messages);
        provider = 'openai';
      } catch (err) {
        console.error('OpenAI error, using mock:', err);
      }
    }

    if (!content) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      content = mockResponse(
        (lastUser?.content ?? '') + (action === 'generate_kill_chain' ? ' kill_chain_mock' : ''),
      );
      provider = 'mock';
    }

    if (action === 'generate_kill_chain') {
      try {
        const cleaned = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        const killChain = JSON.parse(cleaned);
        return jsonResponse({ kill_chain: killChain, provider });
      } catch {
        const err = gatewayError('AI_INVALID_JSON', 'AI failed to return a valid JSON payload.', 502);
        return jsonResponse(err.body, err.status);
      }
    }

    return jsonResponse({ content, provider });
  } catch (err) {
    console.error('ai-gateway unhandled error:', err);
    const safeError = gatewayError('INTERNAL_ERROR', 'Unexpected gateway error.', 500);
    return jsonResponse(safeError.body, safeError.status);
  }
}
