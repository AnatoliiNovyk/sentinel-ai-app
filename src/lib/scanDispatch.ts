import { httpPost } from './httpClient';
import { supabase } from './supabase';
import { runMockScan } from './scanMock';
import { ErrorCode, failure, Result, success } from './errors';
import { InMemoryScanQueue, type ScanJob, type ScanPriority } from './scanQueue';
import { runScansParallel, summarizeScanResults } from './parallelScanner';

const EDGE_BASE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : '';
const ALLOW_MOCK_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK_SCAN_FALLBACK === 'true';

/**
 * Dispatches a scan.
 * 1. Creates a `scans` row (status = queued).
 * 2. Calls the `scan-dispatch` Edge Function which inserts a `scan_jobs` row
 *    and the VPS agent picks it up.
 * 3. Falls back to the browser mock only in local dev or when explicitly enabled
 *    via VITE_ALLOW_MOCK_SCAN_FALLBACK=true.
 *
 * Returns the scan_id on success, or null on failure.
 */
export async function dispatchScan(
  userId: string,
  projectId: string,
  scanner: string,
  target: string,
): Promise<Result<{ scanId: string; mode: 'REAL' | 'MOCK' }>> {
  // 1. Create scan row in DB
  const { data: scan, error: scanErr } = await supabase
    .from('scans')
    .insert({
      user_id: userId,
      project_id: projectId,
      scanner,
      status: 'queued',
      is_mock: false,
      detected_mode: 'UNKNOWN',
      started_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (scanErr || !scan) {
    return failure(
      ErrorCode.SCAN_DB_INSERT_FAILED,
      'Failed to create scan row.',
      scanErr,
      { projectId, scanner },
    );
  }

  // 2. Attempt to call the real Edge Function
  if (EDGE_BASE) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const json = await httpPost<{ job_id?: string }>(`${EDGE_BASE}/scan-dispatch`, {
        scan_id: scan.id,
        project_id: projectId,
        scanner,
        target,
      }, { token: token ?? undefined, timeoutMs: 30_000 });

      await supabase
        .from('scans')
        .update({ status: 'running', is_mock: false, detected_mode: 'REAL' })
        .eq('id', scan.id);
      console.info(`[scanDispatch] Job queued via edge fn: job_id=${json.job_id}`);
      return success({ scanId: scan.id, mode: 'REAL' });
    } catch (netErr) {
      console.warn('[scanDispatch] Edge fn unreachable, falling back to mock:', netErr);
    }
  }

  if (!ALLOW_MOCK_FALLBACK) {
    await supabase
      .from('scans')
      .update({
        status: 'failed',
        is_mock: false,
        detected_mode: 'UNKNOWN',
        completed_at: new Date().toISOString(),
      })
      .eq('id', scan.id);

    return failure(
      ErrorCode.SCAN_EDGE_FN_ERROR,
      'Real scan dispatch is unavailable. Mock fallback is disabled in this environment.',
      undefined,
      { projectId, scanner },
    );
  }

  // 3. Fallback: browser mock (dev/demo only)
  console.info('[scanDispatch] Running in MOCK mode (no real agent)');
  // Mark this scan row as the one mock will use
  await supabase.from('scans').update({ status: 'failed', detected_mode: 'MOCK', is_mock: true }).eq('id', scan.id);

  // runMockScan creates its own scan row — we need to delete the duplicate we created above
  // and let the mock complete it, OR we patch mock to accept an existing scan ID.
  // Simplest: delete the placeholder row and let mock handle everything.
  await supabase.from('scans').delete().eq('id', scan.id);
  const mockScanId = await runMockScan(userId, projectId, scanner);
  if (!mockScanId) {
    return failure(
      ErrorCode.SCAN_MOCK_FAILED,
      'Mock scan failed to execute.',
      undefined,
      { projectId, scanner },
    );
  }
  return success({ scanId: mockScanId, mode: 'MOCK' });
}

/**
 * Dispatches all due scheduled scans via the same pipeline.
 * Replaces the old browser-based scheduler that called runMockScan directly.
 */
export async function dispatchDueSchedules(userId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('scan_schedules')
    .select('*, projects(target)')
    .eq('user_id', userId)
    .eq('enabled', true)
    .lte('next_run_at', nowIso)
    .limit(10);

  if (error) {
    console.error('[scheduler] Error fetching due schedules:', error);
    return 0;
  }

  const due = data ?? [];
  if (due.length === 0) return 0;

  let fired = 0;
  for (const s of due) {
    const runAt = new Date();
    const next = new Date(runAt.getTime() + s.cadence_hours * 3_600_000);

    // Update next_run_at first to prevent double-dispatch if multiple tabs open
    const { error: updateErr } = await supabase
      .from('scan_schedules')
      .update({ last_run_at: runAt.toISOString(), next_run_at: next.toISOString() })
      .eq('id', s.id)
      .eq('last_run_at', s.last_run_at); // optimistic lock

    if (updateErr) {
      // Another tab already updated this — skip
      continue;
    }

    const target = (s as { projects?: { target?: string } }).projects?.target ?? '';
    const result = await dispatchScan(userId, s.project_id, s.scanner, target);
    if (result.ok) {
      fired++;
    } else {
      console.error('[scheduler] Failed to dispatch scheduled scan:', result.error);
    }
  }

  return fired;
}

/**
 * Dispatch multiple scans in parallel with concurrency limiting.
 *
 * @param userId User ID
 * @param scans Array of { projectId, targetUrl, scanner, priority }
 * @param concurrency Max concurrent scans (default 3)
 * @returns Summary of results with per-scan status
 */
export async function dispatchScansParallel(
  userId: string,
  scans: Array<{
    projectId: string;
    targetUrl: string;
    scanner: string;
    priority?: ScanPriority;
  }>,
  concurrency = 3,
): Promise<Result<{ scanIds: string[]; summary: ReturnType<typeof summarizeScanResults> }>> {
  if (!scans.length) {
    return success({ scanIds: [], summary: summarizeScanResults([]) });
  }

  // Create scan jobs
  const queue = new InMemoryScanQueue();
  const scanIds: string[] = [];

  for (const scan of scans) {
    const job: ScanJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectId: scan.projectId,
      targetUrl: scan.targetUrl,
      scanTypes: [scan.scanner],
      priority: scan.priority ?? 'medium',
      createdAt: new Date(),
      userId,
    };
    queue.enqueue(job);
  }

  // Execute in parallel
  const workerFn = async (job: ScanJob): Promise<unknown[]> => {
    const result = await dispatchScan(userId, job.projectId, job.scanTypes[0], job.targetUrl);
    if (result.ok) {
      scanIds.push(result.data.scanId);
      return [{ scanId: result.data.scanId, mode: result.data.mode }];
    }
    /* c8 ignore next */
    throw new Error(result.error?.message ?? 'Unknown error');
  };

  const allJobs: ScanJob[] = [];
  while (queue.size() > 0) {
    const job = queue.dequeue();
    if (job) allJobs.push(job);
  }

  const scanResults = await runScansParallel(allJobs, workerFn, concurrency);
  const summary = summarizeScanResults(scanResults);

  return success({
    scanIds,
    summary,
  });
}

