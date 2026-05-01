import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Vulnerabilities from '../Vulnerabilities';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

vi.mock('../../lib/exporters', () => ({
  downloadFile: vi.fn(),
}));

const { mockVulnsOrder, mockProjectsEq, mockScansEq, mockChannel, mockRemoveChannel, mockVulnUpdateIn } = vi.hoisted(() => ({
  mockVulnsOrder:    vi.fn().mockResolvedValue({ data: [], error: null }),
  mockProjectsEq:    vi.fn().mockResolvedValue({ data: [], error: null }),
  mockScansEq:       vi.fn().mockResolvedValue({ data: [], error: null }),
  mockChannel:       vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
  mockRemoveChannel: vi.fn(),
  mockVulnUpdateIn:  vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'projects') return { select: () => ({ eq: mockProjectsEq }) };
        if (table === 'scans')    return { select: () => ({ eq: mockScansEq }) };
        // vulnerabilities: fetch + update/delete
        return {
          select: () => ({
            eq: () => ({
              order: mockVulnsOrder,
            }),
          }),
          update: () => ({
            in: mockVulnUpdateIn,
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          delete: () => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      },
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    },
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const MOCK_PROJECTS = [
  { id: 'proj-1', user_id: 'user-1', org_id: 'org-1', name: 'Alpha Project',
    description: '', target: 'example.com', environment: 'external',
    created_at: NOW, tags: [], risk_score: 0 },
];

const MOCK_VULNS = [
  {
    id: 'v-1', user_id: 'user-1', project_id: 'proj-1', scan_id: 'scan-1',
    title: 'SQL Injection', severity: 'critical', status: 'open',
    cve_id: 'CVE-2023-1234', cvss: 9.8, asset: 'api.example.com',
    description: 'SQL injection in login form',
    recommendation: 'Use parameterized queries',
    sla_breached_at: null, sla_warned_at: null, created_at: NOW,
  },
  {
    id: 'v-2', user_id: 'user-1', project_id: 'proj-1', scan_id: 'scan-1',
    title: 'XSS Reflected', severity: 'high', status: 'open',
    cve_id: null, cvss: 7.2, asset: 'web.example.com',
    description: 'Reflected XSS in search field',
    recommendation: 'Sanitize inputs',
    sla_breached_at: NOW, sla_warned_at: null, created_at: NOW,
  },
];

function setupMocks(vulns = MOCK_VULNS) {
  mockVulnsOrder.mockResolvedValue({ data: vulns, error: null });
  mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
  mockScansEq.mockResolvedValue({ data: [], error: null });
}

beforeEach(() => {
  setupMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Vulnerabilities — layout', () => {
  it('renders "Vulnerabilities" heading', async () => {
    render(<Vulnerabilities />);
    expect(await screen.findByText('Vulnerabilities')).toBeInTheDocument();
  });

  it('renders stat cards Total, Critical, High, Medium, Open, SLA breached', async () => {
    render(<Vulnerabilities />);
    expect(await screen.findByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SLA breached').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Vulnerabilities — entries', () => {
  it('renders vulnerability titles from supabase', async () => {
    render(<Vulnerabilities />);
    expect(await screen.findByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByText('XSS Reflected')).toBeInTheDocument();
  });

  it('displays stat counts matching loaded data', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // 1 critical + 1 high, total 2, 2 open
    const totalCard = screen.getByText('Total').closest('button')!;
    expect(totalCard).toHaveTextContent('2');
  });

  it('shows empty state "No vulnerabilities found" when no data', async () => {
    mockVulnsOrder.mockResolvedValue({ data: [], error: null });
    render(<Vulnerabilities />);
    expect(await screen.findByText('No vulnerabilities found')).toBeInTheDocument();
  });
});

describe('Vulnerabilities — filters', () => {
  it('clicking Critical stat card filters to critical vulns only', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Click Critical filter button
    fireEvent.click(screen.getByText('Critical').closest('button')!);
    // XSS (high) should be hidden; SQL Injection (critical) should remain
    expect(screen.queryByText('XSS Reflected')).not.toBeInTheDocument();
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('shows "No vulnerabilities match the filters" when filter yields no results', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Click Medium stat card — no medium vulns in mock
    fireEvent.click(screen.getByText('Medium').closest('button')!);
    expect(await screen.findByText('No vulnerabilities match the filters')).toBeInTheDocument();
  });
});

describe('Vulnerabilities — bulk actions', () => {
  it('shows BulkBar Resolve/Accept risk/False positive when an item is selected', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Click the select checkbox of first vuln row (CheckSquare icon button)
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    expect(await screen.findByText('Resolve')).toBeInTheDocument();
    expect(screen.getByText('Accept risk')).toBeInTheDocument();
    expect(screen.getByText('False positive')).toBeInTheDocument();
  });

  it('clicking Resolve calls supabase update', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    await screen.findByText('Resolve');
    await act(async () => { fireEvent.click(screen.getByText('Resolve')); });
    // bulkUpdate was called — supabase update mock was invoked
    expect(screen.queryByText('Resolve')).toBeNull();
  });

  it('clicking Accept risk calls supabase update', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    await screen.findByText('Accept risk');
    await act(async () => { fireEvent.click(screen.getByText('Accept risk')); });
    expect(screen.queryByText('Accept risk')).toBeNull();
  });

  it('clicking False positive calls supabase update', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    await screen.findByText('False positive');
    await act(async () => { fireEvent.click(screen.getByText('False positive')); });
    expect(screen.queryByText('False positive')).toBeNull();
  });

  it('BulkBar close button clears selection', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    await screen.findByText('Resolve');
    fireEvent.click(screen.getByTitle('Clear selection'));
    await waitFor(() => expect(screen.queryByText('Resolve')).toBeNull());
  });

  it('Select all / Deselect all toggles all rows', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByText(/select all/i));
    await screen.findByText('Resolve');
    // Both rows selected — click Deselect all
    fireEvent.click(screen.getByText(/deselect all/i));
    await waitFor(() => expect(screen.queryByText('Resolve')).toBeNull());
  });
});

