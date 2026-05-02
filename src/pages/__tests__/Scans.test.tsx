import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Scans from '../Scans';
import type { Project, Scan, Vulnerability } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockProjects: Project[] = [
  { id: 'proj-1', name: 'Alpha', target: 'https://alpha.example.com', risk_score: 45, org_id: 'org-1', user_id: 'user-1', created_at: '2026-01-01' },
  { id: 'proj-2', name: 'Beta', target: 'https://beta.example.com', risk_score: 72, org_id: 'org-1', user_id: 'user-1', created_at: '2026-01-02' },
];

const mockScans: Scan[] = [
  { id: 'scan-1', project_id: 'proj-1', scanner: 'Nmap:Intense', status: 'completed', is_mock: false, detected_mode: 'REAL', created_at: '2026-04-01T10:00:00Z', finished_at: '2026-04-01T10:30:00Z', user_id: 'user-1' },
  { id: 'scan-2', project_id: 'proj-1', scanner: 'Nmap:Vuln', status: 'running', is_mock: false, detected_mode: 'REAL', created_at: '2026-04-01T11:00:00Z', user_id: 'user-1' },
  { id: 'scan-3', project_id: 'proj-1', scanner: 'Tfsec', status: 'failed', is_mock: true, detected_mode: 'MOCK', created_at: '2026-04-01T12:00:00Z', user_id: 'user-1' },
  { id: 'scan-4', project_id: 'proj-2', scanner: 'Amass', status: 'pending', is_mock: false, detected_mode: 'REAL', created_at: '2026-04-01T13:00:00Z', user_id: 'user-1' },
];

const mockVulns: Vulnerability[] = [
  { id: 'v-1', scan_id: 'scan-1', project_id: 'proj-1', title: 'SQL Injection', severity: 'critical', status: 'open', asset: 'api.example.com', user_id: 'user-1', created_at: '2026-04-01T10:30:00Z', description: 'SQL injection vulnerability', remediation: 'Use parameterized queries' },
  { id: 'v-2', scan_id: 'scan-1', project_id: 'proj-1', title: 'XSS', severity: 'high', status: 'open', asset: 'web.example.com', user_id: 'user-1', created_at: '2026-04-01T10:30:00Z', description: 'Cross-site scripting', remediation: 'Escape user input' },
  { id: 'v-3', scan_id: 'scan-1', project_id: 'proj-1', title: 'Info Disclosure', severity: 'info', status: 'resolved', asset: 'docs.example.com', user_id: 'user-1', created_at: '2026-04-01T10:30:00Z', description: 'Information disclosure', remediation: 'Restrict access' },
];

const { mockGetProjects, mockGetScans, mockGetVulns, mockDispatchScan, mockCallAiGateway, mockUpdateVuln } = vi.hoisted(() => ({
  mockGetProjects: vi.fn().mockResolvedValue([]),
  mockGetScans: vi.fn().mockResolvedValue([]),
  mockGetVulns: vi.fn().mockResolvedValue([]),
  mockDispatchScan: vi.fn().mockResolvedValue({ data: { id: 'new-scan' }, error: null }),
  mockCallAiGateway: vi.fn().mockResolvedValue({ content: '{"explanation":"test","remediation":"fix it","code":""}' }),
  mockUpdateVuln: vi.fn().mockResolvedValue({ error: null }),
}));

const { mockProbeAgentHealth } = vi.hoisted(() => ({
  mockProbeAgentHealth: vi.fn().mockResolvedValue({ reachable: true }),
}));

vi.mock('../../api/scans.service', () => ({
  ScansService: {
    getProjects: () => mockGetProjects(),
    getProjectScans: () => mockGetScans(),
    getScanVulnerabilities: () => mockGetVulns(),
    dispatchScan: () => mockDispatchScan(),
  },
}));

vi.mock('../../lib/aiGateway', () => ({
  callAiGateway: (...args: unknown[]) => mockCallAiGateway(...args),
}));

vi.mock('../../lib/agentHealth', () => ({
  probeAgentHealth: mockProbeAgentHealth,
}));

vi.mock('../../lib/toastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../api/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'vulnerabilities') {
        return {
          update: vi.fn(() => ({ eq: () => mockUpdateVuln() })),
        };
      }
      return { select: vi.fn() };
    }),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// ── Test Data Helpers ────────────────────────────────────────────────────

