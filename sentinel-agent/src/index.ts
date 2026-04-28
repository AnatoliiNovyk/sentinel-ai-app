import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';
dotenv.config();

const execFileAsync = promisify(execFile);

const SUPABASE_URL    = process.env.SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AGENT_SECRET    = process.env.AGENT_SECRET!;
const BASE_POLL_INTERVAL_MS = 3_000;
const MAX_POLL_INTERVAL_MS = 30_000;
const REPORT_MAX_ATTEMPTS = 4;
const REPORT_BASE_DELAY_MS = 1_000;
const STALE_RUNNING_JOB_TIMEOUT_MINUTES = parseInt(process.env.STALE_RUNNING_JOB_TIMEOUT_MINUTES ?? '180', 10);
const STALE_WATCHDOG_INTERVAL_MS = parseInt(process.env.STALE_WATCHDOG_INTERVAL_MS ?? '60000', 10);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------
type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: CBState = 'CLOSED';
  private failureCount = 0;
  private readonly failureThreshold: number;
  private readonly recoveryMs: number;
  private nextAttemptAt = 0;
  readonly name: string;

  constructor(name: string, failureThreshold = 5, recoveryMs = 30_000) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.recoveryMs = recoveryMs;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this.state === 'OPEN') {
      if (now < this.nextAttemptAt) {
        throw new Error(`[CircuitBreaker:${this.name}] OPEN — retry after ${Math.ceil((this.nextAttemptAt - now) / 1000)}s`);
      }
      this.state = 'HALF_OPEN';
      console.log(`[CircuitBreaker:${this.name}] HALF_OPEN — probing...`);
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        console.log(`[CircuitBreaker:${this.name}] CLOSED — recovered`);
      }
      return result;
    } catch (err) {
      this.failureCount++;
      if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.nextAttemptAt = Date.now() + this.recoveryMs;
        console.error(`[CircuitBreaker:${this.name}] OPEN — ${this.failureCount} failures, recovery in ${this.recoveryMs / 1000}s`);
      }
      throw err;
    }
  }

  isOpen(): boolean {
    return this.state === 'OPEN' && Date.now() < this.nextAttemptAt;
  }
}

const reportCB  = new CircuitBreaker('scan-result', 5, 30_000);
const ollamaCB  = new CircuitBreaker('ollama', 3, 60_000);
// ---------------------------------------------------------------------------

type Finding = {
  title: string;
  description: string;
  severity: string;
  asset: string;
  remediation?: string;
  remediation_type?: string;
  status?: string;
};

type ScanJob = {
  id: string;
  scanner: string;
  target: string;
  scan_id: string | null;
  user_id: string;
  project_id: string;
  metadata: Record<string, unknown>;
};

type ReportResultOutcome = {
  ok: boolean;
  durationMs: number;
  attempts: number;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(ms: number, ratio = 0.2): number {
  const delta = ms * ratio;
  const jittered = ms + (Math.random() * 2 - 1) * delta;
  return Math.max(500, Math.round(jittered));
}

function isTransientReportError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;

  const status = err.response?.status;
  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return true;
  }

  const code = err.code;
  return code === 'ECONNABORTED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EAI_AGAIN';
}

console.log('🛡️ Sentinel AI Agent v2.3 starting...');

// --- Ollama Integration ---
async function consultOllama(prompt: string): Promise<string> {
  return ollamaCB.call(async () => {
    console.log('🤖 Sending prompt to Ollama (llama3.1:8b)...');
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.1:8b', // Updated to match user's installed model
      prompt: prompt,
      stream: false,
    }, { timeout: 120000 }); // 2 minute timeout for slow CPUs
    return response.data.response as string;
  }).catch((err: unknown) => {
    const message = getErrorMessage(err);
    console.error('❌ Ollama Error:', message);
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ECONNREFUSED') {
      return 'Error: Ollama is not running on localhost:11434';
    }
    return `Error consulting AI: ${message}`;
  });
}