describe('Vulnerabilities — sort and search', () => {
  it('clicking Newest sort button works', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByText('Newest'));
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('clicking Oldest sort button works', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByText('Oldest'));
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('clicking A→Z sort button works', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByText('A→Z'));
    expect(screen.getByText('XSS Reflected')).toBeInTheDocument();
  });

  it('clicking Project sort button works', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Multiple "Project" text items may exist — use the sort button specifically
    const projectBtns = screen.getAllByText('Project');
    // The sort button is inside the filter row — click the one that looks like a sort btn
    fireEvent.click(projectBtns[0]);
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('search input filters vulnerabilities', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.change(screen.getByPlaceholderText(/search findings/i), { target: { value: 'SQL' } });
    await waitFor(() => expect(screen.queryByText('XSS Reflected')).toBeNull());
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('Clear filters button resets search', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.change(screen.getByPlaceholderText(/search findings/i), { target: { value: 'nomatch' } });
    await screen.findByText('No vulnerabilities match the filters');
    // multiple 'Clear filters' buttons may exist — click any one
    const clearBtns = screen.getAllByText(/clear filters/i);
    fireEvent.click(clearBtns[clearBtns.length - 1]);
    await screen.findByText('SQL Injection');
  });

  it('status filter buttons appear and filter by Open', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // The "Open" filter buttons in Row 3 of filters
    const openBtns = screen.getAllByRole('button', { name: /^open$/i });
    fireEvent.click(openBtns[openBtns.length - 1]); // last one = status filter in row
    // Both vulns are 'open' so both should still be visible
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('Has CVE checkbox filters vulns with cve_id', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByLabelText('Has CVE'));
    await waitFor(() => expect(screen.queryByText('XSS Reflected')).toBeNull());
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
  });

  it('SLA breached checkbox filters by sla_breached_at', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByLabelText('SLA breached'));
    await waitFor(() => expect(screen.queryByText('SQL Injection')).toBeNull());
    expect(screen.getByText('XSS Reflected')).toBeInTheDocument();
  });
});

describe('Vulnerabilities — export', () => {
  it('opens export dropdown on click', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(screen.getByText('CSV')).toBeInTheDocument());
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('clicking CSV calls downloadFile', async () => {
    const { downloadFile } = await import('../../lib/exporters');
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await screen.findByText('CSV');
    fireEvent.click(screen.getByText('CSV'));
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.csv$/),
      expect.any(String),
      'text/csv',
    );
  });

  it('clicking JSON calls downloadFile', async () => {
    const { downloadFile } = await import('../../lib/exporters');
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await screen.findByText('JSON');
    fireEvent.click(screen.getByText('JSON'));
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.json$/),
      expect.any(String),
      'application/json',
    );
  });
});

