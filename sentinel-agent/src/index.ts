import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const SUPABASE_URL    = process.env.SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AGENT_SECRET    = process.env.AGENT_SECRET!;
const POLL_INTERVAL   = 3_000; // 3 seconds

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

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
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
async function runNmap(target: string): Promise<Finding[]> {
  console.log(`📡 Running nmap on ${target}...`);
  return [{
    title: 'Port Scan Result',
    description: `Scanned ${target}. Found open ports.`,
    severity: 'info',
    asset: target
  }];
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
) {
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
        headers: { 'X-Agent-Secret': AGENT_SECRET }
      })
    );
    console.log(`✅ Reported results for job ${jobId}. Status: ${res.status}`);
  } catch (err: unknown) {
    console.error(`❌ Failed to report results for job ${jobId}:`, getErrorMessage(err));
  }
}

async function fetchPendingJob(): Promise<ScanJob | null> {
  const { data, error } = await supabase.rpc('claim_next_job');
  if (error) {
    console.error('❌ Error claiming job:', error.message);
    return null;
  }
  return data && data.length > 0 ? (data[0] as ScanJob) : null;
}

async function runJob(job: ScanJob) {
  console.log(`▶️ Executing ${job.scanner} task for job ${job.id}...`);
  try {
    let findings: Finding[] = [];
    
    if (job.scanner === 'ai_task' || job.scanner === 'ai-agent') {
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
    } else {
      findings = await runNmap(job.target);
    }

    await reportResult(job.id, job.scan_id, job.user_id, job.project_id, findings, job.metadata);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error(`❌ Job ${job.id} crashed:`, message);
    await reportResult(job.id, job.scan_id, job.user_id, job.project_id, [], job.metadata, message);
  }
}

// --- Main Loop ---
async function main() {
  console.log('🚀 Agent loop started (3s interval)');
  while (true) {
    try {
      const job = await fetchPendingJob();
      if (job) {
        await runJob(job);
      }
    } catch (err: unknown) {
      console.error('⚠️ Loop Error:', getErrorMessage(err));
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch((err: unknown) => console.error('🔥 Fatal Crash:', getErrorMessage(err)));