// --- Scanner Tools ---

/**
 * Sanitizes nmap target: only allow IPs, CIDR ranges, and hostnames.
 * Rejects anything with shell metacharacters to prevent command injection.
 */
function sanitizeTarget(target: string): string {
  const trimmed = target.trim();
  // Allow: IPv4, IPv6, CIDR, hostnames (letters/digits/dots/hyphens), optionally with port range
  if (!/^[a-zA-Z0-9.\-:/[\]]+$/.test(trimmed)) {
    throw new Error(`Invalid scan target: "${trimmed}"`);
  }
  return trimmed;
}

// Maps nmap service name / port to a severity level
function portSeverity(port: number, service: string): Finding['severity'] {
  const critical = [21, 23, 69, 512, 513, 514]; // ftp, telnet, tftp, rexec, rlogin, rsh
  const high = [22, 25, 110, 143, 445, 3389, 5900]; // ssh, smtp, pop3, imap, smb, rdp, vnc
  const medium = [80, 8080, 8443, 3306, 5432, 6379, 27017]; // http, mysql, pg, redis, mongo
  if (critical.includes(port)) return 'critical';
  if (high.includes(port)) return 'high';
  if (medium.includes(port)) return 'medium';
  if (service === 'unknown' || service === '') return 'low';
  return 'info';
}

/**
 * Parses nmap XML output into a list of NmapPort objects.
 * Uses regex-based extraction — no external XML parser needed.
 */
function parseNmapXml(xml: string, target: string): Finding[] {
  const findings: Finding[] = [];

  // Extract all <port> blocks
  const portBlockRe = /<port\s+protocol="([^"]+)"\s+portid="([^"]+)">([\s\S]*?)<\/port>/g;
  let portMatch: RegExpExecArray | null;

  while ((portMatch = portBlockRe.exec(xml)) !== null) {
    const protocol  = portMatch[1];
    const portId    = portMatch[2];
    const portBlock = portMatch[3];

    // Only report open ports
    const stateMatch = /<state\s+state="([^"]+)"/.exec(portBlock);
    if (!stateMatch || stateMatch[1] !== 'open') continue;

    const serviceMatch = /<service\s+([^>]*)>/.exec(portBlock);
    const attrs = serviceMatch ? serviceMatch[1] : '';
    const getAttr = (name: string) => {
      const m = new RegExp(`${name}="([^"]*?)"`).exec(attrs);
      return m ? m[1] : '';
    };

    const service = getAttr('name');
    const product = getAttr('product');
    const version = getAttr('version');
    const extraInfo = getAttr('extrainfo');

    const portNum = parseInt(portId, 10);
    const severity = portSeverity(portNum, service);

    const serviceLabel = [product, version, extraInfo].filter(Boolean).join(' ') || service || 'unknown';
    const descParts = [
      `Open ${protocol.toUpperCase()} port ${portId} (${service || 'unknown'}) on ${target}.`,
      serviceLabel !== (service || 'unknown') ? `Service: ${serviceLabel}.` : '',
    ].filter(Boolean);

    findings.push({
      title: `Open port ${portId}/${protocol} — ${service || 'unknown'}`,
      description: descParts.join(' '),
      severity,
      asset: target,
      remediation: severity === 'critical' || severity === 'high'
        ? `Restrict access to port ${portId}. Apply firewall rules, use VPN, or disable the service if not needed.`
        : `Review whether port ${portId} should be publicly accessible.`,
      remediation_type: 'configuration',
      status: 'open',
    });
  }

  // If nmap ran but found no open ports, report as informational
  if (findings.length === 0) {
    findings.push({
      title: 'No open ports detected',
      description: `Nmap scan of ${target} completed. No open ports were found in the scanned range.`,
      severity: 'info',
      asset: target,
      status: 'open',
    });
  }

  return findings;
}

const NMAP_TIMEOUT_MS   = 5 * 60 * 1000; // 5 minutes
const NUCLEI_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes

async function runNmap(target: string): Promise<Finding[]> {
  const safeTarget = sanitizeTarget(target);
  console.log(`📡 Running nmap on ${safeTarget}...`);

  try {
    // -sV: version detection, -T4: aggressive timing, -oX -: XML to stdout
    // --open: only open ports, top 1000 ports (default)
    const { stdout, stderr } = await execFileAsync(
      'nmap',
      ['-sV', '-T4', '--open', '-oX', '-', safeTarget],
      { timeout: NMAP_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );

    if (stderr && !stdout) {
      throw new Error(`nmap stderr: ${stderr.slice(0, 500)}`);
    }

    const findings = parseNmapXml(stdout, safeTarget);
    console.log(`✅ nmap found ${findings.length} finding(s) on ${safeTarget}`);
    return findings;
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    // ENOENT = nmap not installed on VPS
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      throw new Error('nmap is not installed. Run: apt-get install -y nmap');
    }
    throw new Error(`nmap failed: ${message}`);
  }
}

// Maps nuclei severity string to Finding severity
function nucleiSeverityMap(raw: string): Finding['severity'] {
  switch (raw.toLowerCase()) {
    case 'critical': return 'critical';
    case 'high':     return 'high';
    case 'medium':   return 'medium';
    case 'low':      return 'low';
    default:         return 'info';
  }
}

/**
 * Parses nuclei JSONL output (one JSON object per line).
 * Each line is a nuclei finding with id, info.name, info.severity, matched-at, etc.
 */
function parseNucleiOutput(output: string, target: string): Finding[] {
  const findings: Finding[] = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;

    try {
      const entry = JSON.parse(trimmed) as {
        'template-id'?: string;
        info?: { name?: string; severity?: string; description?: string; reference?: string[] };
        'matched-at'?: string;
        host?: string;
        type?: string;
      };

      const name        = entry.info?.name        ?? entry['template-id'] ?? 'Unknown finding';
      const severity    = nucleiSeverityMap(entry.info?.severity ?? 'info');
      const description = entry.info?.description ?? `Nuclei template matched on ${entry['matched-at'] ?? target}`;
      const matchedAt   = entry['matched-at'] ?? target;
      const reference   = entry.info?.reference?.[0];

      findings.push({
        title: name,
        description: `${description}\nMatched at: ${matchedAt}`,
        severity,
        asset: target,
        remediation: reference
          ? `See: ${reference}`
          : 'Review and patch the identified vulnerability based on template guidance.',
        remediation_type: 'patch',
        status: 'open',
      });
    } catch {
      // skip malformed lines
    }
  }

  if (findings.length === 0) {
    findings.push({
      title: 'No vulnerabilities detected by Nuclei',
      description: `Nuclei scan of ${target} completed. No template matches found.`,
      severity: 'info',
      asset: target,
      status: 'open',
    });
  }

  return findings;
}

async function runNuclei(target: string): Promise<Finding[]> {
  const safeTarget = sanitizeTarget(target);
  console.log(`🔬 Running nuclei on ${safeTarget}...`);

  try {
    // -u: target URL/host, -j: JSONL output, -silent: no banner
    // -severity: critical,high,medium,low — skip info to reduce noise
    // -nc: no colour, -timeout 10: per-request timeout
    const { stdout, stderr } = await execFileAsync(
      'nuclei',
      ['-u', safeTarget, '-j', '-silent', '-nc', '-severity', 'critical,high,medium,low', '-timeout', '10'],
      { timeout: NUCLEI_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }
    );

    if (stderr && !stdout) {
      throw new Error(`nuclei stderr: ${stderr.slice(0, 500)}`);
    }

    const findings = parseNucleiOutput(stdout, safeTarget);
    console.log(`✅ nuclei found ${findings.length} finding(s) on ${safeTarget}`);
    return findings;
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      throw new Error('nuclei is not installed. Run: apt-get install -y nuclei or install from https://github.com/projectdiscovery/nuclei');
    }
    throw new Error(`nuclei failed: ${message}`);
  }
}