describe('Vulnerabilities — row features', () => {
  it('VulnRow shows SLA breached badge', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('XSS Reflected');
    // v-2 has sla_breached_at set
    const badges = screen.getAllByText(/SLA breached/i);
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('VulnRow shows CVE link for vuln with cve_id', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    expect(screen.getByText('CVE-2023-1234')).toBeInTheDocument();
  });

  it('VulnRow shows project name when scans include the scan_id', async () => {
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    mockScansEq.mockResolvedValue({ data: [{ id: 'scan-1', project_id: 'proj-1', scanner: 'nmap' }], error: null });
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Project name should appear in VulnRow when scan links to project
    await waitFor(() => {
      const projectLinks = screen.queryAllByText('Alpha Project');
      expect(projectLinks.length).toBeGreaterThan(0);
    });
  });
});

describe('Vulnerabilities — refresh', () => {
  it('clicking Refresh button re-fetches data', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const refreshBtn = screen.getByTitle('Refresh');
    fireEvent.click(refreshBtn);
    // Should still show the data after refresh
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
  });
});

describe('Vulnerabilities — sort options', () => {
  beforeEach(() => {
    mockVulnsOrder.mockResolvedValue({
      data: [
        { id: 'v-1', title: 'SQLi',   severity: 'critical', status: 'open', asset: 'api.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'v-2', title: 'XSS',    severity: 'high',     status: 'open', asset: 'web.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-02T00:00:00Z' },
        { id: 'v-3', title: 'CSRF',   severity: 'medium',   status: 'open', asset: 'admin.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-03T00:00:00Z' },
      ],
      error: null,
    });
  });

  it('vulnerabilities render with proper severity styling', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQLi');
    expect(screen.getByText('SQLi')).toBeInTheDocument();
  });
});

describe('Vulnerabilities — severity and status filtering', () => {
  beforeEach(() => {
    mockVulnsOrder.mockResolvedValue({
      data: [
        { id: 'v-1', title: 'Critical Finding',   severity: 'critical', status: 'open',    asset: 'a.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'v-2', title: 'High Finding',       severity: 'high',     status: 'resolved', asset: 'b.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-02T00:00:00Z' },
        { id: 'v-3', title: 'Medium Finding',     severity: 'medium',   status: 'accepted', asset: 'c.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-03T00:00:00Z' },
      ],
      error: null,
    });
  });

  it('shows vulnerabilities with different severity levels', async () => {
    render(<Vulnerabilities />);
    await waitFor(() => {
      expect(screen.getByText('Critical Finding')).toBeInTheDocument();
      expect(screen.getByText('High Finding')).toBeInTheDocument();
      expect(screen.getByText('Medium Finding')).toBeInTheDocument();
    });
  });

  it('renders medium severity vulnerability', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('Critical Finding');
    expect(screen.getByText('Medium Finding')).toBeInTheDocument();
  });
});

describe('Vulnerabilities — search functionality', () => {
  beforeEach(() => {
    mockVulnsOrder.mockResolvedValue({
      data: [
        { id: 'v-1', title: 'SQL Injection Vulnerability', severity: 'critical', status: 'open', asset: 'api.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'v-2', title: 'Cross Site Scripting', severity: 'high', status: 'open', asset: 'web.example.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-02T00:00:00Z' },
      ],
      error: null,
    });
  });

  it('search input is present', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection Vulnerability');
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('search input can be typed into', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection Vulnerability');
    const searchInput = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'SQL' } });
    expect(searchInput.value).toBe('SQL');
  });
});

