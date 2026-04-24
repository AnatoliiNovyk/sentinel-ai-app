import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ScanInsertRow = { data: { id: string } | null; error: unknown };

type ScheduleRow = {
  id: string;
  project_id: string;
  scanner: string;
  cadence_hours: number;
  last_run_at: string | null;
  projects?: { target?: string };
};

function makeSupabaseMock(opts: {
  due: ScheduleRow[];
  fetchError?: unknown;
  updateErrors?: Array<unknown | null>;
  scanInserts?: ScanInsertRow[];
}) {
  const scheduleChain = {
    eq: vi.fn(),
    lte: vi.fn(),
    limit: vi.fn(),
  };
  scheduleChain.eq.mockReturnValue(scheduleChain);
  scheduleChain.lte.mockReturnValue(scheduleChain);
  scheduleChain.limit.mockResolvedValue({
    data: opts.fetchError ? null : opts.due,
    error: opts.fetchError ?? null,
  });

  const scanSchedulesUpdateEq2 = vi
    .fn()
    .mockImplementation(() => Promise.resolve({ error: opts.updateErrors?.shift() ?? null }));
  const scanSchedulesUpdateEq1 = vi.fn().mockReturnValue({ eq: scanSchedulesUpdateEq2 });
  const scanSchedulesUpdate = vi.fn().mockReturnValue({ eq: scanSchedulesUpdateEq1 });
  const scanSchedulesSelect = vi.fn().mockReturnValue(scheduleChain);

  const inserts = [...(opts.scanInserts ?? [{ data: { id: 'scan-1' }, error: null }])];
  const scansMaybeSingle = vi.fn().mockImplementation(() => {
    const next = inserts.shift() ?? { data: { id: `scan-${Date.now()}` }, error: null };
    return Promise.resolve(next);
  });
  const scansSelect = vi.fn().mockReturnValue({ maybeSingle: scansMaybeSingle });
  const scansInsert = vi.fn().mockReturnValue({ select: scansSelect });

  const scansUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const scansUpdate = vi.fn().mockReturnValue({ eq: scansUpdateEq });

  const scansDeleteEq = vi.fn().mockResolvedValue({ error: null });
  const scansDelete = vi.fn().mockReturnValue({ eq: scansDeleteEq });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'scan_schedules') {
      return {
        select: scanSchedulesSelect,
        update: scanSchedulesUpdate,
      };
    }

    if (table === 'scans') {
      return {
        insert: scansInsert,
        update: scansUpdate,
        delete: scansDelete,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: {
      from,
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
    },
    spies: {
      from,
      scanSchedulesUpdateEq2,
      scansInsert,
    },
  };
}

describe('dispatchDueSchedules', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns 0 when due schedules query fails', async () => {
    const mock = makeSupabaseMock({
      due: [],
      fetchError: { message: 'db unavailable' },
    });

    vi.doMock('../supabase', () => ({ supabase: mock.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan: vi.fn() }));
    vi.stubEnv('VITE_SUPABASE_URL', '');

    const { dispatchDueSchedules } = await import('../scanDispatch');
    const fired = await dispatchDueSchedules('u-1');

    expect(fired).toBe(0);
  });

  it('returns 0 when no schedules are due', async () => {
    const mock = makeSupabaseMock({ due: [] });

    vi.doMock('../supabase', () => ({ supabase: mock.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan: vi.fn() }));
    vi.stubEnv('VITE_SUPABASE_URL', '');

    const { dispatchDueSchedules } = await import('../scanDispatch');
    const fired = await dispatchDueSchedules('u-1');

    expect(fired).toBe(0);
    expect(mock.spies.scansInsert).not.toHaveBeenCalled();
  });

  it('skips schedule when optimistic lock update fails', async () => {
    const mock = makeSupabaseMock({
      due: [
        {
          id: 'sched-1',
          project_id: 'p-1',
          scanner: 'nmap',
          cadence_hours: 24,
          last_run_at: '2026-04-23T00:00:00.000Z',
          projects: { target: 'example.com' },
        },
      ],
      updateErrors: [{ message: 'stale row' }],
    });

    vi.doMock('../supabase', () => ({ supabase: mock.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan: vi.fn() }));
    vi.stubEnv('VITE_SUPABASE_URL', '');

    const { dispatchDueSchedules } = await import('../scanDispatch');
    const fired = await dispatchDueSchedules('u-1');

    expect(fired).toBe(0);
    expect(mock.spies.scansInsert).not.toHaveBeenCalled();
  });

  it('dispatches due schedules and counts successful launches only', async () => {
    const mock = makeSupabaseMock({
      due: [
        {
          id: 'sched-1',
          project_id: 'p-1',
          scanner: 'nmap',
          cadence_hours: 24,
          last_run_at: '2026-04-23T00:00:00.000Z',
          projects: { target: 'a.example.com' },
        },
        {
          id: 'sched-2',
          project_id: 'p-2',
          scanner: 'amass',
          cadence_hours: 24,
          last_run_at: '2026-04-23T00:00:00.000Z',
          projects: { target: 'b.example.com' },
        },
      ],
      updateErrors: [null, null],
      scanInserts: [
        { data: { id: 'scan-1' }, error: null },
        { data: { id: 'scan-2' }, error: null },
      ],
    });

    const runMockScan = vi
      .fn()
      .mockResolvedValueOnce('mock-scan-1')
      .mockResolvedValueOnce(null);

    vi.doMock('../supabase', () => ({ supabase: mock.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan }));
    vi.stubEnv('VITE_SUPABASE_URL', '');

    const { dispatchDueSchedules } = await import('../scanDispatch');
    const fired = await dispatchDueSchedules('u-1');

    expect(runMockScan).toHaveBeenCalledTimes(2);
    expect(fired).toBe(1);
  });
});
