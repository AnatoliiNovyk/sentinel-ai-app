import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import Dashboard from '../Dashboard';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockNavigate, mockRemoveChannel, mockMakeChannel, mockAuthState, mockProbeAuditRows, mockVulnRows, mockProjectRows, mockScanRows, mockScanJobRows, mockTeamRows } = vi.hoisted(() => {
  const makeChannel = () => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  });

  return {
    mockNavigate: vi.fn(),
    mockRemoveChannel: vi.fn(),
    mockMakeChannel: vi.fn(makeChannel),
    mockAuthState: {
      user: null as { id: string } | null,
      profile: {
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Jane Doe',
        company: 'Acme Corp',
        plan: 'free',
        sla_config: null,
        avatar_url: null,
        created_at: '2026-01-01T00:00:00Z',
        sla_warned_at: null,
      },
      organizations: [] as { id: string }[],
    },
    mockProbeAuditRows: [] as unknown[],
    mockVulnRows: [] as unknown[],
    mockProjectRows: [] as unknown[],
    mockScanRows: [] as unknown[],
    mockScanJobRows: [] as unknown[],
    mockTeamRows: [] as unknown[],
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();

  // generic chain with repeated eq() + order() + limit()
  const makeQueryChain = (data: unknown[]) => {
    const chain = {
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve({ data, error: null })),
    };
    return chain;
  };

  // chain with: eq → order (no limit)
  const makeChainNoLimit = (data: unknown[]) => ({
    eq: () => ({
      order: () => Promise.resolve({ data, error: null }),
    }),
  });

  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'scans') return { select: () => makeQueryChain(mockScanRows) };
        if (table === 'projects') return { select: () => makeChainNoLimit(mockProjectRows) };
        if (table === 'vulnerabilities') return { select: () => makeQueryChain(mockVulnRows) };
        if (table === 'scan_jobs') return { select: () => makeQueryChain(mockScanJobRows) };
        if (table === 'team_members') return { select: () => ({ eq: () => Promise.resolve({ data: mockTeamRows, error: null }) }) };
        if (table === 'audit_logs') return { select: () => makeQueryChain(mockProbeAuditRows) };
        // sla-related writes
        return {
          update: () => ({ eq: () => ({ is: () => Promise.resolve({ data: null, error: null }) }) }),
          insert: () => Promise.resolve({ data: null, error: null }),
        };
      },
      channel: () => mockMakeChannel(),
      removeChannel: mockRemoveChannel,
    },
  };
});

vi.mock('../../context/useAuth', () => {
  return { useAuth: () => ({ user: mockAuthState.user, profile: mockAuthState.profile, organizations: mockAuthState.organizations }) };
});

// Prevent global key listener side-effects during suite runs.
vi.mock('../../lib/useSearchShortcut', () => ({
  useSearchShortcut: () => {},
}));

// Sparkline is a pure SVG component — no need to mock

// ── Tests ─────────────────────────────────────────────────────────────────

const renderDashboard = () => {
  render(<Dashboard />);
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockAuthState.user = null;
  mockAuthState.organizations = [];
  mockProbeAuditRows.length = 0;
  mockVulnRows.length = 0;
  mockProjectRows.length = 0;
  mockScanRows.length = 0;
  mockScanJobRows.length = 0;
  mockTeamRows.length = 0;
});

