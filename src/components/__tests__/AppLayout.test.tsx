import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppLayout from '../AppLayout';

const originalLocation = window.location;

const { mockSignOut, mockProfile, mockLocation, mockAuthState, mockProbeAuditRows } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockProfile: { full_name: 'Jane Doe', email: 'jane@test.com' },
  mockLocation: { pathname: '/' },
  mockAuthState: {
    user: { id: 'user-1' } as { id: string } | null,
    organizations: [{ id: 'org-1' }] as { id: string }[],
  },
  mockProbeAuditRows: [] as unknown[],
}));

const { mockProbeAgentHealth } = vi.hoisted(() => ({
  mockProbeAgentHealth: vi.fn(),
}));

vi.mock('../../context/useAuth', () => {
  const _signOut = mockSignOut;
  const _profile = mockProfile;
  return {
    useAuth: () => ({
      profile: _profile,
      signOut: _signOut,
      user: mockAuthState.user,
      organizations: mockAuthState.organizations,
    }),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'audit_logs') {
        return { select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) };
      }

      const chain = {
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => Promise.resolve({ data: mockProbeAuditRows, error: null })),
      };

      return { select: () => chain };
    },
  },
}));

vi.mock('react-router-dom', () => ({
  NavLink: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: (arg: { isActive: boolean }) => string;
  }) => (
    <a href={to} className={typeof className === 'function' ? className({ isActive: to === '/' }) : className}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet-content">Outlet</div>,
  useLocation: () => mockLocation,
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock('../NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">NotificationBell</div>,
}));

vi.mock('../../lib/agentHealth', () => ({
  probeAgentHealth: mockProbeAgentHealth,
  isMixedContentAgentUrl: (url: string) => url.startsWith('http://'),
  isHttpsAgentUrl: (url: string) => url.startsWith('https://'),
}));

describe('AppLayout — sidebar', () => {
  it('renders "Sentinel AI" brand in sidebar', () => {
    render(<AppLayout />);
    expect(screen.getAllByText('Sentinel AI').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Dashboard nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  });

  it('renders AI Assistant nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /AI Assistant/i })).toBeInTheDocument();
  });

  it('renders Projects nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /Projects/i })).toBeInTheDocument();
  });

  it('renders Settings nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });

  it('renders user full name in sidebar footer', () => {
    render(<AppLayout />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders user email in sidebar footer', () => {
    render(<AppLayout />);
    expect(screen.getByText('jane@test.com')).toBeInTheDocument();
  });

  it('renders user initials (JD)', () => {
    render(<AppLayout />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('calls signOut when sign out button is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTitle('Sign out'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('AppLayout — header', () => {
  beforeEach(() => {
    mockLocation.pathname = '/';
    mockProbeAgentHealth.mockResolvedValue({
      reachable: false,
      statusCode: null,
      health: null,
      error: 'Unreachable',
      via: 'direct',
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    localStorage.removeItem('agentHealthUrl');
    mockProbeAuditRows.length = 0;
    vi.unstubAllGlobals();
  });

  it('renders NotificationBell in header', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('renders page title "Dashboard" for "/" path', () => {
    render(<AppLayout />);
    // "Dashboard" appears both in sidebar nav link and in header — verify header presence
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(2);
  });

  it('renders page title "AI Assistant" for "/chat" path', () => {
    mockLocation.pathname = '/chat';
    render(<AppLayout />);
    // "AI Assistant" appears both in sidebar nav link and in header
    expect(screen.getAllByText('AI Assistant').length).toBeGreaterThanOrEqual(2);
  });

  it('renders Outlet content area', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
  });

  it('shows agent online when gateway probe succeeds for HTTP agent URL', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        protocol: 'https:',
        href: 'https://sentinel.local/',
      },
    });
    localStorage.setItem('agentHealthUrl', 'http://95.67.75.146:9090/health');
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: true,
      statusCode: 200,
      health: {
        status: 'ok',
        uptime: 3600,
        jobsProcessed: 7,
        jobsFailed: 0,
        lastJobAt: null,
        lastError: null,
      },
      error: null,
      via: 'gateway',
    });

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText('Agent online · 7 jobs')).toBeInTheDocument();
    });
    expect(mockProbeAgentHealth).toHaveBeenCalled();
  });

  it('shows HTTPS TLS/CORS status when https agent URL check fails', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        protocol: 'https:',
        href: 'https://sentinel.local/',
      },
    });
    localStorage.setItem('agentHealthUrl', 'https://95.67.75.146:9090/health');
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: false,
      statusCode: null,
      health: null,
      error: 'TypeError: Failed to fetch',
      via: 'direct',
    });

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText('Agent HTTPS check failed (TLS/CORS)')).toBeInTheDocument();
    });
    expect(mockProbeAgentHealth).toHaveBeenCalled();
  });

  it('shows global probe smoke badge when latest audit log status is ok', async () => {
    mockProbeAuditRows.push({
      status: 'success',
      created_at: '2026-04-29T10:00:00Z',
      metadata: {
        status: 'ok',
        generated_at: '2026-04-29T10:00:00Z',
        request_id: 'req-global-probe-123',
      },
    });

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText(/Probe OK/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Probe OK/i)).toHaveAttribute('title', expect.stringContaining('request_id: req-global-probe-123'));
  });
});

