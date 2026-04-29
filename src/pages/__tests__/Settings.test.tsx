import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../Settings';

const originalLocation = window.location;

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockUpdateEq, mockProbeAuditRows } = vi.hoisted(() => ({
  mockUpdateEq: vi.fn().mockResolvedValue({ data: null, error: null }),
  mockProbeAuditRows: [] as unknown[],
}));

const { mockProbeAgentHealth } = vi.hoisted(() => ({
  mockProbeAgentHealth: vi.fn(),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  const makeApiUsageSelectChain = () => ({
    eq: () => ({
      eq: () => ({
        gt: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  });
  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'api_usage') {
          return {
            select: () => makeApiUsageSelectChain(),
            update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
            insert: () => Promise.resolve({ data: null, error: null }),
          };
        }

        if (table === 'audit_logs') {
          const chain = {
            eq: vi.fn(() => chain),
            order: vi.fn(() => chain),
            limit: vi.fn(() => Promise.resolve({ data: mockProbeAuditRows, error: null })),
          };
          return {
            select: () => chain,
          };
        }

        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          update: () => ({ eq: mockUpdateEq }),
        };
      },
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
  return {
    useAuth: () => ({ user: _user, profile: _profile }),
  };
});

vi.mock('../../lib/agentHealth', () => ({
  probeAgentHealth: mockProbeAgentHealth,
  isMixedContentAgentUrl: (url: string) => url.startsWith('http://'),
  isHttpsAgentUrl: (url: string) => url.startsWith('https://'),
}));

// ── Tests ─────────────────────────────────────────────────────────────────

afterEach(async () => {
  mockProbeAuditRows.length = 0;
  // Flush any pending async state updates to prevent act() warnings
  await act(async () => {});
});

describe('Settings — layout', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('renders "Settings" heading', () => {
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders "Profile" section heading', () => {
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('renders "Subscription" section heading', () => {
    expect(screen.getByText('Subscription')).toBeInTheDocument();
  });

  it('renders "Remediation SLA" section heading', () => {
    expect(screen.getByText('Remediation SLA')).toBeInTheDocument();
  });

  it('renders "Team Members" section heading', () => {
    expect(screen.getByText('Team Members')).toBeInTheDocument();
  });

  it('renders "Webhook Integrations" section heading', () => {
    expect(screen.getByText('Webhook Integrations')).toBeInTheDocument();
  });
});

describe('Settings — Profile section', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('email input is disabled and pre-filled from profile', () => {
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    expect(emailInput).toBeDisabled();
    expect(emailInput.value).toBe('test@example.com');
  });

  it('full name input is pre-filled from profile', () => {
    const fullNameInput = screen.getByLabelText('Full name') as HTMLInputElement;
    expect(fullNameInput.value).toBe('Jane Doe');
  });

  it('company input is pre-filled from profile', () => {
    const companyInput = screen.getByLabelText('Company') as HTMLInputElement;
    expect(companyInput.value).toBe('Acme Corp');
  });

  it('full name input updates on change', () => {
    const input = screen.getByLabelText('Full name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'John Smith' } });
    expect(input.value).toBe('John Smith');
  });
});

describe('Settings — Plans', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('renders all four plan names', () => {
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('shows "Current plan ✓" for active plan (free)', () => {
    expect(screen.getByText('Current plan ✓')).toBeInTheDocument();
  });

  it('shows "Most Popular" badge on Pro plan', () => {
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });
});

describe('Settings — SLA section', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('renders SLA input for Critical with value from DEFAULT_SLA_CONFIG', () => {
    const criticalInput = screen.getByLabelText('Critical') as HTMLInputElement;
    expect(criticalInput).toBeInTheDocument();
    expect(Number(criticalInput.value)).toBeGreaterThan(0);
  });

  it('renders SLA inputs for all four severities', () => {
    expect(screen.getByLabelText('Critical')).toBeInTheDocument();
    expect(screen.getByLabelText('High')).toBeInTheDocument();
    expect(screen.getByLabelText('Medium')).toBeInTheDocument();
    expect(screen.getByLabelText('Low')).toBeInTheDocument();
  });
});

describe('Settings — Team Members', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('renders owner email in team list', () => {
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders "Owner" role badge', () => {
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('adds a new team member when Invite button clicked', () => {
    const emailInput = screen.getByPlaceholderText('colleague@company.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'colleague@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(screen.getByText('colleague@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });
});

describe('Settings — Save', () => {
  beforeEach(async () => {
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
    await act(async () => { render(<Settings />); });
  });

  it('renders "Save changes" button', () => {
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('calls supabase update when Save clicked', async () => {
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1'));
  });

  it('shows "Saved!" after successful save', async () => {
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(
      () => expect(screen.getByRole('button', { name: /saved!/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});

describe('Settings — Agent mixed content', () => {
  beforeEach(() => {
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
    vi.unstubAllGlobals();
  });

  it('shows agent online from gateway probe for HTTPS app + HTTP agent URL', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        protocol: 'https:',
        href: 'https://sentinel.local/settings',
      },
    });
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: true,
      statusCode: 200,
      health: {
        status: 'ok',
        uptime: 120,
        jobsProcessed: 1,
        jobsFailed: 0,
        lastJobAt: null,
        lastError: null,
        timestamp: '2026-04-29T00:00:00.000Z',
      },
      error: null,
      via: 'gateway',
    });

    await act(async () => { render(<Settings />); });
    const agentInput = screen.getByPlaceholderText('http://your-vps:9090/health');
    fireEvent.change(agentInput, { target: { value: 'http://95.67.75.146:9090/health' } });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Agent online/i)).toBeInTheDocument();
    });
    expect(mockProbeAgentHealth).toHaveBeenCalled();
  });

  it('shows TLS/CORS guidance for HTTPS agent URL when fetch fails', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        protocol: 'https:',
        href: 'https://sentinel.local/settings',
      },
    });
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: false,
      statusCode: null,
      health: null,
      error: 'TypeError: Failed to fetch',
      via: 'direct',
    });

    await act(async () => { render(<Settings />); });
    const agentInput = screen.getByPlaceholderText('http://your-vps:9090/health');
    fireEvent.change(agentInput, { target: { value: 'https://95.67.75.146:9090/health' } });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(screen.getByText(/HTTPS endpoint check failed \(TLS\/CORS\)/i)).toBeInTheDocument();
    });
    expect(mockProbeAgentHealth).toHaveBeenCalled();
  });

  it('shows gateway probe error for mixed-content URL when gateway probe fails', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        protocol: 'https:',
        href: 'https://sentinel.local/settings',
      },
    });
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: false,
      statusCode: 401,
      health: null,
      error: 'Valid admin key is required.',
      via: 'gateway',
    });

    await act(async () => { render(<Settings />); });
    const agentInput = screen.getByPlaceholderText('http://your-vps:9090/health');
    fireEvent.change(agentInput, { target: { value: 'http://95.67.75.146:9090/health' } });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Gateway probe failed:/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Blocked by browser policy/i)).not.toBeInTheDocument();
  });

  it('persists agent URL after blur and restores it after remount', async () => {
    localStorage.removeItem('agentHealthUrl');
    let unmount!: () => void;
    await act(async () => {
      ({ unmount } = render(<Settings />));
    });

    const input = screen.getByPlaceholderText('http://your-vps:9090/health') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'http://95.67.75.146:9090/health' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(localStorage.getItem('agentHealthUrl')).toBe('http://95.67.75.146:9090/health');
    });

    unmount();
    await act(async () => { render(<Settings />); });

    const restored = screen.getByPlaceholderText('http://your-vps:9090/health') as HTMLInputElement;
    expect(restored.value).toBe('http://95.67.75.146:9090/health');
  });

  it('shows latest probe smoke fallback values by default', async () => {
    await act(async () => { render(<Settings />); });
    expect(screen.getByText('Latest probe smoke')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText('Reachable')).toBeInTheDocument();
    expect(screen.getByText('Request ID')).toBeInTheDocument();
  });

  it('shows latest probe smoke details from audit logs', async () => {
    mockProbeAuditRows.push({
      status: 'success',
      created_at: '2026-04-29T10:00:00Z',
      metadata: {
        status: 'ok',
        reachable: true,
        http_status: 200,
        request_id: 'req-settings-probe-123456',
        generated_at: '2026-04-29T10:00:00Z',
      },
    });

    render(<Settings />);

    await waitFor(() => {
      expect(screen.getByText('OK')).toBeInTheDocument();
      expect(screen.getByText('yes')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('req-settings')).toHaveAttribute('title', 'req-settings-probe-123456');
    });
  });
});
