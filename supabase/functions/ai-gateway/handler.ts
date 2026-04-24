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

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

const REQUEST_ID_HEADER = 'X-Request-Id';

type TelemetryMetric =
  | 'unauthorized_count'
  | 'invalid_json_count'
  | 'payload_too_large_count'
  | 'rate_limited_count'
  | 'provider_fallback_count'
  | 'ai_invalid_json_count';

const telemetryMetrics: Record<TelemetryMetric, number> = {
  unauthorized_count: 0,
  invalid_json_count: 0,
  payload_too_large_count: 0,
  rate_limited_count: 0,
  provider_fallback_count: 0,
  ai_invalid_json_count: 0,
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
  requestId: string,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      [REQUEST_ID_HEADER]: requestId,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function buildRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `req-${Date.now().toString(36)}-${hex}`;
}

function resolveRequestId(req: Request): string {
  const incoming = req.headers.get('x-request-id')?.trim() ?? '';
  const isValid = /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming);
  return isValid ? incoming : buildRequestId();
}

function safeErrorDetails(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(apikey|api_key|token|authorization)\s*[:=]\s*['"]?[^\s,'"]+/gi, '$1=[REDACTED]');
}

function logWithRequestId(requestId: string, message: string, err?: unknown): void {
  if (err === undefined) {
    console.error(`[ai-gateway][${requestId}] ${message}`);
    return;
  }

  console.error(`[ai-gateway][${requestId}] ${message}: ${safeErrorDetails(err)}`);
}

function incrementTelemetry(metric: TelemetryMetric, requestId: string): void {
  telemetryMetrics[metric] += 1;
  logWithRequestId(requestId, `telemetry ${metric}=${telemetryMetrics[metric]}`);
}

export function getAiGatewayTelemetrySnapshot(): Record<TelemetryMetric, number> {
  return { ...telemetryMetrics };
}

export function resetAiGatewayTelemetryForTests(): void {
  (Object.keys(telemetryMetrics) as TelemetryMetric[]).forEach((metric) => {
    telemetryMetrics[metric] = 0;
  });
}

function hasValidBearerAuth(req: Request): boolean {
  const auth = req.headers.get('authorization')?.trim() ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return false;
  }

  const token = auth.slice(7).trim();
  return token.length > 0;
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
  const requestId = resolveRequestId(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...securityHeaders,
        [REQUEST_ID_HEADER]: requestId,
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      const err = gatewayError('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
      return jsonResponse(err.body, requestId, err.status);
    }

    if (!hasValidBearerAuth(req)) {
      incrementTelemetry('unauthorized_count', requestId);
      const err = gatewayError('UNAUTHORIZED', 'Authorization Bearer token is required.', 401);
      return jsonResponse(err.body, requestId, err.status);
    }

    const clientKey = extractClientKey(req);
    const rateLimit = checkGatewayRateLimit(clientKey);
    if (!rateLimit.allowed) {
      incrementTelemetry('rate_limited_count', requestId);
      const err = gatewayError('RATE_LIMITED', 'Too many requests. Please retry later.', 429);
      return jsonResponse(err.body, requestId, err.status, {
        'Retry-After': String(rateLimit.retryAfterSeconds),
      });
    }

    let rawBody: unknown;
    try {
      const bodyText = await req.text();
      if (isPayloadTooLarge(bodyText)) {
        incrementTelemetry('payload_too_large_count', requestId);
        const err = gatewayError('PAYLOAD_TOO_LARGE', 'Request payload is too large.', 413);
        return jsonResponse(err.body, requestId, err.status);
      }

      rawBody = JSON.parse(bodyText);
    } catch {
      incrementTelemetry('invalid_json_count', requestId);
      const err = gatewayError('INVALID_JSON', 'Invalid JSON body.', 400);
      return jsonResponse(err.body, requestId, err.status);
    }

    const parsed = parseGatewayRequest(rawBody);
    if (!parsed.ok) {
      return jsonResponse(parsed.error.body, requestId, parsed.error.status);
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
        logWithRequestId(requestId, 'Gemini error, trying next provider', err);
      }
    }

    if (!content && anthropicKey) {
      try {
        content = await callAnthropic(anthropicKey, messages);
        provider = 'anthropic';
      } catch (err) {
        logWithRequestId(requestId, 'Anthropic error, trying next provider', err);
      }
    }

    if (!content && openaiKey) {
      try {
        content = await callOpenAI(openaiKey, messages);
        provider = 'openai';
      } catch (err) {
        logWithRequestId(requestId, 'OpenAI error, using mock', err);
      }
    }

    if (!content) {
      incrementTelemetry('provider_fallback_count', requestId);
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
        return jsonResponse({ kill_chain: killChain, provider }, requestId);
      } catch {
        incrementTelemetry('ai_invalid_json_count', requestId);
        const err = gatewayError('AI_INVALID_JSON', 'AI failed to return a valid JSON payload.', 502);
        return jsonResponse(err.body, requestId, err.status);
      }
    }

    return jsonResponse({ content, provider }, requestId);
  } catch (err) {
    logWithRequestId(requestId, 'Unhandled gateway error', err);
    const safeError = gatewayError('INTERNAL_ERROR', 'Unexpected gateway error.', 500);
    return jsonResponse(safeError.body, requestId, safeError.status);
  }
}
