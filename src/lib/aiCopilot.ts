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

  console.log('📡 Dispatching AI task to scan_jobs...');

  // 1. Create a job for the agent (WITHOUT .select() to avoid 403)
  const { error: jobErr } = await supabase
    .from('scan_jobs')
    .insert({
      user_id: user.id,
      project_id: req.project_id,
      scan_id: req.scan_id,
      scanner: 'ai_task',
      target: prompt,
      status: 'pending'
    });

  if (jobErr) {
    console.error('❌ Supabase RLS/Insert Error:', jobErr);
    throw new Error(`Permission denied: ${jobErr.message}`);
  }

  console.log('✅ Job queued. Waiting for agent result...');

  // 2. Poll for the result in 'vulnerabilities' table (the agent will create a new entry with the response)
  const startTime = Date.now();
  const timeout = 60000; 

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('🔍 Checking for AI response in vulnerabilities...');
    const { data: vResponse, error: vErr } = await supabase
      .from('vulnerabilities')
      .select('description, created_at')
      .eq('scan_id', req.scan_id)
      .eq('title', 'AI Security Response')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vErr) {
      console.warn('⚠️ Error polling vulnerabilities:', vErr.message);
      continue;
    }

    // Check if we found a response and it's fresh
    if (vResponse && new Date(vResponse.created_at).getTime() > startTime - 2000) {
      console.log('🎯 Found AI response!');
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

  throw new Error('AI processing timed out. Please check if the Sentinel Agent is running.');
}
