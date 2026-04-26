import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
import Dashboard from '../Dashboard';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockNavigate, mockChannel } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockChannel: {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  },
}));

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
      channel: () => mockChannel,
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
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

// Sparkline is a pure SVG component — no need to mock

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Dashboard — layout', () => {
  it('renders "Security posture" heading', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText('Security posture')).toBeInTheDocument(),
    );
  });

  it('renders welcome message with first name', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByText(/welcome back.*jane/i)).toBeInTheDocument(),
    );
  });

  it('renders "Launch AI audit" button', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /launch ai audit/i })).toBeInTheDocument(),
    );
  });

  it('navigates to /chat when "Launch AI audit" clicked', async () => {
    render(<Dashboard />);
    await waitFor(() =>
      screen.getByRole('button', { name: /launch ai audit/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /launch ai audit/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });
});

describe('Dashboard — KPI cards', () => {
  it('renders "Projects" KPI card', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Projects')).toBeInTheDocument());
  });

  it('renders "Open findings" KPI card', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Open findings')).toBeInTheDocument());
  });

  it('renders "Resolved" KPI card', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Resolved')).toBeInTheDocument());
  });

  it('shows zero values when no data', async () => {
    render(<Dashboard />);
    // All KPI values are 0 with empty data
    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Dashboard — SLA section', () => {
  it('renders "SLA watch" section heading', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('SLA watch')).toBeInTheDocument());
  });

  it('renders "Recent scans" section heading', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText('Recent scans')).toBeInTheDocument());
  });
});