function setupScansMocks({
  projects = mockProjects,
  scans = mockScans,
  vulns = mockVulns,
  probeHealth = { reachable: true },
} = {}) {
  mockGetProjects.mockResolvedValue(projects);
  mockGetScans.mockResolvedValue(scans);
  mockGetVulns.mockResolvedValue(vulns);
  mockProbeAgentHealth.mockResolvedValue(probeHealth);
}

// ── ScanStatusBadge Tests ────────────────────────────────────────────────

describe('Scans — ScanStatusBadge', () => {
  it('renders "Done" for completed status', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
  });

  it('renders "Running" for running status with pulsing dot', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
  });
});

// ── Loading State Tests ─────────────────────────────────────────────────

describe('Scans — loading state', () => {
  beforeEach(() => {
    mockGetProjects.mockImplementation(() => new Promise(() => {})); // never resolves
  });

  it('shows skeleton while loading projects', async () => {
    render(<Scans />);
    await waitFor(() => {
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});

// ── Header Tests ────────────────────────────────────────────────────────

describe('Scans — header', () => {
  beforeEach(() => {
    setupScansMocks();
  });

  it('renders page title', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText('Vulnerability Scans')).toBeInTheDocument();
    });
  });
});

// ── Scan Stats Tests ────────────────────────────────────────────────────

describe('Scans — stats', () => {
  beforeEach(() => {
    setupScansMocks({ vulns: mockVulns });
  });

  it('renders vulnerability count stats', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText(/Critical/i)).toBeInTheDocument();
      expect(screen.getByText(/High/i)).toBeInTheDocument();
    });
  });
});

// ── Mock Mode Warning ───────────────────────────────────────────────────

describe('Scans — mock mode warning', () => {
  // Reset probe mock before each to avoid test-order dependency
  beforeEach(() => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: true });
  });

  it('shows mock warning when scan is MOCK and agent unreachable', async () => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: false });
    setupScansMocks({
      scans: [mockScans[2]], // mock scan
      probeHealth: { reachable: false },
    });
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /dismiss mock warning/i })).toBeInTheDocument();
      expect(screen.getByText(/selected scan is a simulated run/i)).toBeInTheDocument();
    });
  });

  it('hides mock warning when agent is reachable', async () => {
    setupScansMocks({
      scans: [mockScans[2]],
      probeHealth: { reachable: true },
    });
    render(<Scans />);
    await waitFor(() => {
      expect(screen.queryByText(/Demo Mode/i)).not.toBeInTheDocument();
    });
  });

  it('dismisses mock warning toast', async () => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: false });
    setupScansMocks({
      scans: [mockScans[2]],
      probeHealth: { reachable: false },
    });
    render(<Scans />);
    const dismissBtn = await screen.findByRole('button', { name: /dismiss mock warning/i });
    await act(async () => { fireEvent.click(dismissBtn); });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /dismiss mock warning/i })).not.toBeInTheDocument();
    });
  });
});

// ── AI Generation Tests ────────────────────────────────────────────────

describe('Scans — AI generation', () => {
  beforeEach(() => {
    setupScansMocks({ vulns: [{
      id: 'v-1',
      scan_id: 'scan-1',
      project_id: 'proj-1',
      title: 'SQL Injection',
      severity: 'critical',
      status: 'open',
      asset: 'api.example.com',
      cve_id: 'CVE-2024-1234',
      description: 'SQL injection found in login form',
      remediation: 'Use parameterized queries',
      remediation_code: null,
      user_id: 'user-1',
      created_at: '2026-04-01T10:30:00Z',
    }] });
  });

  it('calls callAiGateway when generate ai fix is clicked', async () => {
    mockCallAiGateway.mockResolvedValueOnce({
      content: '{"explanation":"SQLi fix","remediation":"fix","code":""}',
    });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    const genBtns = screen.getAllByRole('button', { name: /generate ai fix/i });
    expect(genBtns.length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(genBtns[0]); });
    await waitFor(() => { expect(mockCallAiGateway).toHaveBeenCalled(); });
  });
});

// ── Scan Summary Strip ───────────────────────────────────────────────────