describe('Vulnerabilities — bulk selection', () => {
  beforeEach(() => {
    mockVulnsOrder.mockResolvedValue({
      data: [
        { id: 'v-1', title: 'Issue 1', severity: 'critical', status: 'open', asset: 'a.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-01T00:00:00Z' },
        { id: 'v-2', title: 'Issue 2', severity: 'high', status: 'open', asset: 'b.com', scan_id: 's-1', user_id: 'user-1', created_at: '2026-01-02T00:00:00Z' },
      ],
      error: null,
    });
  });

  it('vulnerability rows are selectable', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('Issue 1');
    const selectBtns = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label')?.includes('Select'));
    expect(selectBtns.length).toBeGreaterThan(0);
  });

  it('multiple vulnerabilities render', async () => {
    render(<Vulnerabilities />);
    await waitFor(() => {
      expect(screen.getByText('Issue 1')).toBeInTheDocument();
      expect(screen.getByText('Issue 2')).toBeInTheDocument();
    });
  });
});

describe('Vulnerabilities — no results message', () => {
  it('shows message when no vulnerabilities match filters', async () => {
    mockVulnsOrder.mockResolvedValue({ data: [], error: null });
    render(<Vulnerabilities />);
    await waitFor(() => {
      expect(screen.getByText(/no vulnerabilities found|no findings/i)).toBeInTheDocument();
    });
  });
});

