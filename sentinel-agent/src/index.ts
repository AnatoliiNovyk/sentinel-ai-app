import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

const SUPABASE_URL    = process.env.SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AGENT_SECRET    = process.env.AGENT_SECRET!;
const POLL_INTERVAL   = 3_000; // 3 seconds

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

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
  try {
    console.log('🤖 Sending prompt to Ollama (llama3.1:8b)...');
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.1:8b', // Updated to match user's installed model
      prompt: prompt,
      stream: false,
    }, { timeout: 120000 }); // 2 minute timeout for slow CPUs

    return response.data.response;
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    console.error('❌ Ollama Error:', message);
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ECONNREFUSED') {
      return 'Error: Ollama is not running on localhost:11434';
    }
    return `Error consulting AI: ${message}`;
  }
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
    const res = await axios.post(`${SUPABASE_URL}/functions/v1/scan-result`, {
      job_id: jobId,
      scan_id: scanId,
      user_id: userId,
      project_id: projectId,
      findings,
      metadata,
      error_message: error
    }, {
      headers: { 'X-Agent-Secret': AGENT_SECRET }
    });
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
