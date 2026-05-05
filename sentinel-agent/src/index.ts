import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as http from 'http';
import { resolve } from 'path';

// Support both agent-root and dist runtime locations.
dotenv.config();
dotenv.config({ path: resolve(__dirname, '../.env') });

// ---------------------------------------------------------------------------
// OpenTelemetry — distributed tracing (opt-in via OTEL_ENABLED=true)
// ---------------------------------------------------------------------------
import * as otelApi from '@opentelemetry/api';

let otelTracer: otelApi.Tracer = otelApi.trace.getTracer('sentinel-agent', '1.0.0');

function initOpenTelemetry(): void {
  const enabled = process.env.OTEL_ENABLED?.toLowerCase() === 'true';
  if (!enabled) {
    console.log('ℹ️  OpenTelemetry disabled (set OTEL_ENABLED=true to enable)');
    return;
  }

  try {
    // Dynamic require so the SDK is only loaded when enabled
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require('@opentelemetry/sdk-node') as typeof import('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http') as typeof import('@opentelemetry/exporter-trace-otlp-http');

    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';

    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? 'sentinel-agent',
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    });

    sdk.start();
    otelTracer = otelApi.trace.getTracer('sentinel-agent', '1.0.0');
    console.log(`✅ OpenTelemetry tracing enabled → ${endpoint}`);

    const shutdownOtel = () => {
      sdk.shutdown()
        .catch(() => {})
        .finally(() => process.exit(0));
      // Force exit if SDK takes too long
      setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on('SIGTERM', shutdownOtel);
    process.on('SIGINT',  shutdownOtel);
  } catch (err) {
    console.warn('⚠️ OpenTelemetry init failed (non-fatal):', err instanceof Error ? err.message : String(err));
  }
}

const execFileAsync = promisify(execFile);

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `[agent-config] Missing required environment variable: ${name}. ` +
      'Create/update sentinel-agent/.env from sentinel-agent/.env.example and restart the agent.',
    );
  }
  return value;
}

const SUPABASE_URL    = getRequiredEnv('SUPABASE_URL');
const SERVICE_KEY     = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const AGENT_SECRET    = getRequiredEnv('AGENT_SECRET');
const BASE_POLL_INTERVAL_MS = 3_000;
const MAX_POLL_INTERVAL_MS = 30_000;
const REPORT_MAX_ATTEMPTS = 4;
const REPORT_BASE_DELAY_MS = 1_000;
const STALE_RUNNING_JOB_TIMEOUT_MINUTES = parseInt(process.env.STALE_RUNNING_JOB_TIMEOUT_MINUTES ?? '180', 10);
const AGENT_MAX_CONCURRENT_JOBS = parseInt(process.env.AGENT_MAX_CONCURRENT_JOBS ?? '2', 10);
const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS ?? '90', 10);
const LOG_CLEANUP_INTERVAL_MS = parseInt(process.env.LOG_CLEANUP_INTERVAL_MS ?? '86400000', 10); // 24h
const STALE_WATCHDOG_INTERVAL_MS = parseInt(process.env.STALE_WATCHDOG_INTERVAL_MS ?? '60000', 10);
const OPERATIONAL_ALERT_WEBHOOK_URL = process.env.OPERATIONAL_ALERT_WEBHOOK_URL ?? '';
const SLO_CLAIM_AVG_MS_THRESHOLD = parseInt(process.env.SLO_CLAIM_AVG_MS_THRESHOLD ?? '2000', 10);
const SLO_EXECUTE_AVG_MS_THRESHOLD = parseInt(process.env.SLO_EXECUTE_AVG_MS_THRESHOLD ?? '120000', 10);
const SLO_REPORT_AVG_MS_THRESHOLD = parseInt(process.env.SLO_REPORT_AVG_MS_THRESHOLD ?? '15000', 10);
const SLO_END_TO_END_AVG_MS_THRESHOLD = parseInt(process.env.SLO_END_TO_END_AVG_MS_THRESHOLD ?? '180000', 10);
const SLO_MIN_SAMPLE_COUNT = parseInt(process.env.SLO_MIN_SAMPLE_COUNT ?? '5', 10);
const SLO_ALERT_COOLDOWN_MS = parseInt(process.env.SLO_ALERT_COOLDOWN_MS ?? '900000', 10);

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

