import * as dotenv from 'dotenv';
dotenv.config();
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

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

const NMAP_PROFILES: Record<string, string[]> = {
  stealth: ['-sS', '-T2', '-f'],
  default: ['-sV', '-sC', '-T4'],
  intense: ['-p-', '-sV', '-O', '-A', '-T4'],
  vuln:    ['-sV', '--script', 'vuln,exploit,auth', '-T4']
};

// ─── nmap scanner ─────────────────────────────────────────────────────────────
async function runNmap(target: string, profile: string = 'default'): Promise<unknown[]> {
  const args = NMAP_PROFILES[profile] || NMAP_PROFILES.default;
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm', '--network', 'host',
    'instrumentisto/nmap',
    ...args, '--open',
    '-oX', '-',
    target,
  ], { timeout: 600_000 }); // 10 min timeout for deep scans

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

// ─── trivy scanner ────────────────────────────────────────────────────────────
async function runTrivy(target: string): Promise<unknown[]> {
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm',
    'aquasec/trivy', 'image', '--format', 'json', target,
  ], { timeout: 300_000 });
  const parsed = JSON.parse(stdout || '{}');
  const findings: unknown[] = [];
  for (const res of (parsed.Results || [])) {
    for (const v of (res.Vulnerabilities || [])) {
      findings.push({
        title: v.Title || v.VulnerabilityID,
        description: v.Description || 'Trivy container vulnerability',
        severity: mapTfsecSeverity(v.Severity),
        cve_id: v.VulnerabilityID,
        asset: target,
        mitre_tactic: 'Initial Access',
        remediation: v.FixedVersion ? `Update to ${v.FixedVersion}` : 'No fix available.',
        remediation_type: 'manual',
      });
    }
  }
  return findings;
}

// ─── checkov scanner ──────────────────────────────────────────────────────────
async function runCheckov(repoPath: string): Promise<unknown[]> {
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm', '-v', `${repoPath}:/src`,
    'bridgecrew/checkov', '-d', '/src', '-o', 'json',
  ], { timeout: 180_000 });
  const parsed = JSON.parse(stdout || '{}');
  const findings: unknown[] = [];
  const results = parsed.results?.failed_checks || [];
  for (const r of results) {
    findings.push({
      title: r.check_name,
      description: r.check_id,
      severity: 'high',
      asset: `${r.file_path}:${r.file_line_range?.[0] || 0}`,
      remediation: 'Review Checkov guidelines.',
      remediation_type: 'terraform',
    });
  }
  return findings;
}

// ─── nuclei scanner ───────────────────────────────────────────────────────────
async function runNuclei(target: string): Promise<unknown[]> {
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm',
    'projectdiscovery/nuclei', '-u', target, '-jsonl', '-disable-update-check'
  ], { timeout: 300_000 });
  
  const findings: unknown[] = [];
  const lines = stdout.trim().split('\\n').filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      findings.push({
        title: parsed.info?.name || 'Nuclei finding',
        description: parsed.info?.description || '',
        severity: parsed.info?.severity || 'medium',
        asset: parsed.matched_at || target,
        remediation: parsed.info?.remediation || 'Investigate nuclei finding.',
        remediation_type: 'manual',
      });
    } catch(e) {}
  }
  return findings;
}