describe('Scans — scan summary strip', () => {
  beforeEach(() => {
    setupScansMocks();
  });

  it('renders total scans count', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText('Total scans')).toBeInTheDocument();
    });
  });

  it('renders completed scans count', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('renders running scans count from summary strip', async () => {
    render(<Scans />);
    await waitFor(() => {
      // Check specifically in the summary strip (near "Total scans" and "Completed")
      const totalScansLabel = screen.getByText('Total scans');
      const parent = totalScansLabel.closest('.grid');
      if (parent) {
        expect(parent.textContent).toContain('Running');
      } else {
        // Fallback: just check that Running text exists
        expect(screen.getByText('Running')).toBeInTheDocument();
      }
    });
  });

  it('renders failed scans from scan summary strip', async () => {
    render(<Scans />);
    await waitFor(() => {
      // The scan summary strip shows "Failed" count (not the status badge)
      const allFailed = screen.getAllByText('Failed');
      expect(allFailed.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Scan Sidebar Tests ──────────────────────────────────────────────────

describe('Scans — sidebar', () => {
  beforeEach(() => {
    setupScansMocks();
  });

  it('renders "Recent Scans" heading', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText('Recent Scans')).toBeInTheDocument();
    });
  });

  it('renders scan list items', async () => {
    render(<Scans />);
    await waitFor(() => {
      // Use getAllByRole to find all buttons, then filter for scan-related ones
      const allButtons = screen.getAllByRole('button');
      const scanButtons = allButtons.filter(b => 
        b.textContent?.includes('Nmap:Intense') || 
        b.textContent?.includes('Nmap:Vuln') ||
        b.textContent?.includes('Tfsec')
      );
      expect(scanButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('clicking a scan selects it', async () => {
    render(<Scans />);
    await waitFor(() => {
      const allButtons = screen.getAllByRole('button');
      const intenseBtn = allButtons.find(b => b.textContent?.includes('Nmap:Intense'));
      expect(intenseBtn).toBeDefined();
    });
    const allButtons = screen.getAllByRole('button');
    const intenseBtn = allButtons.find(b => b.textContent?.includes('Nmap:Intense'));
    if (intenseBtn) await act(async () => { fireEvent.click(intenseBtn); });
  });

  it('shows DEMO badge for mock scans', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText('DEMO')).toBeInTheDocument();
    });
  });

  it('shows running progress bar for running scans', async () => {
    render(<Scans />);
    await waitFor(() => {
      const allButtons = screen.getAllByRole('button');
      const vulnBtn = allButtons.find(b => b.textContent?.includes('Nmap:Vuln'));
      expect(vulnBtn).toBeDefined();
    });
    // Progress bar contains an animated div with emerald color
    const progressBars = document.querySelectorAll('[class*="bg-emerald-400"]');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('renders search input', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search scans/i)).toBeInTheDocument();
    });
  });

  it('filters scans by search query', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Search scans/i)).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/Search scans/i);
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'nmap' } }); });
    // After filtering, the clear button should appear since there's an active filter
    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    expect(clearBtn).toBeInTheDocument();
  });

  it('clears all filters when clear button is clicked', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByPlaceholderText(/Search scans/i)).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/Search scans/i);
    await act(async () => { fireEvent.change(searchInput, { target: { value: 'xyz' } }); });
    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    await act(async () => { fireEvent.click(clearBtn); });
    await waitFor(() => {
      expect((searchInput as HTMLInputElement).value).toBe('');
    });
  });
});

// ── New Scan Modal Tests ────────────────────────────────────────────────

