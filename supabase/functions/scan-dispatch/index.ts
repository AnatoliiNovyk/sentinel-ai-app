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
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const body = await req.json();
    const { scan_id, project_id, scanner, target, org_id } = body;

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

    // Rate limit: 10 scans per minute per user
    const rl = checkScanRateLimit(scan.user_id);
    if (!rl.allowed) {
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
