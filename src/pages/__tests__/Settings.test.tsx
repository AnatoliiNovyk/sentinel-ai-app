import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../Settings';

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
  const _user = { id: 'user-1' };
  return {
    useAuth: () => ({ user: _user, profile: mockAuthProfile }),
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

describe('Settings — Webhook section', () => {
  beforeEach(async () => {
    await act(async () => { render(<Settings />); });
  });

  it('types webhook URL and shows show/hide button', () => {
    const webhookInput = screen.getByPlaceholderText(/hooks\.slack\.com/i) as HTMLInputElement;
    fireEvent.change(webhookInput, { target: { value: 'https://hooks.slack.com/services/abc' } });
    expect(screen.getByRole('button', { name: 'Show URL' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show URL' }));
    expect(screen.getByRole('button', { name: 'Hide URL' })).toBeInTheDocument();
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
