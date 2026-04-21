import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Agent-Secret",
};

// Simple shared secret between VPS agent and Supabase
function verifyAgent(req: Request): boolean {
  const secret = req.headers.get("X-Agent-Secret");
  const expected = Deno.env.get("AGENT_SECRET");
  return !!expected && secret === expected;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  if (!verifyAgent(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { job_id, scan_id, user_id, project_id, findings, error_message } = body;

    if (!job_id || !scan_id) {
      return new Response(JSON.stringify({ error: "job_id and scan_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();

    // Handle error case
    if (error_message) {
      await supabase.from("scan_jobs").update({ status: "error", error_message, completed_at: now }).eq("id", job_id);
      await supabase.from("scans").update({ status: "failed", completed_at: now }).eq("id", scan_id);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Insert vulnerabilities from scanner output
    if (Array.isArray(findings) && findings.length > 0) {
      const rows = findings.map((f: Record<string, unknown>) => ({
        scan_id,
        user_id,
        title: f.title ?? "Unnamed finding",
        description: f.description ?? "",
        severity: f.severity ?? "info",
        cve_id: f.cve_id ?? "",
        mitre_tactic: f.mitre_tactic ?? "",
        cis_control: f.cis_control ?? "",
        asset: f.asset ?? "",
        remediation: f.remediation ?? "",
        remediation_code: f.remediation_code ?? "",
        remediation_type: f.remediation_type ?? "manual",
        status: "open",
      }));

      await supabase.from("vulnerabilities").insert(rows);

      // Build severity_summary
      const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const f of findings) {
        const sev = (f.severity as string) ?? "info";
        if (sev in summary) summary[sev as keyof typeof summary]++;
      }

      await supabase.from("scans").update({
        status: "completed",
        completed_at: now,
        severity_summary: summary,
      }).eq("id", scan_id);
    } else {
      // No findings
      await supabase.from("scans").update({ status: "completed", completed_at: now }).eq("id", scan_id);
    }

    // Mark job done
    await supabase.from("scan_jobs").update({ status: "done", completed_at: now }).eq("id", job_id);

    // Recompute risk score
    if (project_id) {
      const { data: allVulns } = await supabase.from("vulnerabilities")
        .select("severity, status").eq("scan_id", scan_id);

      const weights = { critical: 40, high: 20, medium: 8, low: 2, info: 0 };
      let score = 0;
      for (const v of (allVulns ?? [])) {
        if (v.status === "open" || v.status === "in_progress") {
          score += weights[v.severity as keyof typeof weights] ?? 0;
        }
      }
      await supabase.from("projects").update({ risk_score: Math.min(score, 100) }).eq("id", project_id);
    }

    // Create notification for user
    await supabase.from("notifications").insert({
      user_id,
      type: "scan_completed",
      title: "Scan Completed",
      body: `${findings?.length ?? 0} findings were identified.`,
      link: `/projects/${project_id}`,
      severity: "success",
      metadata: { scan_id, job_id },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scan-result error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
