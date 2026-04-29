/**
 * Unit tests for src/lib/riskScore.ts
 * Covers computeScoreFromCounts() and riskBand() — pure functions, no Supabase.
 */
import { describe, it, expect, vi } from 'vitest';
import { computeScoreFromCounts, riskBand, recomputeRiskScoreFromScanId, recomputeProjectRiskScore } from '../riskScore';

// ─── Supabase mock ─────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
vi.mock('../supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

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

// ─── recomputeRiskScoreFromScanId ─────────────────────────────────────────────

describe('recomputeRiskScoreFromScanId', () => {
  it('calls recomputeProjectRiskScore when scan has project_id', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { project_id: 'proj-1' }, error: null }),
      update: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    };
    mockFrom.mockReturnValue(chain);
    await recomputeRiskScoreFromScanId('scan-abc');
    expect(mockFrom).toHaveBeenCalledWith('scans');
  });

  it('does nothing when scan has no project_id', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    mockFrom.mockReturnValue(chain);
    await recomputeRiskScoreFromScanId('scan-missing');
    expect(mockFrom).toHaveBeenCalledWith('scans');
  });
});

// ─── recomputeProjectRiskScore ────────────────────────────────────────────────

describe('recomputeProjectRiskScore', () => {
  function makeChain(overrides: {
    projectEnv?: string | null;
    scans?: { id: string }[];
    vulns?: { severity: string; status: string }[];
  } = {}) {
    const { projectEnv = 'internal', scans = [], vulns = [] } = overrides;
    const mockUpdate = vi.fn().mockReturnThis();
    const mockUpdateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: projectEnv != null ? { environment: projectEnv } : null,
            error: null,
          }),
          update: mockUpdate,
        };
      }
      if (table === 'scans') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: scans, error: null }),
        };
      }
      if (table === 'vulnerabilities') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: vulns, error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    return { mockUpdate, mockUpdateEq };
  }

  it('returns 0 when project has no scans', async () => {
    makeChain({ scans: [] });
    const score = await recomputeProjectRiskScore('proj-1');
    expect(score).toBe(0);
  });

  it('counts open vulns and computes score', async () => {
    makeChain({
      scans: [{ id: 'scan-1' }],
      vulns: [
        { severity: 'critical', status: 'open' },
        { severity: 'high', status: 'open' },
      ],
    });
    const score = await recomputeProjectRiskScore('proj-1');
    // 1 critical (25) + 1 high (12) = 37
    expect(score).toBe(37);
  });

  it('skips resolved vulns', async () => {
    makeChain({
      scans: [{ id: 'scan-1' }],
      vulns: [
        { severity: 'critical', status: 'resolved' },
        { severity: 'high', status: 'open' },
      ],
    });
    const score = await recomputeProjectRiskScore('proj-1');
    expect(score).toBe(12); // only high
  });

  it('skips false_positive vulns', async () => {
    makeChain({
      scans: [{ id: 'scan-1' }],
      vulns: [
        { severity: 'critical', status: 'false_positive' },
        { severity: 'medium', status: 'open' },
      ],
    });
    const score = await recomputeProjectRiskScore('proj-1');
    expect(score).toBe(5); // only medium
  });

  it('skips accepted vulns', async () => {
    makeChain({
      scans: [{ id: 'scan-1' }],
      vulns: [
        { severity: 'critical', status: 'accepted' },
      ],
    });
    const score = await recomputeProjectRiskScore('proj-1');
    expect(score).toBe(0);
  });

  it('writes computed score back to projects table', async () => {
    const { mockUpdateEq } = makeChain({
      scans: [{ id: 'scan-1' }],
      vulns: [{ severity: 'high', status: 'open' }],
    });
    await recomputeProjectRiskScore('proj-1');
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'proj-1');
  });
});