const NMAP_TIMEOUT_MS   = 60 * 1000; // 1 minute (prevent long hangs on unresolvable hosts)
const NUCLEI_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes
const PROWLER_TIMEOUT_MS = parseInt(process.env.PROWLER_TIMEOUT_MS ?? '1200000', 10); // 20 minutes

async function runNmap(target: string): Promise<Finding[]> {
  const safeTarget = sanitizeTarget(target);
  console.log(`📡 Running nmap on ${safeTarget}...`);

  try {
    // -sV: version detection, -T4: aggressive timing, -oX -: XML to stdout
    // --open: only open ports, top 1000 ports (default)
    // --host-timeout: abort per-host scan after 30s to avoid DNS/routing hangs
    const { stdout, stderr } = await execFileAsync(
      'nmap',
      ['-sV', '-T4', '--open', '--host-timeout', '30s', '-oX', '-', safeTarget],
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

// --- tfsec (Terraform IaC static analysis) ---
async function runTfsec(target: string): Promise<Finding[]> {
  console.log(`🏗️ Running tfsec on ${target}...`);
  try {
    // tfsec scans a directory for IaC misconfigurations
    const { stdout } = await execFileAsync(
      'tfsec',
      [target, '--format', 'json', '--no-colour'],
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout) as { results?: Array<{ description: string; severity: string; location?: { filename?: string }; links?: string[] }> };
    const results = parsed.results ?? [];
    if (results.length === 0) {
      return [{ title: 'No IaC misconfigurations found', description: `tfsec scan of "${target}" found no issues.`, severity: 'info', asset: target, status: 'open' }];
    }
    return results.map(r => ({
      title: r.description?.split('\n')[0]?.slice(0, 120) ?? 'IaC misconfiguration',
      description: r.description ?? '',
      severity: (r.severity?.toLowerCase() ?? 'medium') as Finding['severity'],
      asset: r.location?.filename ?? target,
      remediation: r.links?.[0] ? `See: ${r.links[0]}` : 'Review and fix the IaC configuration.',
      remediation_type: 'configuration',
      status: 'open',
    }));
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      throw new Error('tfsec is not installed. Run: apt-get install -y tfsec or see https://github.com/aquasecurity/tfsec');
    }
    throw new Error(`tfsec failed: ${message}`);
  }
}

// --- Prowler (AWS cloud security posture) ---
function parseProwlerFindings(output: string, target: string): Finding[] {
  const lines = output.split('\n').filter(l => l.trim().startsWith('{'));
  if (lines.length === 0) {
    return [];
  }

  return lines.slice(0, 100).flatMap(line => {
    try {
      const r = JSON.parse(line) as { CheckTitle?: string; Status?: string; StatusExtended?: string; Severity?: string; ResourceId?: string; Remediation?: { Recommendation?: { Text?: string; Url?: string } } };
      const f: Finding = {
        title: r.CheckTitle ?? 'Cloud security check',
        description: r.StatusExtended ?? r.Status ?? '',
        severity: (r.Severity?.toLowerCase() ?? 'medium') as Finding['severity'],
        asset: r.ResourceId ?? target,
        remediation: r.Remediation?.Recommendation?.Text ?? 'Review AWS security configuration.',
        remediation_type: 'configuration',
        status: 'open',
      };
      return [f];
    } catch {
      return [] as Finding[];
    }
  });
}

async function runProwler(target: string): Promise<Finding[]> {
  console.log(`☁️ Running prowler on ${target}...`);
  try {
    const { stdout } = await execFileAsync(
      'prowler',
      ['aws', '--output-formats', 'json-ocsf', '--no-banner', '--no-color', '--ignore-exit-code-3', '--only-logs'],
      { timeout: PROWLER_TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }
    );
    const findings = parseProwlerFindings(stdout, target);
    if (findings.length === 0) {
      return [{ title: 'No Prowler findings', description: `Prowler scan completed. No issues found.`, severity: 'info', asset: target, status: 'open' }];
    }
    return findings;
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    const errStdout = typeof err === 'object' && err !== null && 'stdout' in err
      ? String((err as { stdout?: string }).stdout ?? '')
      : '';
    const errStderr = typeof err === 'object' && err !== null && 'stderr' in err
      ? String((err as { stderr?: string }).stderr ?? '')
      : '';

    const findingsFromErrorStdout = parseProwlerFindings(errStdout, target);
    if (findingsFromErrorStdout.length > 0) {
      console.warn(`⚠️ Prowler exited non-zero but produced ${findingsFromErrorStdout.length} finding(s). Returning partial findings.`);
      return findingsFromErrorStdout;
    }

    const combinedMessage = `${message}\n${errStderr}`.trim();
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      throw new Error('prowler is not installed. Run: pip install prowler');
    }
    // NoCredentialsError — AWS not configured on this host; return info finding instead of crashing
    if (combinedMessage.includes('NoCredentialsError') || combinedMessage.includes('Unable to locate credentials')) {
      return [{
        title: 'AWS credentials not configured',
        description: 'Prowler could not run because no AWS credentials are available on this host. Configure AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_DEFAULT_REGION in the agent .env to enable cloud security scanning.',
        severity: 'info',
        asset: target,
        remediation: 'Set AWS credentials in /opt/sentinel-agent/.env or via IAM instance role.',
        remediation_type: 'configuration',
        status: 'open',
      }];
    }
    throw new Error(`prowler failed: ${combinedMessage || message}`);
  }
}

// --- Amass (subdomain enumeration) ---
const AMASS_TIMEOUT_MS = 6 * 60_000; // 6 minutes

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAmassSubdomains(output: string, domain: string): string[] {
  if (!output.trim()) return [];
  const escapedDomain = escapeRegExp(domain.toLowerCase());
  const subdomainRe = new RegExp(`\\b(?:[a-z0-9-]+\\.)+${escapedDomain}\\b`, 'gi');
  const unique = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = subdomainRe.exec(output)) !== null) {
    unique.add(match[0].toLowerCase());
  }

  return Array.from(unique);
}

