import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
