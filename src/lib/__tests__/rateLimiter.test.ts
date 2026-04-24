import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  RateLimiter,
  CircuitBreaker,
  CircuitOpenError,
  getRateLimiter,
  getCircuitBreaker,
  resetAllRateLimiters,
  resetAllCircuitBreakers,
} from '../rateLimiter';

// ─── RateLimiter ─────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  it('throws for invalid config (maxRequests <= 0)', () => {
    expect(() => new RateLimiter({ maxRequests: 0, windowMs: 1000 })).toThrow();
  });

  it('throws for invalid config (windowMs <= 0)', () => {
    expect(() => new RateLimiter({ maxRequests: 5, windowMs: 0 })).toThrow();
  });

  it('allows requests within limit', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('user-1');
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks request when limit exceeded', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });
    limiter.check('user-x');
    limiter.check('user-x');
    limiter.check('user-x');
    const blocked = limiter.check('user-x');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks remaining count correctly', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const r1 = limiter.check('user-a');
    expect(r1.remaining).toBe(4);
    const r2 = limiter.check('user-a');
    expect(r2.remaining).toBe(3);
  });

  it('isolates different keys', () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });
    limiter.check('user-1');
    limiter.check('user-1');
    const blocked = limiter.check('user-1');
    expect(blocked.allowed).toBe(false);

    // user-2 is untouched
    const allowed = limiter.check('user-2');
    expect(allowed.allowed).toBe(true);
  });

  it('allows requests again after window expires', async () => {
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 50 });
    limiter.check('key');
    limiter.check('key');
    expect(limiter.check('key').allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));
    expect(limiter.check('key').allowed).toBe(true);
  });

  it('reset clears a specific key', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
    limiter.check('reset-me');
    expect(limiter.check('reset-me').allowed).toBe(false);
    limiter.reset('reset-me');
    expect(limiter.check('reset-me').allowed).toBe(true);
  });

  it('resetAll clears all keys', () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
    limiter.check('a');
    limiter.check('b');
    limiter.resetAll();
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('getCount returns current request count', () => {
    const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000 });
    expect(limiter.getCount('cnt')).toBe(0);
    limiter.check('cnt');
    limiter.check('cnt');
    expect(limiter.getCount('cnt')).toBe(2);
  });

  it('getConfig returns defensive copy of config', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
    const config = limiter.getConfig();
    expect(config.maxRequests).toBe(5);
    expect(config.windowMs).toBe(1000);
  });

  it('provides resetAt timestamp in result', () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
    const result = limiter.check('ts-test');
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});

