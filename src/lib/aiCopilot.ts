import { supabase } from './supabase';

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

export async function generateAiRemediation(req: AiRemediationRequest): Promise<AiRemediationResponse> {
  const prompt = `
    Context: You are a security expert.
    Vulnerability: ${req.title}
    Description: ${req.description}
    Severity: ${req.severity}
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

  console.log('📡 Dispatching AI task via Edge Function...');

  // 1. Use the scan-dispatch Edge Function instead of direct DB insert to bypass RLS issues
  const { data: dispatchRes, error: dispatchErr } = await supabase.functions.invoke('scan-dispatch', {
    body: {
      project_id: req.project_id,
      scan_id: req.scan_id,
      scanner: 'ai_task',
      target: prompt,
      options: {
        is_ai: true,
        original_prompt: prompt
      }
    }
  });

  if (dispatchErr) {
    console.error('❌ Edge Function Dispatch Error:', dispatchErr);
    // Fallback to direct insert if function fails, but with better logging
    console.log('Attempting fallback direct insert...');
    const { error: fallbackErr } = await supabase.from('scan_jobs').insert({
      user_id: user.id,
      project_id: req.project_id,
      scan_id: req.scan_id,
      scanner: 'ai_task',
      target: prompt,
      status: 'pending'
    });
    if (fallbackErr) throw new Error(`Dispatch failed: ${fallbackErr.message}`);
  }

  console.log('✅ AI Task dispatched. Waiting for agent...');

  // 2. Poll for the result (Agent reports to vulnerabilities table)
  const startTime = Date.now();
  const timeout = 60000; 

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('🔍 Polling for AI result...');
    const { data: vResponse, error: vErr } = await supabase
      .from('vulnerabilities')
      .select('description, created_at')
      .eq('scan_id', req.scan_id)
      .eq('title', 'AI Security Response')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vErr) continue;

    if (vResponse && new Date(vResponse.created_at).getTime() > startTime - 5000) {
      console.log('🎯 AI Response received!');
      try {
        const jsonMatch = vResponse.description.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : vResponse.description;
        const parsed = JSON.parse(jsonStr);
        return {
          explanation: parsed.explanation || 'No explanation provided.',
          code: parsed.code || '',
          language: parsed.language || 'text'
        };
      } catch (e) {
        return {
          explanation: vResponse.description,
          code: '# Manual review required',
          language: 'text'
        };
      }
    }
  }

  throw new Error('AI processing timed out. Verify if the Sentinel Agent is polling.');
}
