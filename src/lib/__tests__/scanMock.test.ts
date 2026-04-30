import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AVAILABLE_SCANNERS, runMockScan } from '../scanMock';

// Mock supabase
const mockFrom = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
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
    // Default: project and scan return null → returns null
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('returns null when supabase scan insert returns no data', async () => {
    const result = await runMockScan('user-1', 'proj-1', 'nmap');
    expect(result).toBeNull();
  });

  it('completes scan and returns scan id when project and scan data exist', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0); // duration = 1000ms, subsetCount = 1

    const mockScan = { id: 'scan-test-1' };
    const mockProject = { id: 'proj-1', name: 'Test', environment: 'internal', target: '10.0.0.1' };

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
      };

      if (table === 'projects') {
        chain.maybeSingle.mockResolvedValue({ data: mockProject, error: null });
      } else if (table === 'scans') {
        callCount++;
        if (callCount === 1) {
          chain.maybeSingle.mockResolvedValue({ data: mockScan, error: null });
        } else {
          chain.maybeSingle.mockResolvedValue({ data: null, error: null });
        }
      } else {
        chain.maybeSingle.mockResolvedValue({ data: null, error: null });
      }
      return chain;
    });

    const promise = runMockScan('user-1', 'proj-1', 'nmap');
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('scan-test-1');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
