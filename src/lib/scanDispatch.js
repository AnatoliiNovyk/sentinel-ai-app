import { supabase } from './supabase';
import { runMockScan } from './scanMock';
import { ErrorCode, failure, success } from './errors';
const EDGE_BASE = import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    : '';
/**
 * Dispatches a scan.
 * 1. Creates a `scans` row (status = queued).
 * 2. Calls the `scan-dispatch` Edge Function which inserts a `scan_jobs` row
 *    and the VPS agent picks it up.
 * 3. Falls back to the browser mock if the edge function is unavailable
 *    (dev environment or edge fn not deployed).
 *
 * Returns the scan_id on success, or null on failure.
 */
export async function dispatchScan(userId, projectId, scanner, target) {
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
        return failure(ErrorCode.SCAN_DB_INSERT_FAILED, 'Failed to create scan row.', scanErr, { projectId, scanner });
    }
    // 2. Attempt to call the real Edge Function
    if (EDGE_BASE) {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const res = await fetch(`${EDGE_BASE}/scan-dispatch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    scan_id: scan.id,
                    project_id: projectId,
                    scanner,
                    target,
                }),
            });
            if (res.ok) {
                const json = await res.json();
                await supabase
                    .from('scans')
                    .update({ status: 'running', is_mock: false, detected_mode: 'REAL' })
                    .eq('id', scan.id);
                console.info(`[scanDispatch] Job queued via edge fn: job_id=${json.job_id}`);
                return success({ scanId: scan.id, mode: 'REAL' });
            }
            const errBody = await res.text();
            console.warn(`[scanDispatch] Edge fn returned ${res.status}: ${errBody}. Falling back to mock.`);
        }
        catch (netErr) {
            console.warn('[scanDispatch] Edge fn unreachable, falling back to mock:', netErr);
        }
    }
    // 3. Fallback: browser mock (dev / demo mode)
    console.info('[scanDispatch] Running in MOCK mode (no real agent)');
    // Mark this scan row as the one mock will use
    await supabase.from('scans').update({ status: 'failed', detected_mode: 'MOCK', is_mock: true }).eq('id', scan.id);
    // runMockScan creates its own scan row — we need to delete the duplicate we created above
    // and let the mock complete it, OR we patch mock to accept an existing scan ID.
    // Simplest: delete the placeholder row and let mock handle everything.
    await supabase.from('scans').delete().eq('id', scan.id);
    const mockScanId = await runMockScan(userId, projectId, scanner);
    if (!mockScanId) {
        return failure(ErrorCode.SCAN_MOCK_FAILED, 'Mock scan failed to execute.', undefined, { projectId, scanner });
    }
    return success({ scanId: mockScanId, mode: 'MOCK' });
}
/**
 * Dispatches all due scheduled scans via the same pipeline.
 * Replaces the old browser-based scheduler that called runMockScan directly.
 */
export async function dispatchDueSchedules(userId) {
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
    if (due.length === 0)
        return 0;
    let fired = 0;
    for (const s of due) {
        const runAt = new Date();
        const next = new Date(runAt.getTime() + s.cadence_hours * 3600000);
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
        const target = s.projects?.target ?? '';
        const result = await dispatchScan(userId, s.project_id, s.scanner, target);
        if (result.ok) {
            fired++;
        }
        else {
            console.error('[scheduler] Failed to dispatch scheduled scan:', result.error);
        }
    }
    return fired;
}