async function runAmass(target: string): Promise<Finding[]> {
  const safeTarget = sanitizeTarget(target);
  console.log(`🌐 Running amass enum on ${safeTarget}...`);
  try {
    const { stdout } = await execFileAsync(
      'amass',
      ['enum', '-passive', '-norecursive', '-noalts', '-d', safeTarget],
      { timeout: AMASS_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }
    );
    const subdomains = parseAmassSubdomains(stdout, safeTarget);
    if (subdomains.length === 0) {
      return [{ title: 'No subdomains found', description: `Amass passive enumeration of "${safeTarget}" found no subdomains.`, severity: 'info', asset: safeTarget, status: 'open' }];
    }
    return subdomains.map(sub => ({
      title: `Exposed subdomain: ${sub}`,
      description: `Subdomain "${sub}" discovered via passive DNS enumeration.`,
      severity: 'low' as Finding['severity'],
      asset: sub,
      remediation: 'Review exposed subdomains and ensure they are intentional and properly secured.',
      remediation_type: 'configuration',
      status: 'open',
    }));
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'stdout' in err) {
      const partialStdout = String((err as { stdout?: string }).stdout ?? '');
      const partialResults = parseAmassSubdomains(partialStdout, safeTarget);
      if (partialResults.length > 0) {
        console.warn(`⚠️ Amass ended with an error but produced ${partialResults.length} partial result(s). Returning partial findings.`);
        return partialResults.map(sub => ({
          title: `Exposed subdomain: ${sub}`,
          description: `Subdomain "${sub}" discovered via passive DNS enumeration (partial output).`,
          severity: 'low' as Finding['severity'],
          asset: sub,
          remediation: 'Review exposed subdomains and ensure they are intentional and properly secured.',
          remediation_type: 'configuration',
          status: 'open',
        }));
      }
    }

    const rawMessage = getErrorMessage(err);
    // Strip ANSI escape codes (Amass progress bars) from error messages stored in DB
    const message = rawMessage.replace(/\x1b\[[0-9;]*[mGKHF]/g, '').replace(/\r/g, '').trim();
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      throw new Error('amass is not installed. Run: apt-get install -y amass');
    }
    throw new Error(`amass failed: ${message}`);
  }
}

