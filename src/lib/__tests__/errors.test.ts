import { describe, expect, it } from 'vitest';
import { errorToUserMessage, ErrorCode } from '../errors';

describe('errorToUserMessage', () => {
  it('maps known scan edge error', () => {
    const msg = errorToUserMessage({
      code: ErrorCode.SCAN_EDGE_FN_ERROR,
      message: 'edge failed',
      timestamp: new Date().toISOString(),
    });

    expect(msg).toContain('Scan service unavailable');
  });

  it('returns fallback message for unknown errors', () => {
    const msg = errorToUserMessage({
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'custom unknown',
      timestamp: new Date().toISOString(),
    });

    expect(msg).toBe('custom unknown');
  });
});
