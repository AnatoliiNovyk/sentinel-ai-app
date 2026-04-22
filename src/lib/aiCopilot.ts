import { supabase } from './supabase';

/**
 * Sprint 6: AI Security Copilot (Local CPU Edition)
 * Redirects AI tasks to the local VPS agent running Ollama (Llama 3).
 */

export type AiRemediationRequest = {
  title: string;
  description: string;
  severity: string;
  asset: string;
  cve_id: string;
  remediation_type: string;
};

export type AiRemediationResponse = {
  explanation: string;
  code: string;
  language: string;
};

export async function generateAiRemediation(req: AiRemediationRequest): Promise<AiRemediationResponse> {
  const prompt = `
    Context: You are a security expert.
    Vulnerability: ${req.title}
    Description: ${req.description}
    Asset: ${req.asset}
    CVE: ${req.cve_id}
    
    Task: Provide a short explanation and a code snippet to fix this.
    Format your response EXACTLY as JSON:
    {
      "explanation": "your explanation",
      "code": "your code snippet",
      "language": "bash/hcl/yaml/etc"
    }
  `;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Create a job for the agent
  const { data: job, error: jobErr } = await supabase
    .from('scan_jobs')
    .insert({
      user_id: user.id,
      scanner: 'ai_task',
      target: prompt,
      status: 'pending'
    })
    .select()
    .single();

  if (jobErr || !job) throw new Error('Failed to queue AI task');

  // 2. Poll for the result (max 60 seconds)
  let result: any = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const { data: updatedJob } = await supabase
      .from('scan_jobs')
      .select('status, error_message')
      .eq('id', job.id)
      .single();

    if (updatedJob?.status === 'completed') {
      // Fetch the "findings" which contains the AI response
      const { data: scanResults } = await supabase
        .from('scans')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Actually, we should probably have a dedicated table for AI results, 
      // but for now the agent reports findings to 'vulnerabilities' table via scan-result function.
      // Let's look for the vulnerability created for this jobId.
      const { data: vuln } = await supabase
        .from('vulnerabilities')
        .select('description')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (vuln) {
        try {
          // Attempt to parse JSON from the AI response
          const parsed = JSON.parse(vuln.description);
          return parsed;
        } catch (e) {
          // If not JSON, return as plain explanation
          return {
            explanation: vuln.description,
            code: '# Manual fix required',
            language: 'text'
          };
        }
      }
    } else if (updatedJob?.status === 'failed') {
      throw new Error(updatedJob.error_message || 'AI processing failed');
    }
  }

  throw new Error('AI processing timed out');
}
