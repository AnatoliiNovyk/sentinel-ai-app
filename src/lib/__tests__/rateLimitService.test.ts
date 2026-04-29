import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRateLimitConfig, getCurrentUsage, recordUsage } from '../rateLimitService';

// ── Supabase chain mocks (vi.hoisted to avoid TDZ) ───────────────────────────

const {
  mockMaybeSingle,
  mockGt,
  mockEq2,
  mockEq1,
  mockSelectFn,
  mockUpdateFn,
  mockUpdateEq,
  mockInsertFn,
} = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockGt = vi.fn();
  const mockEq2 = vi.fn();
  const mockEq1 = vi.fn();
  const mockSelectFn = vi.fn();
  const mockUpdateEq = vi.fn();
  const mockUpdateFn = vi.fn();
  const mockInsertFn = vi.fn();
  return {
    mockMaybeSingle,
    mockGt,
    mockEq2,
    mockEq1,
    mockSelectFn,
    mockUpdateFn,
    mockUpdateEq,
    mockInsertFn,
  };
});

vi.mock('../supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../supabase')>();
  return {
    ...actual,
    supabase: {
      from: () => ({
        select: mockSelectFn,
        update: mockUpdateFn,
        insert: mockInsertFn,
      }),
    },
  };
});

// Rebuild the full chain before each test
function setupChain() {
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockGt.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockEq2.mockReturnValue({ gt: mockGt });
  mockEq1.mockReturnValue({ eq: mockEq2 });
  mockSelectFn.mockReturnValue({ eq: mockEq1 });
  mockUpdateEq.mockResolvedValue({ error: null });
  mockUpdateFn.mockReturnValue({ eq: mockUpdateEq });
  mockInsertFn.mockResolvedValue({ error: null });
}

// ── getRateLimitConfig ────────────────────────────────────────────────────────

describe('getRateLimitConfig', () => {
  it('returns free plan limits', async () => {
    const config = await getRateLimitConfig('free');
    expect(config.scans_per_month).toBe(10);
    expect(config.reports_per_day).toBe(5);
    expect(config.chat_messages_per_hour).toBe(20);
    expect(config.api_calls_per_second).toBe(1);
  });

  it('returns basic plan limits', async () => {
    const config = await getRateLimitConfig('basic');
    expect(config.scans_per_month).toBe(100);
    expect(config.reports_per_day).toBe(50);
  });

  it('returns pro plan limits', async () => {
    const config = await getRateLimitConfig('pro');
    expect(config.api_calls_per_second).toBe(20);
  });

  it('falls back to free plan for unknown planId', async () => {
    const config = await getRateLimitConfig('unknown_xyz');
    expect(config.scans_per_month).toBe(10);
    expect(config.api_calls_per_second).toBe(1);
  });
});

// ── getCurrentUsage ───────────────────────────────────────────────────────────

describe('getCurrentUsage', () => {
  beforeEach(() => setupChain());

  it('returns count from DB when record found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { count: 7 }, error: null });
    const count = await getCurrentUsage('user-1', 'scans_per_month');
    expect(count).toBe(7);
  });

  it('returns 0 when no record found', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const count = await getCurrentUsage('user-1', 'reports_per_day');
    expect(count).toBe(0);
  });

  it('returns 0 on supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const count = await getCurrentUsage('user-1', 'api_calls_per_second');
    expect(count).toBe(0);
  });

  it('calls supabase with correct table and filters', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { count: 3 }, error: null });
    await getCurrentUsage('user-abc', 'chat_messages_per_hour');
    expect(mockEq1).toHaveBeenCalledWith('user_id', 'user-abc');
    expect(mockEq2).toHaveBeenCalledWith('metric', 'chat_messages_per_hour');
  });
});

// ── recordUsage ───────────────────────────────────────────────────────────────

describe('recordUsage', () => {
  beforeEach(() => setupChain());

  it('updates existing record (count + 1) and returns true', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'rec-1', count: 3 }, error: null });
    mockUpdateEq.mockResolvedValue({ error: null });

    const result = await recordUsage('user-1', 'scans_per_month');
    expect(result).toBe(true);
    expect(mockUpdateFn).toHaveBeenCalledWith({ count: 4 });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'rec-1');
  });

  it('inserts new record when none exists and returns true', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsertFn.mockResolvedValue({ error: null });

    const result = await recordUsage('user-1', 'chat_messages_per_hour');
    expect(result).toBe(true);
    expect(mockInsertFn).toHaveBeenCalled();
    const insertArgs = mockInsertFn.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArgs.user_id).toBe('user-1');
    expect(insertArgs.metric).toBe('chat_messages_per_hour');
    expect(insertArgs.count).toBe(1);
  });

  it('returns false when update fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: 'rec-1', count: 5 }, error: null });
    mockUpdateEq.mockResolvedValue({ error: { message: 'Update error' } });

    const result = await recordUsage('user-1', 'scans_per_month');
    expect(result).toBe(false);
  });

  it('returns false when insert fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsertFn.mockResolvedValue({ error: { message: 'Insert error' } });

    const result = await recordUsage('user-1', 'reports_per_day');
    expect(result).toBe(false);
  });
});
