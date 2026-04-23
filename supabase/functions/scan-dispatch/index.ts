import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user from JWT
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      console.error("Auth error:", authErr);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Insert job with org_id for RBAC visibility
    const { data: job, error: jobErr } = await serviceClient
      .from("scan_jobs")
      .insert({
        scan_id,
        user_id: user.id,
        org_id: org_id, // Important for team visibility
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
        org_id: org_id, 
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