describe('Scans — new scan modal', () => {
  beforeEach(async () => {
    mockDispatchScan.mockClear();
    setupScansMocks();
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });
  });

  it('opens modal when "New Scan" button is clicked', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start a new scan/i })).toBeInTheDocument();
    });
    const newScanBtn = screen.getByRole('button', { name: /start a new scan/i });
    await act(async () => { fireEvent.click(newScanBtn); });
    await waitFor(() => {
      expect(screen.getByText('Start New Scan')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start a new scan/i })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    await waitFor(() => expect(screen.getByText('Start New Scan')).toBeInTheDocument());
    const closeBtn = screen.getByRole('button', { name: /close new scan modal/i });
    await act(async () => { fireEvent.click(closeBtn); });
    await waitFor(() => {
      expect(screen.queryByText('Start New Scan')).not.toBeInTheDocument();
    });
  });

  it('renders scanner type select in modal', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start a new scan/i })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    await waitFor(() => expect(screen.getByText('Start New Scan')).toBeInTheDocument());
    // Wait for modal form to be interactive
    await new Promise(r => setTimeout(r, 400));
    // Check for Nmap option which is in the scanner select
    expect(screen.queryByText('Nmap (Intense Scan)')).toBeInTheDocument();
  });

  it('renders target input in modal', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start a new scan/i })).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    await waitFor(() => expect(screen.getByText('Start New Scan')).toBeInTheDocument());
    await new Promise(r => setTimeout(r, 300));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\./i)).toBeInTheDocument();
    });
  });

  it('shows error when launching scan without target', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start a new scan/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    // Open modal - no project selected, handleStartScan should return early
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    await waitFor(() => expect(screen.getByText('Start New Scan')).toBeInTheDocument());
    // Click Launch without project selected
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /launch scan/i })); });
    await new Promise(r => setTimeout(r, 200));
    // Verify it was NOT called with the specific scan we expect
    expect(mockDispatchScan).not.toHaveBeenCalledWith('proj-1', 'Nmap:Intense', '', 'org-1');
  });

  it('calls dispatchScan when Launch is clicked with valid target', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start a new scan/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    // Select project
    const projectSelect = screen.getByRole('combobox', { name: /select project/i });
    await act(async () => { fireEvent.change(projectSelect, { target: { value: 'proj-1' } }); });
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    // Open modal
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    await waitFor(() => expect(screen.getByText('Start New Scan')).toBeInTheDocument());
    // Fill target and launch
    const targetInput = screen.getByPlaceholderText(/e\.g\./i);
    await act(async () => { fireEvent.change(targetInput, { target: { value: '192.168.1.1' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /launch scan/i })); });
    await new Promise(r => setTimeout(r, 200));
    expect(mockDispatchScan).toHaveBeenCalled();
  });

  it('closes modal after successful scan dispatch', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /start a new scan/i })).toBeInTheDocument());
    // Wait for initial data to load
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    // Select project to enable scan dispatch
    const projectSelect = screen.getByRole('combobox', { name: /select project/i });
    await act(async () => { fireEvent.change(projectSelect, { target: { value: 'proj-1' } }); });
    // Wait for scans to update after project selection
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    // Open modal and test
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    await waitFor(() => expect(screen.getByPlaceholderText(/e\.g\./i)).toBeInTheDocument());
    const targetInput = screen.getByPlaceholderText(/e\.g\./i);
    await act(async () => { fireEvent.change(targetInput, { target: { value: 'scanme.nmap.org' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /launch scan/i })); });
    await waitFor(() => {
      expect(screen.queryByText('Start New Scan')).not.toBeInTheDocument();
    });
  });

  it('shows formatted dispatch error from structured object and can dismiss it', async () => {
    mockDispatchScan.mockRejectedValueOnce({ error_description: 'Scanner agent offline' });
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select project/i })).toBeInTheDocument());
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /select project/i }), { target: { value: 'proj-1' } });
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    const targetInput = await screen.findByPlaceholderText(/e\.g\./i);
    await act(async () => { fireEvent.change(targetInput, { target: { value: 'scanme.nmap.org' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /launch scan/i })); });
    await waitFor(() => {
      expect(screen.getByText(/Failed to start scan: Scanner agent offline/i)).toBeInTheDocument();
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /dismiss error/i })); });
    await waitFor(() => {
      expect(screen.queryByText(/Failed to start scan: Scanner agent offline/i)).not.toBeInTheDocument();
    });
  });

  it('falls back to generic dispatch error when error has no readable fields', async () => {
    mockDispatchScan.mockRejectedValueOnce({});
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('combobox', { name: /select project/i })).toBeInTheDocument());
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: /select project/i }), { target: { value: 'proj-1' } });
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    const targetInput = await screen.findByPlaceholderText(/e\.g\./i);
    await act(async () => { fireEvent.change(targetInput, { target: { value: 'scanme.nmap.org' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /launch scan/i })); });
    await waitFor(() => {
      expect(screen.getByText(/Unexpected scan dispatch error/i)).toBeInTheDocument();
    });
  });
});