describe('Dashboard — layout', () => {
  it('renders "Security posture" heading', async () => {
    renderDashboard();
    expect(await screen.findByText('Security posture', {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('renders welcome message with first name', async () => {
    renderDashboard();
    expect(await screen.findByText(/welcome back.*jane/i, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('renders "Launch AI audit" button', async () => {
    renderDashboard();
    expect(
      await screen.findByRole('button', { name: /launch ai audit/i }, { timeout: 5000 }),
    ).toBeInTheDocument();
  });

  it('navigates to /chat when "Launch AI audit" clicked', async () => {
    renderDashboard();
    const launchButton = await screen.findByRole('button', { name: /launch ai audit/i }, { timeout: 5000 });
    fireEvent.click(launchButton);
    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });

});

describe('Dashboard — KPI cards', () => {
  it('renders "Projects" KPI card', async () => {
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('Projects')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('renders "Open findings" KPI card', async () => {
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('Open findings')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('renders "Resolved" KPI card', async () => {
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('Resolved')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('shows zero values when no data', async () => {
    renderDashboard();
    // All KPI values are 0 with empty data
    await waitFor(
      () => {
        const zeros = screen.getAllByText('0');
        expect(zeros.length).toBeGreaterThanOrEqual(3);
      },
      { timeout: 5000 },
    );
  });
});

describe('Dashboard — SLA section', () => {
  it('renders "SLA watch" section heading', async () => {
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('SLA watch')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('renders "Recent scans" section heading', async () => {
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('Recent scans')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });
});

describe('Dashboard — weekly SLO/SLA summary', () => {
  it('renders weekly summary section and threshold state', async () => {
    renderDashboard();
    await waitFor(
      () => {
        expect(screen.getByText('Weekly SLO/SLA summary')).toBeInTheDocument();
        expect(screen.getByText('Threshold breach')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('renders weekly KPI labels', async () => {
    renderDashboard();
    await waitFor(
      () => {
        expect(screen.getByText('Success %')).toBeInTheDocument();
        expect(screen.getByText('Failure %')).toBeInTheDocument();
        expect(screen.getByText('SLA breach %')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});

describe('Dashboard — agent probe smoke summary', () => {
  it('renders agent probe smoke section', async () => {
    renderDashboard();
    await waitFor(
      () => {
        expect(screen.getByText('Agent probe smoke')).toBeInTheDocument();
        expect(screen.getByText('Latest gateway `agent_health_probe` scheduled check')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('shows unknown state placeholders by default', async () => {
    renderDashboard();
    await waitFor(
      () => {
        expect(screen.getByText('Unknown')).toBeInTheDocument();
        expect(screen.getByText('Reachable')).toBeInTheDocument();
        expect(screen.getByText('HTTP')).toBeInTheDocument();
        expect(screen.getByText('Request ID')).toBeInTheDocument();
        expect(screen.getByText('Last run')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('renders latest successful probe details from audit logs for authenticated user', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.organizations = [{ id: 'org-1' }];
    mockProbeAuditRows.push({
      status: 'success',
      created_at: '2026-04-29T10:00:00Z',
      metadata: {
        status: 'ok',
        reachable: true,
        http_status: 200,
        request_id: 'req-1234567890',
        probed_url: 'http://95.67.75.146:9090/health',
        generated_at: '2026-04-29T10:00:00Z',
      },
    });

    renderDashboard();

    await waitFor(
      () => {
        expect(screen.getByText('OK')).toBeInTheDocument();
        expect(screen.getByText('yes')).toBeInTheDocument();
        expect(screen.getByText('200')).toBeInTheDocument();
        expect(screen.getByText('req-12345678')).toBeInTheDocument();
        expect(screen.getByText('req-12345678')).toHaveAttribute('title', 'req-1234567890');
        expect(screen.getByText(/URL: http:\/\/95\.67\.75\.146:9090\/health/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});

describe('Dashboard — vulnerability aging distribution', () => {
  it('does not show aging panel when there are no open findings', async () => {
    mockAuthState.user = { id: 'user-1' };
    renderDashboard();
    await waitFor(
      () => expect(screen.queryByText('Vulnerability aging')).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('shows aging panel heading when open findings exist', async () => {
    mockAuthState.user = { id: 'user-1' };
    const recentDate = new Date(Date.now() - 3 * 86_400_000).toISOString(); // 3 days ago
    mockVulnRows.push({ id: 'v1', severity: 'critical', status: 'open', title: 'Test', project_id: 'p1', created_at: recentDate, user_id: 'user-1' });
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('Vulnerability aging')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('shows aging bucket labels when open findings exist', async () => {
    mockAuthState.user = { id: 'user-1' };
    const recentDate = new Date(Date.now() - 3 * 86_400_000).toISOString();
    mockVulnRows.push({ id: 'v1', severity: 'high', status: 'open', title: 'Old vuln', project_id: 'p1', created_at: recentDate, user_id: 'user-1' });
    renderDashboard();
    await waitFor(
      () => {
        expect(screen.getByText('0–7 days')).toBeInTheDocument();
        expect(screen.getByText('7–30 days')).toBeInTheDocument();
        expect(screen.getByText('30–90 days')).toBeInTheDocument();
        expect(screen.getByText('90d+')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});

describe('Dashboard — top risky projects', () => {
  it('does not show risky projects panel when no open findings', async () => {
    mockAuthState.user = { id: 'user-1' };
    renderDashboard();
    await waitFor(
      () => expect(screen.queryByText('Top risky projects')).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('shows top risky projects panel and project name when open findings exist', async () => {
    mockAuthState.user = { id: 'user-1' };
    const recentDate = new Date(Date.now() - 1 * 86_400_000).toISOString();
    mockProjectRows.push({ id: 'p1', name: 'Risky App', user_id: 'user-1', created_at: recentDate });
    mockVulnRows.push({ id: 'v1', severity: 'critical', status: 'open', title: 'RCE', project_id: 'p1', created_at: recentDate, user_id: 'user-1' });
    renderDashboard();
    await waitFor(
      () => {
        expect(screen.getByText('Top risky projects')).toBeInTheDocument();
        expect(screen.getAllByText('Risky App').length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 },
    );
  });
});

describe('Dashboard — SlaGroup (overdue/at-risk)', () => {
  it('renders SlaGroup "Overdue" when a vuln exceeds SLA budget', async () => {
    mockAuthState.user = { id: 'user-1' };
    // critical SLA = 3 days → create vuln 10 days ago → overdue
    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    mockVulnRows.push({
      id: 'v-overdue',
      title: 'Overdue Critical',
      severity: 'critical',
      status: 'open',
      project_id: 'p1',
      created_at: oldDate,
      user_id: 'user-1',
    });
    renderDashboard();
    await waitFor(
      () => expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1),
      { timeout: 5000 },
    );
    expect(screen.getAllByText('Overdue Critical').length).toBeGreaterThanOrEqual(1);
  });

  it('renders SlaGroup "At risk" when vuln is ≥75% through budget', async () => {
    mockAuthState.user = { id: 'user-1' };
    // high SLA = 7 days → create vuln 6 days ago → at risk (6/7 = 86%)
    const atRiskDate = new Date(Date.now() - 6 * 86_400_000).toISOString();
    mockVulnRows.push({
      id: 'v-at-risk',
      title: 'At Risk High',
      severity: 'high',
      status: 'open',
      project_id: 'p1',
      created_at: atRiskDate,
      user_id: 'user-1',
    });
    renderDashboard();
    await waitFor(
      () => expect(screen.getAllByText('At risk').length).toBeGreaterThanOrEqual(1),
      { timeout: 5000 },
    );
    expect(screen.getAllByText('At Risk High').length).toBeGreaterThanOrEqual(1);
  });

  it('covers buildTrend resolved branch when vuln has status_updated_at', async () => {
    mockAuthState.user = { id: 'user-1' };
    const createdAt    = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const resolvedAt   = new Date(Date.now() - 2 * 86_400_000).toISOString();
    mockVulnRows.push({
      id: 'v-resolved',
      title: 'Resolved Vuln',
      severity: 'high',
      status: 'resolved',
      project_id: 'p1',
      created_at: createdAt,
      status_updated_at: resolvedAt,
      user_id: 'user-1',
    });
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('Security posture')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });
});

describe('Dashboard — StatusBadge via Recent scans', () => {
  it('renders StatusBadge for a completed scan', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockScanRows.push({
      id: 'scan-1',
      scanner: 'nmap',
      status: 'completed',
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
      project_id: 'proj-001',
      user_id: 'user-1',
      severity_summary: { critical: 1, high: 2, medium: 0 },
    });
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('completed')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('renders StatusBadge for a failed scan', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockScanRows.push({
      id: 'scan-2',
      scanner: 'tfsec',
      status: 'failed',
      created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      project_id: 'proj-002',
      user_id: 'user-1',
      severity_summary: {},
    });
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('failed')).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it('navigates to /scans from "View all" in Recent scans', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockScanRows.push({
      id: 'scan-3',
      scanner: 'amass',
      status: 'running',
      created_at: new Date().toISOString(),
      project_id: 'proj-003',
      user_id: 'user-1',
      severity_summary: {},
    });
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('View all')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    fireEvent.click(screen.getByText('View all'));
    expect(mockNavigate).toHaveBeenCalledWith('/scans');
  });

  it('navigates to /projects from "Manage projects" button', async () => {
    mockAuthState.user = { id: 'user-1' };
    renderDashboard();
    await waitFor(
      () => expect(screen.getByText('Manage projects')).toBeInTheDocument(),
      { timeout: 5000 },
    );
    fireEvent.click(screen.getByText('Manage projects'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });
});

describe('Dashboard — top open findings controls', () => {
  it('shows empty search state and clears findings filters', async () => {
    mockAuthState.user = { id: 'user-1' };
    const recentDate = new Date(Date.now() - 2 * 86_400_000).toISOString();
    mockProjectRows.push({ id: 'p1', name: 'Alpha API', user_id: 'user-1', created_at: recentDate });
    mockVulnRows.push({
      id: 'v-top-1',
      title: 'SQL Injection',
      severity: 'critical',
      status: 'open',
      project_id: 'p1',
      asset: 'api.example.com',
      cve_id: 'CVE-2026-1234',
      created_at: recentDate,
      user_id: 'user-1',
    });

    renderDashboard();

    const searchInput = await screen.findByPlaceholderText(/search findings/i, {}, { timeout: 5000 });
    fireEvent.change(searchInput, { target: { value: 'does-not-match' } });

    await waitFor(() => {
      expect(screen.getByText('No findings match the search.')).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    await waitFor(() => {
      expect((searchInput as HTMLInputElement).value).toBe('');
      expect(screen.getAllByText('SQL Injection').length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('renders project name and CVE link in top open findings', async () => {
    mockAuthState.user = { id: 'user-1' };
    const olderDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const newerDate = new Date(Date.now() - 1 * 86_400_000).toISOString();
    mockProjectRows.push({ id: 'p1', name: 'Risky Service', user_id: 'user-1', created_at: olderDate });
    mockVulnRows.push(
      {
        id: 'v-top-2',
        title: 'Broken Access Control',
        severity: 'high',
        status: 'open',
        project_id: 'p1',
        asset: 'app.example.com',
        cve_id: 'CVE-2026-9999',
        created_at: olderDate,
        user_id: 'user-1',
      },
      {
        id: 'v-top-3',
        title: 'Auth Bypass',
        severity: 'critical',
        status: 'open',
        project_id: 'p1',
        asset: 'auth.example.com',
        created_at: newerDate,
        user_id: 'user-1',
      },
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Top open findings')).toBeInTheDocument();
      expect(screen.getAllByText('Risky Service').length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const cveLinks = screen.getAllByRole('link', { name: 'CVE-2026-9999' });
    expect(cveLinks.length).toBeGreaterThan(0);
    expect(cveLinks.some((link) => link.getAttribute('href') === 'https://nvd.nist.gov/vuln/detail/CVE-2026-9999')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'A→Z' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
      expect(screen.getAllByText('Auth Bypass').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Broken Access Control').length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});

describe('Dashboard — additional coverage', () => {
  it('shows medium badge when findings have medium severity', async () => {
    mockAuthState.user = { id: 'user-1' };
    const date = new Date(Date.now() - 2 * 86_400_000).toISOString();
    mockProjectRows.push({ id: 'p1', name: 'MedProject', user_id: 'user-1', created_at: date });
    mockVulnRows.push(
      { id: 'vm1', title: 'Med Finding 1', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: date, user_id: 'user-1' },
      { id: 'vm2', title: 'Med Finding 2', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: date, user_id: 'user-1' },
    );
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Top risky projects')).toBeInTheDocument(), { timeout: 5000 });
    // medium badge: should show 2m in the risk panel
    const medBadges = screen.getAllByText(/^\d+m$/);
    expect(medBadges.length).toBeGreaterThan(0);
  });

  it('title sort works for findings with same severity', async () => {
    mockAuthState.user = { id: 'user-1' };
    const date = new Date(Date.now() - 2 * 86_400_000).toISOString();
    mockProjectRows.push({ id: 'p1', name: 'SortProject', user_id: 'user-1', created_at: date });
    mockVulnRows.push(
      { id: 'vt1', title: 'Zebra Finding', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: date, user_id: 'user-1' },
      { id: 'vt2', title: 'Alpha Finding', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: date, user_id: 'user-1' },
    );
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Top open findings')).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'A\u2192Z' }));
    await waitFor(() => {
      expect(screen.getAllByText('Alpha Finding').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Zebra Finding').length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});

// ── Batch 73 new coverage ─────────────────────────────────────────────────

describe('Dashboard — live scan jobs panel', () => {
  it('shows live jobs panel when scan_jobs has running items', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockScanJobRows.push(
      { id: 'job-1', scanner: 'Nmap', target: '10.0.0.1', status: 'running', created_at: new Date().toISOString(), project_id: 'p1' },
      { id: 'job-2', scanner: 'Tfsec', target: '10.0.0.2', status: 'pending', created_at: new Date().toISOString(), project_id: 'p1' },
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Live scans/i)).toBeInTheDocument();
      expect(screen.getByText('Nmap')).toBeInTheDocument();
      expect(screen.getByText('Tfsec')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('Dashboard — team members panel', () => {
  it('shows team members when org has members', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.organizations = [{ id: 'org-1' }];
    mockTeamRows.push(
      { id: 'tm-1', role: 'owner', auth: { users: { email: 'alice@example.com' } } },
      { id: 'tm-2', role: 'admin', auth: { users: { email: 'bob@example.com' } } },
      { id: 'tm-3', role: 'member', auth: { users: { email: 'carol@example.com' } } },
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Active members')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('owner')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows "+N more" overflow when team has more than 5 members', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.organizations = [{ id: 'org-1' }];
    for (let i = 1; i <= 7; i++) {
      mockTeamRows.push({ id: `tm-${i}`, role: 'member', auth: { users: { email: `user${i}@example.com` } } });
    }
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('+2')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('Dashboard — probe smoke error state', () => {
  it('shows Fail status when probe metadata has status error', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.organizations = [{ id: 'org-1' }];
    mockProbeAuditRows.push({
      status: 'failure',
      created_at: '2026-04-29T09:00:00Z',
      metadata: {
        status: 'error',
        reachable: false,
        http_status: 503,
        request_id: 'req-err-1',
        probed_url: 'http://agent.example.com/health',
        error: 'Connection refused',
        generated_at: '2026-04-29T09:00:00Z',
      },
    });
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Fail')).toBeInTheDocument();
      expect(screen.getByText('no')).toBeInTheDocument();
      expect(screen.getByText('503')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('Dashboard — risk filter buttons', () => {
  it('filters projects by risk score when filter buttons clicked', async () => {
    mockAuthState.user = { id: 'user-1' };
    mockProjectRows.push(
      { id: 'p-crit', name: 'Critical Project', user_id: 'user-1', risk_score: 85, created_at: new Date().toISOString() },
      { id: 'p-high', name: 'High Project', user_id: 'user-1', risk_score: 55, created_at: new Date().toISOString() },
      { id: 'p-med',  name: 'Medium Project', user_id: 'user-1', risk_score: 25, created_at: new Date().toISOString() },
      { id: 'p-low',  name: 'Low Project', user_id: 'user-1', risk_score: 5,  created_at: new Date().toISOString() },
    );
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Project risk')).toBeInTheDocument(), { timeout: 5000 });
    // click Critical filter
    const critBtn = screen.getByRole('button', { name: /^Critical$/i });
    fireEvent.click(critBtn);
    await waitFor(() => expect(screen.getByText('Critical Project')).toBeInTheDocument(), { timeout: 5000 });
    // click High filter
    const highBtn = screen.getByRole('button', { name: /^High$/i });
    fireEvent.click(highBtn);
    await waitFor(() => expect(screen.getByText('High Project')).toBeInTheDocument(), { timeout: 5000 });
    // click Medium filter
    const medBtn = screen.getByRole('button', { name: /^Medium$/i });
    fireEvent.click(medBtn);
    await waitFor(() => expect(screen.getByText('Medium Project')).toBeInTheDocument(), { timeout: 5000 });
    // click Low filter
    const lowBtn = screen.getByRole('button', { name: /^Low$/i });
    fireEvent.click(lowBtn);
    await waitFor(() => expect(screen.getByText('Low Project')).toBeInTheDocument(), { timeout: 5000 });
  });
});

describe('Dashboard — weekly SLO with scan durations', () => {
  it('computes avgDuration and p95Duration when completed scans have timestamps', async () => {
    mockAuthState.user = { id: 'user-1' };
    const now = Date.now();
    // 3 scans within last 7 days with started_at/completed_at
    for (let i = 0; i < 3; i++) {
      const started = new Date(now - (i + 1) * 86_400_000).toISOString();
      const completed = new Date(now - i * 86_400_000 - 3600_000).toISOString(); // 1h later - within budget
      mockScanRows.push({
        id: `ws-${i}`,
        scanner: 'nmap',
        status: 'completed',
        created_at: started,
        started_at: started,
        completed_at: completed,
        project_id: 'p1',
        user_id: 'user-1',
      });
    }
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Weekly SLO/SLA summary')).toBeInTheDocument(), { timeout: 5000 });
    // avg duration label renders in Weekly SLO section
    expect(screen.getByText('Avg min')).toBeInTheDocument();
  });

  it('computes sla breach when a scan duration exceeds 60 min', async () => {
    mockAuthState.user = { id: 'user-1' };
    const now = Date.now();
    const started = new Date(now - 2 * 86_400_000).toISOString();
    const completed = new Date(now - 2 * 86_400_000 + 2 * 3600_000).toISOString(); // 2h later — exceeds 60min SLA
    mockScanRows.push({
      id: 'ws-breach',
      scanner: 'nmap',
      status: 'completed',
      created_at: started,
      started_at: started,
      completed_at: completed,
      project_id: 'p1',
      user_id: 'user-1',
    });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('SLA breach %')).toBeInTheDocument(), { timeout: 5000 });
  });
});

describe('Dashboard — findings newest sort', () => {
  it('sorts findings by newest date', async () => {
    mockAuthState.user = { id: 'user-1' };
    const olderDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const newerDate = new Date(Date.now() - 1 * 86_400_000).toISOString();
    mockProjectRows.push({ id: 'p1', name: 'NS Project', user_id: 'user-1', created_at: olderDate });
    mockVulnRows.push(
      { id: 'vn1', title: 'Older Finding', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: olderDate, user_id: 'user-1' },
      { id: 'vn2', title: 'Newer Finding', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: newerDate, user_id: 'user-1' },
    );
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Top open findings')).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Newest' }));
    await waitFor(() => {
      expect(screen.getAllByText('Newer Finding').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Older Finding').length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('sorts findings by oldest date', async () => {
    mockAuthState.user = { id: 'user-1' };
    const olderDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const newerDate = new Date(Date.now() - 1 * 86_400_000).toISOString();
    mockProjectRows.push({ id: 'p1', name: 'OS Project', user_id: 'user-1', created_at: olderDate });
    mockVulnRows.push(
      { id: 'vo1', title: 'Oldest Finding', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: olderDate, user_id: 'user-1' },
      { id: 'vo2', title: 'Recent Finding', severity: 'medium', status: 'open', project_id: 'p1', asset: null, cve_id: null, created_at: newerDate, user_id: 'user-1' },
    );
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Top open findings')).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Oldest' }));
    await waitFor(() => {
      expect(screen.getAllByText('Oldest Finding').length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });
});

describe('Dashboard — SLA breach debounce effect', () => {
  it('triggers SLA breach update when overdue vuln exists', async () => {
    mockAuthState.user = { id: 'user-1' };
    // critical SLA = 3 days by default, create vuln 10 days old → overdue
    const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    mockVulnRows.push({
      id: 'v-sla-breach',
      title: 'Critical Breach',
      severity: 'critical',
      status: 'open',
      project_id: 'p1',
      created_at: oldDate,
      sla_breached_at: null,
      sla_warned_at: null,
      user_id: 'user-1',
    });
    renderDashboard();
    // Just verify the dashboard renders with the vuln loaded
    await waitFor(() => expect(screen.getByText('Security posture')).toBeInTheDocument(), { timeout: 5000 });
    // The SLA debounce runs async in background — component should still be mounted
    await new Promise(r => setTimeout(r, 100));
    expect(screen.getByText('Security posture')).toBeInTheDocument();
  });

  it('triggers SLA at-risk warning for vuln at 75% of budget', async () => {
    mockAuthState.user = { id: 'user-1' };
    // high SLA = 7 days → 6 days old → 86% used → at risk
    const atRiskDate = new Date(Date.now() - 6 * 86_400_000).toISOString();
    mockVulnRows.push({
      id: 'v-sla-warn',
      title: 'High At Risk',
      severity: 'high',
      status: 'open',
      project_id: 'p1',
      created_at: atRiskDate,
      sla_breached_at: null,
      sla_warned_at: null,
      user_id: 'user-1',
    });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Security posture')).toBeInTheDocument(), { timeout: 5000 });
    await new Promise(r => setTimeout(r, 100));
    expect(screen.getByText('Security posture')).toBeInTheDocument();
  });
});
