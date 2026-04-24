import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AVAILABLE_SCANNERS, runMockScan } from '../scanMock';

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('../riskScore', () => ({
  recomputeProjectRiskScore: vi.fn().mockResolvedValue(undefined),
}));

describe('AVAILABLE_SCANNERS data', () => {
  it('contains at least 10 scanners', () => {
    expect(AVAILABLE_SCANNERS.length).toBeGreaterThanOrEqual(10);
  });

  it('every scanner has id, label, and description', () => {
    for (const scanner of AVAILABLE_SCANNERS) {
      expect(scanner.id).toBeTruthy();
      expect(scanner.label).toBeTruthy();
      expect(scanner.description).toBeTruthy();
    }
  });

  it('contains "nmap" scanner', () => {
    expect(AVAILABLE_SCANNERS.find((s) => s.id === 'nmap')).toBeDefined();
  });

  it('contains "prowler" scanner with cloud="aws"', () => {
    const prowler = AVAILABLE_SCANNERS.find((s) => s.id === 'prowler');
    expect(prowler).toBeDefined();
    expect(prowler?.cloud).toBe('aws');
  });

  it('contains "tfsec" scanner with category="iac"', () => {
    const tfsec = AVAILABLE_SCANNERS.find((s) => s.id === 'tfsec');
    expect(tfsec).toBeDefined();
    expect(tfsec?.category).toBe('iac');
  });

  it('contains "trivy" container scanner', () => {
    const trivy = AVAILABLE_SCANNERS.find((s) => s.id === 'trivy');
    expect(trivy).toBeDefined();
    expect(trivy?.category).toBe('container');
  });

  it('has no duplicate scanner ids', () => {
    const ids = AVAILABLE_SCANNERS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('runMockScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when supabase scan insert returns no data', async () => {
    // supabase is already mocked via vi.mock at the top — both project and scan maybeSingle return null
    const result = await runMockScan('user-1', 'proj-1', 'nmap');
    expect(result).toBeNull();
  });
});
