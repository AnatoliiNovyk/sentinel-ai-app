/**
 * AuditService unit tests — covers retry behavior, all public methods,
 * filtering, and fire-and-forget semantics.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService, AuditAction, type AuditLogEntry } from '../audit.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    orgId: 'org-test',
    userId: 'user-test',
    action: AuditAction.SCAN_CREATED,
    resourceType: 'scan',
    resourceId: 'scan-1',
    status: 'success',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase mock — configurable per test via insertMock
// ─────────────────────────────────────────────────────────────────────────────
const insertMock = vi.fn();
const selectMock = vi.fn();
const deleteMock = vi.fn();

vi.mock('../client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'audit_logs') {
        return {
          insert: insertMock,
          select: selectMock,
          delete: deleteMock,
        };
      }
      return { insert: vi.fn(), select: vi.fn(), delete: vi.fn() };
    }),
  },
}));

// Silence logger output during tests
vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
  }),
}));

describe('AuditService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── log() ──────────────────────────────────────────────────────────────────
  describe('log()', () => {
    it('inserts a row with correct payload on first attempt', async () => {
      insertMock.mockResolvedValueOnce({ error: null });

      await AuditService.log(makeEntry({ metadata: { ip: '127.0.0.1' } }));

      expect(insertMock).toHaveBeenCalledOnce();
      const [payload] = insertMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload['org_id']).toBe('org-test');
      expect(payload['action']).toBe(AuditAction.SCAN_CREATED);
      expect(payload['status']).toBe('success');
      expect(payload['metadata']).toBe(JSON.stringify({ ip: '127.0.0.1' }));
    });

    it('retries on transient DB error and succeeds on second attempt', async () => {
      insertMock
        .mockResolvedValueOnce({ error: new Error('connection reset') })
        .mockResolvedValueOnce({ error: null });

      const promise = AuditService.log(makeEntry());
      // Advance past the first retry delay (1000ms)
      await vi.advanceTimersByTimeAsync(1100);
      await promise;

      expect(insertMock).toHaveBeenCalledTimes(2);
    });

    it('retries twice and succeeds on third attempt', async () => {
      insertMock
        .mockResolvedValueOnce({ error: new Error('timeout') })
        .mockResolvedValueOnce({ error: new Error('timeout') })
        .mockResolvedValueOnce({ error: null });

      const promise = AuditService.log(makeEntry());
      // Advance past delay 1 (1000ms) + delay 2 (2000ms)
      await vi.advanceTimersByTimeAsync(3500);
      await promise;

      expect(insertMock).toHaveBeenCalledTimes(3);
    });

    it('does NOT throw when all 3 retries are exhausted', async () => {
      insertMock.mockResolvedValue({ error: new Error('DB down') });

      const promise = AuditService.log(makeEntry());
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(promise).resolves.toBeUndefined();

      expect(insertMock).toHaveBeenCalledTimes(3);
    });

    it('serializes changes as JSON string', async () => {
      insertMock.mockResolvedValueOnce({ error: null });

      await AuditService.log(makeEntry({ changes: { before: 'x', after: 'y' } }));

      const [payload] = insertMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload['changes']).toBe(JSON.stringify({ before: 'x', after: 'y' }));
    });

    it('sets null for optional fields when not provided', async () => {
      insertMock.mockResolvedValueOnce({ error: null });

      await AuditService.log(makeEntry());

      const [payload] = insertMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload['error_code']).toBeNull();
      expect(payload['error_message']).toBeNull();
      expect(payload['ip_address']).toBeNull();
      expect(payload['user_agent']).toBeNull();
      expect(payload['changes']).toBeNull();
      expect(payload['metadata']).toBeNull();
    });
  });

  // ── logFailure() ───────────────────────────────────────────────────────────
  describe('logFailure()', () => {
    it('inserts a failure entry with error details', async () => {
      insertMock.mockResolvedValueOnce({ error: null });

      await AuditService.logFailure(
        'org-1', 'user-1',
        AuditAction.AUTH_FAILED,
        'session', 'sess-xyz',
        'INVALID_TOKEN', 'JWT signature invalid',
        { ip: '10.0.0.1' }
      );

      const [payload] = insertMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload['status']).toBe('failure');
      expect(payload['error_code']).toBe('INVALID_TOKEN');
      expect(payload['error_message']).toBe('JWT signature invalid');
      expect(payload['action']).toBe(AuditAction.AUTH_FAILED);
    });

    it('does not throw when DB insert fails', async () => {
      insertMock.mockResolvedValue({ error: new Error('DB error') });

      const promise = AuditService.logFailure(
        'org', 'user', AuditAction.SCAN_FAILED, 'scan', 's1', 'ERR', 'msg'
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  // ── logSecurityEvent() ────────────────────────────────────────────────────
  describe('logSecurityEvent()', () => {
    it('does not throw (fire-and-forget)', () => {
      insertMock.mockResolvedValue({ error: null });
      expect(() =>
        AuditService.logSecurityEvent(
          'org-1', 'user-1', AuditAction.USER_LOGIN, 'session', 'sess-1'
        )
      ).not.toThrow();
    });

    it('inserts a success entry asynchronously', async () => {
      insertMock.mockResolvedValue({ error: null });

      AuditService.logSecurityEvent(
        'org-1', 'user-1', AuditAction.RATE_LIMIT_EXCEEDED, 'api', 'ep-1',
        { endpoint: '/scan-dispatch' }
      );

      // Let microtasks flush
      await vi.runAllTimersAsync();
      expect(insertMock).toHaveBeenCalled();
      const [payload] = insertMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload['action']).toBe(AuditAction.RATE_LIMIT_EXCEEDED);
      expect(payload['status']).toBe('success');
    });
  });

  // ── queryLogs() ───────────────────────────────────────────────────────────
  describe('queryLogs()', () => {
    function buildQueryChain(result: { data: AuditLogEntry[]; error: null }) {
      const limit = vi.fn(() => Promise.resolve(result));
      const order = vi.fn(() => ({ limit }));
      const lte = vi.fn(() => ({ order }));
      const gte = vi.fn(() => ({ order, lte }));
      const eq = vi.fn(() => ({ eq, order, gte, lte }));
      const select = vi.fn(() => ({ eq }));
      return { select, eq, order, gte, lte, limit };
    }

    it('returns empty array when no logs exist', async () => {
      const chain = buildQueryChain({ data: [], error: null });
      selectMock.mockReturnValueOnce(chain.eq());

      const result = await AuditService.queryLogs('org-empty');
      expect(Array.isArray(result)).toBe(true);
    });

    it('applies org_id filter', async () => {
      const chain = buildQueryChain({ data: [], error: null });
      const eqSpy = vi.fn(() => chain);
      selectMock.mockReturnValueOnce({ eq: eqSpy });

      await AuditService.queryLogs('org-123');

      expect(eqSpy).toHaveBeenCalledWith('org_id', 'org-123');
    });
  });

  // ── getSummary() ──────────────────────────────────────────────────────────
  describe('getSummary()', () => {
    it('counts success and failure entries correctly', async () => {
      const fakeLogs: Partial<AuditLogEntry>[] = [
        { action: AuditAction.SCAN_CREATED, status: 'success' },
        { action: AuditAction.SCAN_FAILED, status: 'failure', errorMessage: 'timeout', userId: 'u1' },
        { action: AuditAction.SCAN_CREATED, status: 'success' },
      ];

      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce(
        fakeLogs as AuditLogEntry[]
      );

      const summary = await AuditService.getSummary(
        'org-1', new Date(Date.now() - 3600_000), new Date()
      );

      expect(summary.totalActions).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(1);
      expect(summary.actionBreakdown[AuditAction.SCAN_CREATED]).toBe(2);
      expect(summary.topFailures).toHaveLength(1);
      expect(summary.topFailures[0].action).toBe(AuditAction.SCAN_FAILED);
    });

    it('returns zero counts for empty log range', async () => {
      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce([]);

      const summary = await AuditService.getSummary(
        'org-empty', new Date(Date.now() - 3600_000), new Date()
      );

      expect(summary.totalActions).toBe(0);
      expect(summary.successCount).toBe(0);
      expect(summary.failureCount).toBe(0);
      expect(summary.topFailures).toHaveLength(0);
    });
  });

  // ── detectAnomalies() ─────────────────────────────────────────────────────
  describe('detectAnomalies()', () => {
    it('identifies users who exceeded rate limit 5+ times', async () => {
      const fakeLogs: Partial<AuditLogEntry>[] = [
        ...Array.from({ length: 7 }, () => ({
          userId: 'spammer',
          action: AuditAction.RATE_LIMIT_EXCEEDED,
          status: 'failure' as const,
        })),
        { userId: 'normal', action: AuditAction.SCAN_CREATED, status: 'success' },
      ];

      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce(
        fakeLogs as AuditLogEntry[]
      );

      const anomalies = await AuditService.detectAnomalies('org-1');

      expect(anomalies.rateLimitedUsers).toHaveLength(1);
      expect(anomalies.rateLimitedUsers[0].userId).toBe('spammer');
      expect(anomalies.rateLimitedUsers[0].count).toBe(7);
    });

    it('counts circuit breaker events', async () => {
      const fakeLogs: Partial<AuditLogEntry>[] = [
        { userId: 'u1', action: AuditAction.CIRCUIT_BREAKER_OPENED, status: 'failure' as const },
        { userId: 'u2', action: AuditAction.CIRCUIT_BREAKER_OPENED, status: 'failure' as const },
      ];

      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce(
        fakeLogs as AuditLogEntry[]
      );

      const anomalies = await AuditService.detectAnomalies('org-1');

      expect(anomalies.circuitBreakerEvents).toBe(2);
    });

    it('identifies users with 3+ failed auth attempts', async () => {
      const fakeLogs: Partial<AuditLogEntry>[] = Array.from({ length: 5 }, () => ({
        userId: 'brute-force-user',
        action: AuditAction.AUTH_FAILED,
        status: 'failure' as const,
      }));

      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce(
        fakeLogs as AuditLogEntry[]
      );

      const anomalies = await AuditService.detectAnomalies('org-1');

      expect(anomalies.failedAuthAttempts).toHaveLength(1);
      expect(anomalies.failedAuthAttempts[0].userId).toBe('brute-force-user');
    });

    it('returns empty arrays when no anomalies present', async () => {
      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce([]);

      const anomalies = await AuditService.detectAnomalies('org-clean');

      expect(anomalies.rateLimitedUsers).toHaveLength(0);
      expect(anomalies.failedAuthAttempts).toHaveLength(0);
      expect(anomalies.circuitBreakerEvents).toBe(0);
    });
  });

  // ── exportLogs ─────────────────────────────────────────────────────────────

  describe('exportLogs', () => {
    it('returns CSV string with header row', async () => {
      const logs: AuditLogEntry[] = [
        makeEntry({
          timestamp: '2026-04-30T10:00:00Z',
          userId: 'user-1',
          action: AuditAction.SCAN_CREATED,
          resourceType: 'scan',
          resourceId: 'scan-1',
          status: 'success',
        }),
      ];
      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce(logs);

      const csv = await AuditService.exportLogs('org-1', new Date('2026-04-01'), new Date('2026-04-30'));

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Timestamp');
      expect(csv).toContain('User ID');
      expect(csv).toContain('Action');
      expect(csv).toContain('scan_created');
    });

    it('handles logs with optional fields as empty strings in CSV', async () => {
      const logs: AuditLogEntry[] = [
        makeEntry({ errorCode: undefined, errorMessage: undefined, ipAddress: undefined }),
      ];
      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce(logs);

      const csv = await AuditService.exportLogs('org-1', new Date('2026-04-01'), new Date('2026-04-30'));

      expect(csv).toContain('""');
    });

    it('returns only header when logs array is empty', async () => {
      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce([]);

      const csv = await AuditService.exportLogs('org-1', new Date('2026-04-01'), new Date('2026-04-30'));

      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // only header
      expect(lines[0]).toContain('Timestamp');
    });

    it('escapes double-quotes in cell values', async () => {
      const logs: AuditLogEntry[] = [
        makeEntry({ errorMessage: 'He said "hello"' }),
      ];
      vi.spyOn(AuditService, 'queryLogs').mockResolvedValueOnce(logs);

      const csv = await AuditService.exportLogs('org-1', new Date(), new Date());
      expect(csv).toContain('He said ""hello""');
    });
  });

  // ── cleanupOldLogs ─────────────────────────────────────────────────────────

  describe('cleanupOldLogs', () => {
    it('returns 0 when status is 204 (no content)', async () => {
      deleteMock.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ error: null, status: 204 }),
        }),
      });

      const result = await AuditService.cleanupOldLogs('org-1', 30);
      expect(result).toBe(0);
    });

    it('returns 1 when status is 200 (rows affected)', async () => {
      deleteMock.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ error: null, status: 200 }),
        }),
      });

      const result = await AuditService.cleanupOldLogs('org-1', 90);
      expect(result).toBe(1);
    });

    it('throws when delete returns an error', async () => {
      deleteMock.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ error: new Error('Delete failed'), status: 500 }),
        }),
      });

      await expect(AuditService.cleanupOldLogs('org-1', 90)).rejects.toThrow('Delete failed');
    });

    it('uses default retention of 90 days', async () => {
      const ltMock = vi.fn().mockResolvedValue({ error: null, status: 204 });
      deleteMock.mockReturnValue({
        eq: vi.fn().mockReturnValue({ lt: ltMock }),
      });

      await AuditService.cleanupOldLogs('org-1'); // no retentionDays arg
      const cutoffArg = ltMock.mock.calls[0][1] as string;
      const cutoff = new Date(cutoffArg);
      const expectedApprox = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      // Allow 5s difference for test execution time
      expect(Math.abs(cutoff.getTime() - expectedApprox.getTime())).toBeLessThan(5000);
    });
  });
});
