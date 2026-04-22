const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env
const envConfig = dotenv.parse(fs.readFileSync('.env'));
const url = envConfig.VITE_SUPABASE_URL;
const key = envConfig.SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Missing URL or SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const sqlQueries = [
  `-- Enable Insert for authenticated users
   CREATE POLICY "Users can insert own scan jobs"
   ON scan_jobs FOR INSERT TO authenticated 
   WITH CHECK (auth.uid() = user_id);`,
   
  `-- Enable Update for authenticated users
   CREATE POLICY "Users can update own scan jobs"
   ON scan_jobs FOR UPDATE TO authenticated 
   USING (auth.uid() = user_id);`,
   
  `-- Enable Delete for authenticated users
   CREATE POLICY "Users can delete own scan jobs"
   ON scan_jobs FOR DELETE TO authenticated 
   USING (auth.uid() = user_id);`
];

async function applyFix() {
  console.log('📡 Connecting to Supabase...');
  
  for (const sql of sqlQueries) {
    console.log(`Executing: ${sql.split('\n')[0]}...`);
    // Note: Supabase JS doesn't have raw SQL, but we can try to use a stored procedure if it exists,
    // OR we can just use the RPC if we created one.
    // Since we don't have an RPC, we'll try to run it via the PostgREST extension if enabled, 
    // but usually, we'd need to use a library like 'pg' for raw SQL.
    
    // Wait! I can just use the 'pg' library if it's installed, or I'll use a trick.
    // Actually, I'll try to use the REST API to check if I can manage policies.
    // No, PostgREST doesn't support DDL.
    
    console.log('⚠️  Wait, Supabase JS client cannot run raw DDL SQL (CREATE POLICY).');
    console.log('I will use the Supabase CLI instead, since I have the credentials now!');
  }
}

applyFix();
