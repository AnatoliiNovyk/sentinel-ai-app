import { execFile } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);

const SUPABASE_URL    = process.env.SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON   = process.env.SUPABASE_ANON_KEY!;
const AGENT_SECRET    = process.env.AGENT_SECRET!;
const RESULT_ENDPOINT = `${SUPABASE_URL}/functions/v1/scan-result`;
const POLL_INTERVAL   = 10_000; // 10 seconds

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

console.log('🛡️  Sentinel Agent started. Polling for jobs...');

async function fetchPendingJob() {
  const { data, error } = await supabase
    .from('scan_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Claim the job atomically
  const { error: claimErr } = await supabase
    .from('scan_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), agent_id: 'agent-1' })
    .eq('id', data.id)
    .eq('status', 'pending'); // optimistic lock

  if (claimErr) return null;
  return data;
}

async function reportResult(jobId: string, scanId: string, userId: string, projectId: string, findings: unknown[], errorMsg?: string) {
  try {
    const resp = await fetch(RESULT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'X-Agent-Secret': AGENT_SECRET,
      },
      body: JSON.stringify({
        job_id: jobId,
        scan_id: scanId,
        user_id: userId,
        project_id: projectId,
        findings,
        error_message: errorMsg,
      }),
    });

    if (resp.ok) {
      console.log(`📤 scan-result OK [${resp.status}] — job ${jobId}`);
    } else {
      const body = await resp.text();
      console.error(`❌ scan-result ERROR [${resp.status}] — job ${jobId}: ${body}`);
    }
  } catch (err) {
    console.error(`❌ scan-result NETWORK ERROR — job ${jobId}:`, err instanceof Error ? err.message : String(err));
  }
}

// ─── nmap scanner ─────────────────────────────────────────────────────────────
async function runNmap(target: string): Promise<unknown[]> {
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm', '--network', 'host',
    'instrumentisto/nmap',
    '-sV', '-sC', '-T4', '--open',
    '-oX', '-',
    target,
  ], { timeout: 300_000 }); // 5 min timeout

  // Parse nmap XML output
  return parseNmapXml(stdout);
}

// ─── amass scanner ────────────────────────────────────────────────────────────
async function runAmass(target: string): Promise<unknown[]> {
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm',
    'caffix/amass',
    'enum', '-passive', '-d', target,
  ], { timeout: 180_000 });

  const subdomains = stdout.trim().split('\n').filter(Boolean);
  return subdomains.map(sub => ({
    title: `Subdomain discovered: ${sub}`,
    description: `Amass passive enumeration found subdomain at ${sub}`,
    severity: 'info',
    asset: sub,
    mitre_tactic: 'Reconnaissance',
    cis_control: 'CIS 1.1',
    remediation: 'Verify this subdomain is intentional and hardened.',
    remediation_type: 'manual',
  }));
}

// ─── tfsec scanner ────────────────────────────────────────────────────────────
async function runTfsec(repoPath: string): Promise<unknown[]> {
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm', '-v', `${repoPath}:/src`,
    'aquasec/tfsec', '/src', '--format', 'json',
  ], { timeout: 120_000 });

  interface TfsecResult {
    description?: string;
    rule_description?: string;
    rule_id?: string;
    severity?: string;
    location?: { filename?: string; start_line?: number };
    resolution?: string;
    resolution_url?: string;
  }
  const parsed = JSON.parse(stdout);
  return (parsed.results ?? []).map((r: TfsecResult) => ({
    title: r.description ?? 'IaC misconfiguration',
    description: `${r.rule_description ?? ''} (${r.rule_id ?? ''})`,
    severity: mapTfsecSeverity(r.severity ?? ''),
    asset: `${r.location?.filename ?? ''}:${r.location?.start_line ?? 0}`,
    mitre_tactic: 'Initial Access',
    cis_control: 'CIS 18.1',
    remediation: r.resolution ?? 'Fix the IaC misconfiguration.',
    remediation_type: 'terraform',
    remediation_code: r.resolution_url as string ?? '',
  }));
}

function mapTfsecSeverity(s: string): string {
  if (s === 'CRITICAL') return 'critical';
  if (s === 'HIGH') return 'high';
  if (s === 'MEDIUM') return 'medium';
  return 'low';
}

// ─── Nmap XML parser (simplified) ────────────────────────────────────────────
function parseNmapXml(xml: string): unknown[] {
  const findings: unknown[] = [];
  const portMatches = xml.matchAll(/<port protocol="(\w+)" portid="(\d+)"[\s\S]*?<state state="open"[\s\S]*?<service name="([^"]*)"[^>]*version="([^"]*)"/gm);
  for (const match of portMatches) {
    const [, proto, port, service, version] = match;
    findings.push({
      title: `Open port: ${port}/${proto} (${service})`,
      description: `Service ${service} version ${version} is exposed.`,
      severity: ['22', '3389', '23'].includes(port) ? 'high' : 'medium',
      asset: `target:${port}`,
      mitre_tactic: 'Discovery',
      cis_control: 'CIS 4.4',
      remediation: `Restrict access to port ${port} via firewall rules.`,
      remediation_type: 'bash',
      remediation_code: `ufw deny ${port}`,
    });
  }
  return findings;
}

// ─── Main dispatch ────────────────────────────────────────────────────────────
async function runJob(job: Record<string, string>) {
  console.log(`▶ Processing job ${job.id} [${job.scanner}] → ${job.target}`);
  try {
    let findings: unknown[] = [];

    switch (job.scanner) {
      case 'nmap':    findings = await runNmap(job.target);  break;
      case 'amass':   findings = await runAmass(job.target); break;
      case 'tfsec':   findings = await runTfsec(job.target); break;
      default:
        console.warn(`Unknown scanner: ${job.scanner}, using nmap fallback`);
        findings = await runNmap(job.target);
    }

    console.log(`✅ Job ${job.id} done — ${findings.length} findings`);
    await reportResult(job.id, job.scan_id, job.user_id, job.project_id, findings);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Job ${job.id} failed:`, msg);
    await reportResult(job.id, job.scan_id, job.user_id, job.project_id, [], msg);
  }
}

// ─── Poll loop ────────────────────────────────────────────────────────────────
let isRunning = false;

setInterval(async () => {
  if (isRunning) return; // don't overlap
  isRunning = true;
  try {
    const job = await fetchPendingJob();
    if (job) await runJob(job as Record<string, string>);
  } finally {
    isRunning = false;
  }
}, POLL_INTERVAL);
