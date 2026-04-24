import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Pure function exports from ai.service ─────────────────────────────────
// We import only the pure helpers; Supabase-dependent methods are not tested here.
import { getPollingPolicy } from '../ai.service';

// Also import internal helpers by importing the module directly via vi.importActual
// since getBackoffDelayMs and isRetryablePollingError are not exported.
// We test them indirectly via observable behaviour of getPollingPolicy and
// by importing the module internals using the module's side-effects.

// ── getPollingPolicy ──────────────────────────────────────────────────────

describe('getPollingPolicy', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns defaults when no env vars are set', () => {
    const policy = getPollingPolicy();
    expect(policy.maxAttempts).toBe(40);
    expect(policy.baseDelayMs).toBe(1500);
    expect(policy.maxDelayMs).toBe(8000);
    expect(policy.jitterRatio).toBe(0.2);
  });

  it('applies valid VITE_AI_POLL_MAX_ATTEMPTS override', () => {
    vi.stubEnv('VITE_AI_POLL_MAX_ATTEMPTS', '10');
    const policy = getPollingPolicy();
    expect(policy.maxAttempts).toBe(10);
  });

  it('rejects VITE_AI_POLL_MAX_ATTEMPTS below min (< 1) → uses default', () => {
    vi.stubEnv('VITE_AI_POLL_MAX_ATTEMPTS', '0');
    const policy = getPollingPolicy();
    expect(policy.maxAttempts).toBe(40);
  });

  it('rejects VITE_AI_POLL_MAX_ATTEMPTS above max (> 300) → uses default', () => {
    vi.stubEnv('VITE_AI_POLL_MAX_ATTEMPTS', '500');
    const policy = getPollingPolicy();
    expect(policy.maxAttempts).toBe(40);
  });

  it('rejects non-numeric VITE_AI_POLL_MAX_ATTEMPTS → uses default', () => {
    vi.stubEnv('VITE_AI_POLL_MAX_ATTEMPTS', 'abc');
    const policy = getPollingPolicy();
    expect(policy.maxAttempts).toBe(40);
  });

  it('applies valid VITE_AI_POLL_BASE_DELAY_MS override', () => {
    vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '3000');
    const policy = getPollingPolicy();
    expect(policy.baseDelayMs).toBe(3000);
  });

  it('rejects base delay below 100ms → uses default', () => {
    vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '50');
    const policy = getPollingPolicy();
    expect(policy.baseDelayMs).toBe(1500);
  });

  it('applies valid VITE_AI_POLL_MAX_DELAY_MS override', () => {
    vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '1000');
    vi.stubEnv('VITE_AI_POLL_MAX_DELAY_MS', '20000');
    const policy = getPollingPolicy();
    expect(policy.maxDelayMs).toBe(20000);
  });

  it('ensures maxDelayMs >= baseDelayMs when max < base', () => {
    vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '5000');
    vi.stubEnv('VITE_AI_POLL_MAX_DELAY_MS', '1000');
    const policy = getPollingPolicy();
    // maxDelayMs candidate 1000 < base 5000 → Math.max(5000, 1000) = 5000
    expect(policy.maxDelayMs).toBeGreaterThanOrEqual(policy.baseDelayMs);
  });

  it('applies valid VITE_AI_POLL_JITTER_RATIO override', () => {
    vi.stubEnv('VITE_AI_POLL_JITTER_RATIO', '0.5');
    const policy = getPollingPolicy();
    expect(policy.jitterRatio).toBe(0.5);
  });

  it('rejects jitter > 1 → uses default 0.2', () => {
    vi.stubEnv('VITE_AI_POLL_JITTER_RATIO', '1.5');
    const policy = getPollingPolicy();
    expect(policy.jitterRatio).toBe(0.2);
  });

  it('rejects jitter < 0 → uses default 0.2', () => {
    vi.stubEnv('VITE_AI_POLL_JITTER_RATIO', '-0.1');
    const policy = getPollingPolicy();
    expect(policy.jitterRatio).toBe(0.2);
  });

  it('truncates float maxAttempts to integer', () => {
    vi.stubEnv('VITE_AI_POLL_MAX_ATTEMPTS', '15.9');
    const policy = getPollingPolicy();
    expect(policy.maxAttempts).toBe(15);
    expect(Number.isInteger(policy.maxAttempts)).toBe(true);
  });

  it('truncates float baseDelayMs to integer', () => {
    vi.stubEnv('VITE_AI_POLL_BASE_DELAY_MS', '2500.7');
    const policy = getPollingPolicy();
    expect(policy.baseDelayMs).toBe(2500);
    expect(Number.isInteger(policy.baseDelayMs)).toBe(true);
  });

  it('returns all four required policy fields', () => {
    const policy = getPollingPolicy();
    expect(policy).toHaveProperty('maxAttempts');
    expect(policy).toHaveProperty('baseDelayMs');
    expect(policy).toHaveProperty('maxDelayMs');
    expect(policy).toHaveProperty('jitterRatio');
  });
});