// --- Agent Logging ---
async function writeLog(
  jobId: string,
  scanId: string | null,
  projectId: string,
  level: 'info' | 'success' | 'error' | 'warn',
  message: string
): Promise<void> {
  try {
    await supabase.from('agent_logs').insert({
      job_id: jobId,
      scan_id: scanId,
      project_id: projectId,
      level,
      message,
    });
  } catch {
    // fire-and-forget — logging must never crash the agent
  }
}

// --- Job Processing ---
async function reportResult(
  jobId: string,
  scanId: string | null,
  userId: string,
  projectId: string,
  findings: Finding[],
  metadata: Record<string, unknown>,
  error?: string
) : Promise<ReportResultOutcome> {
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= REPORT_MAX_ATTEMPTS; attempt++) {
    metrics.reportAttemptsTotal++;
    try {
      const res = await reportCB.call(() =>
        axios.post(`${SUPABASE_URL}/functions/v1/scan-result`, {
          job_id: jobId,
          scan_id: scanId,
          user_id: userId,
          project_id: projectId,
          findings,
          metadata,
          error_message: error
        }, {
          headers: {
            'X-Agent-Secret': AGENT_SECRET,
            'Authorization': `Bearer ${SERVICE_KEY}`
          },
          timeout: 15_000,
        })
      );

      console.log(`✅ Reported results for job ${jobId}. Status: ${res.status}. Attempt ${attempt}/${REPORT_MAX_ATTEMPTS}`);
      metrics.reportSuccessTotal++;
      return {
        ok: true,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };
    } catch (err: unknown) {
      const transient = isTransientReportError(err);
      const hasRetriesLeft = attempt < REPORT_MAX_ATTEMPTS;
      const errMsg = getErrorMessage(err);

      if (transient && hasRetriesLeft) {
        metrics.reportRetriesTotal++;
        const delayMs = REPORT_BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(`⚠️ Report attempt ${attempt}/${REPORT_MAX_ATTEMPTS} failed for job ${jobId}: ${errMsg}. Retrying in ${delayMs}ms`);
        await writeLog(jobId, scanId, projectId, 'warn', `Report delivery transient failure (attempt ${attempt}/${REPORT_MAX_ATTEMPTS}); retry in ${delayMs}ms`);
        await sleep(delayMs);
        continue;
      }

      console.error(`❌ Failed to report results for job ${jobId} after ${attempt}/${REPORT_MAX_ATTEMPTS} attempt(s): ${errMsg}`);
      metrics.reportFailuresTotal++;
      await writeLog(jobId, scanId, projectId, 'error', `Report delivery failed after ${attempt}/${REPORT_MAX_ATTEMPTS} attempt(s): ${errMsg}`);
      return {
        ok: false,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };
    }
  }

  metrics.reportFailuresTotal++;
  return {
    ok: false,
    durationMs: Date.now() - startedAt,
    attempts: REPORT_MAX_ATTEMPTS,
  };
}

async function fetchPendingJob(): Promise<ScanJob | null> {
  const startedAt = Date.now();
  const { data, error } = await supabase.rpc('claim_next_job');
  recordDurationMetric('claimDurationMsLast', 'claimDurationMsSum', 'claimDurationMsSamples', Date.now() - startedAt);

  if (error) {
    metrics.jobClaimErrorsTotal++;
    throw new Error(`claim_next_job failed: ${error.message}`);
  }
  return data && data.length > 0 ? (data[0] as ScanJob) : null;
}

