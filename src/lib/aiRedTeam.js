import { supabase } from './supabase';
export async function generateKillChain(projectName, vulns) {
    if (vulns.length === 0)
        return [];
    const prompt = `
    Context: You are a Red Team AI.
    Project: ${projectName}
    Vulnerabilities: ${JSON.stringify(vulns.map(v => ({ title: v.title, severity: v.severity, asset: v.asset })))}
    
    Task: Generate a realistic attack kill chain in 4 phases (Recon, Initial Access, Execution, Exfiltration).
    Format your response EXACTLY as a JSON array:
    [
      { "phase": "Recon", "tactic": "TA...", "description": "...", "exploited_vuln": "...", "asset": "..." },
      ...
    ]
  `;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        return [];
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
    if (jobErr || !job)
        return [];
    // 2. Poll for the result
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const { data: updatedJob } = await supabase
            .from('scan_jobs')
            .select('status')
            .eq('id', job.id)
            .single();
        if (updatedJob?.status === 'completed') {
            const { data: vuln } = await supabase
                .from('vulnerabilities')
                .select('description')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (vuln) {
                try {
                    return JSON.parse(vuln.description);
                }
                catch (e) {
                    console.error('Failed to parse AI kill chain JSON', e);
                }
            }
        }
    }
    return []; // Fallback empty
}
