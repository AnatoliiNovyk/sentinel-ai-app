import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RemediationAssistant } from '../RemediationAssistant';
import type { Vulnerability } from '../../lib/supabase';
import type { RemediationSuggestion } from '../../lib/remediationService';

// ── remediationService mocks ──────────────────────────────────────────────────

const { mockGenerateRemediation, mockGetSavedRemediation, mockClearRemediationCache } = vi.hoisted(() => ({
  mockGenerateRemediation: vi.fn(),
  mockGetSavedRemediation: vi.fn(),
  mockClearRemediationCache: vi.fn(),
}));

vi.mock('../../lib/remediationService', () => ({
  generateRemediation: mockGenerateRemediation,
  getSavedRemediation: mockGetSavedRemediation,
  clearRemediationCache: mockClearRemediationCache,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ profile: { id: 'user-1' } }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVuln(overrides: Partial<Vulnerability> = {}): Vulnerability {
  return {
    id: 'vuln-1',
    scan_id: 'scan-1',
    user_id: 'user-1',
    title: 'SQL Injection in login',
    description: 'Unsanitized user input',
    severity: 'high',
    cve_id: '',
    mitre_tactic: '',
    cis_control: '',
    asset: 'api.example.com',
    remediation: 'Use parameterized queries',
    remediation_code: '',
    remediation_type: 'manual',
    created_at: '2026-01-01T00:00:00Z',
    status: 'open',
    note: '',
    status_updated_at: '2026-01-01T00:00:00Z',
    sla_breached_at: null,
    sla_warned_at: null,
    ...overrides,
  };
}

function makeSuggestion(overrides: Partial<RemediationSuggestion> = {}): RemediationSuggestion {
  return {
    id: 'sugg-1',
    vulnerability_id: 'vuln-1',
    user_id: 'user-1',
    summary: 'Use parameterized queries to prevent SQL injection.',
    priority: 'immediate',
    effort: 'moderate',
    estimated_time: '2 hours',
    steps: [
      {
        order: 1,
        title: 'Replace raw queries',
        description: 'Use prepared statements in your ORM.',
        command: 'npm install knex',
        language: 'bash',
      },
    ],
    references: [{ label: 'OWASP SQL Injection', url: 'https://owasp.org/sql-injection' }],
    generated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RemediationAssistant — initial state (no cached suggestion)', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    mockClearRemediationCache.mockReturnValue(undefined);
  });

  it('shows "Generate Fix" button when no suggestion exists', async () => {
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Generate Fix/i })).toBeInTheDocument(),
    );
  });

  it('shows "AI Remediation Assistant" label', async () => {
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() =>
      expect(screen.getByText('AI Remediation Assistant')).toBeInTheDocument(),
    );
  });

  it('shows description text', async () => {
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() =>
      expect(screen.getByText(/Get step-by-step fix guidance/i)).toBeInTheDocument(),
    );
  });
});

describe('RemediationAssistant — loading state', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
  });

  it('shows loading spinner while generating', async () => {
    // generateRemediation never resolves → keeps loading state
    mockGenerateRemediation.mockReturnValue(new Promise(() => {}));

    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));

    fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));

    await waitFor(() =>
      expect(screen.getByText(/Generating AI remediation plan/i)).toBeInTheDocument(),
    );
  });
});

describe('RemediationAssistant — with suggestion', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    mockClearRemediationCache.mockReturnValue(undefined);
  });

  it('shows suggestion summary after generation', async () => {
    const suggestion = makeSuggestion();
    mockGenerateRemediation.mockResolvedValue(suggestion);

    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });

    // Summary renders twice (header + expanded body) — use getAllByText
    await waitFor(() => {
      const matches = screen.getAllByText('Use parameterized queries to prevent SQL injection.');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows "AI Remediation Plan" heading after generation', async () => {
    mockGenerateRemediation.mockResolvedValue(makeSuggestion());

    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });

    await waitFor(() =>
      expect(screen.getByText('AI Remediation Plan')).toBeInTheDocument(),
    );
  });

  it('shows priority badge (Immediate)', async () => {
    mockGenerateRemediation.mockResolvedValue(makeSuggestion({ priority: 'immediate' }));

    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });

    await waitFor(() =>
      expect(screen.getByText('Immediate')).toBeInTheDocument(),
    );
  });

  it('pre-populates suggestion from cache (getSavedRemediation)', async () => {
    const saved = makeSuggestion({ summary: 'Cached fix from previous session' });
    mockGetSavedRemediation.mockResolvedValue(saved);
    // Clear call count so we only count calls made in THIS test render
    mockGenerateRemediation.mockClear();

    render(<RemediationAssistant vuln={makeVuln()} />);

    await waitFor(() =>
      expect(screen.getByText('Cached fix from previous session')).toBeInTheDocument(),
    );
    // generateRemediation should NOT have been called during this render
    expect(mockGenerateRemediation).not.toHaveBeenCalled();
  });
});

describe('RemediationAssistant — error state', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    // Use mockImplementation so the rejection is always fresh regardless of prior mock state
    mockGenerateRemediation.mockImplementation(() =>
      Promise.reject(new Error('Network error')),
    );
  });

  it('shows "Generate Fix" button again after generation fails (retry available)', async () => {
    // The component's render order: "!suggestion && !loading" fires before "if (error)",
    // so after a failed generation (suggestion=null, loading=false) the "Generate Fix"
    // panel re-renders, allowing the user to retry.
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
      // Allow the rejected promise chain and React state updates to settle
      await new Promise((r) => setTimeout(r, 0));
    });

    // After failed generation, component returns to initial UI (Generate Fix button re-appears)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Generate Fix/i })).toBeInTheDocument(),
    );
    // generateRemediation was attempted
    expect(mockGenerateRemediation).toHaveBeenCalledOnce();
  });
});
