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

describe('RemediationAssistant — expanded suggestion content', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    mockClearRemediationCache.mockReturnValue(undefined);
  });

  async function renderWithSuggestion(overrides: Parameters<typeof makeSuggestion>[0] = {}) {
    const suggestion = makeSuggestion(overrides);
    mockGenerateRemediation.mockResolvedValue(suggestion);
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });
    await waitFor(() => screen.getByText('AI Remediation Plan'));
    return suggestion;
  }

  it('shows "Remediation Steps" label in expanded view', async () => {
    await renderWithSuggestion();
    expect(screen.getByText('Remediation Steps')).toBeInTheDocument();
  });

  it('shows step title in expanded view', async () => {
    await renderWithSuggestion();
    expect(screen.getByText('Replace raw queries')).toBeInTheDocument();
  });

  it('shows references link', async () => {
    await renderWithSuggestion();
    expect(screen.getByText('OWASP SQL Injection')).toBeInTheDocument();
  });

  it('shows "Regenerate" button', async () => {
    await renderWithSuggestion();
    expect(screen.getByTitle(/Regenerate AI remediation plan/i)).toBeInTheDocument();
  });

  it('shows estimated time', async () => {
    await renderWithSuggestion({ estimated_time: '2 hours' });
    expect(screen.getByText('2 hours')).toBeInTheDocument();
  });

  it('shows "1 step" (singular) badge', async () => {
    await renderWithSuggestion({ steps: [makeSuggestion().steps[0]] });
    expect(screen.getByText('1 step')).toBeInTheDocument();
  });

  it('shows "N steps" (plural) badge for multiple steps', async () => {
    const steps = [
      { order: 1, title: 'Step A', description: 'desc A' },
      { order: 2, title: 'Step B', description: 'desc B' },
    ];
    await renderWithSuggestion({ steps });
    expect(screen.getByText('2 steps')).toBeInTheDocument();
  });

  it('shows effort "moderate" icon and label', async () => {
    await renderWithSuggestion({ effort: 'moderate' });
    expect(screen.getByText(/Moderate/)).toBeInTheDocument();
  });

  it('shows effort "quick-win" label', async () => {
    await renderWithSuggestion({ effort: 'quick-win' });
    expect(screen.getByText(/Quick win/)).toBeInTheDocument();
  });

  it('shows effort "complex" label', async () => {
    await renderWithSuggestion({ effort: 'complex' });
    expect(screen.getByText(/Complex/)).toBeInTheDocument();
  });

  it('shows priority "high" badge', async () => {
    await renderWithSuggestion({ priority: 'high' });
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows priority "medium" badge', async () => {
    await renderWithSuggestion({ priority: 'medium' });
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('shows priority "low" badge', async () => {
    await renderWithSuggestion({ priority: 'low' });
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders code block with Copy button when step has command', async () => {
    await renderWithSuggestion();
    // step has command: 'npm install knex'
    expect(screen.getByText('npm install knex')).toBeInTheDocument();
    expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
  });

  it('renders step note when step.note is present', async () => {
    const steps = [{ ...makeSuggestion().steps[0], note: 'Run as sudo' }];
    await renderWithSuggestion({ steps });
    expect(screen.getByText('Run as sudo')).toBeInTheDocument();
  });

  it('renders language label "bash" in code block', async () => {
    await renderWithSuggestion();
    expect(screen.getByText('bash')).toBeInTheDocument();
  });

  it('shows "Copy all" button when steps have commands', async () => {
    await renderWithSuggestion();
    expect(screen.getByTitle('Copy all commands')).toBeInTheDocument();
  });

  it('does not show "Copy all" when no step has a command', async () => {
    const steps = [{ order: 1, title: 'Manual step', description: 'No code required' }];
    await renderWithSuggestion({ steps });
    expect(screen.queryByTitle('Copy all commands')).not.toBeInTheDocument();
  });

  it('shows generated timestamp in footer', async () => {
    await renderWithSuggestion();
    expect(screen.getByText(/Generated /)).toBeInTheDocument();
  });
});

describe('RemediationAssistant — expand/collapse toggle', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    mockClearRemediationCache.mockReturnValue(undefined);
  });

  it('collapses expanded suggestion when header is clicked', async () => {
    mockGenerateRemediation.mockResolvedValue(makeSuggestion());
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });
    await waitFor(() => screen.getByText('Remediation Steps'));

    // Click header to collapse
    fireEvent.click(screen.getByTitle('Collapse remediation plan'));
    await waitFor(() =>
      expect(screen.queryByText('Remediation Steps')).not.toBeInTheDocument(),
    );
    expect(screen.getByTitle('Expand remediation plan')).toBeInTheDocument();
  });

  it('expands collapsed suggestion when header is clicked again', async () => {
    const saved = makeSuggestion({ summary: 'Saved suggestion' });
    mockGetSavedRemediation.mockResolvedValue(saved);
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByText('Saved suggestion'));
    // Initially collapsed (expanded=false by default when loaded from cache)
    const expandBtn = screen.getByTitle('Expand remediation plan');
    fireEvent.click(expandBtn);
    await waitFor(() => screen.getByText('Remediation Steps'));
  });
});

describe('RemediationAssistant — StepCard collapse', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    mockClearRemediationCache.mockReturnValue(undefined);
  });

  it('collapses a step when its header is clicked', async () => {
    mockGenerateRemediation.mockResolvedValue(makeSuggestion());
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });
    await waitFor(() => screen.getByText('Replace raw queries'));

    // Step description is visible
    expect(screen.getByText('Use prepared statements in your ORM.')).toBeInTheDocument();
    // Click step header to collapse
    fireEvent.click(screen.getByTitle('Collapse step'));
    await waitFor(() =>
      expect(screen.queryByText('Use prepared statements in your ORM.')).not.toBeInTheDocument(),
    );
  });
});

describe('RemediationAssistant — Regenerate', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    mockClearRemediationCache.mockReturnValue(undefined);
  });

  it('clicking Regenerate calls clearRemediationCache and generateRemediation again', async () => {
    mockGenerateRemediation.mockClear();
    mockGenerateRemediation.mockResolvedValue(makeSuggestion());
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });
    await waitFor(() => screen.getByTitle(/Regenerate AI remediation plan/i));

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Regenerate AI remediation plan/i));
    });

    expect(mockClearRemediationCache).toHaveBeenCalledWith('vuln-1');
    expect(mockGenerateRemediation).toHaveBeenCalledTimes(2);
  });
});

describe('RemediationAssistant — clipboard copy', () => {
  beforeEach(() => {
    mockGetSavedRemediation.mockResolvedValue(null);
    mockClearRemediationCache.mockReturnValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  async function openExpanded() {
    mockGenerateRemediation.mockResolvedValue(makeSuggestion());
    render(<RemediationAssistant vuln={makeVuln()} />);
    await waitFor(() => screen.getByRole('button', { name: /Generate Fix/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Generate Fix/i }));
    });
    await waitFor(() => screen.getByText('Remediation Steps'));
  }

  it('clicking Copy button in code block calls clipboard.writeText', async () => {
    await openExpanded();
    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy to clipboard'));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('npm install knex');
  });

  it('clicking Copy all calls clipboard.writeText with all commands', async () => {
    await openExpanded();
    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy all commands'));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    const callArg = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(callArg).toContain('npm install knex');
  });
});
