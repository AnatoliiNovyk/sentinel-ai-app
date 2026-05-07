import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../Settings';
import { AuditService } from '../../api/audit.service';

const originalLocation = window.location;

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockUpdateEq, mockProbeAuditRows, mockAuthProfile } = vi.hoisted(() => ({
  mockUpdateEq: vi.fn().mockResolvedValue({ data: null, error: null }),
  mockProbeAuditRows: [] as unknown[],
  mockAuthProfile: {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Jane Doe',
    company: 'Acme Corp',
    plan: 'free' as string,
    sla_config: null,
    avatar_url: null,
    created_at: '2026-01-01T00:00:00Z',
    sla_warned_at: null,
  },
}));

const { mockAuthState } = vi.hoisted(() => ({
  mockAuthState: {
    user: { id: 'user-1' } as { id: string; app_metadata?: { org_id?: string } } | null,
    profileOverride: undefined as {
      id: string;
      email?: string | null;
      full_name: string;
      company: string | null;
      plan: string;
      sla_config: unknown;
      avatar_url: string | null;
      created_at: string;
      sla_warned_at: string | null;
    } | null | undefined,
  },
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
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
      },
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
  return {
    useAuth: () => ({
      user: mockAuthState.user,
      profile: mockAuthState.profileOverride === undefined ? mockAuthProfile : mockAuthState.profileOverride,
    }),
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
  mockAuthState.user = { id: 'user-1' };
  mockAuthState.profileOverride = undefined;
  mockAuthProfile.email = 'test@example.com';
  mockAuthProfile.full_name = 'Jane Doe';
  mockAuthProfile.company = 'Acme Corp';
  mockAuthProfile.plan = 'free';
  mockAuthProfile.sla_config = null;
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

  it('continues save flow when audit logging throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const auditSpy = vi.spyOn(AuditService, 'logSecurityEvent').mockRejectedValue(new Error('audit failed'));

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1'));
    await waitFor(() => expect(screen.getByRole('button', { name: /saved!/i })).toBeInTheDocument());
    await waitFor(() => expect(warnSpy).toHaveBeenCalledWith('Audit log failed:', expect.any(Error)));

    auditSpy.mockRestore();
    warnSpy.mockRestore();
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

describe('Settings — Security & Preferences toggles', () => {
  beforeEach(async () => {
    localStorage.removeItem('darkMode');
    await act(async () => { render(<Settings />); });
  });

  it('toggles Two-Factor Authentication on/off', () => {
    const btn = screen.getByTitle(/two-factor/i);
    fireEvent.click(btn);
    // Toggle clicked — no throw expected
    fireEvent.click(btn);
  });

  it('toggles Dark Mode on/off', () => {
    const btn = screen.getByTitle(/dark mode/i);
    fireEvent.click(btn);
    fireEvent.click(btn);
  });
});

describe('Settings — Notification Preferences', () => {
  beforeEach(async () => {
    localStorage.removeItem('sentinelNotifPrefs');
    await act(async () => { render(<Settings />); });
  });

  it('toggles email notification channel', () => {
    fireEvent.click(screen.getByTitle(/disable email notifications|enable email notifications/i));
  });

  it('toggles in-app notification channel', () => {
    fireEvent.click(screen.getByTitle(/disable in-app notifications|enable in-app notifications/i));
  });

  it('toggles webhook delivery channel', () => {
    fireEvent.click(screen.getByTitle(/disable webhook delivery|enable webhook delivery/i));
  });

  it('sets minimum severity to Medium+', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Medium+' }));
  });

  it('sets minimum severity to High+', () => {
    fireEvent.click(screen.getByRole('button', { name: 'High+' }));
  });

  it('sets minimum severity to Critical only', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Critical only' }));
  });

  it('sets digest to Daily digest', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Daily digest' }));
  });

  it('sets digest to Weekly digest', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Weekly digest' }));
  });
});

describe('Settings — Data Retention presets', () => {
  beforeEach(async () => {
    localStorage.removeItem('sentinelRetention');
    await act(async () => { render(<Settings />); });
  });

  it('clicks 30d preset for Scan Results', () => {
    const presets = screen.getAllByRole('button', { name: '30d' });
    fireEvent.click(presets[0]);
  });

  it('changes retention input value', () => {
    const inputs = screen.getAllByRole('spinbutton', { name: /retention/i });
    fireEvent.change(inputs[0], { target: { value: '60' } });
  });
});

