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

Keep responses clear, technical, and action-oriented. Use bullet points sparingly. Never invent data you don't have — describe what you would do.`;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function mockResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("aws") || lower.includes("cloud")) {
    return `I'll initiate a cloud security assessment. Plan:\n\n1. Reconnaissance with Prowler and CloudSploit across IAM, S3, and security groups.\n2. IaC analysis via tfsec and Checkov on your Terraform modules.\n3. Compliance mapping to CIS AWS Foundations and SOC2.\n4. Prioritization by MITRE ATT&CK cloud tactics.\n\nEstimated duration: 12-18 minutes. Shall I proceed with a read-only scan?`;
  }
  if (lower.includes("scan") || lower.includes("audit") || lower.includes("pentest")) {
    return `I'll orchestrate an external audit using Amass for subdomain enumeration, Masscan for port discovery, Nmap for service fingerprinting, and OpenVAS for CVE correlation. Findings will be normalized and mapped to MITRE ATT&CK. Would you like an executive summary for leadership?`;
  }
  if (lower.includes("report")) {
    return `I can generate two tiers: Executive Summary (business risk language, KPIs) or Technical Deep Dive (per-finding remediation with Terraform/Kubernetes patches). Which one should I produce first?`;
  }
  return `I'm Sentinel, your AI security auditor. I can orchestrate external, cloud, IaC, and vulnerability scans, map findings to MITRE ATT&CK and CIS Controls, and generate reports with ready-to-apply remediation. Try: "Scan my AWS account for SOC2 compliance".`;
}

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
    const messages: ChatMessage[] = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    let content = "";
    let provider = "mock";

    if (anthropicKey) {
      try {
        content = await callAnthropic(anthropicKey, messages);
        provider = "anthropic";
      } catch (err) {
        console.error("Anthropic fallback:", err);
      }
    }

    if (!content && openaiKey) {
      try {
        content = await callOpenAI(openaiKey, messages);
        provider = "openai";
      } catch (err) {
        console.error("OpenAI fallback:", err);
      }
    }

    if (!content) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      content = mockResponse(lastUser?.content ?? "");
      provider = "mock";
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
