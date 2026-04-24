import { describe, expect, it } from 'vitest';
import { ErrorCode, failure, success } from '../errors';
describe('Result contract helpers', () => {
    it('returns ok result with payload via success()', () => {
        const res = success({ scanId: 'scan-1', mode: 'REAL' });
        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.data.scanId).toBe('scan-1');
            expect(res.data.mode).toBe('REAL');
        }
    });
    it('returns error result with metadata via failure()', () => {
        const res = failure(ErrorCode.SCAN_EDGE_FN_ERROR, 'Edge failed', new Error('network down'), { projectId: 'p-1' });
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.error.code).toBe(ErrorCode.SCAN_EDGE_FN_ERROR);
            expect(res.error.message).toBe('Edge failed');
            expect(res.error.context).toEqual({ projectId: 'p-1' });
            expect(typeof res.error.timestamp).toBe('string');
            expect(res.error.timestamp.length).toBeGreaterThan(0);
        }
    });
});
