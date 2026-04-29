#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function readEnvFile(envFile) {
  if (!fs.existsSync(envFile)) {
    return {};
  }
  const content = fs.readFileSync(envFile, 'utf8');
  const map = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const raw = trimmed.slice(idx + 1).trim();
    map[key] = raw.replace(/^['"]|['"]$/g, '');
  }
  return map;
}

function safeReadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function requestJson(url, options) {
  const res = await fetch(url, options);
  let text = '';
  try {
    text = await res.text();
  } catch {
    text = '';
  }
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, text, json };
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envFile = args['env-file'] || 'sentinel-agent/.env';
  const reportFile = args['report-file'] || path.join('reports', 'agent-health-probe-smoke.json');

  const env = readEnvFile(envFile);
  const supabaseUrl = env.SUPABASE_URL || '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

  const workflow = args.workflow || process.env.GITHUB_WORKFLOW || 'Agent Health Probe Smoke';
  const runId = args['run-id'] || process.env.GITHUB_RUN_ID || 'local-run';
  const runNumber = args['run-number'] || process.env.GITHUB_RUN_NUMBER || '0';

  if (!supabaseUrl || !serviceKey) {
    printResult({
      ok: true,
      persisted: false,
      status: 'skipped',
      reason: 'missing_supabase_env',
    });
    return;
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const projectsResp = await requestJson(`${supabaseUrl}/rest/v1/projects?select=id,org_id,user_id&limit=1`, {
      method: 'GET',
      headers,
    });

    if (!projectsResp.ok) {
      printResult({
        ok: true,
        persisted: false,
        status: 'skipped',
        reason: 'projects_lookup_failed',
        http_status: projectsResp.status,
      });
      return;
    }

    const projects = Array.isArray(projectsResp.json) ? projectsResp.json : [];
    if (projects.length === 0) {
      printResult({
        ok: true,
        persisted: false,
        status: 'skipped',
        reason: 'missing_project_context',
      });
      return;
    }

    const project = projects[0] || {};
    const report = safeReadJson(reportFile);
    const probeStatus = report && typeof report.status === 'string' ? report.status : 'error';

    const metadata = {
      status: probeStatus,
      reachable: report && typeof report.reachable === 'boolean' ? report.reachable : false,
      http_status: report && typeof report.http_status === 'number' ? report.http_status : null,
      request_id: report && typeof report.request_id === 'string' ? report.request_id : null,
      probed_url: report && typeof report.probed_url === 'string' ? report.probed_url : null,
      error: report && typeof report.error === 'string' ? report.error : 'probe report unavailable',
      generated_at: report && typeof report.generated_at === 'string' ? report.generated_at : new Date().toISOString(),
      workflow,
      run_id: String(runId),
      run_number: String(runNumber),
    };

    const payload = {
      org_id: String(project.org_id || ''),
      user_id: String(project.user_id || ''),
      action: 'agent_health_probe_smoke',
      resource_type: 'workflow',
      resource_id: String(runId),
      status: probeStatus === 'ok' ? 'success' : 'failure',
      error_code: probeStatus === 'ok' ? null : 'AGENT_PROBE_SMOKE_FAILED',
      error_message: probeStatus === 'ok' ? null : String(metadata.error),
      metadata,
      created_at: new Date().toISOString(),
    };

    const insertResp = await requestJson(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!insertResp.ok) {
      printResult({
        ok: true,
        persisted: false,
        status: 'warning',
        reason: 'audit_insert_failed',
        http_status: insertResp.status,
      });
      return;
    }

    printResult({
      ok: true,
      persisted: true,
      status: 'ok',
      reason: null,
    });
  } catch (error) {
    printResult({
      ok: true,
      persisted: false,
      status: 'warning',
      reason: 'unexpected_error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

main();
