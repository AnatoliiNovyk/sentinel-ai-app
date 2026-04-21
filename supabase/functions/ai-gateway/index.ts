const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

// ─── Google Gemini ────────────────────────────────────────────────────────────
async function callGemini(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const userMessages = messages.filter((m) => m.role !== "system");

  // Convert to Gemini format
  const contents = userMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── Anthropic Claude ─────────────────────────────────────────────────────────
async function callAnthropic(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.filter((m) => m.role !== "system"),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const json = await res.json();
  return json.content?.[0]?.text ?? "";
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
async function callOpenAI(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// ─── Mock fallback (dev only) ─────────────────────────────────────────────────
function mockResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("aws") || lower.includes("cloud")) {
    return `I'll initiate a **cloud security assessment**.\n\n**Plan:**\n1. Reconnaissance with Prowler and CloudSploit across IAM, S3, and security groups.\n2. IaC analysis via tfsec and Checkov on your Terraform modules.\n3. Compliance mapping to CIS AWS Foundations and SOC2.\n4. Prioritization by MITRE ATT&CK cloud tactics.\n\n**Estimated duration:** 12-18 minutes. Shall I proceed with a read-only scan?`;
  }
  if (lower.includes("scan") || lower.includes("audit") || lower.includes("pentest")) {
    return `I'll orchestrate an external audit using Amass for subdomain enumeration, Masscan for port discovery, Nmap for service fingerprinting, and OpenVAS for CVE correlation. Findings will be normalized and mapped to MITRE ATT&CK. Would you like an **executive summary** for leadership?`;
  }
  if (lower.includes("report")) {
    return `I can generate two tiers:\n- **Executive Summary** — business risk language, KPIs\n- **Technical Deep Dive** — per-finding remediation with Terraform/Kubernetes patches\n\nWhich one should I produce first?`;
  }
  if (lower.includes("kill_chain_mock")) {
    return JSON.stringify([
      { phase: 'Initial Access', tactic: 'TA0001', description: 'Attacker exploits external vuln', exploited_vuln: 'RCE', asset: 'Web Server' },
      { phase: 'Execution', tactic: 'TA0002', description: 'Attacker drops shell', exploited_vuln: 'Weak OS config', asset: 'Internal Net' }
    ]);
  }
  return `I'm **Sentinel**, your AI security auditor. I can orchestrate external, cloud, IaC, and vulnerability scans, map findings to MITRE ATT&CK and CIS Controls, and generate reports with ready-to-apply remediation.\n\nTry: *"Scan my AWS account for SOC2 compliance"*.`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    let messages: ChatMessage[] = [];
    
    if (body.action === 'generate_kill_chain') {
      const prompt = `You are an expert Red Teamer. Generate a MITRE ATT&CK Kill Chain attack path based on these vulnerabilities for project ${body.project}:\n${JSON.stringify(body.vulnerabilities, null, 2)}\nRespond ONLY with a JSON array of objects without markdown block formatting. Each object must have: phase (e.g. Reconnaissance, Initial Access, Execution, Exfiltration), tactic (e.g. TA0043), description (how attacker moves), exploited_vuln (title of the vuln used), asset (the target asset).`;
      messages = [{ role: 'user', content: prompt }];
    } else {
      messages = body.messages ?? [];
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Priority: Gemini → Anthropic → OpenAI → mock
    const geminiKey    = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const openaiKey    = Deno.env.get("OPENAI_API_KEY");

    let content = "";
    let provider = "mock";

    if (geminiKey) {
      try {
        content = await callGemini(geminiKey, messages);
        provider = "gemini-1.5-pro";
      } catch (err) {
        console.error("Gemini error, trying next provider:", err);
      }
    }

    if (!content && anthropicKey) {
      try {
        content = await callAnthropic(anthropicKey, messages);
        provider = "anthropic";
      } catch (err) {
        console.error("Anthropic error, trying next provider:", err);
      }
    }

    if (!content && openaiKey) {
      try {
        content = await callOpenAI(openaiKey, messages);
        provider = "openai";
      } catch (err) {
        console.error("OpenAI error, using mock:", err);
      }
    }

    if (!content) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      content = mockResponse((lastUser?.content ?? "") + (body.action === 'generate_kill_chain' ? ' kill_chain_mock' : ''));
      provider = "mock";
    }

    if (body.action === 'generate_kill_chain') {
      try {
        const cleaned = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        const kill_chain = JSON.parse(cleaned);
        return new Response(JSON.stringify({ kill_chain, provider }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "AI failed to return valid JSON", raw: content }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500
        });
      }
    }

    return new Response(JSON.stringify({ content, provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
