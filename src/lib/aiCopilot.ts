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

/**
 * Dispatches an AI task and polls for the result.
 * This uses the scan-dispatch Edge Function to bypass RLS restrictions.
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
      "explanation": "Brief clear explanation of why this is a risk and how to fix it",
      "code": "The exact code/command to fix it",
      "language": "bash/hcl/json/etc"
    }
  `;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be logged in to use AI Assistant');

  console.log('📡 [AI] Dispatching task via RPC...');

  // 1. Try calling the RPC function (most reliable)
  const { data: jobId, error: rpcErr } = await supabase.rpc('dispatch_ai_task', {
    p_scan_id: req.scan_id,
    p_project_id: req.project_id,
    p_target: prompt
  });

  if (rpcErr) {
    console.warn('⚠️ [AI] RPC failed, falling back to Edge Function:', rpcErr.message);
    
    // 2. Fallback to Edge Function
    const { data: dispatchRes, error: dispatchErr } = await supabase.functions.invoke('scan-dispatch', {
      body: {
        project_id: req.project_id,
        scan_id: req.scan_id,
        scanner: 'ai_task',
        target: prompt
      }
    });

    if (dispatchErr) {
      console.error('❌ [AI] Both RPC and Edge Function failed:', dispatchErr);
      throw new Error('System could not queue your AI request. Please check if the database RPC is installed.');
    }
  }

  console.log('✅ [AI] Task queued successfully. Starting result poll...');

  // 2. Poll for the result in 'vulnerabilities' table
  // The agent will report the result as a new vulnerability entry with a specific title
  const startTime = Date.now();
  const timeout = 90000; // 90 seconds (AI on CPU can be slow)
  const pollInterval = 3000;

  while (Date.now() - startTime < timeout) {
    await new Promise(r => setTimeout(r, pollInterval));
    
    console.log('🔍 [AI] Checking for results...');
    const { data: results, error: vErr } = await supabase
      .from('vulnerabilities')
      .select('description, created_at')
      .eq('scan_id', req.scan_id)
      .eq('title', 'AI Security Response')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (vErr) {
      console.warn('⚠️ [AI] Polling error (skipping):', vErr.message);
      continue;
    }

    // Verify if this is a NEW result created after we started polling
    if (results && new Date(results.created_at).getTime() > startTime - 5000) {
      console.log('🎯 [AI] Result found!');
      try {
        // Find JSON block in the description
        const jsonMatch = results.description.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : results.description;
        const parsed = JSON.parse(jsonStr);
        
        return {
          explanation: parsed.explanation || 'See description below.',
          code: parsed.code || '# Check explanation for details',
          language: parsed.language || 'text'
        };
      } catch (e) {
        // Fallback if not valid JSON
        return {
          explanation: results.description,
          code: '# Manual review required',
          language: 'text'
        };
      }
    }
  }

  throw new Error('AI processing timed out. The agent is taking too long to respond.');
}