// ─── CircuitBreaker ──────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100,
    });
  });

  it('throws for invalid config', () => {
    expect(() => new CircuitBreaker({ failureThreshold: 0, successThreshold: 1, timeout: 100 })).toThrow();
    expect(() => new CircuitBreaker({ failureThreshold: 1, successThreshold: 0, timeout: 100 })).toThrow();
    expect(() => new CircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeout: 0 })).toThrow();
  });

  it('starts in CLOSED state', () => {
    expect(cb.getState()).toBe('CLOSED');
  });

  it('executes function successfully when CLOSED', async () => {
    const result = await cb.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('opens circuit after failure threshold', async () => {
    const failFn = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await cb.execute(failFn).catch(() => {});
    }
    expect(cb.getState()).toBe('OPEN');
  });

  it('throws CircuitOpenError when OPEN', async () => {
    cb.forceOpen();
    await expect(cb.execute(() => Promise.resolve('x'))).rejects.toThrow(CircuitOpenError);
  });

  it('transitions to HALF_OPEN after timeout', async () => {
    cb.forceOpen();
    expect(cb.getState()).toBe('OPEN');
    await new Promise((r) => setTimeout(r, 110));
    expect(cb.getState()).toBe('HALF_OPEN');
  });

  it('closes circuit after success threshold in HALF_OPEN', async () => {
    cb.forceOpen();
    await new Promise((r) => setTimeout(r, 110));
    expect(cb.getState()).toBe('HALF_OPEN');

    await cb.execute(() => Promise.resolve('ok'));
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.getState()).toBe('CLOSED');
  });

  it('reopens circuit on failure in HALF_OPEN', async () => {
    // Open then wait for HALF_OPEN transition
    const failFn = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) await cb.execute(failFn).catch(() => {});
    expect(cb.getState()).toBe('OPEN');
    await new Promise((r) => setTimeout(r, 110));
    expect(cb.getState()).toBe('HALF_OPEN');

    // One failure in HALF_OPEN should re-open
    await cb.execute(failFn).catch(() => {});
    expect(cb.getState()).toBe('OPEN');
  });

  it('reset returns circuit to CLOSED with clean state', () => {
    cb.forceOpen();
    cb.reset();
    expect(cb.getState()).toBe('CLOSED');
    const stats = cb.getStats();
    expect(stats.failures).toBe(0);
    expect(stats.totalRequests).toBe(0);
  });

  it('getStats returns correct stats object', async () => {
    await cb.execute(() => Promise.resolve('x'));
    const stats = cb.getStats();
    expect(stats.state).toBe('CLOSED');
    expect(stats.totalRequests).toBe(1);
    expect(stats.failures).toBe(0);
  });

  it('records lastFailureAt on failure', async () => {
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    const stats = cb.getStats();
    expect(stats.lastFailureAt).not.toBeNull();
    expect(stats.lastFailureAt!).toBeLessThanOrEqual(Date.now());
  });

  it('nextAttemptAt is null when CLOSED', () => {
    expect(cb.getStats().nextAttemptAt).toBeNull();
  });

  it('nextAttemptAt is set when OPEN', () => {
    cb.forceOpen();
    expect(cb.getStats().nextAttemptAt).toBeGreaterThan(Date.now());
  });

  it('propagates original error from wrapped function', async () => {
    const originalError = new Error('original error');
    await expect(cb.execute(() => Promise.reject(originalError))).rejects.toBe(originalError);
  });

  it('CircuitOpenError has correct name', async () => {
    cb.forceOpen();
    const error = await cb.execute(() => Promise.resolve('x')).catch((e) => e);
    expect(error).toBeInstanceOf(CircuitOpenError);
    expect(error.name).toBe('CircuitOpenError');
  });
});

// ─── Global Registry ─────────────────────────────────────────────────────

describe('Global Rate Limiter Registry', () => {
  beforeEach(() => resetAllRateLimiters());

  it('creates new rate limiter with config', () => {
    const limiter = getRateLimiter('api', { maxRequests: 10, windowMs: 60_000 });
    expect(limiter).toBeInstanceOf(RateLimiter);
  });

  it('returns same instance for same name', () => {
    const a = getRateLimiter('shared', { maxRequests: 5, windowMs: 1000 });
    const b = getRateLimiter('shared');
    expect(a).toBe(b);
  });

  it('throws when getting non-existent limiter without config', () => {
    expect(() => getRateLimiter('nonexistent')).toThrow();
  });
});

describe('Global Circuit Breaker Registry', () => {
  beforeEach(() => resetAllCircuitBreakers());

  it('creates new circuit breaker with config', () => {
    const breaker = getCircuitBreaker('db', { failureThreshold: 3, successThreshold: 2, timeout: 5000 });
    expect(breaker).toBeInstanceOf(CircuitBreaker);
  });

  it('returns same instance for same name', () => {
    const a = getCircuitBreaker('service', { failureThreshold: 5, successThreshold: 3, timeout: 10_000 });
    const b = getCircuitBreaker('service');
    expect(a).toBe(b);
  });

  it('throws when getting non-existent breaker without config', () => {
    expect(() => getCircuitBreaker('nonexistent')).toThrow();
  });

  afterEach(() => {
    resetAllRateLimiters();
    resetAllCircuitBreakers();
  });
});