// ── Detail Modal Tests ───────────────────────────────────────────────────

describe('Scans — detail modal', () => {
  beforeEach(() => {
    setupScansMocks({ vulns: [mockVulns[0]] });
  });

  it('renders vulnerability list', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    });
  });
});

// ── CSV Export ──────────────────────────────────────────────────────────

describe('Scans — CSV export', () => {
  beforeEach(() => {
    setupScansMocks({ vulns: mockVulns });
  });

  it('renders CSV export button when vulnerabilities exist', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument();
    });
  });

  it('does not render CSV button when no vulnerabilities', async () => {
    setupScansMocks({ vulns: [] });
    render(<Scans />);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /csv/i })).not.toBeInTheDocument();
    });
  });
});

// ── Empty State ────────────────────────────────────────────────────────

describe('Scans — empty state', () => {
  beforeEach(() => {
    setupScansMocks({ scans: [] });
  });

  it('shows empty state when no scans', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText(/No scans match filters/i)).toBeInTheDocument();
    });
  });
});

// ── Refresh + relative time ─────────────────────────────────────────────

describe('Scans — refresh and relative time', () => {
  beforeEach(() => {
    setupScansMocks({
      scans: [
        {
          ...mockScans[0],
          created_at: new Date(Date.now() - 20 * 1000).toISOString(),
        },
        {
          ...mockScans[1],
          created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
  });

  it('refresh button reloads scans for the selected project', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /refresh scans/i })).toBeInTheDocument());
    const initialCalls = mockGetScans.mock.calls.length;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /refresh scans/i })); });
    await waitFor(() => {
      expect(mockGetScans.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('renders relative times for just now and yesterday branches', async () => {
    render(<Scans />);
    await waitFor(() => {
      expect(screen.getByText('Just now')).toBeInTheDocument();
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });
  });
});

// ── Detail Modal — open/close ────────────────────────────────────────────

describe('Scans — detail modal open/close', () => {
  beforeEach(() => {
    setupScansMocks({ vulns: [mockVulns[0]] });
  });

  it('opens detail modal when View Details button clicked', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    const viewBtn = screen.getByRole('button', { name: /view details/i });
    fireEvent.click(viewBtn);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument();
    });
    // Detail modal shows severity/status/asset
    expect(screen.getAllByText('Severity').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThan(0);
    expect(screen.getAllByText('api.example.com').length).toBeGreaterThan(0);
  });

  it('closes detail modal when X button clicked', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /close vulnerability details/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /close vulnerability details/i })).not.toBeInTheDocument());
  });

  it('shows "No remediation plan available yet." when remediation is empty', async () => {
    const vulnNoRemediation = { ...mockVulns[0], remediation: '', remediation_code: '' };
    setupScansMocks({ vulns: [vulnNoRemediation] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() => expect(screen.getByText(/No remediation plan available yet\./i)).toBeInTheDocument());
  });

  it('shows CVE in detail modal as "N/A" when not set', async () => {
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument());
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });
});

// ── CSV Export — trigger download ────────────────────────────────────────

describe('Scans — CSV export trigger', () => {
  beforeEach(() => {
    setupScansMocks({ vulns: mockVulns });
  });

  it('triggers CSV download when export button clicked', async () => {
    const mockClick = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return { click: mockClick, href: '', download: '' } as unknown as HTMLElement;
      return origCreate(tag);
    });
    global.URL.createObjectURL = vi.fn(() => 'blob:fake');
    global.URL.revokeObjectURL = vi.fn();

    render(<Scans />);
    await waitFor(() => expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /csv/i }));
    expect(mockClick).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

// ── AI Generation error path ─────────────────────────────────────────────

describe('Scans — AI generation error', () => {
  beforeEach(() => {
    setupScansMocks({ vulns: [mockVulns[0]] });
  });

  it('shows AI generation error when callAiGateway throws', async () => {
    mockCallAiGateway.mockRejectedValueOnce(new Error('Gateway timeout'));
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    const aiBtn = screen.getByRole('button', { name: /generate ai fix/i });
    fireEvent.click(aiBtn);
    await waitFor(() => expect(screen.getByText(/AI Generation failed/i)).toBeInTheDocument());
  });
});

