import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Agent-Secret",
};
const operationalAlertWebhookUrl = Deno.env.get("OPERATIONAL_ALERT_WEBHOOK_URL") ?? "";
type AgentLogLevel = "info" | "success" | "error" | "warn";
type AuditAction = "scan_completed" | "scan_failed";

async function sendOperationalAlert(payload: Record<string, unknown>): Promise<void> {
  if (!operationalAlertWebhookUrl) return;

  try {
    await fetch(operationalAlertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("operational alert send failed:", error instanceof Error ? error.message : "Unknown error");
  }
}

async function insertAuditLog(
  serviceClient: ReturnType<typeof createClient>,
  params: {
    org_id: string;
    user_id: string;
    action: AuditAction;
    resource_type: string;
    resource_id: string;
    status: "success" | "failure";
    error_code?: string | null;
    error_message?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  const { error } = await serviceClient.from("audit_logs").insert({
    org_id: params.org_id,
    user_id: params.user_id,
    action: params.action,
    resource_type: params.resource_type,
    resource_id: params.resource_id,
    status: params.status,
    error_code: params.error_code ?? null,
    error_message: params.error_message ?? null,
    metadata: params.metadata ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("audit log insert failed:", error.message);
  }
}

async function insertAgentLog(
  serviceClient: ReturnType<typeof createClient>,
  params: {
    job_id?: string | null;
    scan_id?: string | null;
    project_id?: string | null;
    level?: AgentLogLevel;
    message: string;
  },
): Promise<void> {
  const { error } = await serviceClient.from("agent_logs").insert({
    job_id: params.job_id ?? null,
    scan_id: params.scan_id ?? null,
    project_id: params.project_id ?? null,
    level: params.level ?? "info",
    message: params.message,
  });

  if (error) {
    console.warn("agent log insert failed:", error.message);
  }
}

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
    const { job_id, scan_id, user_id, project_id, findings, error_message, metadata } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let scanContext: { user_id: string; org_id: string } | null = null;
    if (scan_id) {
      const { data } = await supabase
        .from("scans")
        .select("user_id, org_id")
        .eq("id", scan_id)
        .maybeSingle();
      if (data?.user_id && data?.org_id) {
        scanContext = { user_id: data.user_id, org_id: data.org_id };
      }
    }

    const now = new Date().toISOString();
    await insertAgentLog(supabase, {
      job_id,
      scan_id: scan_id ?? null,
      project_id: project_id ?? null,
      level: "info",
      message: "Scan result received",
    });

    // 1. Handle error case
    if (error_message) {
      await insertAgentLog(supabase, {
        job_id,
        scan_id: scan_id ?? null,
        project_id: project_id ?? null,
        level: "error",
        message: `Scan failed: ${error_message}`,
      });

      if (scan_id && scanContext) {
        await insertAuditLog(supabase, {
          org_id: scanContext.org_id,
          user_id: scanContext.user_id,
          action: "scan_failed",
          resource_type: "scan",
          resource_id: scan_id,
          status: "failure",
          error_code: "SCAN_FAILED",
          error_message,
          metadata: { project_id: project_id ?? null, job_id },
        });
      }

      await sendOperationalAlert({
        event: "scan_failed",
        scan_id: scan_id ?? null,
        job_id,
        project_id: project_id ?? null,
        user_id: scanContext?.user_id ?? user_id ?? null,
        org_id: scanContext?.org_id ?? null,
        error_message,
        timestamp: new Date().toISOString(),
      });

      await supabase.from("scan_jobs").update({ status: "error", error_message, completed_at: now }).eq("id", job_id);
      if (scan_id) {
        await supabase.from("scans").update({ status: "failed", completed_at: now }).eq("id", scan_id);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // 2. Handle Chat Response (if scan_id is null and conversation_id exists)
    if (!scan_id && metadata?.conversation_id && metadata?.type === 'chat_response') {
      const aiResponse = findings[0]?.description || "Agent could not generate a response.";
      
      await supabase.from("ai_messages").insert({
        conversation_id: metadata.conversation_id,
        user_id: user_id,
        role: 'assistant',
        content: aiResponse
      });

      // Mark job as done
      await supabase.from("scan_jobs").update({ status: "done", completed_at: now }).eq("id", job_id);
      await insertAgentLog(supabase, {
        job_id,
        scan_id: null,
        project_id: project_id ?? null,
        level: "success",
        message: "Chat response completed",
      });
      
      return new Response(JSON.stringify({ ok: true, type: 'chat_response' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Normal Vulnerability Reporting (Existing Logic)
    if (Array.isArray(findings) && findings.length > 0) {
      const rows = findings.map((f: Record<string, unknown>) => ({
        scan_id,
        user_id,
        title: (f.title as string | undefined) ?? "Unnamed finding",
        description: (f.description as string | undefined) ?? "",
        severity: (f.severity as string | undefined) ?? "info",
        cve_id: (f.cve_id as string | undefined) ?? "",
        mitre_tactic: (f.mitre_tactic as string | undefined) ?? "",
        cis_control: (f.cis_control as string | undefined) ?? "",
        asset: (f.asset as string | undefined) ?? "",
        remediation: (f.remediation as string | undefined) ?? "",
        remediation_code: (f.remediation_code as string | undefined) ?? "",
        remediation_type: (f.remediation_type as string | undefined) ?? "manual",
        status: "open",
      }));

      await supabase.from("vulnerabilities").insert(rows);

      if (scan_id) {
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
      }
    } else if (scan_id) {
      await supabase.from("scans").update({ status: "completed", completed_at: now }).eq("id", scan_id);
    }

    // Mark job done
    await supabase.from("scan_jobs").update({ status: "done", completed_at: now }).eq("id", job_id);
    if (scan_id) {
      await insertAgentLog(supabase, {
        job_id,
        scan_id,
        project_id: project_id ?? null,
        level: "success",
        message: `Scan completed with ${Array.isArray(findings) ? findings.length : 0} findings`,
      });

      if (scanContext) {
        await insertAuditLog(supabase, {
          org_id: scanContext.org_id,
          user_id: scanContext.user_id,
          action: "scan_completed",
          resource_type: "scan",
          resource_id: scan_id,
          status: "success",
          metadata: {
            project_id: project_id ?? null,
            job_id,
            findings_count: Array.isArray(findings) ? findings.length : 0,
          },
        });
      }
    }

    // Recompute risk score (only if scan_id exists)
    if (project_id && scan_id) {
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

    // Notification
    await supabase.from("notifications").insert({
      user_id,
      type: scan_id ? "scan_completed" : "ai_response",
      title: scan_id ? "Scan Completed" : "AI Response Ready",
      body: scan_id ? `${findings?.length ?? 0} findings were identified.` : "Sentinel AI has responded to your inquiry.",
      link: scan_id ? `/projects/${project_id}` : "/chat",
      severity: "success",
      metadata: { scan_id, job_id, conversation_id: metadata?.conversation_id },
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
