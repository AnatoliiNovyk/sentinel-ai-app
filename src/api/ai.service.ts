import { supabase } from '../lib/supabase';
import { ErrorCode, failure, Result, success } from '../lib/errors';

export interface AiTaskRequest {
  title: string;
  description: string;
  severity: string;
  asset: string;
  cve_id?: string;
  project_id: string;
  scan_id: string;
  user_id: string;
}

export const AiService = {
  async generateFix(req: AiTaskRequest): Promise<Result<string>> {
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

    // Note: When calling a function with a single JSONB parameter,
    // PostgREST/Supabase-js sometimes expects the object directly as the payload.
    // However, to be absolutely sure and avoid 404s, we use the named parameter 'params'.
    // BUT, if we still get 404, we try the anonymous call (passing the object directly).
    const { data: jobId, error: rpcErr } = await supabase.rpc('dispatch_ai_task', {
      project_id: req.project_id,
      scan_id: req.scan_id,
      user_id: req.user_id,
      target: prompt,
      metadata: { type: 'fix_generation', scan_id: req.scan_id }
    });

    if (rpcErr || !jobId) {
      return failure(ErrorCode.AI_RPC_FAILED, 'Failed to dispatch AI fix generation.', rpcErr, {
        projectId: req.project_id,
        scanId: req.scan_id,
      });
    }
    return success(jobId);
  },

  async dispatchChatTask(
    projectId: string,
    conversationId: string,
    userId: string,
    content: string,
  ): Promise<Result<string>> {
    const { data, error } = await supabase.rpc('dispatch_ai_task', {
      project_id: projectId,
      scan_id: null,
      user_id: userId,
      target: content,
      metadata: { type: 'chat_response', conversation_id: conversationId }
    });

    if (error || !data) {
      return failure(ErrorCode.AI_RPC_FAILED, 'Failed to dispatch AI chat task.', error, {
        projectId,
        conversationId,
      });
    }
    return success(data);
  },

  async pollForResult(scanId: string | null, startTime: number): Promise<Result<unknown>> {
    const maxRetries = 40; // 2 minutes
    for (let i = 0; i < maxRetries; i++) {
      let query = supabase
        .from('vulnerabilities')
        .select('*')
        .eq('title', 'AI Security Response')
        .gt('created_at', new Date(startTime).toISOString());

      if (scanId) {
        query = query.eq('scan_id', scanId);
      } else {
        query = query.is('scan_id', null);
      }

      const { data } = await query.maybeSingle();

      if (data) return success(data);
      await new Promise(r => setTimeout(r, 3000));
    }
    return failure(
      ErrorCode.AI_PROCESSING_TIMEOUT,
      'AI processing timed out. Please check again in a moment.',
      undefined,
      { scanId },
    );
  }
};