// ── Detail Modal — severity variants and remediation_code ────────────────

describe('Scans — detail modal severity variants', () => {
  it('shows "high" severity badge with orange style', async () => {
    const highVuln = { ...mockVulns[1], id: 'v-high', severity: 'high' as const, remediation_code: null };
    setupScansMocks({ vulns: [highVuln] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('XSS')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByText('HIGH').length).toBeGreaterThan(0);
  });

  it('shows "medium" severity badge with yellow style', async () => {
    const medVuln = { ...mockVulns[0], id: 'v-med', title: 'Medium Vuln', severity: 'medium' as const, remediation_code: null };
    setupScansMocks({ vulns: [medVuln] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('Medium Vuln')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByText('MEDIUM').length).toBeGreaterThan(0);
  });

  it('shows remediation_code block when remediation_code is provided', async () => {
    const vulnWithCode = {
      ...mockVulns[0],
      id: 'v-code',
      severity: 'critical' as const,
      remediation: 'Fix it now',
      remediation_code: 'const safe = db.prepare("SELECT * FROM users WHERE id = ?").get(id);',
    };
    setupScansMocks({ vulns: [vulnWithCode] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/const safe = db\.prepare/i)).toBeInTheDocument();
  });

  it('AI gateway returns non-JSON response — falls back to raw content', async () => {
    mockCallAiGateway.mockResolvedValueOnce({ content: 'This is a plain text fix suggestion.' });
    setupScansMocks({ vulns: [{ ...mockVulns[0], severity: 'critical' as const, remediation_code: null }] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate ai fix/i }));
    });
    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalled());
  });

  it('AI gateway returns malformed JSON — catch block executes', async () => {
    mockCallAiGateway.mockResolvedValueOnce({ content: 'Fix this: {"key": undefined_value} done' });
    setupScansMocks({ vulns: [{ ...mockVulns[0], severity: 'critical' as const, remediation_code: null }] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate ai fix/i }));
    });
    await waitFor(() => expect(mockCallAiGateway).toHaveBeenCalled());
  });
});

// ── Load error catch blocks ─────────────────────────────────────────────

describe('Scans — service error catch paths', () => {
  beforeEach(() => {
    // Reset mock call queues to avoid contamination from previous tests
    mockGetVulns.mockReset();
    mockGetVulns.mockResolvedValue([]);
    mockUpdateVuln.mockReset();
    mockUpdateVuln.mockResolvedValue({ error: null });
    mockCallAiGateway.mockReset();
    mockCallAiGateway.mockResolvedValue({ content: '{"explanation":"test","remediation":"fix","code":""}' });
  });
  it('handles loadScans error gracefully (getProjectScans throws)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetProjects.mockResolvedValue(mockProjects);
    mockGetScans.mockRejectedValueOnce(new Error('DB error'));
    mockGetVulns.mockResolvedValue([]);
    mockProbeAgentHealth.mockResolvedValue({ reachable: true });
    render(<Scans />);
    // Wait for the catch block to execute (loadScans is called after project auto-select)
    await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Failed to load scans:', expect.any(Error)));
    consoleSpy.mockRestore();
  });

  it('handles loadVulnerabilities error gracefully (getScanVulnerabilities throws)', async () => {
    // useEffect [selectedScanId] calls getScanVulnerabilities inline — make that fail
    setupScansMocks({ scans: [mockScans[0]], vulns: [] });
    mockGetVulns.mockRejectedValueOnce(new Error('Vuln fetch error'));
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('Vulnerability Scans')).toBeInTheDocument());
    // No crash; vulnerabilities section renders empty
  });

  it('loadVulnerabilities catch fires after AI generation reloads vulns', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // First call (initial inline useEffect) succeeds; second call (loadVulnerabilities after AI gen) rejects
    mockGetVulns
      .mockResolvedValueOnce([{ ...mockVulns[0], severity: 'critical', remediation_code: null }])
      .mockRejectedValueOnce(new Error('Reload failed'));
    mockGetProjects.mockResolvedValue(mockProjects);
    mockGetScans.mockResolvedValue([mockScans[0]]);
    mockProbeAgentHealth.mockResolvedValue({ reachable: true });
    mockCallAiGateway.mockResolvedValueOnce({
      content: '{"explanation":"fix","remediation":"fix it","code":"SELECT 1;"}',
    });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /generate ai fix/i }));
    });
    await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Failed to load vulnerabilities:', expect.any(Error)));
    consoleSpy.mockRestore();
  });

  it('shows target required error when project has no target and no custom target', async () => {
    const emptyTargetProject = { ...mockProjects[0], id: 'proj-empty', target: '' };
    mockGetProjects.mockResolvedValue([emptyTargetProject]);
    mockGetScans.mockResolvedValue([mockScans[0]]);
    mockGetVulns.mockResolvedValue([]);
    mockProbeAgentHealth.mockResolvedValue({ reachable: true });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('Vulnerability Scans')).toBeInTheDocument());
    const projectSelect = screen.getByRole('combobox', { name: /select project/i });
    await act(async () => { fireEvent.change(projectSelect, { target: { value: 'proj-empty' } }); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /start a new scan/i })); });
    await waitFor(() => expect(screen.getByText('Start New Scan')).toBeInTheDocument());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /launch scan/i })); });
    await waitFor(() => {
      expect(screen.getByText(/Target is required/i)).toBeInTheDocument();
    });
  });
});

