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

    const { data: jobId, error: rpcErr } = await supabase.rpc('dispatch_ai_task', {
      p_scan_id: req.scan_id,
      p_project_id: req.project_id,
      p_target: prompt
    });

    if (rpcErr) throw rpcErr;
    return jobId;
  },

  /**
   * Dispatches a general chat task to the local agent.
   */
  async dispatchChatTask(projectId: string, text: string) {
    const prompt = `You are a cybersecurity expert assistant. User says: ${text}`;
    
    const { data: jobId, error } = await supabase.rpc('dispatch_ai_task', {
      p_scan_id: null,
      p_project_id: projectId,
      p_target: prompt
    });

    if (error) throw error;
    return jobId;
  },

  /**
   * Universal polling for AI results.
   * Works for both scans and general chat.
   */
  async pollForResult(scanId: string | null, startTime: number, timeout: number = 90000) {
    const pollInterval = 3000;
    const endBy = startTime + timeout;

    while (Date.now() < endBy) {
      await new Promise(r => setTimeout(r, pollInterval));

      let query = supabase
        .from('vulnerabilities')
        .select('description, created_at')
        .eq('title', 'AI Security Response')
        .order('created_at', { ascending: false })
        .limit(1);

      // If scanId is provided and not 'null', filter by it
      if (scanId && scanId !== 'null') {
        query = query.eq('scan_id', scanId);
      } else {
        // For chat, we look for findings where scan_id IS NULL
        query = query.is('scan_id', null);
      }

      const { data: results, error } = await query.maybeSingle();

      if (error) {
        console.warn('Polling error (retrying):', error.message);
        continue;
      }

      // Check if the finding is fresh (created AFTER we started polling)
      // We use a 60s buffer to account for potential clock drift between client and server.
      if (results && new Date(results.created_at).getTime() > startTime - 60000) {
        return results.description;
      }
    }

    throw new Error('AI Agent did not respond within the expected time. Please check agent.log on the server.');
  }
};
