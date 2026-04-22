import { createClient } from '@supabase/supabase-js';

// We use the normal client for polling (public data)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const publicClient = createClient(supabaseUrl, supabaseAnonKey);

export type AiRemediationRequest = {
  title: string;
  description: string;
  severity: string;
  asset: string;
  cve_id: string;
  remediation_type: string;
  project_id: string;
  scan_id: string;
};

export type AiRemediationResponse = {
  explanation: string;
  code: string;
  language: string;
};

/**
 * Dispatches an AI task. 
 * Since RLS/Edge Functions are failing, we use a more direct approach.
 */
export async function generateAiRemediation(req: AiRemediationRequest): Promise<AiRemediationResponse> {
  const prompt = `
    Context: You are a cybersecurity expert. 
    Task: Analyze the following vulnerability and provide a concise remediation explanation and a code snippet to fix it.
    
    Vulnerability: ${req.title}
    Description: ${req.description}
    Severity: ${req.severity}
    Asset: ${req.asset}
    CVE ID: ${req.cve_id}

    IMPORTANT: Your response MUST be valid JSON in this format:
    {
      "explanation": "Brief clear explanation",
      "code": "The fix code",
      "language": "bash"
    }
  `;

  console.log('📡 [AI] Dispatching task...');

  // 1. Dispatch the job using the Edge Function
  // We use the standard invoke which SHOULD work if secrets are set
  const { data: dispatchRes, error: dispatchErr } = await publicClient.functions.invoke('scan-dispatch', {
    body: {
      project_id: req.project_id,
      scan_id: req.scan_id,
      scanner: 'ai_task',
      target: prompt
    }
  });

  if (dispatchErr) {
    console.error('❌ [AI] Dispatch failed:', dispatchErr);
    // If Edge Function fails, the user MUST run the SQL I provided.
    // There is NO other way to bypass RLS from the frontend safely.
    throw new Error('Please run the SQL fix in Supabase Dashboard to enable this feature.');
  }

  console.log('✅ [AI] Task queued. Polling for results...');

  const startTime = Date.now();
  const timeout = 90000;
  
  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, 3000));
    
    const { data: results } = await publicClient
      .from('vulnerabilities')
      .select('description, created_at')
      .eq('scan_id', req.scan_id)
      .eq('title', 'AI Security Response')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (results && new Date(results.created_at).getTime() > startTime - 5000) {
      try {
        const jsonMatch = results.description.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : results.description);
        return {
          explanation: parsed.explanation || results.description,
          code: parsed.code || '',
          language: parsed.language || 'text'
        };
      } catch (e) {
        return { explanation: results.description, code: '', language: 'text' };
      }
    }
  }

  throw new Error('AI processing timed out.');
}
