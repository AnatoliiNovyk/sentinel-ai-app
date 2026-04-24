/**
 * Unit tests for src/lib/riskScore.ts
 * Covers computeScoreFromCounts() and riskBand() — pure functions, no Supabase.
 */
import { describe, it, expect } from 'vitest';
import { computeScoreFromCounts, riskBand } from '../riskScore';

// ─── computeScoreFromCounts ───────────────────────────────────────────────────

describe('computeScoreFromCounts', () => {
  it('returns 0 for all-zero counts', () => {
    expect(computeScoreFromCounts({ critical: 0, high: 0, medium: 0, low: 0, info: 0 })).toBe(0);
  });

  it('applies CRITICAL weight correctly (1 critical = 25 pts)', () => {
    const score = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'internal');
    expect(score).toBe(25);
  });

  it('applies HIGH weight correctly (1 high = 12 pts)', () => {
    const score = computeScoreFromCounts({ critical: 0, high: 1, medium: 0, low: 0, info: 0 }, 'internal');
    expect(score).toBe(12);
  });

  it('applies MEDIUM weight correctly (1 medium = 5 pts)', () => {
    const score = computeScoreFromCounts({ critical: 0, high: 0, medium: 1, low: 0, info: 0 }, 'internal');
    expect(score).toBe(5);
  });

  it('applies LOW weight correctly (1 low = 2 pts)', () => {
    const score = computeScoreFromCounts({ critical: 0, high: 0, medium: 0, low: 1, info: 0 }, 'internal');
    expect(score).toBe(2);
  });

  it('info vulns do not contribute to score', () => {
    const score = computeScoreFromCounts({ critical: 0, high: 0, medium: 0, low: 0, info: 999 }, 'internal');
    expect(score).toBe(0);
  });

  it('clamps score to max 100', () => {
    // 5 criticals * 25 = 125 → clamped to 100
    const score = computeScoreFromCounts({ critical: 5, high: 0, medium: 0, low: 0, info: 0 }, 'internal');
    expect(score).toBe(100);
  });

  it('applies production environment multiplier (1.5x)', () => {
    // 1 critical = 25 * 1.5 = 37.5 → 38
    const score = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'production');
    expect(score).toBe(38);
  });

  it('applies external environment multiplier (1.3x)', () => {
    // 1 critical = 25 * 1.3 = 32.5 → 33
    const score = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'external');
    expect(score).toBe(33);
  });

  it('applies staging environment multiplier (1.1x)', () => {
    // 1 critical = 25 * 1.1 = 27.5 → 28
    const score = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'staging');
    expect(score).toBe(28);
  });

  it('applies cloud environment multiplier (1.2x)', () => {
    // 1 critical = 25 * 1.2 = 30 → 30
    const score = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'cloud');
    expect(score).toBe(30);
  });

  it('defaults to multiplier 1.0 for unknown environment', () => {
    const base = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'internal');
    const unknown = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'unknown-env');
    expect(base).toBe(unknown);
  });

  it('combines multiple severity types correctly', () => {
    // 1 critical (25) + 1 high (12) + 1 medium (5) + 1 low (2) = 44
    const score = computeScoreFromCounts({ critical: 1, high: 1, medium: 1, low: 1, info: 0 }, 'internal');
    expect(score).toBe(44);
  });

  it('uses internal as default environment', () => {
    const withDefault = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 });
    const withExplicit = computeScoreFromCounts({ critical: 1, high: 0, medium: 0, low: 0, info: 0 }, 'internal');
    expect(withDefault).toBe(withExplicit);
  });
});

// ─── riskBand ─────────────────────────────────────────────────────────────────

describe('riskBand', () => {
  it('returns Clean for score 0', () => {
    expect(riskBand(0).label).toBe('Clean');
  });

  it('returns Low for score 1', () => {
    expect(riskBand(1).label).toBe('Low');
  });

  it('returns Low for score 14', () => {
    expect(riskBand(14).label).toBe('Low');
  });

  it('returns Medium for score 15 (boundary)', () => {
    expect(riskBand(15).label).toBe('Medium');
  });

  it('returns Medium for score 39', () => {
    expect(riskBand(39).label).toBe('Medium');
  });

  it('returns High for score 40 (boundary)', () => {
    expect(riskBand(40).label).toBe('High');
  });

  it('returns High for score 69', () => {
    expect(riskBand(69).label).toBe('High');
  });

  it('returns Critical for score 70 (boundary)', () => {
    expect(riskBand(70).label).toBe('Critical');
  });

  it('returns Critical for score 100', () => {
    expect(riskBand(100).label).toBe('Critical');
  });

  it('each band has a non-empty color string', () => {
    for (const score of [0, 1, 15, 40, 70, 100]) {
      expect(riskBand(score).color.length).toBeGreaterThan(0);
    }
  });
});
