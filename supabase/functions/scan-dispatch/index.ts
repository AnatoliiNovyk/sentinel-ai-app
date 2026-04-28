import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ---------------------------------------------------------------------------
// In-memory rate limiter for scan dispatch (10 scans / 60s per user)
// ---------------------------------------------------------------------------
const SCAN_RATE_LIMIT = 10;
const SCAN_WINDOW_MS = 60_000;
const scanBuckets = new Map<string, number[]>();
type AgentLogLevel = "info" | "success" | "error" | "warn";

function checkScanRateLimit(userId: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - SCAN_WINDOW_MS;
  const prev = scanBuckets.get(userId) ?? [];
  const recent = prev.filter((t) => t > windowStart);

  if (recent.length >= SCAN_RATE_LIMIT) {
    const oldest = recent[0];
    const retryMs = Math.max(1, SCAN_WINDOW_MS - (now - oldest));
    scanBuckets.set(userId, recent);
    return { allowed: false, retryAfterSeconds: Math.ceil(retryMs / 1000) };
  }

  recent.push(now);
  scanBuckets.set(userId, recent);
  return { allowed: true, retryAfterSeconds: 0 };
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
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  let dispatchScanId: string | null = null;
  let dispatchProjectId: string | null = null;

  try {
    const body = await req.json();
    const { scan_id, project_id, scanner, target, org_id } = body;
    dispatchScanId = typeof scan_id === "string" ? scan_id : null;
    dispatchProjectId = typeof project_id === "string" ? project_id : null;

    if (!scan_id || !project_id || !scanner || !target) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve ownership from the already-created scan row (written by authenticated client under RLS).
    const { data: scan, error: scanErr } = await serviceClient
      .from("scans")
      .select("id, user_id, project_id, org_id, status")
      .eq("id", scan_id)
      .maybeSingle();

    if (scanErr || !scan) {
      return new Response(JSON.stringify({ error: "Scan not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (scan.project_id !== project_id) {
      return new Response(JSON.stringify({ error: "scan_id/project_id mismatch" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await insertAgentLog(serviceClient, {
      scan_id,
      project_id,
      level: "info",
      message: "Scan dispatch request accepted",
    });

    // Rate limit: 10 scans per minute per user
    const rl = checkScanRateLimit(scan.user_id);
    if (!rl.allowed) {
      await insertAgentLog(serviceClient, {
        scan_id,
        project_id,
        level: "warn",
        message: `Scan dispatch rate-limited (retry_after=${rl.retryAfterSeconds}s)`,
      });
      return new Response(
        JSON.stringify({ error: "Too many scan requests. Please wait before starting another scan.", retryAfterSeconds: rl.retryAfterSeconds }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSeconds) } },
      );
    }

    // Insert job with org_id for RBAC visibility
    const { data: job, error: jobErr } = await serviceClient
      .from("scan_jobs")
      .insert({
        scan_id,
        user_id: scan.user_id,
        org_id: scan.org_id ?? org_id ?? null,
        project_id,
        scanner,
        target,
        status: "pending",
      })
      .select()
      .single();

    if (jobErr) throw jobErr;

    await insertAgentLog(serviceClient, {
      job_id: job.id,
      scan_id,
      project_id,
      level: "success",
      message: "Scan job queued",
    });

    // Ensure the scan record also has the correct status and org_id
    await serviceClient
      .from("scans")
      .update({ 
        status: "running", 
        org_id: scan.org_id ?? org_id ?? null,
        started_at: new Date().toISOString() 
      })
      .eq("id", scan_id);

    return new Response(JSON.stringify({ job_id: job.id, status: "queued" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("scan-dispatch error:", err);
    try {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await insertAgentLog(serviceClient, {
        scan_id: dispatchScanId,
        project_id: dispatchProjectId,
        level: "error",
        message: `Scan dispatch failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    } catch {
      // Logging failures must not mask the original dispatch error.
    }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