// ─── mobsf scanner ────────────────────────────────────────────────────────────
async function runMobsf(apkUrl: string): Promise<unknown[]> {
  console.log(`Downloading APK from ${apkUrl}...`);
  try {
    // 1. Download the file
    const targetFile = `/tmp/mobsf_target_${Date.now()}.apk`;
    await execAsync(`curl -sL -o ${targetFile} "${apkUrl}"`);
    
    // 2. Upload to MobSF
    console.log('Uploading to MobSF...');
    const { stdout: uploadOut } = await execAsync(`curl -s -F "file=@${targetFile}" http://localhost:8000/api/v1/upload -H "Authorization: sentinel_mobsf_key"`);
    const uploadRes = JSON.parse(uploadOut);
    const hash = uploadRes.hash;
    
    // 3. Trigger Scan
    console.log('Scanning in MobSF (this may take a few minutes)...');
    await execAsync(`curl -s -X POST --url http://localhost:8000/api/v1/scan --data "hash=${hash}" -H "Authorization: sentinel_mobsf_key"`);
    
    // 4. Get JSON Report
    console.log('Fetching MobSF report...');
    const { stdout: reportOut } = await execAsync(`curl -s -X POST --url http://localhost:8000/api/v1/report_json --data "hash=${hash}" -H "Authorization: sentinel_mobsf_key"`);
    const report = JSON.parse(reportOut);
    
    // Cleanup
    await execAsync(`rm -f ${targetFile}`);
    
    // Parse findings
    const findings: unknown[] = [];
    
    // Map Manifest findings
    if (report.manifest_analysis) {
      for (const item of report.manifest_analysis.manifest_summary || []) {
        if (item.severity === 'high' || item.severity === 'warning') {
          findings.push({
            title: item.title || 'Manifest Configuration Issue',
            description: item.description || item.stat,
            severity: item.severity === 'high' ? 'high' : 'medium',
            asset: 'AndroidManifest.xml',
            mitre_tactic: 'Defense Evasion',
            remediation: 'Review and secure manifest configuration.',
            remediation_type: 'manual',
          });
        }
      }
    }
    
    // Map Code analysis findings
    if (report.code_analysis) {
      for (const [key, issue] of Object.entries(report.code_analysis)) {
        const i = issue as any;
        if (i.metadata && i.metadata.severity !== 'info') {
          findings.push({
            title: i.metadata.masvs || key,
            description: i.metadata.description,
            severity: i.metadata.severity,
            asset: 'Source Code / Smali',
            mitre_tactic: 'Execution',
            remediation: 'Review the flagged code segments and implement secure Android/iOS coding practices.',
            remediation_type: 'manual',
          });
        }
      }
    }
    
    return findings.length > 0 ? findings : [
      {
        title: 'MobSF Scan Completed',
        description: 'The scan finished, but no high/medium vulnerabilities were extracted. Check full report in MobSF UI.',
        severity: 'info',
        asset: 'APK',
        mitre_tactic: 'None',
        remediation: 'None',
        remediation_type: 'manual',
      }
    ];

  } catch (err) {
    console.error('MobSF scan failed:', err);
    return [];
  }
}

// ─── local ollama ai ─────────────────────────────────────────────────────────
async function runOllama(prompt: string): Promise<string> {
  console.log('🤖 Calling local Ollama (llama3)...');
  try {
    const resp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        model: 'llama3',
        prompt: prompt,
        stream: false
      })
    });
    if (!resp.ok) throw new Error(`Ollama HTTP Error: ${resp.status}`);
    const data = await resp.json() as any;
    console.log('✅ Ollama responded successfully.');
    return data.response;
  } catch (err) {
    console.error('❌ Ollama connection failed. Is it running?', err instanceof Error ? err.message : String(err));
    return 'AI Error: Local Ollama instance is unreachable or failed to respond.';
  }
}

// ─── Nmap XML parser (simplified) ────────────────────────────────────────────
function parseNmapXml(xml: string): unknown[] {
  const findings: unknown[] = [];
  
  // 1. Parse Open Ports and Services
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

  // 2. Parse NSE Script Results (Vulnerabilities)
  const scriptMatches = xml.matchAll(/<script id="([^"]+)" output="([\s\S]+?)"/gm);
  for (const match of scriptMatches) {
    const [, id, output] = match;
    // Basic logic to determine severity based on keywords in script output
    let severity = 'info';
    if (output.toLowerCase().includes('vulnerable') || output.toLowerCase().includes('exploit')) {
      severity = 'critical';
    } else if (output.toLowerCase().includes('warning') || output.toLowerCase().includes('vulnerability')) {
      severity = 'high';
    }

    findings.push({
      title: `NSE Script: ${id}`,
      description: output.trim(),
      severity: severity,
      asset: 'Network Service',
      mitre_tactic: 'Exploitation',
      cis_control: 'CIS 7.1',
      remediation: 'Review NSE script output and apply recommended security patches.',
      remediation_type: 'manual',
    });
  }

  return findings;
}

// ─── Main dispatch ────────────────────────────────────────────────────────────
async function runJob(job: Record<string, string>) {
  console.log(`▶ Processing job ${job.id} [${job.scanner}] → ${job.target}`);
  try {
    let findings: unknown[] = [];

    const [scannerName, profile] = job.scanner.split(':');

    switch (scannerName) {
      case 'ai_task': {
        const prompt = job.target || (job.options as any)?.prompt || 'No prompt provided';
        const response = await runOllama(prompt);
        findings = [{ 
          title: 'AI Security Response', 
          description: response, 
          severity: 'info', 
          asset: 'AI Engine',
          mitre_tactic: 'Analysis' 
        }];
        break;
      }
      case 'nmap':           findings = await runNmap(job.target, profile);  break;
      case 'amass':          findings = await runAmass(job.target); break;
      case 'tfsec':          findings = await runTfsec(job.target); break;
      case 'trivy':          findings = await runTrivy(job.target); break;
      case 'checkov':        findings = await runCheckov(job.target); break;
      case 'nuclei':         findings = await runNuclei(job.target); break;
      case 'mobsf':          findings = await runMobsf(job.target); break;
      case 'kube-bench':     /* stub for kube-bench */ break;
      case 'gcp-scc':        /* stub for gcp-scc */ break;
      case 'azure-defender': /* stub for azure-defender */ break;
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
