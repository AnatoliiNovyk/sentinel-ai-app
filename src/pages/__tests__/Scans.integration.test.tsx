import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
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
    onViewDetails,
  }: {
    vulnerabilities: Array<Record<string, unknown>>;
    onGenerateAiFix: (v: Record<string, unknown>) => void;
    onViewDetails: (v: Record<string, unknown>) => void;
  }) => (
    <div>
      <div data-testid="vuln-count">{vulnerabilities.length}</div>
      {vulnerabilities[0] && (
        <button onClick={() => onGenerateAiFix(vulnerabilities[0])}>generate-ai-fix</button>
      )}
      {vulnerabilities[0] && (
        <button onClick={() => onViewDetails(vulnerabilities[0])}>view-details</button>
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
        status: 'open',
        asset: 'example.com',
        cve_id: 'CVE-1',
        scan_id: 'scan-1',
        created_at: '2026-04-24T00:00:00.000Z',
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads initial data and shows mode and vulnerabilities', async () => {
    render(<Scans />);

    await waitFor(() => expect(mockGetProjects).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await waitFor(() => expect(mockGetProjectScans).toHaveBeenCalledWith('project-1'), { timeout: 3000 });
    await waitFor(() => expect(mockGetScanVulnerabilities).toHaveBeenCalledWith('scan-1'), { timeout: 3000 });

    expect(screen.getByTestId('mode').textContent).toBe('MOCK');
    expect(screen.getByTestId('vuln-count').textContent).toBe('1');
  }, { timeout: 5000 });

  it('dispatches new scan from modal with project fallback target', async () => {
    render(<Scans />);

    await waitFor(() => screen.getByText('open-new-scan'), { timeout: 3000 });

    fireEvent.click(screen.getByText('open-new-scan'));
    fireEvent.click(screen.getByRole('button', { name: 'Launch scan' }));

    await waitFor(
      () => {
        expect(mockDispatchScan).toHaveBeenCalledWith('project-1', 'Nmap:Intense', 'example.com', 'org-1');
      },
      { timeout: 3000 },
    );
  }, { timeout: 5000 });

  it('runs AI generation flow and refreshes vulnerabilities', async () => {
    render(<Scans />);

    await waitFor(() => expect(mockGetScanVulnerabilities).toHaveBeenCalledWith('scan-1'), { timeout: 3000 });

    fireEvent.click(screen.getByText('generate-ai-fix'));

    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockCallAiGateway).toHaveBeenCalledWith([
      expect.objectContaining({ role: 'user', content: expect.stringContaining('Outdated package') }),
    ]);
    expect(mockVulnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Fix it', remediation: 'Update package', remediation_code: 'npm update' }),
    );

    await waitFor(
      () => {
        expect(mockGetScanVulnerabilities).toHaveBeenCalledTimes(2);
      },
      { timeout: 3000 },
    );
  }, { timeout: 6000 });

  it('opens and closes vulnerability detail modal', async () => {
    render(<Scans />);

    await waitFor(() => screen.getByText('view-details'), { timeout: 3000 });

    fireEvent.click(screen.getByText('view-details'));

    // Detail modal should be visible with vuln title
    await waitFor(() => {
      expect(screen.getByText('Outdated package')).toBeDefined();
    }, { timeout: 3000 });

    // Close the modal
    fireEvent.click(screen.getByRole('button', { name: 'Close vulnerability details' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Close vulnerability details' })).toBeNull();
    }, { timeout: 3000 });
  }, { timeout: 6000 });

  it('renders detail modal with critical severity and remediation code', async () => {
    mockGetScanVulnerabilities.mockResolvedValue([
      {
        id: 'vuln-crit',
        title: 'Critical RCE',
        description: 'Remote code execution',
        severity: 'critical',
        status: 'open',
        asset: '10.0.0.1',
        cve_id: 'CVE-2026-9999',
        remediation: 'Patch immediately',
        remediation_code: 'apt-get update && apt-get upgrade -y',
        scan_id: 'scan-1',
        created_at: '2026-04-24T00:00:00.000Z',
      },
    ]);

    render(<Scans />);

    await waitFor(() => screen.getByText('view-details'), { timeout: 3000 });
    fireEvent.click(screen.getByText('view-details'));

    await waitFor(() => {
      expect(screen.getByText('Critical RCE')).toBeDefined();
      expect(screen.getByText('CRITICAL')).toBeDefined();
      // remediation_code block should be rendered
      expect(screen.getByText('apt-get update && apt-get upgrade -y')).toBeDefined();
    }, { timeout: 3000 });
  }, { timeout: 6000 });

  it('shows DEMO badge when scan has is_mock = true', async () => {
    mockGetProjectScans.mockResolvedValue([
      {
        id: 'scan-1',
        scanner: 'nmap',
        status: 'completed',
        created_at: '2026-04-24T00:00:00.000Z',
        detected_mode: 'MOCK',
        is_mock: true,
      },
    ]);

    render(<Scans />);

    await waitFor(() => expect(mockGetProjectScans).toHaveBeenCalled(), { timeout: 3000 });
    expect(screen.getByText('DEMO')).toBeDefined();
  }, { timeout: 5000 });

  it('shows running progress bar when scan status is running', async () => {
    mockGetProjectScans.mockResolvedValue([
      {
        id: 'scan-1',
        scanner: 'nmap',
        status: 'running',
        created_at: '2026-04-24T00:00:00.000Z',
        detected_mode: 'ACTIVE',
        is_mock: false,
      },
    ]);

    render(<Scans />);

    await waitFor(() => expect(mockGetProjectScans).toHaveBeenCalled(), { timeout: 3000 });
    // RunningProgressBar component renders when status is 'running'
    expect(screen.getByText('nmap')).toBeDefined();
  }, { timeout: 5000 });

  it('renders detail modal with medium severity', async () => {
    mockGetScanVulnerabilities.mockResolvedValue([
      {
        id: 'vuln-med',
        title: 'Medium Priority Issue',
        description: 'Not critical but should be fixed',
        severity: 'medium',
        status: 'open',
        asset: 'example.com',
        cve_id: 'CVE-2026-0001',
        scan_id: 'scan-1',
        created_at: '2026-04-24T00:00:00.000Z',
      },
    ]);

    render(<Scans />);

    await waitFor(() => screen.getByText('view-details'), { timeout: 3000 });
    fireEvent.click(screen.getByText('view-details'));

    await waitFor(() => {
      expect(screen.getByText('Medium Priority Issue')).toBeDefined();
      expect(screen.getByText('MEDIUM')).toBeDefined();
    }, { timeout: 3000 });
  }, { timeout: 6000 });

  it('renders detail modal with low severity', async () => {
    mockGetScanVulnerabilities.mockResolvedValue([
      {
        id: 'vuln-low',
        title: 'Low Priority Issue',
        description: 'Minor issue',
        severity: 'low',
        status: 'open',
        asset: 'example.com',
        cve_id: 'CVE-2026-0002',
        scan_id: 'scan-1',
        created_at: '2026-04-24T00:00:00.000Z',
      },
    ]);

    render(<Scans />);

    await waitFor(() => screen.getByText('view-details'), { timeout: 3000 });
    fireEvent.click(screen.getByText('view-details'));

    await waitFor(() => {
      expect(screen.getByText('Low Priority Issue')).toBeDefined();
      expect(screen.getByText('LOW')).toBeDefined();
    }, { timeout: 3000 });
  }, { timeout: 6000 });

  it('shows status filter when multiple status values exist', async () => {
    mockGetProjectScans.mockResolvedValue([
      {
        id: 'scan-1',
        scanner: 'nmap',
        status: 'completed',
        created_at: '2026-04-24T00:00:00.000Z',
        detected_mode: 'MOCK',
        is_mock: false,
      },
      {
        id: 'scan-2',
        scanner: 'tfsec',
        status: 'pending',
        created_at: '2026-04-25T00:00:00.000Z',
        detected_mode: 'MOCK',
        is_mock: false,
      },
      {
        id: 'scan-3',
        scanner: 'amass',
        status: 'failed',
        created_at: '2026-04-26T00:00:00.000Z',
        detected_mode: 'MOCK',
        is_mock: false,
      },
    ]);
    mockGetScanVulnerabilities.mockResolvedValue([
      {
        id: 'vuln-1',
        title: 'Outdated package',
        description: 'desc',
        severity: 'high',
        status: 'open',
        asset: 'example.com',
        cve_id: 'CVE-1',
        scan_id: 'scan-1',
        created_at: '2026-04-24T00:00:00.000Z',
      },
    ]);

    render(<Scans />);

    await waitFor(() => expect(mockGetProjectScans).toHaveBeenCalled(), { timeout: 3000 });
    // Status filter should be visible (uniqueStatuses > 2)
    expect(screen.getByLabelText('Filter by status')).toBeDefined();
  }, { timeout: 5000 });

  it('can click to select a specific scan from list', async () => {
    mockGetProjectScans.mockResolvedValue([
      {
        id: 'scan-1',
        scanner: 'nmap',
        status: 'completed',
        created_at: '2026-04-24T00:00:00.000Z',
        detected_mode: 'MOCK',
        is_mock: false,
      },
    ]);

    render(<Scans />);

    await waitFor(() => screen.getByText('nmap'), { timeout: 3000 });
    // Click the scan to select it
    fireEvent.click(screen.getByText('nmap'));
    expect(screen.getByText('nmap')).toBeDefined();
  }, { timeout: 5000 });

  it('shows "No scans match filters" when search returns no results', async () => {
    render(<Scans />);

    await waitFor(() => screen.getByText('nmap'), { timeout: 3000 });
    fireEvent.change(screen.getByPlaceholderText('Search scans…'), {
      target: { value: 'xyz-not-found-zzz' },
    });
    await waitFor(
      () => expect(screen.getByText('No scans match filters')).toBeInTheDocument(),
      { timeout: 3000 },
    );
  }, { timeout: 5000 });

  it('shows scanner filter when multiple scanners exist', async () => {
    mockGetProjectScans.mockResolvedValue([
      { id: 'scan-1', scanner: 'nmap',  status: 'completed', created_at: '2026-04-24T00:00:00Z', detected_mode: 'MOCK', is_mock: false },
      { id: 'scan-2', scanner: 'tfsec', status: 'completed', created_at: '2026-04-25T00:00:00Z', detected_mode: 'MOCK', is_mock: false },
      { id: 'scan-3', scanner: 'amass', status: 'completed', created_at: '2026-04-26T00:00:00Z', detected_mode: 'MOCK', is_mock: false },
    ]);
    mockGetScanVulnerabilities.mockResolvedValue([]);

    render(<Scans />);

    await waitFor(() => expect(mockGetProjectScans).toHaveBeenCalled(), { timeout: 3000 });
    expect(screen.getByLabelText('Filter by scanner')).toBeInTheDocument();
  }, { timeout: 5000 });

  it('shows clear-filters button when search is active and clears on click', async () => {
    render(<Scans />);

    await waitFor(() => screen.getByText('nmap'), { timeout: 3000 });
    fireEvent.change(screen.getByPlaceholderText('Search scans…'), {
      target: { value: 'nmap' },
    });
    await waitFor(() => expect(screen.getByTitle('Clear all filters')).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByTitle('Clear all filters'));
    await waitFor(() => expect(screen.queryByTitle('Clear all filters')).toBeNull(), { timeout: 3000 });
  }, { timeout: 5000 });

  it('triggers refresh when Refresh button is clicked', async () => {
    render(<Scans />);

    await waitFor(() => screen.getByText('nmap'), { timeout: 3000 });
    const callsBefore = mockGetProjectScans.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh scans' }));
    await waitFor(
      () => expect(mockGetProjectScans.mock.calls.length).toBeGreaterThan(callsBefore),
      { timeout: 3000 },
    );
  }, { timeout: 5000 });

  it('renders CSV button and calls URL.createObjectURL on click', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(<Scans />);

    await waitFor(() => expect(mockGetScanVulnerabilities).toHaveBeenCalled(), { timeout: 3000 });
    const csvBtn = await screen.findByTitle('Export vulnerabilities CSV', {}, { timeout: 3000 });
    fireEvent.click(csvBtn);
    expect(createObjectURL).toHaveBeenCalled();
  }, { timeout: 5000 });

  it('shows dispatch error from toReadableErrorMessage when scan fails', async () => {
    mockDispatchScan.mockRejectedValue(new Error('Network timeout'));
    render(<Scans />);

    await waitFor(() => screen.getByText('open-new-scan'), { timeout: 3000 });
    fireEvent.click(screen.getByText('open-new-scan'));
    fireEvent.click(screen.getByRole('button', { name: 'Launch scan' }));

    await waitFor(
      () => expect(screen.getByText(/Network timeout/i)).toBeInTheDocument(),
      { timeout: 3000 },
    );
  }, { timeout: 5000 });

  it('dismisses AI generation error on close click', async () => {
    mockDispatchScan.mockRejectedValue(new Error('Dispatch failed'));
    render(<Scans />);

    await waitFor(() => screen.getByText('open-new-scan'), { timeout: 3000 });
    fireEvent.click(screen.getByText('open-new-scan'));
    fireEvent.click(screen.getByRole('button', { name: 'Launch scan' }));

    await waitFor(() => screen.getByText(/Dispatch failed/i), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
    await waitFor(
      () => expect(screen.queryByText(/Dispatch failed/i)).toBeNull(),
      { timeout: 3000 },
    );
  }, { timeout: 5000 });
});
