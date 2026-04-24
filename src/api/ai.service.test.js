import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '../lib/errors';
import { AiService, getPollingPolicy } from './ai.service';
import { supabase } from '../lib/supabase';
vi.mock('../lib/supabase', () => ({
    supabase: {
        rpc: vi.fn(),
        from: vi.fn(),
    },
}));
function makeQuery(data, error = null) {
    const query = {
        select: vi.fn(),
        eq: vi.fn(),
        gt: vi.fn(),
        is: vi.fn(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error }),
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
    vi.unstubAllEnvs();
});
describe('AiService', () => {
    it('uses default polling policy when env is not provided', () => {
        const policy = getPollingPolicy();
        expect(policy).toEqual({
            maxAttempts: 40,
            baseDelayMs: 1500,
            maxDelayMs: 8000,
            jitterRatio: 0.2,
        });
    });
    it('uses custom polling policy from valid env values', () => {
        vi.stubEnv('VITE_AI_POLL_MAX_ATTEMPTS', '7');
        vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '1200');
        vi.stubEnv('VITE_AI_POLL_MAX_DELAY_MS', '3000');
        vi.stubEnv('VITE_AI_POLL_JITTER_RATIO', '0.5');
        const policy = getPollingPolicy();
        expect(policy).toEqual({
            maxAttempts: 7,
            baseDelayMs: 1200,
            maxDelayMs: 3000,
            jitterRatio: 0.5,
        });
    });
    it('falls back to defaults for invalid env values', () => {
        vi.stubEnv('VITE_AI_POLL_MAX_ATTEMPTS', '0');
        vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '-10');
        vi.stubEnv('VITE_AI_POLL_MAX_DELAY_MS', 'abc');
        vi.stubEnv('VITE_AI_POLL_JITTER_RATIO', '2');
        const policy = getPollingPolicy();
        expect(policy).toEqual({
            maxAttempts: 40,
            baseDelayMs: 1500,
            maxDelayMs: 8000,
            jitterRatio: 0.2,
        });
    });
    it('normalizes max delay to be at least base delay', () => {
        vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '5000');
        vi.stubEnv('VITE_AI_POLL_MAX_DELAY_MS', '1500');
        const policy = getPollingPolicy();
        expect(policy.baseDelayMs).toBe(5000);
        expect(policy.maxDelayMs).toBe(5000);
    });
    it('returns AI_RPC_FAILED when generateFix rpc call fails', async () => {
        vi.mocked(supabase.rpc).mockResolvedValueOnce({
            data: null,
            error: { message: 'rpc failed' },
        });
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
        vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'job-1', error: null });
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
        vi.mocked(supabase.from).mockReturnValueOnce(query);
        const res = await AiService.pollForResult(null, Date.now() - 1000);
        expect(query.is).toHaveBeenCalledWith('scan_id', null);
        expect(res).toEqual({ ok: true, data: { id: 'vuln-1' } });
    });
    it('pollForResult returns timeout after retries', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const query = makeQuery(null);
        vi.mocked(supabase.from).mockImplementation(() => query);
        const promise = AiService.pollForResult('scan-1', Date.now() - 1000);
        await vi.runAllTimersAsync();
        const res = await promise;
        expect(query.eq).toHaveBeenCalledWith('scan_id', 'scan-1');
        expect(query.maybeSingle).toHaveBeenCalledTimes(40);
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.error.code).toBe(ErrorCode.AI_PROCESSING_TIMEOUT);
        }
    });
    it('pollForResult succeeds after retryable query error', async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const transientError = { code: 'ETIMEDOUT', message: 'temporary db timeout' };
        const query = makeQuery(null);
        query.maybeSingle
            .mockResolvedValueOnce({ data: null, error: transientError })
            .mockResolvedValueOnce({ data: { id: 'vuln-retry' }, error: null });
        vi.mocked(supabase.from).mockImplementation(() => query);
        const promise = AiService.pollForResult('scan-2', Date.now() - 1000);
        await vi.runAllTimersAsync();
        const res = await promise;
        expect(query.maybeSingle).toHaveBeenCalledTimes(2);
        expect(res).toEqual({ ok: true, data: { id: 'vuln-retry' } });
    });
    it('pollForResult fails immediately on non-retryable query error', async () => {
        const nonRetryableError = { code: '42501', message: 'permission denied' };
        const query = makeQuery(null, nonRetryableError);
        vi.mocked(supabase.from).mockImplementation(() => query);
        const res = await AiService.pollForResult('scan-3', Date.now() - 1000);
        expect(query.maybeSingle).toHaveBeenCalledTimes(1);
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.error.code).toBe(ErrorCode.AI_POLLING_FAILED);
            expect(res.error.cause).toEqual(nonRetryableError);
        }
    });
});