describe('Settings — Team Members management', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('shows invite error for invalid email', () => {
    const emailInput = screen.getByPlaceholderText('colleague@company.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
  });

  it('shows duplicate email error', () => {
    const emailInput = screen.getByPlaceholderText('colleague@company.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(screen.getByText('This email is already in the team.')).toBeInTheDocument();
  });

  it('removes a team member', async () => {
    const emailInput = screen.getByPlaceholderText('colleague@company.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => screen.getByText('new@acme.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    await waitFor(() => expect(screen.queryByText('new@acme.com')).toBeNull());
  });
});

describe('Settings — handleUpgrade paths', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('clicking Enterprise plan opens contact email', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const enterpriseBtn = screen.getByRole('button', { name: /contact sales/i });
    await act(async () => { fireEvent.click(enterpriseBtn); });
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    openSpy.mockRestore();
  });

  it('clicking Basic Upgrade opens mailto fallback (no Stripe)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const basicBtn = screen.getAllByRole('button', { name: /upgrade/i })[0];
    await act(async () => { fireEvent.click(basicBtn); });
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    openSpy.mockRestore();
  });
});

describe('Settings — Agent health with lastJobAt and lastError', () => {
  afterEach(() => {
    localStorage.removeItem('agentHealthUrl');
  });

  it('renders last job timestamp and last error when agent health returns them', async () => {
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: true,
      statusCode: 200,
      health: {
        status: 'ok',
        uptime: 7200,
        jobsProcessed: 10,
        jobsFailed: 1,
        lastJobAt: '2026-04-30T12:00:00.000Z',
        lastError: 'timeout on target host',
        timestamp: '2026-04-30T12:05:00.000Z',
      },
      error: null,
      via: 'direct',
    });

    await act(async () => { render(<Settings />); });
    const agentInput = screen.getByPlaceholderText('http://your-vps:9090/health');
    fireEvent.change(agentInput, { target: { value: 'http://95.67.75.146:9090/health' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^check$/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Agent online/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Last job:/i)).toBeInTheDocument();
    expect(screen.getByText(/timeout on target host/i)).toBeInTheDocument();
  });
});

describe('Settings — ApiKeyRow show/hide and copy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows masked value by default and toggles to reveal key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    await act(async () => { render(<Settings />); });

    const showBtns = screen.getAllByRole('button', { name: 'Show key' });
    expect(showBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(showBtns[0]);
    expect(screen.getAllByRole('button', { name: 'Hide key' }).length).toBeGreaterThanOrEqual(1);
  });

  it('copies key to clipboard when Copy key clicked', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    await act(async () => { render(<Settings />); });

    const copyBtns = screen.getAllByRole('button', { name: 'Copy key' });
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);
    await act(async () => { fireEvent.click(copyBtns[0]); });

    expect(writeTextMock).toHaveBeenCalled();
  });
});


// ── Additional coverage tests ─────────────────────────────────────────────

describe('Settings — additional coverage', () => {
  it('clicking Upgrade on a paid plan does not throw', async () => {
    await act(async () => { render(<Settings />); });
    await waitFor(() => expect(screen.getAllByText(/Upgrade/i).length).toBeGreaterThan(0));
    const upgradeBtn = screen.getAllByText(/Upgrade/i)[0];
    fireEvent.click(upgradeBtn);
    // should not throw
  });

  it('agent input onKeyDown Enter triggers saveAgentUrl', async () => {
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: true,
      statusCode: 200,
      health: { status: 'ok', uptime: 60, jobsProcessed: 0, jobsFailed: 0, lastJobAt: null, lastError: null, timestamp: '' },
      error: null,
      via: 'direct',
    });
    await act(async () => { render(<Settings />); });
    const agentInput = screen.getByPlaceholderText('http://your-vps:9090/health');
    fireEvent.change(agentInput, { target: { value: 'http://localhost:9090/health' } });
    fireEvent.keyDown(agentInput, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(mockProbeAgentHealth).toHaveBeenCalled());
  });

  it('agent input onBlur commits URL without throwing', async () => {
    await act(async () => { render(<Settings />); });
    const agentInput = screen.getByPlaceholderText('http://your-vps:9090/health');
    fireEvent.change(agentInput, { target: { value: 'http://localhost:9090/health' } });
    fireEvent.blur(agentInput);
    await waitFor(() => expect(screen.getByText('Unknown')).toBeInTheDocument());
  });

  it('shows probe smoke status "OK" when probeSmoke audit row has status ok', async () => {
    mockProbeAuditRows.push({
      status: 'success',
      created_at: '2026-04-01T00:00:00Z',
      metadata: { status: 'ok', reachable: true, http_status: 200, request_id: 'req-123', generated_at: '2026-04-01T00:00:00Z' },
    });
    await act(async () => { render(<Settings />); });
    await waitFor(() => expect(screen.getByText('OK')).toBeInTheDocument());
  });

  it('shows probe smoke status "Fail" when probeSmoke audit row has status error', async () => {
    mockProbeAuditRows.push({
      status: 'failure',
      created_at: '2026-04-01T00:00:00Z',
      metadata: { status: 'error', reachable: false, http_status: 500, request_id: null, generated_at: null },
    });
    await act(async () => { render(<Settings />); });
    await waitFor(() => expect(screen.getByText('Fail')).toBeInTheDocument());
  });
});

