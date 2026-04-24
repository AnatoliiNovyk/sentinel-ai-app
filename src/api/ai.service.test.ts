import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../lib/errors';
import { AiService } from './ai.service';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

type QueryMock = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function makeQuery(data: unknown): QueryMock {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gt: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data }),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gt.mockReturnValue(query);
  query.is.mockReturnValue(query);

  return query;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AiService', () => {
  it('returns AI_RPC_FAILED when generateFix rpc call fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc failed' },
    } as never);

    const res = await AiService.generateFix({
      title: 'v',
      description: 'd',
      severity: 'high',
      asset: 'a',
      project_id: 'p1',
      scan_id: 's1',
      user_id: 'u1',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ErrorCode.AI_RPC_FAILED);
    }
  });

  it('returns success with job id when generateFix rpc succeeds', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'job-1', error: null } as never);

    const res = await AiService.generateFix({
      title: 'v',
      description: 'd',
      severity: 'high',
      asset: 'a',
      project_id: 'p1',
      scan_id: 's1',
      user_id: 'u1',
    });

    expect(res).toEqual({ ok: true, data: 'job-1' });
  });

  it('pollForResult returns first matching record for null scanId', async () => {
    const query = makeQuery({ id: 'vuln-1' });
    vi.mocked(supabase.from).mockReturnValueOnce(query as never);

    const res = await AiService.pollForResult(null, Date.now() - 1000);

    expect(query.is).toHaveBeenCalledWith('scan_id', null);
    expect(res).toEqual({ ok: true, data: { id: 'vuln-1' } });
  });

  it('pollForResult returns timeout after retries', async () => {
    vi.useFakeTimers();
    const query = makeQuery(null);
    vi.mocked(supabase.from).mockImplementation(() => query as never);

    const promise = AiService.pollForResult('scan-1', Date.now() - 1000);
    await vi.advanceTimersByTimeAsync(40 * 3000);
    const res = await promise;

    expect(query.eq).toHaveBeenCalledWith('scan_id', 'scan-1');
    expect(query.maybeSingle).toHaveBeenCalledTimes(40);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ErrorCode.AI_PROCESSING_TIMEOUT);
    }
  });
});
