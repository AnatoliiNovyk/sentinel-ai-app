import { supabase } from '../lib/supabase';

export interface AiTaskRequest {
  title: string;
  description: string;
  severity: string;
  asset: string;
  cve_id?: string;
  project_id: string;
  scan_id: string;
}

export const AiService = {
  async generateFix(req: AiTaskRequest) {
    const prompt = `
      As a security engineer, analyze this vulnerability and provide a remediation plan.
      
      Vulnerability: ${req.title}
      Severity: ${req.severity}
      Asset: ${req.asset}
      CVE: ${req.cve_id || 'N/A'}
      Description: ${req.description}
      
      Provide a clear remediation plan and, if applicable, a code snippet (e.g., bash, python, terraform) to fix it.
      Format the response as JSON: { "explanation": "...", "remediation": "...", "code": "..." }
    `;

    // Updated parameter names to match the new RPC signature
    const { data: jobId, error: rpcErr } = await supabase.rpc('dispatch_ai_task', {
      scan_id: req.scan_id,
      project_id: req.project_id,
      target: prompt,
      metadata: { type: 'fix_generation', scan_id: req.scan_id }
    });

    if (rpcErr) throw rpcErr;
    return jobId;
  },

  async dispatchChatTask(projectId: string, conversationId: string, content: string) {
    // Updated parameter names to match the new RPC signature
    const { data, error } = await supabase.rpc('dispatch_ai_task', {
      project_id: projectId,
      scan_id: null,
      target: content,
      metadata: { type: 'chat_response', conversation_id: conversationId }
    });

    if (error) throw error;
    return data;
  },

  async pollForResult(scanId: string, startTime: number) {
    const maxRetries = 40; // 2 minutes
    for (let i = 0; i < maxRetries; i++) {
      const { data } = await supabase
        .from('vulnerabilities')
        .select('*')
        .eq('scan_id', scanId)
        .eq('title', 'AI Security Response')
        .gt('created_at', new Date(startTime).toISOString())
        .maybeSingle();

      if (data) return data;
      await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('AI processing timed out. Please check again in a moment.');
  }
};
