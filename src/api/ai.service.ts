import { supabase } from './client';

export type AiRemediationRequest = {
  title: string;
  description: string;
  severity: string;
  asset: string;
  cve_id: string;
  project_id: string;
  scan_id: string;
};

export const AiService = {
  /**
   * Dispatches an AI task using the database RPC.
   */
  async generateFix(req: AiRemediationRequest) {
    const prompt = `
      Context: You are a cybersecurity expert. 
      Vulnerability: ${req.title}
      Description: ${req.description}
      Severity: ${req.severity}
      Asset: ${req.asset}
      CVE: ${req.cve_id}

      Task: Provide a JSON response with keys "explanation", "code", and "language".
    `;

    // 1. Call RPC (Security Definer ensures bypass of RLS)
    const { data: jobId, error: rpcErr } = await supabase.rpc('dispatch_ai_task', {
      p_scan_id: req.scan_id,
      p_project_id: req.project_id,
      p_target: prompt
    });

    if (rpcErr) throw rpcErr;
    return jobId;
  },

  /**
   * Polls for the AI response in the vulnerabilities table.
   */
  async pollForResult(scanId: string, startTime: number, timeout: number = 90000) {
    const pollInterval = 3000;
    const endBy = startTime + timeout;

    while (Date.now() < endBy) {
      await new Promise(r => setTimeout(r, pollInterval));

      const { data: results, error } = await supabase
        .from('vulnerabilities')
        .select('description, created_at')
        .eq('scan_id', scanId)
        .eq('title', 'AI Security Response')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) continue;

      if (results && new Date(results.created_at).getTime() > startTime - 5000) {
        return results.description;
      }
    }

    throw new Error('AI Generation timed out.');
  }
};
