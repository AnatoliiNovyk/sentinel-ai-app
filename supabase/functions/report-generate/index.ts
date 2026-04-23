import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Project = {
  id: string;
  user_id: string;
  name: string;
  target: string;
  environment: string;
};

type Scan = {
  id: string;
  scanner: string;
  status: string;
  severity_summary: Record<string, number>;
  created_at: string;
};

type Vulnerability = {
  id: string;
  title: string;
  description: string;
  severity: string;
  cve_id: string;
  mitre_tactic: string;
  cis_control: string;
  asset: string;
  remediation: string;
};

type ReportKind = "executive" | "technical";

function totalize(vulns: Vulnerability[]): Record<string, number> {
  return vulns.reduce((acc, v) => {
    acc[v.severity] = (acc[v.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function baseReport(kind: ReportKind, project: Project, scans: Scan[], vulns: Vulnerability[]): string {
  const totals = totalize(vulns);
  if (kind === "executive") {
    return `# Executive Summary — ${project.name}

Generated: ${new Date().toLocaleString()}

## Overview
An AI-orchestrated audit was performed against "${project.name}" (${project.environment}) across ${scans.length} scan(s). A total of ${vulns.length} findings were correlated and mapped to industry frameworks (MITRE ATT&CK, CIS Controls).

## Risk profile
- Critical: ${totals.critical ?? 0}
- High: ${totals.high ?? 0}
- Medium: ${totals.medium ?? 0}
- Low: ${totals.low ?? 0}

## Business impact
${(totals.critical ?? 0) > 0 ? "Immediate attention required: critical issues could allow data exfiltration or full compromise of production resources." : "No critical exposures detected at this time. Maintain continuous monitoring to catch drift."}

## Recommended next steps
1. Apply the AI-generated remediation patches for all critical and high findings within the next change window.
2. Schedule a follow-up scan after remediation to validate closure.
3. Enable continuous posture monitoring to detect configuration drift.

## Compliance alignment
Findings were correlated with SOC2, CIS Controls v8 and MITRE ATT&CK. Detailed evidence is available in the companion Technical Deep Dive report.
`;
  }

  const lines = [
    `# Technical Deep Dive — ${project.name}`,
    `Generated: ${new Date().toLocaleString()}`,
    ``,
    `Target: ${project.target}`,
    `Environment: ${project.environment}`,
    `Total scans: ${scans.length}`,
    `Total findings: ${vulns.length}`,
    ``,
    `## Findings`,
  ];
  for (const v of vulns) {
    lines.push(
      ``,
      `### [${v.severity.toUpperCase()}] ${v.title}`,
      `- Asset: \`${v.asset}\``,
      `- MITRE: ${v.mitre_tactic || "-"}`,
      `- CIS: ${v.cis_control || "-"}`,
      v.cve_id ? `- CVE: ${v.cve_id}` : "",
      ``,
      v.description,
      ``,
      `**Remediation:** ${v.remediation}`
    );
  }
  return lines.filter(Boolean).join("\n");
}

async function augmentWithAi(
  base: string,
  kind: ReportKind,
  project: Project,
  totals: Record<string, number>,
  supabaseUrl: string,
  anonKey: string,
  authHeader: string
): Promise<string> {
  try {
    const prompt = kind === "executive"
      ? `Rewrite the following executive summary so it sounds premium and board-ready. Keep the same facts but improve prose. Project: ${project.name}. Totals: critical=${totals.critical ?? 0}, high=${totals.high ?? 0}. Start with a compelling one-paragraph narrative. Then keep the risk profile and next steps as structured markdown.\n\nBase report:\n${base}`
      : `Enhance the following technical security report. Add a short executive paragraph at the top, keep all finding details intact, and add a one-line "Why it matters" note under each finding where useful.\n\nBase report:\n${base}`;

    const res = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader || `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return base;
    const data = await res.json();
    const text: string = data?.content ?? "";
    return text.trim().length > 200 ? text : base;
  } catch {
    return base;
  }
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const projectId: string = body.project_id;
    const kind: ReportKind = body.kind === "technical" ? "technical" : "executive";
    const useAi: boolean = body.use_ai !== false;

    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: scans } = await supabase
      .from("scans")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    const scanList = (scans ?? []) as Scan[];

    const scanIds = scanList.map((s) => s.id);
    const { data: vulns } = scanIds.length
      ? await supabase.from("vulnerabilities").select("*").in("scan_id", scanIds)
      : { data: [] };
    const vulnList = (vulns ?? []) as Vulnerability[];

    const base = baseReport(kind, project as Project, scanList, vulnList);
    const totals = totalize(vulnList);

    const content = useAi
      ? await augmentWithAi(base, kind, project as Project, totals, supabaseUrl, anonKey, authHeader)
      : base;

    const title = `${kind === "executive" ? "Executive Summary" : "Technical Deep Dive"} - ${(project as Project).name}`;

    const { data: report, error: insertErr } = await supabase
      .from("reports")
      .insert({
        user_id: user.id,
        project_id: projectId,
        kind,
        title,
        content,
      })
      .select()
      .maybeSingle();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "report_ready",
      title: `${kind === "executive" ? "Executive" : "Technical"} report ready`,
      body: `${title} has been generated and is available in the Reports tab.`,
      link: "reports",
      severity: "success",
      metadata: { report_id: report?.id, project_id: projectId, kind },
    });

    return new Response(
      JSON.stringify({ report_id: report?.id, title, kind, content_length: content.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
