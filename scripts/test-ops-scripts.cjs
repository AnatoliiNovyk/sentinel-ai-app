const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

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

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }

    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function extractJson(stdout) {
  const first = stdout.indexOf('{');
  const last = stdout.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(`Could not extract JSON from output: ${stdout}`);
  }
  return JSON.parse(stdout.slice(first, last + 1));
}

function runPwshRaw(scriptPath, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timeout = setTimeout(() => {
      if (finished) {
        return;
      }
      finished = true;
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${scriptPath}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      reject(new Error(`Command execution failed: ${scriptPath}\nerror: ${error.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });

    child.on('close', (code) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
  });
}

async function runPwsh(scriptPath, args) {
  const result = await runPwshRaw(scriptPath, args, 240_000);

  if (result.code !== 0) {
    throw new Error(`Command failed: ${scriptPath}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  return result.stdout;
}

async function runPwshExpectFail(scriptPath, args) {
  const result = await runPwshRaw(scriptPath, args, 120_000);

  if (result.code === 0) {
    throw new Error(`Command expected to fail but succeeded: ${scriptPath}\nstdout:\n${result.stdout}`);
  }

  return { stdout: result.stdout, stderr: result.stderr };
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

function writeEscalationEnvFile(filePath, escalationWebhookUrl) {
  const lines = [
    'SUPABASE_URL=http://127.0.0.1:9',
    'SUPABASE_SERVICE_ROLE_KEY=test-service-role-key',
    `ESCALATION_ALERT_WEBHOOK_URL=${escalationWebhookUrl}`,
  ];
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
  const stdout = await runPwsh(scriptPath, ['-EnvFile', envFile, '-ControlledFailure', '-WaitForCompletion', '-TimeoutSeconds', '10', '-PollIntervalSeconds', '1']);
  const json = extractJson(stdout);

  assert.equal(json.dispatch_http, 200);
  assert.equal(json.result_http, 200);
  assert.equal(json.wait_for_completion, true);
  assert.equal(json.final_scan_status, 'failed');
  assert.ok(json.jobs !== undefined && json.jobs !== null);

  await closeServer(server);
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
  const stdout = await runPwsh(scriptPath, ['-EnvFile', envFile, '-TimeoutMinutes', '10', '-MaxScans', '10', '-ApplyCleanup']);
  const json = extractJson(stdout);

  assert.equal(json.apply_cleanup, true);
  assert.equal(json.stale_running_jobs_count, 1);
  assert.equal(json.affected_scans_count, 1);
  assert.equal(json.cleanup_http, 200);

  await closeServer(server);
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
  const stdout = await runPwsh(scriptPath, ['-EnvFile', envFile, '-HoursBack', '24', '-StaleMinutes', '60']);
  const json = extractJson(stdout);

  assert.equal(json.schema_version, '1.0');
  assert.equal(json.report_type, 'daily_scan_health_report');
  assert.equal(typeof json.evidence_id, 'string');
  assert.equal(typeof json.integrity.payload_hash, 'string');
  assert.equal(json.integrity.payload_hash.length, 64);
  assert.ok(json.summary);
  assert.equal(typeof json.summary.scans_total, 'number');
  assert.equal(typeof json.summary.jobs_total, 'number');
  assert.equal(typeof json.summary.stale_running_jobs_count, 'number');
  assert.equal(typeof json.summary.error_job_rate_percent, 'number');
  assert.equal(typeof json.summary.trend.error_job_rate_spike_percent, 'number');
  assert.ok(Array.isArray(json.summary.trend.daily_error_rates));
  assert.equal(typeof json.thresholds_ok, 'boolean');
  assert.ok(Array.isArray(json.threshold_breaches));

  await closeServer(server);
}

async function testDailyReportThresholdFail(rootDir) {
  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/scans') {
      return sendJson(res, 200, [
        {
          id: 'scan-daily-fail-1',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          completed_at: null,
        },
      ]);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/scan_jobs') {
      return sendJson(res, 200, [
        {
          id: 'job-daily-fail-1',
          scan_id: 'scan-daily-fail-1',
          status: 'running',
          error_message: null,
          started_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          completed_at: null,
        },
      ]);
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-daily-fail-'));
  const envFile = path.join(tempDir, '.env');
  writeEnvFile(envFile, `http://127.0.0.1:${port}`, false);

  const scriptPath = path.join(rootDir, 'scripts', 'daily-queue-health-report.ps1');
  const failResult = await runPwshExpectFail(scriptPath, [
    '-EnvFile', envFile,
    '-HoursBack', '24',
    '-StaleMinutes', '1',
    '-MaxStaleRunningJobs', '0',
    '-FailOnThresholdBreach',
  ]);

  assert.match(`${failResult.stdout}\n${failResult.stderr}`, /Daily health thresholds breached/i);
  await closeServer(server);
}

async function testDailyReportTrendSpikeThresholdFail(rootDir) {
  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/scans') {
      return sendJson(res, 200, []);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/scan_jobs') {
      const jobs = [];
      for (let d = 3; d >= 1; d -= 1) {
        for (let i = 0; i < 10; i += 1) {
          jobs.push({
            id: `job-trend-base-${d}-${i}`,
            scan_id: `scan-trend-base-${d}`,
            status: i === 0 ? 'error' : 'completed',
            error_message: i === 0 ? `base-error-${d}` : null,
            started_at: new Date(Date.now() - d * 24 * 60 * 60 * 1000 + i * 1000).toISOString(),
            completed_at: new Date(Date.now() - d * 24 * 60 * 60 * 1000 + i * 1000 + 500).toISOString(),
          });
        }
      }

      for (let i = 0; i < 10; i += 1) {
        jobs.push({
          id: `job-trend-current-${i}`,
          scan_id: 'scan-trend-current',
          status: i < 6 ? 'error' : 'completed',
          error_message: i < 6 ? 'current-spike-error' : null,
          started_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + i * 1000).toISOString(),
          completed_at: new Date(Date.now() - 2 * 60 * 60 * 1000 + i * 1000 + 500).toISOString(),
        });
      }

      return sendJson(res, 200, jobs);
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-daily-trend-fail-'));
  const envFile = path.join(tempDir, '.env');
  writeEnvFile(envFile, `http://127.0.0.1:${port}`, false);

  const scriptPath = path.join(rootDir, 'scripts', 'daily-queue-health-report.ps1');
  const failResult = await runPwshExpectFail(scriptPath, [
    '-EnvFile', envFile,
    '-HoursBack', '24',
    '-TrendDays', '4',
    '-StaleMinutes', '60',
    '-MaxStaleRunningJobs', '100',
    '-MaxErrorJobRatePercent', '100',
    '-MaxErrorRateTrendSpikePercent', '20',
    '-FailOnThresholdBreach',
  ]);

  assert.match(`${failResult.stdout}\n${failResult.stderr}`, /error_rate_trend_spike_percent|Daily health thresholds breached/i);
  await closeServer(server);
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
  const stdout = await runPwsh(scriptPath, [
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

  await closeServer(server);
}

async function testDailyBreachEscalationScript(rootDir) {
  let webhookCalled = false;
  let webhookPayload = null;

  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'POST' && url.pathname === '/webhook') {
      webhookCalled = true;
      webhookPayload = await parseJsonBody(req);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-escalate-'));
  const envFile = path.join(tempDir, '.env');
  const reportFile = path.join(tempDir, 'daily-report.json');
  writeEscalationEnvFile(envFile, `http://127.0.0.1:${port}/webhook`);

  fs.writeFileSync(reportFile, JSON.stringify({
    thresholds_ok: false,
    threshold_breaches: [{ type: 'stale_running_jobs', actual: 5, threshold: 3 }],
    summary: {
      generated_at: new Date().toISOString(),
      scans_total: 10,
      jobs_total: 12,
    },
  }), 'utf8');

  const scriptPath = path.join(rootDir, 'scripts', 'escalate-daily-health-breach.ps1');
  const stdout = await runPwsh(scriptPath, [
    '-EnvFile', envFile,
    '-ReportFile', reportFile,
    '-EscalateOnBreach',
    '-EscalationSeverity', 'critical',
  ]);
  const json = extractJson(stdout);

  assert.equal(json.status, 'escalated');
  assert.equal(json.escalation_attempted, true);
  assert.equal(webhookCalled, true);
  assert.equal(webhookPayload.event, 'daily_scan_pipeline_threshold_breach');
  assert.equal(webhookPayload.severity, 'critical');

  await closeServer(server);
}

async function testDailyBreachEscalationSkippedWhenHealthy(rootDir) {
  let webhookCalled = false;

  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'POST' && url.pathname === '/webhook') {
      webhookCalled = true;
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'not found', method: req.method, path: url.pathname });
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-escalate-skip-'));
  const envFile = path.join(tempDir, '.env');
  const reportFile = path.join(tempDir, 'daily-report.json');
  writeEscalationEnvFile(envFile, `http://127.0.0.1:${port}/webhook`);

  fs.writeFileSync(reportFile, JSON.stringify({
    thresholds_ok: true,
    threshold_breaches: [],
    summary: {
      generated_at: new Date().toISOString(),
    },
  }), 'utf8');

  const scriptPath = path.join(rootDir, 'scripts', 'escalate-daily-health-breach.ps1');
  const stdout = await runPwsh(scriptPath, [
    '-EnvFile', envFile,
    '-ReportFile', reportFile,
    '-EscalateOnBreach',
  ]);
  const json = extractJson(stdout);

  assert.equal(json.status, 'skipped');
  assert.equal(json.reason, 'thresholds_ok');
  assert.equal(webhookCalled, false);

  await closeServer(server);
}

async function testRecoveryPlaybookScript(rootDir) {
  let cleanupCalled = false;
  let webhookCalled = false;

  const staleJobsBefore = [
    {
      id: 'job-recovery-1',
      scan_id: 'scan-recovery-1',
      status: 'running',
      started_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      error_message: null,
    },
    {
      id: 'job-recovery-2',
      scan_id: 'scan-recovery-2',
      status: 'running',
      started_at: new Date(Date.now() - 1000 * 60 * 260).toISOString(),
      error_message: null,
    },
  ];

  const { server, port } = await startMockServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/rest/v1/scan_jobs') {
      if (!cleanupCalled) {
        return sendJson(res, 200, staleJobsBefore);
      }
      return sendJson(res, 200, []);
    }

    if (req.method === 'GET' && url.pathname === '/rest/v1/scans') {
      return sendJson(res, 200, [
        {
          id: 'scan-recovery-1',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
          completed_at: null,
        },
        {
          id: 'scan-recovery-2',
          status: 'running',
          started_at: new Date(Date.now() - 1000 * 60 * 260).toISOString(),
          completed_at: null,
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

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ops-recovery-'));
  const envFile = path.join(tempDir, '.env');
  writeEnvFile(envFile, `http://127.0.0.1:${port}`, false);

  const scriptPath = path.join(rootDir, 'scripts', 'recovery-playbook.ps1');
  const stdout = await runPwsh(scriptPath, [
    '-EnvFile', envFile,
    '-TimeoutMinutes', '120',
    '-MaxScans', '200',
    '-ApplyCleanup',
    '-SendWebhook',
    '-WebhookUrl', `http://127.0.0.1:${port}/webhook`,
  ]);
  const json = extractJson(stdout);

  assert.equal(json.schema_version, '1.0');
  assert.equal(json.report_type, 'scan_pipeline_recovery_playbook');
  assert.equal(typeof json.evidence_id, 'string');
  assert.equal(typeof json.integrity.payload_hash, 'string');
  assert.equal(json.integrity.payload_hash.length, 64);
  assert.equal(json.summary.mode, 'apply');
  assert.equal(json.summary.stale_running_jobs_before_count, 2);
  assert.equal(json.summary.stale_running_jobs_after_count, 0);
  assert.equal(json.summary.cleanup_attempted, true);
  assert.equal(json.summary.cleanup_ok, true);
  assert.equal(cleanupCalled, true);
  assert.equal(webhookCalled, true);

  await closeServer(server);
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');

  await testSmokeScript(rootDir);
  await testTriageScript(rootDir);
  await testDailyReportScript(rootDir);
  await testDailyReportThresholdFail(rootDir);
  await testDailyReportTrendSpikeThresholdFail(rootDir);
  await testScheduledCleanupScript(rootDir);
  await testDailyBreachEscalationScript(rootDir);
  await testDailyBreachEscalationSkippedWhenHealthy(rootDir);
  await testRecoveryPlaybookScript(rootDir);

  process.stdout.write('Ops scripts contract tests passed.\n');
}

main().catch((err) => {
  process.stderr.write(`${err.stack || String(err)}\n`);
  process.exit(1);
});