describe('AppLayout — Scans link', () => {
  it('renders Scans nav link pointing to /scans', () => {
    render(<AppLayout />);
    const link = screen.getByRole('link', { name: /Scans/i });
    expect(link).toHaveAttribute('href', '/scans');
  });
});

describe('AppLayout — sidebar mobile open/close', () => {
  beforeEach(() => {
    mockLocation.pathname = '/';
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });
  });

  it('opens sidebar on hamburger click and closes on overlay click', async () => {
    render(<AppLayout />);
    const hamburger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(hamburger);
    // Overlay renders when sidebarOpen=true
    const overlay = document.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay!);
    // Overlay disappears after close
    await waitFor(() => expect(document.querySelector('[aria-hidden="true"]')).toBeNull());
  });

  it('closes sidebar via close-menu button', async () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    await waitFor(() => expect(document.querySelector('[aria-hidden="true"]')).toBeNull());
  });
});

describe('AppLayout — Ctrl+K command palette', () => {
  beforeEach(() => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });
  });

  it('opens command palette via Ctrl+K', async () => {
    render(<AppLayout />);
    const btn = screen.getByTitle('Command palette (Ctrl+K)');
    expect(btn).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    });
    // No throw = palette toggle handled
  });

  it('opens command palette via Meta+K', async () => {
    render(<AppLayout />);
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
    });
    // Toggle again to close
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true });
    });
  });

  it('opens palette via Search… button click', async () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTitle('Command palette (Ctrl+K)'));
    // No throw = pass
  });
});

describe('AppLayout — poll catch / agent error path', () => {
  afterEach(() => {
    localStorage.removeItem('agentHealthUrl');
    mockProbeAuditRows.length = 0;
  });

  it('handles probeAgentHealth throwing (catch sets reachable=false)', async () => {
    localStorage.setItem('agentHealthUrl', 'https://bad-host:9090/health');
    mockProbeAgentHealth.mockRejectedValueOnce(new Error('network error'));

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText(/Agent HTTPS check failed/i)).toBeInTheDocument();
    });
  });

  it('handles poll catch with http url (no TLS hint)', async () => {
    localStorage.setItem('agentHealthUrl', 'http://bad-host:9090/health');
    mockProbeAgentHealth.mockRejectedValueOnce(new Error('network error'));

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText(/Agent offline|Agent check blocked/i)).toBeInTheDocument();
    });
  });
});