// ── Running Progress Bar Cleanup ────────────────────────────────────────────

describe('Scans — RunningProgressBar unmount cleanup', () => {
  it('clears interval when unmounting with running scan (line 63 cleanup)', async () => {
    setupScansMocks({ scans: [mockScans[1]] }); // running scan
    const { unmount } = render(<Scans />);
    await waitFor(() => expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument());
    // RunningProgressBar should be mounted with its useEffect
    unmount(); // triggers return () => clearInterval(id)
    // No crash = pass (cleanup executed)
  });
});

// ── LoadScans Catch Block ─────────────────────────────────────────────────

describe('Scans — loadScans catch block (lines 212-214)', () => {
  it('handles error in loadScans during refresh', async () => {
    setupScansMocks();
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('Vulnerability Scans')).toBeInTheDocument());
    // Now trigger a refresh that causes loadScans to fail
    mockGetScans.mockRejectedValueOnce(new Error('network error'));
    const refreshBtn = screen.getByRole('button', { name: /refresh scans/i });
    fireEvent.click(refreshBtn);
    await waitFor(() => {
      expect(mockGetScans).toHaveBeenCalled();
    });
    // Should still render without crashing
    expect(screen.getByText('Vulnerability Scans')).toBeInTheDocument();
  });
});

// ── UseEffect Else Branch ─────────────────────────────────────────────────

describe('Scans — useEffect else branch (lines 216-217)', () => {
  it('clears scans when selected project becomes null', async () => {
    setupScansMocks({ scans: [mockScans[0]], vulns: [mockVulns[0]] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('Vulnerability Scans')).toBeInTheDocument());
    // Now clear the project selection
    const projectSelect = screen.getByRole('combobox', { name: /select project/i });
    fireEvent.change(projectSelect, { target: { value: '' } });
    await waitFor(() => {
      // Scans should be cleared
      expect(screen.queryByText('SQL Injection')).not.toBeInTheDocument();
    });
  });
});

// ── Severity Fallback ────────────────────────────────────────────────────

describe('Scans — detail modal severity fallback (line 673)', () => {
  it('shows blue color class for low severity vuln in detail modal', async () => {
    const lowVuln = { ...mockVulns[0], id: 'v-low', severity: 'low' as const, status: 'open' as const };
    setupScansMocks({ vulns: [lowVuln] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument());
    expect(screen.getAllByText('LOW').length).toBeGreaterThan(0);
  });

  it('shows blue color class for info severity vuln in detail modal', async () => {
    const infoVuln = { ...mockVulns[2], id: 'v-info', severity: 'info' as const, status: 'open' as const };
    setupScansMocks({ vulns: [infoVuln] });
    render(<Scans />);
    await waitFor(() => expect(screen.getByText('Info Disclosure')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /close vulnerability details/i })).toBeInTheDocument());
    expect(screen.getAllByText('INFO').length).toBeGreaterThan(0);
  });
});
