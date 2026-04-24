import { describe, expect, it } from 'vitest';
import {
  consumeRateLimit,
  extractClientKey,
} from '../../../supabase/functions/ai-gateway/rateLimit';

describe('ai-gateway rate limit', () => {
  it('allows requests up to limit and blocks the next one', () => {
    const store = new Map<string, number[]>();
    const key = '10.0.0.1';
    const now = 1000;

    expect(consumeRateLimit(store, key, now, 2, 60_000).allowed).toBe(true);
    expect(consumeRateLimit(store, key, now + 100, 2, 60_000).allowed).toBe(true);

    const blocked = consumeRateLimit(store, key, now + 200, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows requests again when the window expires', () => {
    const store = new Map<string, number[]>();
    const key = '10.0.0.2';

    expect(consumeRateLimit(store, key, 1_000, 1, 1_000).allowed).toBe(true);
    expect(consumeRateLimit(store, key, 1_500, 1, 1_000).allowed).toBe(false);
    expect(consumeRateLimit(store, key, 2_001, 1, 1_000).allowed).toBe(true);
  });

  it('extracts client key from x-forwarded-for first IP', () => {
    const req = new Request('https://example.com', {
      headers: {
        'x-forwarded-for': '203.0.113.5, 198.51.100.7',
      },
    });

    expect(extractClientKey(req)).toBe('203.0.113.5');
  });
});
