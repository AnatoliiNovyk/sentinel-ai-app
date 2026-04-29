import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import Dashboard from '../Dashboard';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockNavigate, mockRemoveChannel, mockMakeChannel } = vi.hoisted(() => {
  const makeChannel = () => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  });

  return {
    mockNavigate: vi.fn(),
    mockRemoveChannel: vi.fn(),
    mockMakeChannel: vi.fn(makeChannel),
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();

  // chain with: eq → order → limit
  const makeChain = (data: unknown[]) => ({
    eq: () => ({
      order: () => ({
        limit: () => Promise.resolve({ data, error: null }),
      }),
    }),
  });

  // chain with: eq → order (no limit)
  const makeChainNoLimit = (data: unknown[]) => ({
    eq: () => ({
      order: () => Promise.resolve({ data, error: null }),
    }),
  });

  // chain with: eq → in → order → limit  (for scan_jobs)
  const makeChainInFilter = (data: unknown[]) => ({
    eq: () => ({
      in: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data, error: null }),
        }),
      }),
    }),
  });

  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'scans') return { select: () => makeChain([]) };
        if (table === 'projects') return { select: () => makeChainNoLimit([]) };
        if (table === 'vulnerabilities') return { select: () => makeChain([]) };
        if (table === 'scan_jobs') return { select: () => makeChainInFilter([]) };
        if (table === 'team_members') return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
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
  const _user = null;
  const _profile = {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Jane Doe',
    company: 'Acme Corp',
    plan: 'free',
    sla_config: null,
    avatar_url: null,
    created_at: '2026-01-01T00:00:00Z',
    sla_warned_at: null,
  };
  return { useAuth: () => ({ user: _user, profile: _profile, organizations: [] }) };
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
});
