import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../errors';

type InsertResult = {
  data: { id: string } | null;
  error: unknown;
};

function makeSupabaseMock(opts: {
  insertResult: InsertResult;
  token?: string | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(opts.insertResult);
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const insert = vi.fn().mockReturnValue({ select });

  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn().mockReturnValue({ eq: deleteEq });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'scans') {
      return {
        insert,
        update,
        delete: del,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: {
      from,
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: opts.token ? { access_token: opts.token } : null },
        }),
      },
    },
    spies: { from, insert, update, updateEq, del, deleteEq, maybeSingle },
  };
}

describe('dispatchScan', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns SCAN_DB_INSERT_FAILED when scan row insert fails', async () => {
    const mock = makeSupabaseMock({
      insertResult: { data: null, error: { message: 'insert failed' } },
    });

    vi.doMock('../supabase', () => ({ supabase: mock.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan: vi.fn() }));

    vi.stubEnv('VITE_SUPABASE_URL', '');
    const { dispatchScan } = await import('../scanDispatch');

    const result = await dispatchScan('u1', 'p1', 'nmap', 'example.com');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.SCAN_DB_INSERT_FAILED);
    }
  });

  it('falls back to MOCK mode when edge is unavailable', async () => {
    const mock = makeSupabaseMock({
      insertResult: { data: { id: 'scan-placeholder' }, error: null },
    });
    const runMockScan = vi.fn().mockResolvedValue('scan-mock-1');

    vi.doMock('../supabase', () => ({ supabase: mock.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan }));

    vi.stubEnv('VITE_SUPABASE_URL', '');
    const { dispatchScan } = await import('../scanDispatch');

    const result = await dispatchScan('u1', 'p1', 'nmap', 'example.com');

    expect(runMockScan).toHaveBeenCalledWith('u1', 'p1', 'nmap');
    expect(result).toEqual({ ok: true, data: { scanId: 'scan-mock-1', mode: 'MOCK' } });
  });

  it('returns REAL mode when edge dispatch succeeds', async () => {
    const mock = makeSupabaseMock({
      insertResult: { data: { id: 'scan-real-1' }, error: null },
      token: 'token-123',
    });
    const runMockScan = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job_id: 'job-1' }),
    });

    vi.doMock('../supabase', () => ({ supabase: mock.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan }));
    vi.stubGlobal('fetch', fetchMock);

    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co');
    const { dispatchScan } = await import('../scanDispatch');

    const result = await dispatchScan('u1', 'p1', 'nmap', 'example.com');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runMockScan).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: { scanId: 'scan-real-1', mode: 'REAL' } });
  });
});

describe('dispatchScansParallel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('dispatches multiple scans and returns summary', async () => {
    const mockSupabase = makeSupabaseMock({
      insertResult: { data: { id: 'scan-p1' }, error: null },
      token: 'token-123',
    });
    const runMockScan = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ job_id: 'job-x' }),
    });

    vi.doMock('../supabase', () => ({ supabase: mockSupabase.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan }));
    vi.stubGlobal('fetch', fetchMock);

    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co');
    const { dispatchScansParallel } = await import('../scanDispatch');

    const scans = [
      { projectId: 'proj1', targetUrl: 'https://example1.com', scanner: 'nmap' },
      { projectId: 'proj2', targetUrl: 'https://example2.com', scanner: 'nuclei' },
      { projectId: 'proj3', targetUrl: 'https://example3.com', scanner: 'trivy', priority: 'high' as const },
    ];

    const result = await dispatchScansParallel('user-1', scans, 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.scanIds.length).toBeGreaterThanOrEqual(0);
      expect(result.data.summary.total).toBe(3);
    }
  });

  it('handles empty scan list', async () => {
    const mockSupabase = makeSupabaseMock({
      insertResult: { data: { id: 'scan-1' }, error: null },
    });
    vi.doMock('../supabase', () => ({ supabase: mockSupabase.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan: vi.fn() }));

    vi.stubEnv('VITE_SUPABASE_URL', '');
    const { dispatchScansParallel } = await import('../scanDispatch');

    const result = await dispatchScansParallel('user-1', []);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.scanIds).toEqual([]);
      expect(result.data.summary.total).toBe(0);
    }
  });

  it('respects concurrency limit', async () => {
    const mockSupabase = makeSupabaseMock({
      insertResult: { data: { id: 'scan-1' }, error: null },
      token: 'token-123',
    });
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const fetchMock = vi.fn(async () => {
      currentConcurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((r) => setTimeout(r, 10));
      currentConcurrent -= 1;
      return {
        ok: true,
        json: async () => ({ job_id: 'job-1' }),
      };
    });

    vi.doMock('../supabase', () => ({ supabase: mockSupabase.supabase }));
    vi.doMock('../scanMock', () => ({ runMockScan: vi.fn() }));
    vi.stubGlobal('fetch', fetchMock);

    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co');
    const { dispatchScansParallel } = await import('../scanDispatch');

    const scans = Array.from({ length: 5 }, (_, i) => ({
      projectId: `proj${i}`,
      targetUrl: `https://example${i}.com`,
      scanner: 'nmap',
    }));

    await dispatchScansParallel('user-1', scans, 2);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