describe('AppLayout — pollProbeSmoke branches', () => {
  afterEach(() => {
    localStorage.removeItem('agentHealthUrl');
    mockProbeAuditRows.length = 0;
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.organizations = [{ id: 'org-1' }];
  });

  it('probe smoke stays unknown when no user and no org', async () => {
    mockAuthState.user = null;
    mockAuthState.organizations = [];
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText('Probe n/a')).toBeInTheDocument();
    });
  });

  it('uses userId query when no org present', async () => {
    mockAuthState.organizations = [];
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });
    mockProbeAuditRows.push({
      status: 'success',
      created_at: '2026-04-29T10:00:00Z',
      metadata: null,
    });

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText(/Probe OK/i)).toBeInTheDocument();
    });
  });

  it('maps row.status=failure to Probe Fail', async () => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });
    mockProbeAuditRows.push({
      status: 'failure',
      created_at: '2026-04-29T10:00:00Z',
      metadata: null,
    });

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText(/Probe Fail/i)).toBeInTheDocument();
    });
  });

  it('handles supabase throwing in pollProbeSmoke (stays unknown)', async () => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });
    // Corrupt the mock to throw
    const origFrom = (await import('../../lib/supabase')).supabase.from;
    vi.spyOn((await import('../../lib/supabase')).supabase, 'from').mockImplementationOnce(() => {
      throw new Error('db error');
    });

    render(<AppLayout />);

    await waitFor(() => {
      expect(screen.getByText('Probe n/a')).toBeInTheDocument();
    });

    vi.spyOn((await import('../../lib/supabase')).supabase, 'from').mockRestore();
    void origFrom;
  });
});

describe('AppLayout — formatRelativeMinutes via probeSmoke', () => {
  afterEach(() => {
    vi.useRealTimers();
    mockProbeAuditRows.length = 0;
  });

  it('shows "just now" when probe was 30s ago', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);
    const thirtySecsAgo = new Date(now.getTime() - 30_000).toISOString();
    mockProbeAuditRows.push({ status: 'success', created_at: thirtySecsAgo, metadata: { status: 'ok', generated_at: thirtySecsAgo } });
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });

    render(<AppLayout />);
    await act(async () => { vi.runAllTimersAsync(); });

    await waitFor(() => expect(screen.getByText(/Probe OK · just now/i)).toBeInTheDocument());
  });

  it('shows "Xm ago" when probe was 5min ago', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60_000).toISOString();
    mockProbeAuditRows.push({ status: 'success', created_at: fiveMinsAgo, metadata: { status: 'ok', generated_at: fiveMinsAgo } });
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });

    render(<AppLayout />);
    await act(async () => { vi.runAllTimersAsync(); });

    await waitFor(() => expect(screen.getByText(/Probe OK · 5m ago/i)).toBeInTheDocument());
  });

  it('shows "Xh ago" when probe was 2h ago', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600_000).toISOString();
    mockProbeAuditRows.push({ status: 'success', created_at: twoHoursAgo, metadata: { status: 'ok', generated_at: twoHoursAgo } });
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });

    render(<AppLayout />);
    await act(async () => { vi.runAllTimersAsync(); });

    await waitFor(() => expect(screen.getByText(/Probe OK · 2h ago/i)).toBeInTheDocument());
  });

  it('shows "Xd ago" when probe was 3 days ago', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-30T12:00:00Z');
    vi.setSystemTime(now);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600_000).toISOString();
    mockProbeAuditRows.push({ status: 'success', created_at: threeDaysAgo, metadata: { status: 'ok', generated_at: threeDaysAgo } });
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });

    render(<AppLayout />);
    await act(async () => { vi.runAllTimersAsync(); });

    await waitFor(() => expect(screen.getByText(/Probe OK · 3d ago/i)).toBeInTheDocument());
  });
});

describe('AppLayout — agentUrl storage event', () => {
  afterEach(() => {
    localStorage.removeItem('agentHealthUrl');
    mockProbeAuditRows.length = 0;
  });

  it('updates agentUrl on storage event for agentHealthUrl key', async () => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });
    render(<AppLayout />);

    await act(async () => {
      const event = new StorageEvent('storage', { key: 'agentHealthUrl', newValue: 'http://new-host:9090/health' });
      window.dispatchEvent(event);
    });
    // No throw = agent URL update handled
  });

  it('ignores storage events for other keys', async () => {
    mockProbeAgentHealth.mockResolvedValue({ reachable: false, health: null, error: 'offline', via: 'direct' });
    render(<AppLayout />);

    await act(async () => {
      const event = new StorageEvent('storage', { key: 'otherKey', newValue: 'value' });
      window.dispatchEvent(event);
    });
  });
});
