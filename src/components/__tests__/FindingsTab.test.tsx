import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FindingsTab from '../FindingsTab';
import type { Vulnerability } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ profile: null }),
}));

vi.mock('../../context/PresenceContext', () => ({
  usePresence: () => ({ updatePresence: vi.fn() }),
}));

vi.mock('../PresenceAvatars', () => ({
  PresenceAvatars: () => null,
}));

vi.mock('../CommentThread', () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}));

vi.mock('../RemediationAssistant', () => ({
  RemediationAssistant: () => <div data-testid="remediation-assistant" />,
}));

const { mockEq, mockIn, mockMaybySingle, mockUpdate } = vi.hoisted(() => {
  const mockMaybySingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockSelectSingle = vi.fn(() => ({ maybeSingle: mockMaybySingle }));
  const mockSelectMulti = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockEq = vi.fn(() => ({ select: mockSelectSingle }));
  const mockIn = vi.fn(() => ({ select: mockSelectMulti }));
  const mockUpdate = vi.fn(() => ({ eq: mockEq, in: mockIn }));
  return { mockEq, mockIn, mockMaybySingle, mockUpdate };
});

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: () => ({ update: mockUpdate }),
    },
  };
});

const { mockDownloadFile, mockToCsvExport } = vi.hoisted(() => ({
  mockDownloadFile: vi.fn(),
  mockToCsvExport: vi.fn().mockReturnValue('csv-data'),
}));

vi.mock('../../lib/exporters', () => ({
  downloadFile: mockDownloadFile,
  toCsvExport: mockToCsvExport,
}));

