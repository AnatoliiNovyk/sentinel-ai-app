import { supabase, ScanSchedule } from './supabase';
import { runMockScan } from './scanMock';

export async function dispatchDueSchedules(userId: string): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('scan_schedules')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
    .lte('next_run_at', nowIso)
    .limit(10);

  const due = (data ?? []) as ScanSchedule[];
  if (due.length === 0) return 0;

  let fired = 0;
  for (const s of due) {
    const runAt = new Date();
    const next = new Date(runAt.getTime() + s.cadence_hours * 3600 * 1000);
    await supabase
      .from('scan_schedules')
      .update({ last_run_at: runAt.toISOString(), next_run_at: next.toISOString() })
      .eq('id', s.id);

    try {
      await runMockScan(userId, s.project_id, s.scanner);
      fired++;
    } catch (_err) {
      // continue even if one fails
    }
  }
  return fired;
}
