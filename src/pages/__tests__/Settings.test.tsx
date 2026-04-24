import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../Settings';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockUpdateEq } = vi.hoisted(() => ({
  mockUpdateEq: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: () => ({
        update: () => ({ eq: mockUpdateEq }),
      }),
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Settings — layout', () => {
  it('renders "Settings" heading', () => {
    render(<Settings />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders "Profile" section heading', () => {
    render(<Settings />);
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('renders "Subscription" section heading', () => {
    render(<Settings />);
    expect(screen.getByText('Subscription')).toBeInTheDocument();
  });

  it('renders "Remediation SLA" section heading', () => {
    render(<Settings />);
    expect(screen.getByText('Remediation SLA')).toBeInTheDocument();
  });

  it('renders "Team Members" section heading', () => {
    render(<Settings />);
    expect(screen.getByText('Team Members')).toBeInTheDocument();
  });

  it('renders "Webhook Integrations" section heading', () => {
    render(<Settings />);
    expect(screen.getByText('Webhook Integrations')).toBeInTheDocument();
  });
});

describe('Settings — Profile section', () => {
  it('email input is disabled and pre-filled from profile', () => {
    render(<Settings />);
    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    expect(emailInput).toBeDisabled();
    expect(emailInput.value).toBe('test@example.com');
  });

  it('full name input is pre-filled from profile', () => {
    render(<Settings />);
    const fullNameInput = screen.getByLabelText('Full name') as HTMLInputElement;
    expect(fullNameInput.value).toBe('Jane Doe');
  });

  it('company input is pre-filled from profile', () => {
    render(<Settings />);
    const companyInput = screen.getByLabelText('Company') as HTMLInputElement;
    expect(companyInput.value).toBe('Acme Corp');
  });

  it('full name input updates on change', () => {
    render(<Settings />);
    const input = screen.getByLabelText('Full name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'John Smith' } });
    expect(input.value).toBe('John Smith');
  });
});

describe('Settings — Plans', () => {
  it('renders all four plan names', () => {
    render(<Settings />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('shows "Current plan ✓" for active plan (free)', () => {
    render(<Settings />);
    expect(screen.getByText('Current plan ✓')).toBeInTheDocument();
  });

  it('shows "Most Popular" badge on Pro plan', () => {
    render(<Settings />);
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });
});

describe('Settings — SLA section', () => {
  it('renders SLA input for Critical with value from DEFAULT_SLA_CONFIG', () => {
    render(<Settings />);
    const criticalInput = screen.getByLabelText('Critical') as HTMLInputElement;
    expect(criticalInput).toBeInTheDocument();
    expect(Number(criticalInput.value)).toBeGreaterThan(0);
  });

  it('renders SLA inputs for all four severities', () => {
    render(<Settings />);
    expect(screen.getByLabelText('Critical')).toBeInTheDocument();
    expect(screen.getByLabelText('High')).toBeInTheDocument();
    expect(screen.getByLabelText('Medium')).toBeInTheDocument();
    expect(screen.getByLabelText('Low')).toBeInTheDocument();
  });
});

describe('Settings — Team Members', () => {
  it('renders owner email in team list', () => {
    render(<Settings />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders "Owner" role badge', () => {
    render(<Settings />);
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('adds a new team member when Invite button clicked', () => {
    render(<Settings />);
    const emailInput = screen.getByPlaceholderText('colleague@company.com') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'colleague@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    expect(screen.getByText('colleague@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });
});

describe('Settings — Save', () => {
  beforeEach(() => {
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('renders "Save changes" button', () => {
    render(<Settings />);
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('calls supabase update when Save clicked', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-1'));
  });

  it('shows "Saved!" after successful save', async () => {
    render(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(
      () => expect(screen.getByRole('button', { name: /saved!/i })).toBeInTheDocument(),
      { timeout: 3000 },
    );
  });
});