async function recoverStaleRunningJobs(): Promise<{ jobsRecovered: number; scansRecovered: number }> {
  const cutoffIso = new Date(Date.now() - STALE_RUNNING_JOB_TIMEOUT_MINUTES * 60 * 1000).toISOString();

  const { data: staleJobs, error: staleErr } = await supabase
    .from('scan_jobs')
    .select('id, scan_id')
    .eq('status', 'running')
    .lt('started_at', cutoffIso);

  if (staleErr) {
    throw new Error(`watchdog query failed: ${staleErr.message}`);
  }

  if (!staleJobs || staleJobs.length === 0) {
    return { jobsRecovered: 0, scansRecovered: 0 };
  }

  const staleJobIds = staleJobs.map((j) => j.id);
  const nowIso = new Date().toISOString();

  const { data: updatedJobs, error: updateJobsErr } = await supabase
    .from('scan_jobs')
    .update({
      status: 'error',
      error_message: `stale timeout auto-fail (${STALE_RUNNING_JOB_TIMEOUT_MINUTES}m)`,
      completed_at: nowIso,
    })
    .in('id', staleJobIds)
    .eq('status', 'running')
    .select('id, scan_id');

  if (updateJobsErr) {
    throw new Error(`watchdog update jobs failed: ${updateJobsErr.message}`);
  }

  const recoveredJobRows = updatedJobs ?? [];
  const candidateScanIds = [...new Set(recoveredJobRows.map((j) => j.scan_id).filter(Boolean))] as string[];

  let scansRecovered = 0;
  for (const scanId of candidateScanIds) {
    const { count, error: runningCountErr } = await supabase
      .from('scan_jobs')
      .select('id', { head: true, count: 'exact' })
      .eq('scan_id', scanId)
      .eq('status', 'running');

    if (runningCountErr) {
      throw new Error(`watchdog count failed for scan ${scanId}: ${runningCountErr.message}`);
    }

    if ((count ?? 0) === 0) {
      const { data: updatedScan, error: updateScanErr } = await supabase
        .from('scans')
        .update({ status: 'failed', completed_at: nowIso })
        .eq('id', scanId)
        .eq('status', 'running')
        .select('id');

      if (updateScanErr) {
        throw new Error(`watchdog update scan failed for ${scanId}: ${updateScanErr.message}`);
      }

      if (updatedScan && updatedScan.length > 0) {
        scansRecovered++;
      }
    }
  }

  return { jobsRecovered: recoveredJobRows.length, scansRecovered };
}

async function runJob(job: ScanJob) {
  const jobStartedAt = Date.now();
  console.log(`▶️ Executing ${job.scanner} task for job ${job.id}...`);
  await writeLog(job.id, job.scan_id, job.project_id, 'info', `▶️ Starting ${job.scanner} scan on ${job.target}`);
  try {
    const executionStartedAt = Date.now();
    let findings: Finding[] = [];
    
    if (job.scanner === 'ai_task' || job.scanner === 'ai-agent') {
      await writeLog(job.id, job.scan_id, job.project_id, 'info', '🤖 Consulting Ollama AI model...');
      const aiResponse = await consultOllama(job.target);
      findings = [{
        title: 'AI Security Response',
        description: aiResponse,
        severity: 'info',
        asset: 'AI Engine',
        remediation: 'Review AI suggestions',
        remediation_type: 'manual',
        status: 'open'
      }];
    } else if (job.scanner === 'nuclei' || job.scanner === 'nuclei-scan') {
      await writeLog(job.id, job.scan_id, job.project_id, 'info', `🔬 Running Nuclei template scan on ${job.target}...`);
      findings = await runNuclei(job.target);
    } else {
      await writeLog(job.id, job.scan_id, job.project_id, 'info', `📡 Running Nmap port scan on ${job.target}...`);
      findings = await runNmap(job.target);
    }

    const realFindings = findings.filter(f => f.severity !== 'info' || !f.title.toLowerCase().includes('no '));
    recordDurationMetric('executeDurationMsLast', 'executeDurationMsSum', 'executeDurationMsSamples', Date.now() - executionStartedAt);

    await writeLog(
      job.id, job.scan_id, job.project_id, 'success',
      `✅ Scan complete — ${realFindings.length} finding(s) found (${findings.length} total)`
    );

    const reportOutcome = await reportResult(job.id, job.scan_id, job.user_id, job.project_id, findings, job.metadata);
    recordDurationMetric('reportDurationMsLast', 'reportDurationMsSum', 'reportDurationMsSamples', reportOutcome.durationMs);

    if (reportOutcome.ok) {
      await writeLog(job.id, job.scan_id, job.project_id, 'success', '📤 Results reported to Sentinel AI');
    } else {
      await writeLog(job.id, job.scan_id, job.project_id, 'error', '📤 Result reporting failed after retries');
    }

    await sendWebhookAlert(job.project_id, job.target, findings);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error(`❌ Job ${job.id} crashed:`, message);
    await writeLog(job.id, job.scan_id, job.project_id, 'error', `❌ Scan failed: ${message}`);

    const failureReportOutcome = await reportResult(job.id, job.scan_id, job.user_id, job.project_id, [], job.metadata, message);
    recordDurationMetric('reportDurationMsLast', 'reportDurationMsSum', 'reportDurationMsSamples', failureReportOutcome.durationMs);

    if (!failureReportOutcome.ok) {
      await writeLog(job.id, job.scan_id, job.project_id, 'error', '❌ Failed to deliver scan failure payload after retries');
    }
  } finally {
    recordDurationMetric('endToEndDurationMsLast', 'endToEndDurationMsSum', 'endToEndDurationMsSamples', Date.now() - jobStartedAt);
  }
}

