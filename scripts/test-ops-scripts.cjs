const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

function startMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        await handler(req, res);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        port: address.port,
      });
    });
  });
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(null);
        return;
      }
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(null);
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function extractJson(stdout) {
  const first = stdout.indexOf('{');
  const last = stdout.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(`Could not extract JSON from output: ${stdout}`);
  }
  return JSON.parse(stdout.slice(first, last + 1));
}

function runPwsh(scriptPath, args) {
  const result = spawnSync(
    'pwsh',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(`Command failed: ${scriptPath}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout;
}

function writeEnvFile(filePath, supabaseUrl, includeAgentSecret = true) {
  const lines = [
    `SUPABASE_URL=${supabaseUrl}`,
    'SUPABASE_SERVICE_ROLE_KEY=test-service-role-key',
    'OPERATIONAL_ALERT_WEBHOOK_URL=http://127.0.0.1:9/webhook',
  ];

  if (includeAgentSecret) {
    lines.push('AGENT_SECRET=test-agent-secret');
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

async function testSmokeScript(rootDir) {
  let logsCalls = 0;

  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/projects') {
      return sendJson(res, 200, [{ id: 'project-1', user_id: 'user-1', org_id: 'org-1', target: '127.0.0.1' }]);
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/scans') {
      return sendJson(res, 201, [{ id: 'scan-smoke-1' }]);
    }

    if (req.method === 'POST' && url.pathname === '/functions/v1/scan-dispatch') {
      return sendJson(res, 200, { job_id: 'job-smoke-1', status: 'queued' });
    }

    if (req.method === 'POST' && url.pathname === '/functions/v1/scan-result') {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/scans') {
      return sendJson(res, 200, [{ id: 'scan-smoke-1', status: 'failed', started_at: new Date().toISOString(), completed_at: new Date().toISOString() }]);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/scan_jobs') {
      return sendJson(res, 200, [{ id: 'job-smoke-1', status: 'error', error_message: 'smoke controlled failure' }]);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/agent_logs') {
      logsCalls += 1;
      if (logsCalls <= 1) {
        return sendJson(res, 200, [
          { created_at: new Date().toISOString(), level: 'info', message: 'Scan dispatch request accepted' },
          { created_at: new Date().toISOString(), level: 'success', message: 'Scan job queued' },
        ]);
      }
      return sendJson(res, 200, [
        { created_at: new Date().toISOString(), level: 'info', message: 'Scan dispatch request accepted' },
        { created_at: new Date().toISOString(), level: 'success', message: 'Scan job queued' },
        { created_at: new Date().toISOString(), level: 'error', message: 'smoke controlled failure' },
      ]);
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-smoke-'));
  const envFile = path.join(tempDir, '.env');
  writeEnvFile(envFile, `http://127.0.0.1:${port}`);

  const scriptPath = path.join(rootDir, 'scripts', 'smoke-pipeline-safe.ps1');
  const stdout = runPwsh(scriptPath, ['-EnvFile', envFile, '-ControlledFailure', '-WaitForCompletion', '-TimeoutSeconds', '10', '-PollIntervalSeconds', '1']);
  const json = extractJson(stdout);

  assert.equal(json.dispatch_http, 200);
  assert.equal(json.result_http, 200);
  assert.equal(json.wait_for_completion, true);
  assert.equal(json.final_scan_status, 'failed');
  assert.ok(Array.isArray(json.jobs));

  server.close();
}

async function testTriageScript(rootDir) {
  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/scan_jobs') {
      return sendJson(res, 200, [
        {
          id: 'job-stale-1',
          scan_id: 'scan-stale-1',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
          error_message: null,
        },
      ]);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/scans') {
      return sendJson(res, 200, [
        {
          id: 'scan-stale-1',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
          completed_at: null,
        },
      ]);
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/cleanup_stale_running_jobs') {
      const body = await parseJsonBody(req);
      assert.equal(body.timeout_minutes, 10);
      return sendJson(res, 200, { jobs_updated: 1, scans_updated: 1, timeout_minutes: 10 });
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-triage-'));
  const envFile = path.join(tempDir, '.env');
  writeEnvFile(envFile, `http://127.0.0.1:${port}`, false);

  const scriptPath = path.join(rootDir, 'scripts', 'triage-stuck-scans.ps1');
  const stdout = runPwsh(scriptPath, ['-EnvFile', envFile, '-TimeoutMinutes', '10', '-MaxScans', '10', '-ApplyCleanup']);
  const json = extractJson(stdout);

  assert.equal(json.apply_cleanup, true);
  assert.equal(json.stale_running_jobs_count, 1);
  assert.equal(json.affected_scans_count, 1);
  assert.equal(json.cleanup_http, 200);

  server.close();
}

async function testDailyReportScript(rootDir) {
  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/scans') {
      return sendJson(res, 200, [
        {
          id: 'scan-daily-1',
          status: 'completed',
          started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          completed_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        },
        {
          id: 'scan-daily-2',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          completed_at: null,
        },
      ]);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/scan_jobs') {
      return sendJson(res, 200, [
        {
          id: 'job-daily-1',
          scan_id: 'scan-daily-1',
          status: 'completed',
          error_message: null,
          started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          completed_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        },
        {
          id: 'job-daily-2',
          scan_id: 'scan-daily-2',
          status: 'running',
          error_message: null,
          started_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
          completed_at: null,
        },
      ]);
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-daily-'));
  const envFile = path.join(tempDir, '.env');
  writeEnvFile(envFile, `http://127.0.0.1:${port}`, false);

  const scriptPath = path.join(rootDir, 'scripts', 'daily-queue-health-report.ps1');
  const stdout = runPwsh(scriptPath, ['-EnvFile', envFile, '-HoursBack', '24', '-StaleMinutes', '60']);
  const json = extractJson(stdout);

  assert.ok(json.summary);
  assert.equal(typeof json.summary.scans_total, 'number');
  assert.equal(typeof json.summary.jobs_total, 'number');
  assert.equal(typeof json.summary.stale_running_jobs_count, 'number');

  server.close();
}

async function testScheduledCleanupScript(rootDir) {
  let cleanupCalled = false;
  let webhookCalled = false;

  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/scan_jobs') {
      return sendJson(res, 200, [
        {
          id: 'job-cleanup-1',
          scan_id: 'scan-cleanup-1',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 200).toISOString(),
          error_message: null,
        },
        {
          id: 'job-cleanup-2',
          scan_id: 'scan-cleanup-2',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
          error_message: null,
        },
      ]);
    }

    if (req.method === 'POST' && url.pathname === '/rest/v1/rpc/cleanup_stale_running_jobs') {
      cleanupCalled = true;
      const body = await parseJsonBody(req);
      assert.equal(body.timeout_minutes, 120);
      return sendJson(res, 200, { jobs_updated: 2, scans_updated: 2, timeout_minutes: 120 });
    }

    if (req.method === 'POST' && url.pathname === '/webhook') {
      webhookCalled = true;
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-scheduled-cleanup-'));
  const envFile = path.join(tempDir, '.env');
  writeEnvFile(envFile, `http://127.0.0.1:${port}`, false);

  const scriptPath = path.join(rootDir, 'scripts', 'scheduled-stale-cleanup.ps1');
  const stdout = runPwsh(scriptPath, [
    '-EnvFile', envFile,
    '-TimeoutMinutes', '120',
    '-MinStaleJobsToCleanup', '2',
    '-MaxJobsInspect', '100',
    '-ApplyCleanup',
    '-SendWebhook',
    '-WebhookUrl', `http://127.0.0.1:${port}/webhook`,
  ]);
  const json = extractJson(stdout);

  assert.equal(json.summary.should_cleanup, true);
  assert.equal(json.summary.cleanup_attempted, true);
  assert.equal(json.summary.cleanup_http, 200);
  assert.equal(cleanupCalled, true);
  assert.equal(webhookCalled, true);

  server.close();
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');

  await testSmokeScript(rootDir);
  await testTriageScript(rootDir);
  await testDailyReportScript(rootDir);
  await testScheduledCleanupScript(rootDir);

  process.stdout.write('Ops scripts contract tests passed.\n');
}

main().catch((err) => {
  process.stderr.write(`${err.stack || String(err)}\n`);
  process.exit(1);
});