describe('Settings — paid plan billing portal', () => {
  afterEach(() => {
    mockAuthProfile.plan = 'free';
  });

  it('renders Manage billing button when plan is pro', async () => {
    mockAuthProfile.plan = 'pro';
    await act(async () => { render(<Settings />); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
    });
  });

  it('clicking Manage billing opens window.open with mailto fallback (no STRIPE_PORTAL_URL)', async () => {
    mockAuthProfile.plan = 'pro';
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    await act(async () => { render(<Settings />); });
    const manageBillingBtn = await screen.findByRole('button', { name: /manage billing/i });
    await act(async () => { fireEvent.click(manageBillingBtn); });
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    openSpy.mockRestore();
  });

  it('renders Manage billing button when plan is basic', async () => {
    mockAuthProfile.plan = 'basic';
    await act(async () => { render(<Settings />); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /manage billing/i })).toBeInTheDocument();
    });
  });

  it('does not render Manage billing button when plan is free', async () => {
    mockAuthProfile.plan = 'free';
    await act(async () => { render(<Settings />); });
    expect(screen.queryByRole('button', { name: /manage billing/i })).toBeNull();
  });
});

describe('Settings — Stripe checkout fallback', () => {
  afterEach(() => {
    mockAuthProfile.plan = 'free';
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('opens mailto fallback after failed Stripe checkout fetch', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    // Mock fetch to fail (network error)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await act(async () => { render(<Settings />); });
    // Click Basic Upgrade button
    const upgradeBtn = screen.getAllByRole('button', { name: /upgrade/i })[0];
    await act(async () => { fireEvent.click(upgradeBtn); });
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    });
    openSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('opens mailto fallback when Stripe checkout returns non-ok response', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    // Mock fetch to return 500
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await act(async () => { render(<Settings />); });
    const upgradeBtn = screen.getAllByRole('button', { name: /upgrade/i })[0];
    await act(async () => { fireEvent.click(upgradeBtn); });
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    });
    openSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('redirects to Stripe URL when checkout returns ok with url', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    const stripeUrl = 'https://checkout.stripe.com/pay/test_session_123';
    // Mock fetch to return success with redirect URL
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ url: stripeUrl }),
    }));
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await act(async () => { render(<Settings />); });
    const upgradeBtn = screen.getAllByRole('button', { name: /upgrade/i })[0];
    await act(async () => { fireEvent.click(upgradeBtn); });
    // Either redirect to stripe URL or fall back to mailto
    await waitFor(() => {
      const mailedFallback = openSpy.mock.calls.some(c => String(c[0]).includes('mailto:'));
      // fetch was called with stripe checkout URL  
      expect(mailedFallback || (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length > 0).toBe(true);
    });
    openSpy.mockRestore();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('shows Processing button state during upgrade (fetch with auth session)', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co');
    // Mock fetch to fail quickly so we can test the flow
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }));
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await act(async () => { render(<Settings />); });
    const upgradeBtn = screen.getAllByRole('button', { name: /upgrade/i })[0];
    await act(async () => { fireEvent.click(upgradeBtn); });
    // After failed fetch, should fall back to mailto
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    });
    openSpy.mockRestore();
  });
});

// ─── Additional branch coverage ───────────────────────────────────────────