// --- Agent Logging ---
async function writeLog(
  jobId: string,
  scanId: string | null,
  projectId: string,
  level: 'info' | 'success' | 'error' | 'warn',
  message: string,
  traceId?: string,
  spanId?: string,
): Promise<void> {
  try {
    await supabase.from('agent_logs').insert({
      job_id: jobId,
      scan_id: scanId,
      project_id: projectId,
      level,
      message,
      ...(traceId ? { trace_id: traceId } : {}),
      ...(spanId  ? { span_id: spanId }   : {}),
    });
  } catch {
    // fire-and-forget — logging must never crash the agent
  }
}

function getActiveTraceIds(): { traceId: string | undefined; spanId: string | undefined } {
  const spanContext = otelApi.trace.getActiveSpan()?.spanContext();
  if (!spanContext || !otelApi.isValidTraceId(spanContext.traceId)) {
    return { traceId: undefined, spanId: undefined };
  }
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
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

  return otelTracer.startActiveSpan(
    `scan.${job.scanner.toLowerCase()}`,
    {
      kind: otelApi.SpanKind.INTERNAL,
      attributes: {
        'job.id':      job.id,
        'job.scanner': job.scanner,
        'job.target':  job.target,
        'job.scan_id': job.scan_id ?? '',
        'job.project': job.project_id,
      },
    },
    async (span) => {
      const { traceId, spanId } = getActiveTraceIds();
      try {
        console.log(`▶️ Executing ${job.scanner} task for job ${job.id}...${traceId ? ` [trace=${traceId.slice(0, 8)}...]` : ''}`);
        await writeLog(job.id, job.scan_id, job.project_id, 'info', `▶️ Starting ${job.scanner} scan on ${job.target}`, traceId, spanId);
        try {
          const executionStartedAt = Date.now();
          let findings: Finding[] = [];

          const scannerKey = job.scanner.toLowerCase();

          if (scannerKey === 'ai_task' || scannerKey === 'ai-agent') {
            await writeLog(job.id, job.scan_id, job.project_id, 'info', '🤖 Consulting Ollama AI model...', traceId, spanId);
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
          } else if (scannerKey === 'nuclei' || scannerKey === 'nuclei-scan') {
            await writeLog(job.id, job.scan_id, job.project_id, 'info', `🔬 Running Nuclei template scan on ${job.target}...`, traceId, spanId);
            findings = await runNuclei(job.target);
          } else if (scannerKey === 'tfsec') {
            await writeLog(job.id, job.scan_id, job.project_id, 'info', `🏗️ Running tfsec IaC analysis...`, traceId, spanId);
            findings = await runTfsec(job.target);
          } else if (scannerKey === 'prowler') {
            await writeLog(job.id, job.scan_id, job.project_id, 'info', `☁️ Running Prowler cloud security scan...`, traceId, spanId);
            findings = await runProwler(job.target);
          } else if (scannerKey === 'amass') {
            await writeLog(job.id, job.scan_id, job.project_id, 'info', `🌐 Running Amass subdomain enumeration on ${job.target}...`, traceId, spanId);
            findings = await runAmass(job.target);
          } else {
            await writeLog(job.id, job.scan_id, job.project_id, 'info', `📡 Running Nmap port scan on ${job.target}...`, traceId, spanId);
            findings = await runNmap(job.target);
          }

          const realFindings = findings.filter(f => f.severity !== 'info' || !f.title.toLowerCase().includes('no '));
          recordDurationMetric('executeDurationMsLast', 'executeDurationMsSum', 'executeDurationMsSamples', Date.now() - executionStartedAt);

          span.setAttribute('job.findings_total', findings.length);
          span.setAttribute('job.findings_real', realFindings.length);

          await writeLog(
            job.id, job.scan_id, job.project_id, 'success',
            `✅ Scan complete — ${realFindings.length} finding(s) found (${findings.length} total)`,
            traceId, spanId,
          );

          const reportOutcome = await reportResult(job.id, job.scan_id, job.user_id, job.project_id, findings, job.metadata);
          recordDurationMetric('reportDurationMsLast', 'reportDurationMsSum', 'reportDurationMsSamples', reportOutcome.durationMs);

          if (reportOutcome.ok) {
            await writeLog(job.id, job.scan_id, job.project_id, 'success', '📤 Results reported to Sentinel AI', traceId, spanId);
            span.setStatus({ code: otelApi.SpanStatusCode.OK });
          } else {
            await writeLog(job.id, job.scan_id, job.project_id, 'error', '📤 Result reporting failed after retries', traceId, spanId);
            span.setStatus({ code: otelApi.SpanStatusCode.ERROR, message: 'Result reporting failed' });
          }

          await sendWebhookAlert(job.project_id, job.target, findings);
        } catch (err: unknown) {
          const message = getErrorMessage(err);
          console.error(`❌ Job ${job.id} crashed:`, message);
          span.recordException(err instanceof Error ? err : new Error(message));
          span.setStatus({ code: otelApi.SpanStatusCode.ERROR, message });
          await writeLog(job.id, job.scan_id, job.project_id, 'error', `❌ Scan failed: ${message}`, traceId, spanId);

          const failureReportOutcome = await reportResult(job.id, job.scan_id, job.user_id, job.project_id, [], job.metadata, message);
          recordDurationMetric('reportDurationMsLast', 'reportDurationMsSum', 'reportDurationMsSamples', failureReportOutcome.durationMs);

          if (!failureReportOutcome.ok) {
            await writeLog(job.id, job.scan_id, job.project_id, 'error', '❌ Failed to deliver scan failure payload after retries', traceId, spanId);
          }
        } finally {
          recordDurationMetric('endToEndDurationMsLast', 'endToEndDurationMsSum', 'endToEndDurationMsSamples', Date.now() - jobStartedAt);
        }
      } finally {
        span.end();
      }
    },
  );
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

type SloBreach = {
  metric: 'claim' | 'execute' | 'report' | 'end_to_end';
  avgMs: number;
  thresholdMs: number;
  samples: number;
};

async function maybeSendLatencySloAlert(): Promise<void> {
  const claimAvg = getDurationAvg(metrics.claimDurationMsSum, metrics.claimDurationMsSamples);
  const executeAvg = getDurationAvg(metrics.executeDurationMsSum, metrics.executeDurationMsSamples);
  const reportAvg = getDurationAvg(metrics.reportDurationMsSum, metrics.reportDurationMsSamples);
  const endToEndAvg = getDurationAvg(metrics.endToEndDurationMsSum, metrics.endToEndDurationMsSamples);

  const breaches: SloBreach[] = [];
  if (metrics.claimDurationMsSamples >= SLO_MIN_SAMPLE_COUNT && claimAvg > SLO_CLAIM_AVG_MS_THRESHOLD) {
    breaches.push({ metric: 'claim', avgMs: claimAvg, thresholdMs: SLO_CLAIM_AVG_MS_THRESHOLD, samples: metrics.claimDurationMsSamples });
  }
  if (metrics.executeDurationMsSamples >= SLO_MIN_SAMPLE_COUNT && executeAvg > SLO_EXECUTE_AVG_MS_THRESHOLD) {
    breaches.push({ metric: 'execute', avgMs: executeAvg, thresholdMs: SLO_EXECUTE_AVG_MS_THRESHOLD, samples: metrics.executeDurationMsSamples });
  }
  if (metrics.reportDurationMsSamples >= SLO_MIN_SAMPLE_COUNT && reportAvg > SLO_REPORT_AVG_MS_THRESHOLD) {
    breaches.push({ metric: 'report', avgMs: reportAvg, thresholdMs: SLO_REPORT_AVG_MS_THRESHOLD, samples: metrics.reportDurationMsSamples });
  }
  if (metrics.endToEndDurationMsSamples >= SLO_MIN_SAMPLE_COUNT && endToEndAvg > SLO_END_TO_END_AVG_MS_THRESHOLD) {
    breaches.push({ metric: 'end_to_end', avgMs: endToEndAvg, thresholdMs: SLO_END_TO_END_AVG_MS_THRESHOLD, samples: metrics.endToEndDurationMsSamples });
  }

  if (breaches.length === 0 || !OPERATIONAL_ALERT_WEBHOOK_URL) {
    return;
  }

  const now = Date.now();
  if (metrics.sloAlertLastAtMs > 0 && now - metrics.sloAlertLastAtMs < SLO_ALERT_COOLDOWN_MS) {
    metrics.sloAlertsSuppressedTotal++;
    return;
  }

  try {
    await axios.post(OPERATIONAL_ALERT_WEBHOOK_URL, {
      event: 'agent_latency_slo_breach',
      severity: 'warning',
      source: 'sentinel-agent',
      timestamp: new Date().toISOString(),
      breaches: breaches.map((b) => ({
        metric: b.metric,
        avg_ms: Number(b.avgMs.toFixed(2)),
        threshold_ms: b.thresholdMs,
        samples: b.samples,
      })),
      health: {
        jobs_processed: health.jobsProcessed,
        jobs_failed: health.jobsFailed,
        last_error: health.lastError,
      },
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10_000,
    });

    metrics.sloAlertsTotal++;
    metrics.sloAlertLastAtMs = now;
    console.warn(`📣 SLO latency alert sent (${breaches.map((b) => b.metric).join(', ')})`);
  } catch (err: unknown) {
    console.warn(`⚠️ Failed to send SLO latency alert: ${getErrorMessage(err)}`);
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
  activeJobs: 0,
  maxConcurrentJobs: AGENT_MAX_CONCURRENT_JOBS,
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
  sloAlertsTotal: 0,
  sloAlertsSuppressedTotal: 0,
  sloAlertLastAtMs: 0,
  logCleanupRunsTotal: 0,
  logCleanupLastDeletedTotal: 0,
  logCleanupLastRunAt: 0,
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

function getDurationAvg(sum: number, samples: number): number {
  if (samples <= 0) return 0;
  return sum / samples;
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
        '# HELP sentinel_slo_alerts_total Total latency SLO alerts sent',
        '# TYPE sentinel_slo_alerts_total counter',
        `sentinel_slo_alerts_total ${metrics.sloAlertsTotal}`,
        '# HELP sentinel_slo_alerts_suppressed_total Total latency SLO alerts suppressed by cooldown',
        '# TYPE sentinel_slo_alerts_suppressed_total counter',
        `sentinel_slo_alerts_suppressed_total ${metrics.sloAlertsSuppressedTotal}`,
        '# HELP sentinel_slo_alert_last_timestamp_seconds Unix timestamp of last sent latency SLO alert',
        '# TYPE sentinel_slo_alert_last_timestamp_seconds gauge',
        `sentinel_slo_alert_last_timestamp_seconds ${metrics.sloAlertLastAtMs > 0 ? Math.floor(metrics.sloAlertLastAtMs / 1000) : 0}`,
        '# HELP sentinel_log_cleanup_runs_total Total log retention cleanup runs',
        '# TYPE sentinel_log_cleanup_runs_total counter',
        `sentinel_log_cleanup_runs_total ${metrics.logCleanupRunsTotal}`,
        '# HELP sentinel_log_cleanup_last_deleted_total Rows deleted in last log retention cleanup',
        '# TYPE sentinel_log_cleanup_last_deleted_total gauge',
        `sentinel_log_cleanup_last_deleted_total ${metrics.logCleanupLastDeletedTotal}`,
        '# HELP sentinel_log_cleanup_last_run_timestamp_seconds Unix timestamp of last log cleanup run',
        '# TYPE sentinel_log_cleanup_last_run_timestamp_seconds gauge',
        `sentinel_log_cleanup_last_run_timestamp_seconds ${metrics.logCleanupLastRunAt > 0 ? Math.floor(metrics.logCleanupLastRunAt / 1000) : 0}`,
        '# HELP sentinel_active_jobs Current number of concurrently running scan jobs',
        '# TYPE sentinel_active_jobs gauge',
        `sentinel_active_jobs ${health.activeJobs}`,
        '# HELP sentinel_max_concurrent_jobs Configured maximum concurrent jobs',
        '# TYPE sentinel_max_concurrent_jobs gauge',
        `sentinel_max_concurrent_jobs ${AGENT_MAX_CONCURRENT_JOBS}`,
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
  let lastLogCleanupRunAt = 0;

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

          await maybeSendLatencySloAlert();

          // Log retention cleanup (once per LOG_CLEANUP_INTERVAL_MS, default 24h)
          if (nowMs - lastLogCleanupRunAt >= LOG_CLEANUP_INTERVAL_MS) {
            try {
              const { data: cleanupResult, error: cleanupError } = await supabase
                .rpc('cleanup_old_logs', { retention_days: LOG_RETENTION_DAYS });
              if (cleanupError) {
                console.warn(`⚠️ Log retention cleanup failed: ${cleanupError.message}`);
              } else {
                const result = cleanupResult as { total_deleted?: number; agent_logs_deleted?: number; audit_logs_deleted?: number } | null;
                const totalDeleted = result?.total_deleted ?? 0;
                metrics.logCleanupRunsTotal++;
                metrics.logCleanupLastDeletedTotal = totalDeleted;
                metrics.logCleanupLastRunAt = nowMs;
                lastLogCleanupRunAt = nowMs;
                if (totalDeleted > 0) {
                  console.log(`🧹 Log retention cleanup: deleted ${totalDeleted} row(s) older than ${LOG_RETENTION_DAYS} days (agent_logs=${result?.agent_logs_deleted ?? 0}, audit_logs=${result?.audit_logs_deleted ?? 0})`);
                }
              }
            } catch (cleanupErr: unknown) {
              console.warn(`⚠️ Log retention cleanup error: ${getErrorMessage(cleanupErr)}`);
            }
          }
        } catch (watchdogErr: unknown) {
          console.warn(`⚠️ Watchdog error: ${getErrorMessage(watchdogErr)}`);
        }
        lastWatchdogRunAt = nowMs;
      }

      // Fill all available concurrent slots with pending jobs
      let foundJob = false;
      while (health.activeJobs < AGENT_MAX_CONCURRENT_JOBS) {
        const job = await fetchPendingJob();
        if (!job) break;
        foundJob = true;
        health.activeJobs++;
        health.lastJobAt = new Date().toISOString();
        runJob(job).finally(() => {
          health.activeJobs--;
          health.jobsProcessed++;
        });
      }
      void foundJob; // suppress unused var warning

      consecutiveLoopErrors = 0;
      pollIntervalMs = health.activeJobs > 0 ? BASE_POLL_INTERVAL_MS : pollIntervalMs;
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

initOpenTelemetry();
main().catch((err: unknown) => console.error('🔥 Fatal Crash:', getErrorMessage(err)));
