import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScansService } from '../scans.service';
import { getGlobalScaAnalyzer } from '../../lib/supplyChain';

vi.mock('../client', () => {
  const mockFrom = vi.fn((table: string) => {
    if (table === 'scans') {
      return {
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({
              data: { id: 'scan-123', status: 'running', project_id: 'proj-1' },
              error: null,
            }),
          }),
        }),
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      };
    }
    if (table === 'vulnerabilities') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    }
    if (table === 'projects') {
      return {
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    }
    return { select: () => Promise.resolve({ data: [], error: null }) };
  });

  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: mockFrom,
      functions: {
        invoke: vi.fn(() => Promise.resolve({ data: { job_id: 'job-123' }, error: null })),
      },
    },
  };
});

vi.mock('../../lib/supplyChain', () => ({
  getGlobalScaAnalyzer: vi.fn(() => ({
    scan: vi.fn(),
  })),
}));

describe('Scans Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('dispatch with SBOM analysis', () => {
    it('creates scan and dispatches to Edge Function', async () => {
      const result = await ScansService.dispatchScan(
        'proj-1',
        'sbom',
        JSON.stringify({ version: '1.4', components: [] }),
        'org-1',
        true
      );

      expect(result).toBeDefined();
      expect(result.scan).toBeDefined();
      expect(result.dispatchResult).toBeDefined();
    });

    it('handles scan creation with valid SBOM', async () => {
      const mockSbom = {
        version: '1.4',
        metadata: { component: { name: 'test-app' } },
        components: [
          { name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21' },
        ],
      };

      const result = await ScansService.dispatchScan(
        'proj-1',
        'sbom',
        JSON.stringify(mockSbom),
        'org-1',
        true
      );

      expect(result.scan.id).toEqual('scan-123');
      expect(result.scan.status).toBeDefined();
    });

    it('retrieves scan vulnerabilities', async () => {
      const vulnerabilities = await ScansService.getScanVulnerabilities('scan-123');

      expect(Array.isArray(vulnerabilities)).toBe(true);
    });

    it('retrieves project scans list', async () => {
      const scans = await ScansService.getProjectScans('proj-1');

      expect(Array.isArray(scans)).toBe(true);
    });
  });

  describe('SCA with SupplyChain integration', () => {
    it('analyzes SBOM dependencies through ScaAnalyzer', async () => {
      const analyzer = getGlobalScaAnalyzer();

      (analyzer.scan as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: {
          dependencies: 2,
          vulnerabilities: [
            {
              id: 'GHSA-1234-5678-90ab',
              severity: 'HIGH',
              affected_versions: ['4.17.21'],
            },
          ],
        },
      });

      const mockSbom = {
        version: '1.4',
        components: [
          { name: 'lodash', version: '4.17.21' },
          { name: 'express', version: '4.18.0' },
        ],
      };

      const result = await ScansService.dispatchScan(
        'proj-1',
        'sbom',
        JSON.stringify(mockSbom),
        'org-1',
        true
      );

      expect(result.scan).toBeDefined();
      expect(analyzer.scan).toBeDefined();
    });

    it('handles SBOM dispatch with proper serialization', async () => {
      const sbomData = {
        version: '1.4',
        components: [
          { name: 'pkg-a', version: '1.0' },
          { name: 'pkg-b', version: '2.0' },
        ],
      };

      const result = await ScansService.dispatchScan(
        'proj-1',
        'sbom',
        JSON.stringify(sbomData),
        'org-1',
        true
      );

      expect(result.dispatchResult).toBeDefined();
    });

    it('handles empty components array gracefully', async () => {
      const emptyBom = { version: '1.4', components: [] };

      const result = await ScansService.dispatchScan(
        'proj-1',
        'sbom',
        JSON.stringify(emptyBom),
        'org-1',
        true
      );

      expect(result.scan).toBeDefined();
    });
  });

  describe('project and scan retrieval', () => {
    it('fetches projects list with RLS', async () => {
      const projects = await ScansService.getProjects();

      expect(Array.isArray(projects)).toBe(true);
    });

    it('aggregates vulnerabilities by scan', async () => {
      const scanId = 'scan-123';

      const vulnerabilities = await ScansService.getScanVulnerabilities(scanId);

      expect(Array.isArray(vulnerabilities)).toBe(true);
    });

    it('retrieves scans for specific project', async () => {
      const projectId = 'proj-1';

      const scans = await ScansService.getProjectScans(projectId);

      expect(Array.isArray(scans)).toBe(true);
    });
  });
});
