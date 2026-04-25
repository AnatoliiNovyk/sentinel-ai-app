import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Scans from '../Scans';

const {
  mockGetProjects,
  mockGetProjectScans,
  mockGetScanVulnerabilities,
  mockDispatchScan,
  mockCallAiGateway,
  mockVulnUpdate,
} = vi.hoisted(() => ({
  mockGetProjects: vi.fn(),
  mockGetProjectScans: vi.fn(),
  mockGetScanVulnerabilities: vi.fn(),
  mockDispatchScan: vi.fn(),
  mockCallAiGateway: vi.fn(),
  mockVulnUpdate: vi.fn(),
}));

vi.mock('../../lib/aiGateway', () => ({
  callAiGateway: mockCallAiGateway,
}));

vi.mock('../../api/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'vulnerabilities') {
        return { update: mockVulnUpdate };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

vi.mock('../../api/scans.service', () => ({
  ScansService: {
    getProjects: mockGetProjects,
    getProjectScans: mockGetProjectScans,
    getScanVulnerabilities: mockGetScanVulnerabilities,
    dispatchScan: mockDispatchScan,
  },
}));


vi.mock('../../components/scans/ScanHeader', () => ({
  ScanHeader: ({ onNewScan, currentMode }: { onNewScan: () => void; currentMode?: string }) => (
    <div>
      <div data-testid="mode">{currentMode}</div>
      <button onClick={onNewScan}>open-new-scan</button>
    </div>
  ),
}));

vi.mock('../../components/scans/ScanStats', () => ({
  ScanStats: ({ totalVulnerabilities }: { totalVulnerabilities: number }) => (
    <div data-testid="stats-total">{totalVulnerabilities}</div>
  ),
}));

vi.mock('../../components/scans/VulnerabilityList', () => ({
  VulnerabilityList: ({
    vulnerabilities,
    onGenerateAiFix,
  }: {
    vulnerabilities: Array<Record<string, string>>;
    onGenerateAiFix: (v: Record<string, string>) => void;
  }) => (
    <div>
      <div data-testid="vuln-count">{vulnerabilities.length}</div>
      {vulnerabilities[0] && (
        <button onClick={() => onGenerateAiFix(vulnerabilities[0])}>generate-ai-fix</button>
      )}
    </div>
  ),
}));

describe('Scans integration flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetProjects.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Project One',
        target: 'example.com',
        org_id: 'org-1',
      },
    ]);

    mockGetProjectScans.mockResolvedValue([
      {
        id: 'scan-1',
        scanner: 'nmap',
        status: 'completed',
        created_at: '2026-04-24T00:00:00.000Z',
        detected_mode: 'MOCK',
      },
    ]);

    mockGetScanVulnerabilities.mockResolvedValue([
      {
        id: 'vuln-1',
        title: 'Outdated package',
        description: 'desc',
        severity: 'high',
        asset: 'example.com',
        cve_id: 'CVE-1',
        scan_id: 'scan-1',
      },
    ]);

    mockDispatchScan.mockResolvedValue({});
    mockCallAiGateway.mockResolvedValue({
      content: JSON.stringify({ explanation: 'Fix it', remediation: 'Update package', code: 'npm update' }),
      provider: 'mock',
      isMock: true,
    });
    mockVulnUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it('loads initial data and shows mode and vulnerabilities', async () => {
    render(<Scans />);

    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockGetProjectScans).toHaveBeenCalledWith('project-1'));
    await waitFor(() => expect(mockGetScanVulnerabilities).toHaveBeenCalledWith('scan-1'));

    expect(screen.getByTestId('mode').textContent).toBe('MOCK');
    expect(screen.getByTestId('vuln-count').textContent).toBe('1');
  });

  it('dispatches new scan from modal with project fallback target', async () => {
    render(<Scans />);

    await waitFor(() => screen.getByText('open-new-scan'));

    fireEvent.click(screen.getByText('open-new-scan'));
    fireEvent.click(screen.getByRole('button', { name: 'Launch scan' }));

    await waitFor(() => {
      expect(mockDispatchScan).toHaveBeenCalledWith('project-1', 'Nmap:Intense', 'example.com', 'org-1');
    });
  });

  it('runs AI generation flow and refreshes vulnerabilities', async () => {
    render(<Scans />);

    await waitFor(() => expect(mockGetScanVulnerabilities).toHaveBeenCalledWith('scan-1'));

    fireEvent.click(screen.getByText('generate-ai-fix'));

    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalledTimes(1));
    expect(mockCallAiGateway).toHaveBeenCalledWith([
      expect.objectContaining({ role: 'user', content: expect.stringContaining('Outdated package') }),
    ]);
    expect(mockVulnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Fix it', remediation: 'Update package', remediation_code: 'npm update' }),
    );

    await waitFor(() => {
      expect(mockGetScanVulnerabilities).toHaveBeenCalledTimes(2);
    });
  });
});
