import { supabase } from './supabase';
import { aiMock } from './agentTools';

export async function generateKillChain(projectName: string, vulns: any[]): Promise<any[]> {
  if (vulns.length === 0) return [];

  const payload = {
    action: 'generate_kill_chain',
    project: projectName,
    vulnerabilities: vulns.map(v => ({ title: v.title, severity: v.severity, asset: v.asset })),
  };

  try {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: payload
    });
    
    if (!error && data?.kill_chain && Array.isArray(data.kill_chain)) {
      return data.kill_chain;
    }
  } catch (err) {
    console.error('Failed to call real AI gateway for kill chain', err);
  }

  // Fallback to mock generation if real AI is unavailable
  await new Promise(r => setTimeout(r, 2000));
  
  // Sort by severity to find the entry point
  const criticals = vulns.filter(v => v.severity === 'critical');
  const highs = vulns.filter(v => v.severity === 'high');
  const mediums = vulns.filter(v => v.severity === 'medium');

  const chain = [];
  
  // 1. Reconnaissance
  const reconVuln = mediums[0] || vulns[0];
  chain.push({
    phase: 'Reconnaissance',
    tactic: 'TA0043',
    description: `Attacker discovers the asset footprint by scanning external IP ranges and identifies exposed services.`,
    exploited_vuln: reconVuln?.title || 'Exposed service enumeration',
    asset: reconVuln?.asset || 'External Perimeter'
  });

  // 2. Initial Access
  const initialVuln = criticals[0] || highs[0] || vulns[0];
  chain.push({
    phase: 'Initial Access',
    tactic: 'TA0001',
    description: `Exploitation of public-facing application. Attacker uses an automated exploit against the vulnerable endpoint to gain a foothold.`,
    exploited_vuln: initialVuln?.title || 'Remote Code Execution',
    asset: initialVuln?.asset || 'Web Server'
  });

  // 3. Execution & Persistence
  chain.push({
    phase: 'Execution & Persistence',
    tactic: 'TA0002 / TA0003',
    description: `Once inside, the attacker drops a web shell or reverse shell payload to maintain access. They manipulate system configurations to survive reboots.`,
    exploited_vuln: 'Weak OS configuration / Missing EDR',
    asset: 'Internal Network'
  });

  // 4. Exfiltration
  const dbVuln = vulns.find(v => v.title.toLowerCase().includes('sql') || v.title.toLowerCase().includes('database')) || initialVuln;
  chain.push({
    phase: 'Exfiltration',
    tactic: 'TA0010',
    description: `Attacker dumps sensitive database records and archives them before exfiltrating over an encrypted C2 channel.`,
    exploited_vuln: dbVuln?.title || 'Data exposure',
    asset: dbVuln?.asset || 'Database instance'
  });

  return chain;
}