// ---------------------------------------------------------------------------
// Webhook alerting — fires when critical/high findings detected
// ---------------------------------------------------------------------------
async function sendWebhookAlert(
  projectId: string,
  target: string,
  findings: Finding[]
): Promise<void> {
  const criticals = findings.filter(f => f.severity === 'critical' || f.severity === 'high');
  if (criticals.length === 0) return;

  try {
    const { data: project } = await supabase
      .from('projects')
      .select('webhook_url, name')
      .eq('id', projectId)
      .maybeSingle();

    const webhookUrl = project?.webhook_url as string | null;
    if (!webhookUrl) return;

    const payload = {
      event: 'critical_findings',
      project_id: projectId,
      project_name: project?.name ?? projectId,
      target,
      findings_count: criticals.length,
      findings: criticals.map(f => ({ title: f.title, severity: f.severity, asset: f.asset })),
      timestamp: new Date().toISOString(),
    };

    await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    });
    console.log(`📣 Webhook alert sent to ${webhookUrl} (${criticals.length} critical/high findings)`);
  } catch (err: unknown) {
    console.warn(`⚠️ Webhook alert failed: ${getErrorMessage(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Health state (updated by main loop)
// ---------------------------------------------------------------------------
const health = {
  status: 'starting' as 'starting' | 'ok' | 'error',
  startedAt: new Date().toISOString(),
  jobsProcessed: 0,
  jobsFailed: 0,
  lastJobAt: null as string | null,
  lastError: null as string | null,
};

const metrics = {
  reportAttemptsTotal: 0,
  reportRetriesTotal: 0,
  reportSuccessTotal: 0,
  reportFailuresTotal: 0,
  jobClaimErrorsTotal: 0,
  staleJobsRecoveredTotal: 0,
  staleScansRecoveredTotal: 0,
  claimDurationMsLast: 0,
  claimDurationMsSum: 0,
  claimDurationMsSamples: 0,
  executeDurationMsLast: 0,
  executeDurationMsSum: 0,
  executeDurationMsSamples: 0,
  reportDurationMsLast: 0,
  reportDurationMsSum: 0,
  reportDurationMsSamples: 0,
  endToEndDurationMsLast: 0,
  endToEndDurationMsSum: 0,
  endToEndDurationMsSamples: 0,
};

function recordDurationMetric(
  lastKey: 'claimDurationMsLast' | 'executeDurationMsLast' | 'reportDurationMsLast' | 'endToEndDurationMsLast',
  sumKey: 'claimDurationMsSum' | 'executeDurationMsSum' | 'reportDurationMsSum' | 'endToEndDurationMsSum',
  sampleKey: 'claimDurationMsSamples' | 'executeDurationMsSamples' | 'reportDurationMsSamples' | 'endToEndDurationMsSamples',
  durationMs: number,
): void {
  metrics[lastKey] = durationMs;
  metrics[sumKey] += durationMs;
  metrics[sampleKey] += 1;
}

const HEALTH_PORT = parseInt(process.env.HEALTH_PORT ?? '9090', 10);

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/metrics') {
      const lines = [
        '# HELP sentinel_jobs_processed_total Total jobs processed by agent',
        '# TYPE sentinel_jobs_processed_total counter',
        `sentinel_jobs_processed_total ${health.jobsProcessed}`,
        '# HELP sentinel_jobs_failed_total Total jobs failed in agent loop',
        '# TYPE sentinel_jobs_failed_total counter',
        `sentinel_jobs_failed_total ${health.jobsFailed}`,
        '# HELP sentinel_report_attempts_total Total result report attempts',
        '# TYPE sentinel_report_attempts_total counter',
        `sentinel_report_attempts_total ${metrics.reportAttemptsTotal}`,
        '# HELP sentinel_report_retries_total Total result report retries',
        '# TYPE sentinel_report_retries_total counter',
        `sentinel_report_retries_total ${metrics.reportRetriesTotal}`,
        '# HELP sentinel_report_success_total Total successful result reports',
        '# TYPE sentinel_report_success_total counter',
        `sentinel_report_success_total ${metrics.reportSuccessTotal}`,
        '# HELP sentinel_report_failures_total Total failed result reports after retries',
        '# TYPE sentinel_report_failures_total counter',
        `sentinel_report_failures_total ${metrics.reportFailuresTotal}`,
        '# HELP sentinel_job_claim_errors_total Total claim_next_job RPC errors',
        '# TYPE sentinel_job_claim_errors_total counter',
        `sentinel_job_claim_errors_total ${metrics.jobClaimErrorsTotal}`,
        '# HELP sentinel_stale_jobs_recovered_total Total stale running scan_jobs auto-failed by watchdog',
        '# TYPE sentinel_stale_jobs_recovered_total counter',
        `sentinel_stale_jobs_recovered_total ${metrics.staleJobsRecoveredTotal}`,
        '# HELP sentinel_stale_scans_recovered_total Total stale scans auto-failed by watchdog',
        '# TYPE sentinel_stale_scans_recovered_total counter',
        `sentinel_stale_scans_recovered_total ${metrics.staleScansRecoveredTotal}`,
        '# HELP sentinel_claim_duration_ms_last Last claim_next_job RPC duration in ms',
        '# TYPE sentinel_claim_duration_ms_last gauge',
        `sentinel_claim_duration_ms_last ${metrics.claimDurationMsLast}`,
        '# HELP sentinel_claim_duration_ms_avg Average claim_next_job RPC duration in ms',
        '# TYPE sentinel_claim_duration_ms_avg gauge',
        `sentinel_claim_duration_ms_avg ${metrics.claimDurationMsSamples > 0 ? (metrics.claimDurationMsSum / metrics.claimDurationMsSamples).toFixed(2) : '0'}`,
        '# HELP sentinel_execute_duration_ms_last Last scan execution duration in ms',
        '# TYPE sentinel_execute_duration_ms_last gauge',
        `sentinel_execute_duration_ms_last ${metrics.executeDurationMsLast}`,
        '# HELP sentinel_execute_duration_ms_avg Average scan execution duration in ms',
        '# TYPE sentinel_execute_duration_ms_avg gauge',
        `sentinel_execute_duration_ms_avg ${metrics.executeDurationMsSamples > 0 ? (metrics.executeDurationMsSum / metrics.executeDurationMsSamples).toFixed(2) : '0'}`,
        '# HELP sentinel_report_duration_ms_last Last scan-result reporting duration in ms',
        '# TYPE sentinel_report_duration_ms_last gauge',
        `sentinel_report_duration_ms_last ${metrics.reportDurationMsLast}`,
        '# HELP sentinel_report_duration_ms_avg Average scan-result reporting duration in ms',
        '# TYPE sentinel_report_duration_ms_avg gauge',
        `sentinel_report_duration_ms_avg ${metrics.reportDurationMsSamples > 0 ? (metrics.reportDurationMsSum / metrics.reportDurationMsSamples).toFixed(2) : '0'}`,
        '# HELP sentinel_end_to_end_duration_ms_last Last end-to-end job duration in ms',
        '# TYPE sentinel_end_to_end_duration_ms_last gauge',
        `sentinel_end_to_end_duration_ms_last ${metrics.endToEndDurationMsLast}`,
        '# HELP sentinel_end_to_end_duration_ms_avg Average end-to-end job duration in ms',
        '# TYPE sentinel_end_to_end_duration_ms_avg gauge',
        `sentinel_end_to_end_duration_ms_avg ${metrics.endToEndDurationMsSamples > 0 ? (metrics.endToEndDurationMsSum / metrics.endToEndDurationMsSamples).toFixed(2) : '0'}`,
      ];

      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(`${lines.join('\n')}\n`);
      return;
    }

    if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
      const body = JSON.stringify({
        ...health,
        metrics,
        uptime: Math.floor((Date.now() - new Date(health.startedAt).getTime()) / 1000),
        timestamp: new Date().toISOString(),
      });
      res.writeHead(health.status === 'ok' ? 200 : 503, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(body);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  server.listen(HEALTH_PORT, () => {
    console.log(`🌐 Health endpoint listening on :${HEALTH_PORT}/health`);
  });
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
async function main() {
  startHealthServer();
  health.status = 'ok';
  console.log(`🚀 Agent loop started (${BASE_POLL_INTERVAL_MS}ms base interval)`);
  let consecutiveLoopErrors = 0;
  let pollIntervalMs = BASE_POLL_INTERVAL_MS;
  let lastWatchdogRunAt = 0;

  while (true) {
    try {
      const nowMs = Date.now();
      if (nowMs - lastWatchdogRunAt >= STALE_WATCHDOG_INTERVAL_MS) {
        try {
          const recovered = await recoverStaleRunningJobs();
          if (recovered.jobsRecovered > 0 || recovered.scansRecovered > 0) {
            metrics.staleJobsRecoveredTotal += recovered.jobsRecovered;
            metrics.staleScansRecoveredTotal += recovered.scansRecovered;
            console.warn(`🧹 Watchdog recovered stale states: jobs=${recovered.jobsRecovered}, scans=${recovered.scansRecovered}`);
          }
        } catch (watchdogErr: unknown) {
          console.warn(`⚠️ Watchdog error: ${getErrorMessage(watchdogErr)}`);
        }
        lastWatchdogRunAt = nowMs;
      }

      const job = await fetchPendingJob();
      if (job) {
        health.lastJobAt = new Date().toISOString();
        await runJob(job);
        health.jobsProcessed++;
      }

      consecutiveLoopErrors = 0;
      pollIntervalMs = BASE_POLL_INTERVAL_MS;
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      console.error('⚠️ Loop Error:', msg);
      health.jobsFailed++;
      health.lastError = msg;

      consecutiveLoopErrors++;
      const backoffMs = Math.min(
        BASE_POLL_INTERVAL_MS * 2 ** Math.min(consecutiveLoopErrors, 4),
        MAX_POLL_INTERVAL_MS,
      );
      pollIntervalMs = withJitter(backoffMs);
      console.warn(`⏳ Backing off queue polling for ${pollIntervalMs}ms (consecutive errors: ${consecutiveLoopErrors})`);
    }

    await sleep(pollIntervalMs);
  }
}

main().catch((err: unknown) => console.error('🔥 Fatal Crash:', getErrorMessage(err)));
