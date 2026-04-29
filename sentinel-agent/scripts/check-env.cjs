#!/usr/bin/env node
/**
 * sentinel-agent/scripts/check-env.cjs
 *
 * Validates that all required environment variables are set and non-placeholder.
 * Run before starting the agent:
 *   node scripts/check-env.cjs
 *
 * Exit code 0 = OK, exit code 1 = missing/placeholder variables found.
 */

const { existsSync } = require('fs');
const { resolve } = require('path');

// Load .env if present
const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  console.warn('[check-env] WARNING: .env file not found — reading from process environment only.');
  console.warn('[check-env] Copy sentinel-agent/.env.example to sentinel-agent/.env and fill in values.\n');
}

const REQUIRED = [
  { name: 'SUPABASE_URL',              hint: 'Supabase Dashboard → Settings → API → Project URL' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', hint: 'Supabase Dashboard → Settings → API → service_role secret' },
  { name: 'AGENT_SECRET',              hint: 'Run: openssl rand -hex 32' },
];

const PLACEHOLDERS = [
  'YOUR_SERVICE_ROLE_KEY_HERE',
  'YOUR_ANON_KEY_HERE',
  'generate-a-strong-random-secret-here',
  'YOUR_KEY_HERE',
  'PLACEHOLDER',
  '',
];

let hasErrors = false;

for (const { name, hint } of REQUIRED) {
  const value = (process.env[name] ?? '').trim();
  if (!value || PLACEHOLDERS.includes(value)) {
    console.error(`[check-env] ❌ Missing or placeholder: ${name}`);
    console.error(`            → ${hint}\n`);
    hasErrors = true;
  } else {
    const masked = value.length > 8 ? value.slice(0, 4) + '****' + value.slice(-4) : '****';
    console.log(`[check-env] ✅ ${name} = ${masked}`);
  }
}

if (hasErrors) {
  console.error('\n[check-env] Fix the above variables before starting the agent.');
  process.exit(1);
} else {
  console.log('\n[check-env] All required environment variables are set. ✅');
  process.exit(0);
}
