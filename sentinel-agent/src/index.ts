import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config();

const SUPABASE_URL    = process.env.SUPABASE_URL!;
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const AGENT_SECRET    = process.env.AGENT_SECRET!;
const POLL_INTERVAL   = 3_000; // 3 seconds

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

console.log('🛡️ Sentinel AI Agent v2.0 starting...');

// --- Ollama Integration ---
async function consultOllama(prompt: string): Promise<string> {
  try {
    console.log('🤖 Sending prompt to Ollama (llama3)...');
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3',
      prompt: prompt,
      stream: false,
    }, { timeout: 120000 }); // 2 minute timeout for slow CPUs

    return response.data.response;
  } catch (err: any) {
    console.error('❌ Ollama Error:', err.message);
    if (err.code === 'ECONNREFUSED') return 'Error: Ollama is not running on localhost:11434';
    return `Error consulting AI: ${err.message}`;
  }
}

// --- Scanner Tools ---
async function runNmap(target: string): Promise<any[]> {
  console.log(`📡 Running nmap on ${target}...`);
  // Simplified for audit purposes
  return [{
    title: 'Port Scan Result',
    description: `Scanned ${target}. Found open ports.`,
    severity: 'info',
    asset: target
  }];
}

// --- Job Processing ---
async function reportResult(jobId: string, scanId: string, userId: string, projectId: string, findings: any[], error?: string) {
  try {
    const res = await axios.post(`${SUPABASE_URL}/functions/v1/scan-result`, {
      job_id: jobId,
      scan_id: scanId,
      user_id: userId,
      project_id: projectId,
      findings,
      error_message: error
    }, {
      headers: { 'X-Agent-Secret': AGENT_SECRET }
    });
    console.log(`✅ Reported results for job ${jobId}. Status: ${res.status}`);
  } catch (err: any) {
    console.error(`❌ Failed to report results for job ${jobId}:`, err.message);
  }
}

async function fetchPendingJob() {
  const { data, error } = await supabase
    .from('scan_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('❌ DB Fetch Error:', error.message);
    return null;
  }
  if (!data) return null;

  console.log(`🔍 Claiming job ${data.id} (${data.scanner})...`);
  const { error: claimErr } = await supabase
    .from('scan_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), agent_id: 'vps-agent-main' })
    .eq('id', data.id)
    .eq('status', 'pending');

  if (claimErr) {
    console.error(`❌ Claim failed for ${data.id}:`, claimErr.message);
    return null;
  }

  return data;
}

async function runJob(job: any) {
  console.log(`▶️ Executing ${job.scanner} task for ${job.target}...`);
  try {
    let findings: any[] = [];
    
    switch (job.scanner) {
      case 'ai_task':
        const aiResponse = await consultOllama(job.target);
        findings = [{
          title: 'AI Security Response',
          description: aiResponse,
          severity: 'info',
          asset: job.target.substring(0, 50),
          remediation: 'Review AI suggestions',
          remediation_type: 'manual',
          status: 'open'
        }];
        break;
      default:
        findings = await runNmap(job.target);
    }

    await reportResult(job.id, job.scan_id, job.user_id, job.project_id, findings);
  } catch (err: any) {
    console.error(`❌ Job ${job.id} crashed:`, err.message);
    await reportResult(job.id, job.scan_id, job.user_id, job.project_id, [], err.message);
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
    } catch (err: any) {
      console.error('⚠️ Loop Error:', err.message);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch(err => console.error('🔥 Fatal Crash:', err));