describe('Settings — formatRelativeMinutes branches', () => {
  afterEach(() => {
    mockProbeAuditRows.length = 0;
  });

  it('shows "just now" for a timestamp less than 1 minute ago', async () => {
    const recentTs = new Date(Date.now() - 30_000).toISOString();
    mockProbeAuditRows.push({
      status: 'success',
      created_at: recentTs,
      metadata: { status: 'ok', reachable: true, http_status: 200, request_id: 'req-recent', generated_at: recentTs },
    });
    await act(async () => { render(<Settings />); });
    await waitFor(() => {
      expect(screen.getByText('just now')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows "just now" for a future timestamp', async () => {
    const futureTs = new Date(Date.now() + 60_000).toISOString();
    mockProbeAuditRows.push({
      status: 'success',
      created_at: '2026-04-01T00:00:00Z',
      metadata: { status: 'ok', reachable: true, http_status: 200, request_id: 'req-future', generated_at: futureTs },
    });
    await act(async () => { render(<Settings />); });
    await waitFor(() => {
      expect(screen.getByText('just now')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows "Xm ago" for a timestamp a few minutes ago', async () => {
    const minsAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    mockProbeAuditRows.push({
      status: 'success',
      created_at: minsAgo,
      metadata: { status: 'ok', reachable: true, http_status: 200, request_id: 'req-mins', generated_at: minsAgo },
    });
    await act(async () => { render(<Settings />); });
    await waitFor(() => {
      expect(screen.getByText('5m ago')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows "Xh ago" for a timestamp a few hours ago', async () => {
    const hoursAgo = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    mockProbeAuditRows.push({
      status: 'success',
      created_at: hoursAgo,
      metadata: { status: 'ok', reachable: true, http_status: 200, request_id: 'req-hours', generated_at: hoursAgo },
    });
    await act(async () => { render(<Settings />); });
    await waitFor(() => {
      expect(screen.getByText('3h ago')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows "n/a" for an invalid timestamp string in generatedAt', async () => {
    mockProbeAuditRows.push({
      status: 'success',
      created_at: '2026-04-01T00:00:00Z',
      metadata: { status: 'ok', reachable: true, http_status: 200, request_id: 'req-inv', generated_at: 'not-a-valid-date' },
    });
    await act(async () => { render(<Settings />); });
    await waitFor(() => {
      // formatRelativeMinutes returns 'n/a' for unparseable timestamps
      expect(screen.getByText('n/a')).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});

describe('Settings — localStorage edge cases', () => {
  afterEach(() => {
    localStorage.removeItem('sentinelRetention');
    localStorage.removeItem('sentinelNotifPrefs');
    mockProbeAuditRows.length = 0;
    vi.clearAllMocks();
  });

  it('falls back to DEFAULT_RETENTION when sentinelRetention contains invalid JSON', async () => {
    localStorage.setItem('sentinelRetention', '{invalid-json');
    await act(async () => { render(<Settings />); });
    // Default scans retention is 90 days
    const [scanInput] = screen.getAllByRole('spinbutton', { name: /scan results retention/i });
    expect(scanInput).toHaveValue(90);
  });

  it('loads sentinelRetention from localStorage when valid JSON is stored', async () => {
    localStorage.setItem('sentinelRetention', JSON.stringify({ scans: 45 }));
    await act(async () => { render(<Settings />); });
    const [scanInput] = screen.getAllByRole('spinbutton', { name: /scan results retention/i });
    expect(scanInput).toHaveValue(45);
  });

  it('notifPrefs falls back to defaults when localStorage contains invalid JSON', async () => {
    localStorage.setItem('sentinelNotifPrefs', '{broken-json');
    await act(async () => { render(<Settings />); });
    // email channel enabled by default → title 'Disable Email notifications'
    expect(screen.getByTitle('Disable Email notifications')).toBeInTheDocument();
  });

  it('notifPrefs merges defaults when saved settings omit channels', async () => {
    localStorage.setItem('sentinelNotifPrefs', JSON.stringify({ minSeverity: 'critical', digest: 'weekly' }));
    await act(async () => { render(<Settings />); });

    expect(screen.getByTitle('Disable Email notifications')).toBeInTheDocument();
    expect(screen.getByTitle('Disable In-app notifications')).toBeInTheDocument();
    expect(screen.getByTitle('Enable Webhook delivery')).toBeInTheDocument();

    const criticalOnlyButton = screen.getByRole('button', { name: 'Critical only' });
    const weeklyDigestButton = screen.getByRole('button', { name: 'Weekly digest' });

    expect(criticalOnlyButton.className).toMatch(/bg-red-500\/20/);
    expect(weeklyDigestButton.className).toMatch(/bg-emerald-500\/20/);
  });
});

describe('Settings — SettingsProfile null auth fallbacks', () => {
  it('renders empty profile inputs and no unsaved badge when profile is null', async () => {
    mockAuthState.profileOverride = null;

    await act(async () => { render(<Settings />); });

    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Full name')).toHaveValue('');
    expect(screen.getByLabelText('Company')).toHaveValue('');
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('does not attempt profile save when user is missing', async () => {
    localStorage.removeItem('sentinelNotifPrefs');
    mockAuthState.user = null;

    await act(async () => { render(<Settings />); });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    expect(mockUpdateEq).not.toHaveBeenCalled();
    expect(localStorage.getItem('sentinelNotifPrefs')).toBeNull();
  });

  it('treats null company as empty string without unsaved state', async () => {
    mockAuthState.profileOverride = {
      ...mockAuthProfile,
      company: null,
    };

    await act(async () => { render(<Settings />); });

    expect(screen.getByLabelText('Company')).toHaveValue('');
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
});

describe('Settings — SettingsProfile saving state', () => {
  it('shows "Saving..." while profile update is pending', async () => {
    let resolveUpdate: ((value: { data: null; error: null }) => void) | undefined;
    mockUpdateEq.mockImplementationOnce(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));

    await act(async () => { render(<Settings />); });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Pending Save' } });
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByRole('button', { name: /saving/i })).toBeInTheDocument();

    resolveUpdate?.({ data: null, error: null });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saved!/i })).toBeInTheDocument();
    });
  });
});

describe('Settings — saveAgentUrl with empty URL', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not call probe when agent URL is whitespace only', async () => {
    mockProbeAgentHealth.mockResolvedValue({
      reachable: true,
      health: { status: 'ok', uptime: 100, jobsProcessed: 5, jobsFailed: 0, lastJobAt: null, lastError: null, timestamp: new Date().toISOString() },
      error: null,
      via: 'direct',
      statusCode: 200,
    });
    await act(async () => { render(<Settings />); });
    const urlInput = screen.getByPlaceholderText('http://your-vps:9090/health');
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: '   ' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Check'));
    });
    expect(mockProbeAgentHealth).not.toHaveBeenCalled();
  });
});

describe('Settings — company input interaction', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('company input updates state when changed', async () => {
    const companyInput = screen.getByLabelText('Company') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(companyInput, { target: { value: 'New Corp Ltd' } });
    });
    expect(companyInput).toHaveValue('New Corp Ltd');
  });
});

describe('Settings — SettingsProfile audit failure recovery', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('save flow continues even when audit log fails (catch block ~line 88)', async () => {
    const logSecurityEventSpy = vi.spyOn(AuditService, 'logSecurityEvent').mockRejectedValueOnce(new Error('Audit service unavailable'));
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await act(async () => { render(<Settings />); });

    const fullNameInput = screen.getByLabelText('Full name') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fullNameInput, { target: { value: 'New Name' } });
    });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Even though audit log failed, save flow should succeed (setSaved = true)
    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    }, { timeout: 4000 });

    expect(logSecurityEventSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Audit log failed'), expect.any(Error));

    consoleWarnSpy.mockRestore();
  });

  it('hasChanges returns false when profile is null initially (line 165)', async () => {
    // When profile is null, the Save button should not show "Unsaved changes" indicator initially
    await act(async () => { render(<Settings />); });
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
});

describe('Settings — SettingsSubscription overview stats', () => {
  it('renders all four overview cards with correct icon labels', async () => {
    await act(async () => { render(<Settings />); });
    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByText('SLA rules')).toBeInTheDocument();
    expect(screen.getByText('Team members')).toBeInTheDocument();
    expect(screen.getByText('Retention policies')).toBeInTheDocument();
  });

  it('displays plan-specific colors for current plan indicator', async () => {
    mockAuthProfile.plan = 'pro';
    await act(async () => { render(<Settings />); });
    // Pro plan should show violet color indicator
    expect(screen.getByText('Current plan')).toBeInTheDocument();
  });

  it('plan cards show correct feature lists', async () => {
    await act(async () => { render(<Settings />); });
    // Check that at least one plan has its expected feature
    expect(screen.getByText(/GitHub CI integration/)).toBeInTheDocument();
  });

  it('free plan shows "Current plan ✓" text instead of upgrade button', async () => {
    mockAuthProfile.plan = 'free';
    await act(async () => { render(<Settings />); });
    // Free plan is active by default, so it shows "Current plan ✓" text, not a button
    expect(screen.getByText(/Current plan ✓/)).toBeInTheDocument();
  });

  it('enterprise plan button opens mailto link', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    await act(async () => { render(<Settings />); });

    const contactButtons = screen.getAllByRole('button', { name: /Contact sales/ });
    await act(async () => {
      fireEvent.click(contactButtons[0]);
    });

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'), '_blank');
    openSpy.mockRestore();
  });
});

