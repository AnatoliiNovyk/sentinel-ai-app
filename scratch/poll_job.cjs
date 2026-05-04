const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const supabase = createClient(url, key);

const JOB_ID = process.argv[2];
if (!JOB_ID) { console.error('Usage: node poll_job.cjs <job_id>'); process.exit(1); }

async function poll() {
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const { data, error } = await supabase.from('scan_jobs')
      .select('id, status, error_message, created_at')
      .eq('id', JOB_ID)
      .single();
    if (error) { console.error('DB error:', error.message); continue; }
    const errMsg = data?.error_message ? data.error_message.substring(0, 120) : 'none';
    console.log('[' + (i+1) + '/12] status=' + data?.status + ' error=' + errMsg);
    if (data?.status === 'completed' || data?.status === 'failed' || data?.status === 'error') break;
  }
  console.log('Done polling.');
}
poll();