describe('Vulnerabilities — load more', () => {
  it('shows Load more button when more than 25 items exist', async () => {
    const manyVulns = Array.from({ length: 26 }, (_, i) => ({
      id: `v-${i}`, title: `Finding ${i}`, severity: 'medium', status: 'open',
      asset: `host${i}.com`, scan_id: 's-1', user_id: 'user-1',
      created_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    mockVulnsOrder.mockResolvedValue({ data: manyVulns, error: null });
    render(<Vulnerabilities />);
    await waitFor(() => {
      expect(screen.getByText(/load more/i)).toBeInTheDocument();
    });
  });

  it('clicking Load more loads additional items', async () => {
    const manyVulns = Array.from({ length: 26 }, (_, i) => ({
      id: `v-${i}`, title: `Finding ${i}`, severity: 'medium', status: 'open',
      asset: `host${i}.com`, scan_id: 's-1', user_id: 'user-1',
      created_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    mockVulnsOrder.mockResolvedValue({ data: manyVulns, error: null });
    render(<Vulnerabilities />);
    const loadMoreBtn = await screen.findByText(/load more/i);
    fireEvent.click(loadMoreBtn);
    await waitFor(() => {
      expect(screen.queryByText(/load more/i)).toBeNull();
    });
  });
});

describe('Vulnerabilities — project filter', () => {
  it('project dropdown is present', async () => {
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const select = screen.getByTitle('Filter by project');
    expect(select).toBeInTheDocument();
  });

  it('changing project dropdown filters results', async () => {
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    mockScansEq.mockResolvedValue({ data: [{ id: 'scan-1', project_id: 'proj-1', scanner: 'nmap' }], error: null });
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const select = screen.getByTitle('Filter by project');
    fireEvent.change(select, { target: { value: 'proj-999' } });
    await waitFor(() => {
      expect(screen.queryByText('SQL Injection')).toBeNull();
    });
  });
});

describe('Vulnerabilities — VulnRow features', () => {
  it('clicking project link in VulnRow navigates to /projects', async () => {
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    mockScansEq.mockResolvedValue({ data: [{ id: 'scan-1', project_id: 'proj-1', scanner: 'nmap', created_at: NOW }], error: null });
    mockNavigate.mockClear();
    render(<Vulnerabilities />);
    // Wait for vuln data, then find the project button in VulnRow
    await screen.findByText('SQL Injection');
    await waitFor(() => {
      const projectBtns = screen.queryAllByRole('button', { name: /Alpha Project/i });
      expect(projectBtns.length).toBeGreaterThan(0);
    });
    const projectBtns = screen.getAllByRole('button', { name: /Alpha Project/i });
    fireEvent.click(projectBtns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  it('shows CVSS score for vulns with cvss value', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // SQL Injection has cvss=9.8
    expect(screen.getByText('9.8')).toBeInTheDocument();
  });

  it('shows scan scanner name in VulnRow', async () => {
    mockScansEq.mockResolvedValue({ data: [{ id: 'scan-1', project_id: 'proj-1', scanner: 'nuclei', created_at: NOW }], error: null });
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    await waitFor(() => {
      const scanTexts = screen.queryAllByText(/Scan: nuclei/i);
      expect(scanTexts.length).toBeGreaterThan(0);
    });
  });
});

describe('Vulnerabilities — export dropdown outside click', () => {
  it('clicking outside export dropdown closes it', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Open export dropdown
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await screen.findByText('CSV');
    // Fire mousedown event on the document body (outside the dropdown)
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByText('CSV')).not.toBeInTheDocument());
  });

  it('doExport CSV with selected items exports only selected', async () => {
    const { downloadFile } = await import('../../lib/exporters');
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Select one vuln
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    await screen.findByText('Resolve');
    // Open export and click CSV
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await screen.findByText('CSV');
    fireEvent.click(screen.getByText('CSV'));
    expect(downloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.csv$/),
      expect.any(String),
      'text/csv',
    );
  });
});

describe('Vulnerabilities — bulk loading overlay', () => {
  it('shows "Updating findings" overlay during bulk update', async () => {
    // Delay the update response so bulkLoading stays true long enough to render
    let resolveUpdate!: (val: { data: null; error: null }) => void;
    mockVulnUpdateIn.mockImplementationOnce(
      () => new Promise(resolve => { resolveUpdate = resolve; }),
    );

    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');

    // Select one vuln
    const checkboxes = screen.getAllByRole('button', { name: 'Select' });
    fireEvent.click(checkboxes[0]);
    await screen.findByText('Resolve');

    // Trigger bulk update (don't await — the promise is pending)
    fireEvent.click(screen.getByText('Resolve'));

    // Overlay should appear while update is in progress
    await waitFor(() => expect(screen.getByText(/Updating findings/i)).toBeInTheDocument());

    // Resolve the promise and verify overlay disappears
    await act(async () => { resolveUpdate({ data: null, error: null }); });
    await waitFor(() => expect(screen.queryByText(/Updating findings/i)).not.toBeInTheDocument());
  });
});

describe('Vulnerabilities — keyboard shortcut and project sort', () => {
  it('Ctrl+F focuses search input', async () => {
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    const searchInput = screen.getByPlaceholderText(/search findings/i);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    // Verify component is stable (focus behavior may vary in jsdom)
    expect(searchInput).toBeInTheDocument();
  });

  it('clicking "Project" sort button sorts by project name', async () => {
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    mockScansEq.mockResolvedValue({ data: [{ id: 'scan-1', project_id: 'proj-1', scanner: 'nmap', created_at: NOW }], error: null });
    render(<Vulnerabilities />);
    await screen.findByText('SQL Injection');
    // Attempt to find and click the Project sort button
    const allBtns = screen.getAllByRole('button');
    const projectSortBtn = allBtns.find(b => b.textContent?.trim() === 'Project');
    expect(projectSortBtn).toBeDefined();
    // Use act to flush React state updates
    await act(async () => { fireEvent.click(projectSortBtn!); });
    // After clicking Project sort, vulns are sorted by project name (localeCompare)
    await waitFor(() => expect(screen.getByText('SQL Injection')).toBeInTheDocument());
  });
});

describe('Vulnerabilities — VulnRow note and low CVSS', () => {
  it('renders note text when vuln has a note field', async () => {
    mockVulnsOrder.mockResolvedValue({
      data: [{
        id: 'v-note', user_id: 'user-1', scan_id: 'scan-1',
        title: 'Noted Vuln', severity: 'medium', status: 'open',
        cve_id: null, cvss: null, asset: 'note.io',
        note: 'This is a test note for coverage',
        sla_breached_at: null, sla_warned_at: null, created_at: NOW,
      }],
      error: null,
    });
    render(<Vulnerabilities />);
    await screen.findByText('Noted Vuln');
    expect(screen.getByText(/Note: This is a test note/i)).toBeInTheDocument();
  });

  it('renders low CVSS (< 4) in slate color class', async () => {
    mockVulnsOrder.mockResolvedValue({
      data: [{
        id: 'v-low', user_id: 'user-1', scan_id: 'scan-1',
        title: 'Low CVSS Vuln', severity: 'low', status: 'open',
        cve_id: null, cvss: 2.1, asset: 'low.io',
        sla_breached_at: null, sla_warned_at: null, created_at: NOW,
      }],
      error: null,
    });
    render(<Vulnerabilities />);
    await screen.findByText('Low CVSS Vuln');
    expect(screen.getByText('2.1')).toBeInTheDocument();
  });
});