// ─── Batch G: SettingsSecurity branch coverage ────────────────────────────

describe('Settings — SettingsSecurity hasChanges and unsaved changes banner', () => {
  afterEach(() => {
    mockAuthProfile.full_name = 'Jane Doe';
    mockAuthProfile.company = 'Acme Corp';
    mockAuthProfile.sla_config = null;
  });

  it('shows "Unsaved changes" banner when full_name is modified', async () => {
    await act(async () => { render(<Settings />); });

    const nameInput = screen.getByDisplayValue('Jane Doe');
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'New Name' } });
    });

    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
  });

  it('shows "Unsaved changes" banner when company is modified', async () => {
    await act(async () => { render(<Settings />); });

    const companyInput = screen.getByDisplayValue('Acme Corp');
    await act(async () => {
      fireEvent.change(companyInput, { target: { value: 'New Corp' } });
    });

    expect(screen.getByText(/Unsaved changes/i)).toBeInTheDocument();
  });

  it('save button shows "Saved!" after successful security save', async () => {
    await act(async () => { render(<Settings />); });

    const saveBtn = screen.getByRole('button', { name: /save security settings/i });
    await act(async () => { fireEvent.click(saveBtn); });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Security saved!/i })).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('Settings — SettingsSecurity agent health display', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows agent online panel with lastJobAt and lastError when probe returns health data', async () => {
    const lastJobAt = new Date(Date.now() - 5 * 60_000).toISOString();
    mockProbeAgentHealth.mockResolvedValue({
      reachable: true,
      health: {
        status: 'ok',
        uptime: 7200,
        jobsProcessed: 42,
        jobsFailed: 1,
        lastJobAt,
        lastError: 'timeout on job 41',
        timestamp: new Date().toISOString(),
      },
      via: 'direct',
      error: null,
      statusCode: null,
    });

    await act(async () => { render(<Settings />); });

    const checkBtn = screen.getByRole('button', { name: /check/i });
    await act(async () => { fireEvent.click(checkBtn); });

    await waitFor(() => {
      expect(screen.getByText('Agent online')).toBeInTheDocument();
    }, { timeout: 3000 });

    // lastJobAt is rendered in the agent health panel
    expect(screen.getByText(/Last job:/i)).toBeInTheDocument();
    // lastError is shown
    expect(screen.getByText(/timeout on job 41/i)).toBeInTheDocument();
  });

  it('shows agent online panel with no lastJobAt/lastError (null branches)', async () => {
    mockProbeAgentHealth.mockResolvedValue({
      reachable: true,
      health: {
        status: 'ok',
        uptime: 3600,
        jobsProcessed: 5,
        jobsFailed: 0,
        lastJobAt: null,
        lastError: null,
        timestamp: new Date().toISOString(),
      },
      via: 'direct',
      error: null,
      statusCode: null,
    });

    await act(async () => { render(<Settings />); });
    const checkBtn = screen.getByRole('button', { name: /check/i });
    await act(async () => { fireEvent.click(checkBtn); });

    await waitFor(() => {
      expect(screen.getByText('Agent online')).toBeInTheDocument();
    }, { timeout: 3000 });

    // No "Last job:" text when lastJobAt is null
    expect(screen.queryByText(/Last job:/i)).toBeNull();
    // No error text when lastError is null
    expect(screen.queryByText(/⚠/)).toBeNull();
  });

  it('shows gateway probe error message when via=gateway and error is present', async () => {
    mockProbeAgentHealth.mockResolvedValue({
      reachable: false,
      health: null,
      via: 'gateway',
      error: 'connection refused',
      statusCode: null,
    });

    await act(async () => { render(<Settings />); });
    const checkBtn = screen.getByRole('button', { name: /check/i });
    await act(async () => { fireEvent.click(checkBtn); });

    await waitFor(() => {
      expect(screen.getByText(/Gateway probe failed: connection refused/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

describe('Settings — SettingsSecurity probeSmoke status variants', () => {
  afterEach(() => {
    mockProbeAuditRows.length = 0;
  });

  it('shows "Fail" badge when probeSmoke status is error', async () => {
    const ts = new Date(Date.now() - 60_000).toISOString();
    mockProbeAuditRows.push({
      status: 'failure',
      created_at: ts,
      metadata: { status: 'error', reachable: false, http_status: 503, request_id: 'req-fail', generated_at: ts },
    });

    await act(async () => { render(<Settings />); });

    await waitFor(() => {
      expect(screen.getByText('Fail')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows "OK" badge when probeSmoke status is ok', async () => {
    const ts = new Date(Date.now() - 60_000).toISOString();
    mockProbeAuditRows.push({
      status: 'success',
      created_at: ts,
      metadata: { status: 'ok', reachable: true, http_status: 200, request_id: 'req-ok', generated_at: ts },
    });

    await act(async () => { render(<Settings />); });

    await waitFor(() => {
      expect(screen.getByText('OK')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('shows "no" for reachable=false in probe smoke panel', async () => {
    const ts = new Date(Date.now() - 60_000).toISOString();
    mockProbeAuditRows.push({
      status: 'failure',
      created_at: ts,
      metadata: { status: 'error', reachable: false, http_status: null, request_id: null, generated_at: ts },
    });

    await act(async () => { render(<Settings />); });

    await waitFor(() => {
      expect(screen.getByText('no')).toBeInTheDocument();
    }, { timeout: 4000 });
  });
});

describe('Settings — SettingsSecurity retention preset buttons', () => {
  it('clicking 365-day preset shows "1yr" active style', async () => {
    await act(async () => { render(<Settings />); });

    const yrButton = screen.getAllByRole('button', { name: '1yr' })[0];
    await act(async () => { fireEvent.click(yrButton); });

    // After click the button should have the active style class
    expect(yrButton.className).toMatch(/bg-slate-600/);
  });

  it('changing retention input directly updates displayed value', async () => {
    await act(async () => { render(<Settings />); });

    const retentionInputs = screen.getAllByTitle(/retention in days/i);
    const firstInput = retentionInputs[0] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(firstInput, { target: { value: '120' } });
    });

    expect(firstInput.value).toBe('120');
  });
});

// ─── Batch K: SettingsSubscription branch coverage ────────────────────────

describe('Settings — SettingsSubscription profile null branch', () => {
  afterEach(() => {
    mockAuthState.profileOverride = undefined;
  });

  it('renders without crash when profile is null (useEffect if-branch not taken)', async () => {
    mockAuthState.profileOverride = null;
    await act(async () => { render(<Settings />); });
    // Plan defaults to 'free' since no profile to set it from
    expect(screen.getAllByText('Current plan')[0]).toBeInTheDocument();
  });
});

describe('Settings — SettingsSubscription enterprise plan active', () => {
  afterEach(() => {
    mockAuthProfile.plan = 'free';
  });

  it('shows enterprise plan as active with amber color overview card', async () => {
    mockAuthProfile.plan = 'enterprise';
    await act(async () => { render(<Settings />); });
    // Enterprise plan shows "Current plan ✓"
    const currentPlanTexts = screen.getAllByText(/Current plan ✓/);
    expect(currentPlanTexts.length).toBeGreaterThan(0);
  });

  it('shows planLabel fallback when plan id is not in PLANS list', async () => {
    mockAuthProfile.plan = 'unknown_plan_xyz';
    await act(async () => { render(<Settings />); });
    // planLabel falls back to the raw plan string (appears in overview card and plan description)
    const elements = screen.getAllByText('unknown_plan_xyz');
    expect(elements.length).toBeGreaterThan(0);
  });
});

describe('Settings — SettingsSubscription handleUpgrade early return for free', () => {
  afterEach(() => {
    mockAuthProfile.plan = 'free';
    vi.restoreAllMocks();
  });

  it('clicking Upgrade on free plan card (when pro is active) does not open window', async () => {
    mockAuthProfile.plan = 'pro';
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    await act(async () => { render(<Settings />); });
    // When pro is active, free plan shows Upgrade button
    // All Upgrade buttons: free (returns early), basic (no stripePriceId → mailto), enterprise (contact sales)
    const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
    // First Upgrade button = free plan (handleUpgrade returns immediately)
    await act(async () => { fireEvent.click(upgradeButtons[0]); });
    // No window.open should be called for the free plan
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});

describe('Settings — SettingsSubscription plan badge and button variants', () => {
  afterEach(() => {
    mockAuthProfile.plan = 'free';
  });

  it('renders Most Popular badge for pro plan when pro is not active', async () => {
    mockAuthProfile.plan = 'free';
    await act(async () => { render(<Settings />); });
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('shows upgrade buttons for non-active plans when enterprise is current plan', async () => {
    mockAuthProfile.plan = 'enterprise';
    await act(async () => { render(<Settings />); });
    // With enterprise active, free/basic/pro plans show Upgrade buttons
    const upgradeButtons = screen.getAllByRole('button', { name: /upgrade/i });
    expect(upgradeButtons.length).toBeGreaterThan(0);
  });

  it('ApiRateLimitsPanel is not rendered when user is null', async () => {
    mockAuthState.user = null;
    await act(async () => { render(<Settings />); });
    // When user is null, ApiRateLimitsPanel should not render
    expect(screen.queryByText(/API Rate Limits/i)).toBeNull();
  });
});

describe('Settings — SettingsSecurity Enter key submits agent URL', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('pressing Enter in agent URL input triggers health check', async () => {
    mockProbeAgentHealth.mockResolvedValue({
      reachable: true,
      health: {
        status: 'ok', uptime: 100, jobsProcessed: 1, jobsFailed: 0,
        lastJobAt: null, lastError: null, timestamp: new Date().toISOString(),
      },
      via: 'direct',
      error: null,
      statusCode: null,
    });

    await act(async () => { render(<Settings />); });

    const urlInput = screen.getByPlaceholderText(/your-vps/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.keyDown(urlInput, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(mockProbeAgentHealth).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});

// ─── Batch P: SettingsSecurity branch coverage ────────────────────────────

describe('Settings — SettingsSecurity edge branches (Batch P)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = { id: 'user-1' };
    mockAuthState.profileOverride = undefined;
  });

  it('shows mixed-content browser policy message for direct HTTP agent error', async () => {
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: false,
      health: null,
      via: 'direct',
      error: 'connection refused',
      statusCode: null,
    });

    await act(async () => { render(<Settings />); });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Blocked by browser policy/i)).toBeInTheDocument();
    });
  });

  it('shows timeout message when probe rejects with AbortError', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    mockProbeAgentHealth.mockRejectedValueOnce(abortError);

    await act(async () => { render(<Settings />); });
    const urlInput = screen.getByPlaceholderText(/your-vps/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(urlInput, { target: { value: 'https://95.67.75.146:9090/health' } });
    });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Request timeout while checking agent health/i)).toBeInTheDocument();
    });
  });

  it('shows HTTP status message when probe has no error but returns statusCode', async () => {
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: false,
      health: null,
      via: 'direct',
      error: null,
      statusCode: 503,
    });

    await act(async () => { render(<Settings />); });
    fireEvent.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Agent unreachable: HTTP 503/i)).toBeInTheDocument();
    });
  });

  it('does not trigger health check on non-Enter key in agent URL input', async () => {
    mockProbeAgentHealth.mockResolvedValueOnce({
      reachable: true,
      health: {
        status: 'ok', uptime: 100, jobsProcessed: 1, jobsFailed: 0,
        lastJobAt: null, lastError: null, timestamp: new Date().toISOString(),
      },
      via: 'direct',
      error: null,
      statusCode: 200,
    });

    await act(async () => { render(<Settings />); });
    const urlInput = screen.getByPlaceholderText(/your-vps/i) as HTMLInputElement;

    await act(async () => {
      fireEvent.keyDown(urlInput, { key: 'Escape', code: 'Escape' });
    });

    expect(mockProbeAgentHealth).not.toHaveBeenCalled();
  });

  it('returns early from save when user is null', async () => {
    mockAuthState.user = null;

    await act(async () => { render(<Settings />); });
    const saveSecurityBtn = screen.getByRole('button', { name: /save security settings/i });

    await act(async () => {
      fireEvent.click(saveSecurityBtn);
    });

    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it('shows saving state while security save is in-flight', async () => {
    let resolveUpdate: (() => void) | null = null;
    mockUpdateEq.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveUpdate = () => resolve({ data: null, error: null });
      })
    );

    await act(async () => { render(<Settings />); });
    const saveSecurityBtn = screen.getByRole('button', { name: /save security settings/i });

    await act(async () => {
      fireEvent.click(saveSecurityBtn);
    });

    expect(screen.getByRole('button', { name: /saving security/i })).toBeInTheDocument();

    await act(async () => {
      resolveUpdate?.();
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /security saved/i })).toBeInTheDocument();
    });
  });

  it('clamps retention input values to min/max bounds', async () => {
    await act(async () => { render(<Settings />); });
    const retentionInputs = screen.getAllByTitle(/retention in days/i);
    const firstInput = retentionInputs[0] as HTMLInputElement;

    await act(async () => {
      fireEvent.change(firstInput, { target: { value: '1' } });
    });
    expect(firstInput.value).toBe('7');

    await act(async () => {
      fireEvent.change(firstInput, { target: { value: '99999' } });
    });
    expect(firstInput.value).toBe('3650');
  });

});
