const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SERVICE_ROLE_KEY=(.*)/);

const url = urlMatch ? urlMatch[1].trim() : null;
const key = keyMatch ? keyMatch[1].trim() : null;

if (!url || !key) {
  console.error('❌ Could not parse .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log('📡 Testing direct insert with SERVICE_ROLE_KEY...');
  
  const { data: scan, error: sErr } = await supabase.from('scans').select('id, user_id, project_id').limit(1).maybeSingle();
  
  if (sErr) {
    console.error('❌ Scan fetch failed:', sErr.message);
    return;
  }

  if (!scan) {
    console.error('❌ No scans found.');
    return;
  }

  const { data, error } = await supabase.from('scan_jobs').insert({
    scan_id: scan.id,
    user_id: scan.user_id,
    project_id: scan.project_id,
    scanner: 'ai_task_test',
    target: 'Test from Antigravity',
    status: 'pending'
  }).select().single();

  if (error) {
    console.error('❌ Insert failed:', error.message);
  } else {
    console.log('✅ SUCCESS! Inserted job ID:', data.id);
  }
}

test();