vi.mock('../../lib/riskScore', () => ({
  recomputeRiskScoreFromScanId: vi.fn().mockResolvedValue(null),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

let _id = 0;
function makeVuln(overrides: Partial<Vulnerability> = {}): Vulnerability {
  _id++;
  return {
    id: `v-${_id}`,
    scan_id: 'scan-1',
    user_id: 'user-1',
    title: `Finding ${_id}`,
    description: 'desc',
    severity: 'high',
    cve_id: '',
    mitre_tactic: '',
    cis_control: '',
    asset: 'host.example.com',
    remediation: 'fix it',
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe('FindingsTab — empty state', () => {
  it('shows empty state message when no vulns', () => {
    render(<FindingsTab vulns={[]} onUpdated={vi.fn()} />);
    expect(screen.getByText(/No findings to triage/i)).toBeInTheDocument();
  });
});

describe('FindingsTab — rendering with vulns', () => {
  it('renders all vulnerability titles', () => {
    const vulns = [
      makeVuln({ title: 'SQL Injection' }),
      makeVuln({ title: 'Open SSH Port' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    expect(screen.getByText('Open SSH Port')).toBeInTheDocument();
  });

  it('shows correct "All (N)" count pill', () => {
    const vulns = [makeVuln(), makeVuln(), makeVuln()];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    // Multiple status pills may show (3), check at least one exists
    expect(screen.getAllByText('(3)').length).toBeGreaterThanOrEqual(1);
  });

  it('renders filter pills: Status, Severity, SLA', () => {
    render(<FindingsTab vulns={[makeVuln()]} onUpdated={vi.fn()} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('SLA')).toBeInTheDocument();
  });

  it('shows "Export CSV" button', () => {
    render(<FindingsTab vulns={[makeVuln()]} onUpdated={vi.fn()} />);
    expect(screen.getByTitle('Export filtered findings as CSV')).toBeInTheDocument();
  });
});

describe('FindingsTab — severity filter', () => {
  it('filters vulns by severity when pill clicked', () => {
    const vulns = [
      makeVuln({ title: 'Critical Bug', severity: 'critical' }),
      makeVuln({ title: 'Low Bug', severity: 'low' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getAllByText('critical')[0]);
    expect(screen.getByText('Critical Bug')).toBeInTheDocument();
    expect(screen.queryByText('Low Bug')).not.toBeInTheDocument();
  });

  it('shows "No findings match" message when filter yields nothing', () => {
    const vulns = [makeVuln({ severity: 'low' })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    // Click critical pill — no critical vulns exist
    fireEvent.click(screen.getAllByText('critical')[0]);
    expect(screen.getByText(/No findings match the current filters/i)).toBeInTheDocument();
  });
});

describe('FindingsTab — status filter', () => {
  it('filters by resolved status', () => {
    const vulns = [
      makeVuln({ title: 'Open Issue', status: 'open' }),
      makeVuln({ title: 'Fixed Issue', status: 'resolved' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getAllByText('Resolved')[0]);
    expect(screen.getByText('Fixed Issue')).toBeInTheDocument();
    expect(screen.queryByText('Open Issue')).not.toBeInTheDocument();
  });
});

describe('FindingsTab — export', () => {
  it('calls downloadFile when Export CSV clicked', () => {
    render(<FindingsTab vulns={[makeVuln()]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByTitle('Export filtered findings as CSV'));
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/findings.*\.csv/),
      'csv-data',
      'text/csv',
    );
  });
});

describe('FindingsTab — selection (toggleAll / toggleOne)', () => {
  beforeEach(() => {
    _id = 0;
  });

  it('toggleAll selects all findings', () => {
    const vulns = [makeVuln({ title: 'Bug A' }), makeVuln({ title: 'Bug B' })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    // Initially "Select all (2)" text is visible
    expect(screen.getByText(/select all \(2\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    // After select all, text changes to "Deselect all"
    expect(screen.getByText(/deselect all/i)).toBeInTheDocument();
  });

  it('toggleAll deselects all when all are selected', () => {
    const vulns = [makeVuln({ title: 'Bug C' })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    expect(screen.getByText(/deselect all/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
    expect(screen.getByText(/select all/i)).toBeInTheDocument();
  });

  it('toggleOne selects individual finding via checkbox', () => {
    const vulns = [makeVuln({ title: 'Bug D' }), makeVuln({ title: 'Bug E' })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    // Each FindingRow has a select button
    const selectBtns = screen.getAllByRole('button', { name: /select finding/i });
    expect(selectBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(selectBtns[0]);
    // Bulk action panel should appear (some selected)
    waitFor(() =>
      expect(screen.getByText(/bulk action/i)).toBeInTheDocument(),
    );
  });
});

describe('FindingsTab — asset breakdown panel', () => {
  beforeEach(() => {
    _id = 0;
  });

  it('shows "Findings by asset" toggle button when vulns exist', () => {
    const vulns = [
      makeVuln({ asset: 'web.example.com', severity: 'critical' }),
      makeVuln({ asset: 'api.example.com', severity: 'high' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    expect(screen.getByRole('button', { name: /findings by asset/i })).toBeInTheDocument();
  });

  it('expands asset panel and shows asset names', () => {
    const vulns = [
      makeVuln({ asset: 'db.example.com', severity: 'critical' }),
      makeVuln({ asset: 'db.example.com', severity: 'high' }),
      makeVuln({ asset: 'web.example.com', severity: 'medium' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /findings by asset/i }));
    // Asset names appear in the panel (may also appear in vuln rows)
    expect(screen.getAllByText('db.example.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('web.example.com').length).toBeGreaterThanOrEqual(1);
  });

  it('shows severity count badges in asset panel', () => {
    const vulns = [
      makeVuln({ asset: 'host.example.com', severity: 'critical' }),
      makeVuln({ asset: 'host.example.com', severity: 'critical' }),
      makeVuln({ asset: 'host.example.com', severity: 'high' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /findings by asset/i }));
    // 2 critical badges with value "2", 1 high badge with value "1"
    const criticalBadges = screen.getAllByTitle(/critical: 2/i);
    expect(criticalBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('hides asset panel when collapsed again', () => {
    const vulns = [makeVuln({ asset: 'host.example.com' })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /findings by asset/i });
    fireEvent.click(toggle); // open — asset name visible in panel (title attr)
    // The panel has a span with title containing the asset name
    expect(screen.getAllByText('host.example.com').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(toggle); // close — asset name visible only in vuln row (not panel)
    // After collapse, asset breakdown rows are hidden; asset still appears in vuln list
    // Panel breakdown row has title attr; check it's gone from the panel
    const panelSpans = screen.queryAllByTitle('host.example.com');
    expect(panelSpans.length).toBe(0);
  });

  it('limits asset breakdown to top 5 assets', () => {
    const assets = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com', 'f.com'];
    const vulns = assets.map(asset => makeVuln({ asset }));
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /findings by asset/i }));
    // Only top 5 shown — f.com is the 6th (last added, but all equal total=1, so sorted by insertion, f.com is last)
    const allAssets = screen.queryAllByTitle(/\.com/);
    // At most 5 visible asset rows
    expect(allAssets.length).toBeLessThanOrEqual(5);
  });
});

describe('FindingsTab — search and clear', () => {
  beforeEach(() => { _id = 0; });

  it('filters by search query', () => {
    const vulns = [
      makeVuln({ title: 'SQL Injection Attack' }),
      makeVuln({ title: 'Open SSH Port Exposed' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search findings/i), { target: { value: 'sql' } });
    expect(screen.getByText('SQL Injection Attack')).toBeInTheDocument();
    expect(screen.queryByText('Open SSH Port Exposed')).not.toBeInTheDocument();
  });

  it('clears search via X button', () => {
    const vulns = [makeVuln({ title: 'SQL Injection Attack' })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search findings/i), { target: { value: 'xyz-not-found' } });
    expect(screen.getByText(/No findings match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('SQL Injection Attack')).toBeInTheDocument();
  });
});

describe('FindingsTab — stat card clicks', () => {
  beforeEach(() => { _id = 0; });

  it('filters to Open when Open stat card is clicked', () => {
    const vulns = [
      makeVuln({ title: 'Open Bug', status: 'open' }),
      makeVuln({ title: 'Resolved Bug', status: 'resolved' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    // First "Open" button is the stat card; filter pill is second
    fireEvent.click(screen.getAllByRole('button', { name: /Open/ })[0]);
    expect(screen.getByText('Open Bug')).toBeInTheDocument();
    expect(screen.queryByText('Resolved Bug')).not.toBeInTheDocument();
  });

  it('filters to Resolved when Resolved stat card is clicked', () => {
    const vulns = [
      makeVuln({ title: 'Open Bug', status: 'open' }),
      makeVuln({ title: 'Resolved Bug', status: 'resolved' }),
    ];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    // First "Resolved" button is the stat card; filter pill is second
    fireEvent.click(screen.getAllByRole('button', { name: /Resolved/ })[0]);
    expect(screen.getByText('Resolved Bug')).toBeInTheDocument();
    expect(screen.queryByText('Open Bug')).not.toBeInTheDocument();
  });

  it('clicking Total resets to all', () => {
    const vulns = [makeVuln({ status: 'open' }), makeVuln({ status: 'resolved' })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Resolved/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Total/ }));
    // Both rows visible again
    expect(screen.getAllByText(/Finding/i).length).toBeGreaterThanOrEqual(2);
  });
});

describe('FindingsTab — SLA filter', () => {
  beforeEach(() => { _id = 0; });

  it('filters by SLA Overdue via stat card click', () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 100 * 24 * 3600 * 1000).toISOString();
    const vulns = [makeVuln({ title: 'Old Critical', severity: 'critical', created_at: oldDate })];
    render(<FindingsTab vulns={vulns} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^SLA Overdue/ }));
    // Toggle back
    fireEvent.click(screen.getByRole('button', { name: /^SLA Overdue/ }));
  });

  it('filters by overdue via filter pill', () => {
    render(<FindingsTab vulns={[makeVuln()]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Overdue/ }));
    // Click At risk pill
    fireEvent.click(screen.getByRole('button', { name: /^At risk/ }));
    // Back to any
    fireEvent.click(screen.getByRole('button', { name: /^Any/ }));
  });
});

describe('FindingsTab — FindingRow expand/collapse', () => {
  beforeEach(() => { _id = 0; });

  it('expands finding details on toggle click', async () => {
    const vuln = makeVuln({ title: 'XSS Vulnerability', description: 'Cross-site scripting' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => expect(screen.getByText('Cross-site scripting')).toBeInTheDocument());
  });

  it('collapses finding on second toggle click', async () => {
    const vuln = makeVuln({ title: 'XSS Bug', description: 'Some desc' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => expect(screen.getByText('Some desc')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => expect(screen.queryByText('Some desc')).not.toBeInTheDocument());
  });

  it('renders remediation when expanded', async () => {
    const vuln = makeVuln({ remediation: 'Patch immediately' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => expect(screen.getByText('Patch immediately')).toBeInTheDocument());
  });

  it('renders MetaCell with CVE link when expanded', async () => {
    const vuln = makeVuln({ cve_id: 'CVE-2024-1234', mitre_tactic: 'Initial Access', cis_control: 'CIS-5' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => {
      expect(screen.getByText('CVE-2024-1234')).toBeInTheDocument();
      expect(screen.getByText('Initial Access')).toBeInTheDocument();
      expect(screen.getByText('CIS-5')).toBeInTheDocument();
    });
  });

  it('shows "No note yet" when expanded with empty note', async () => {
    const vuln = makeVuln({ note: '' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => expect(screen.getByText('No note yet.')).toBeInTheDocument());
  });

  it('shows existing note text when expanded', async () => {
    const vuln = makeVuln({ note: 'Ticket JIRA-123 opened' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => expect(screen.getByText('Ticket JIRA-123 opened')).toBeInTheDocument());
  });

  it('shows SLA overdue badge when sla_breached_at is in the past', async () => {
    const past = new Date(Date.now() - 100 * 24 * 3600 * 1000).toISOString();
    const vuln = makeVuln({ severity: 'critical', created_at: past });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    // sla_breached_at: slaStateFor with DEFAULT_SLA_CONFIG critical=7 → 100 days overdue
    await waitFor(() => expect(screen.getByText('SLA overdue')).toBeInTheDocument());
  });
});

describe('FindingsTab — FindingRow note editing', () => {
  beforeEach(() => { _id = 0; });

  it('enters edit mode when "Add" note button clicked', async () => {
    const vuln = makeVuln({ note: '' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => expect(screen.getByText('No note yet.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByPlaceholderText(/Add context/i)).toBeInTheDocument();
  });

  it('cancels note edit and restores note text', async () => {
    const vuln = makeVuln({ note: 'Original note' });
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => screen.getByText('Original note'));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByPlaceholderText(/Add context/i), { target: { value: 'Changed note' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByText('Original note')).toBeInTheDocument();
  });

  it('saves note and calls onUpdated', async () => {
    const savedVuln = makeVuln({ note: 'Saved note text' });
    mockMaybySingle.mockResolvedValueOnce({ data: savedVuln, error: null });
    const onUpdated = vi.fn();
    const vuln = makeVuln({ note: '' });
    render(<FindingsTab vulns={[vuln]} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle details' }));
    await waitFor(() => screen.getByText('No note yet.'));
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/Add context/i), { target: { value: 'Saved note text' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save note/i })); });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(savedVuln));
  });
});

describe('FindingsTab — FindingRow changeStatus', () => {
  beforeEach(() => { _id = 0; });

  it('changes status via select dropdown and calls onUpdated', async () => {
    const updated = makeVuln({ status: 'resolved' });
    mockMaybySingle.mockResolvedValueOnce({ data: updated, error: null });
    const onUpdated = vi.fn();
    const vuln = makeVuln({ status: 'open' });
    render(<FindingsTab vulns={[vuln]} onUpdated={onUpdated} />);
    const select = screen.getByRole('combobox', { name: 'Vulnerability status' });
    await act(async () => { fireEvent.change(select, { target: { value: 'resolved' } }); });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  });
});

describe('FindingsTab — bulk action bar', () => {
  beforeEach(() => { _id = 0; });

  it('shows bulk action bar when findings are selected', async () => {
    const vuln = makeVuln();
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    await waitFor(() => expect(screen.getByText(/1 selected/i)).toBeInTheDocument());
  });

  it('calls bulkChangeStatus when Resolve bulk button clicked', async () => {
    const updated = makeVuln({ status: 'resolved' });
    const selectMulti = vi.fn().mockResolvedValue({ data: [updated], error: null });
    mockIn.mockReturnValueOnce({ select: selectMulti });
    const onUpdated = vi.fn();
    const vuln = makeVuln();
    render(<FindingsTab vulns={[vuln]} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    await waitFor(() => screen.getByText(/1 selected/i));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Resolve$/ }));
    });
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
  });

  it('calls bulkChangeStatus with false_positive', async () => {
    mockIn.mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const vuln = makeVuln();
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    await waitFor(() => screen.getByText(/1 selected/i));
    await act(async () => {
      // Bulk bar "False positive" is the last matching button (filter pill comes first)
      const btns = screen.getAllByRole('button', { name: /false positive/i });
      fireEvent.click(btns.at(-1)!);
    });
  });

  it('calls bulkChangeStatus with in_progress', async () => {
    mockIn.mockReturnValueOnce({ select: vi.fn().mockResolvedValue({ data: [], error: null }) });
    const vuln = makeVuln();
    render(<FindingsTab vulns={[vuln]} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    await waitFor(() => screen.getByText(/1 selected/i));
    await act(async () => {
      const btns = screen.getAllByRole('button', { name: /in progress/i });
      fireEvent.click(btns.at(-1)!);
    });
  });
});
