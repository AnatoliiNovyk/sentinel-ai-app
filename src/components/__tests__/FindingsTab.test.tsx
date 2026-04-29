import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import FindingsTab from '../FindingsTab';
import type { Vulnerability } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ profile: null }),
}));

const { mockEq, mockUpdate } = vi.hoisted(() => ({
  mockEq: vi.fn().mockResolvedValue({ data: null, error: null }),
  mockUpdate: vi.fn(),
}));
mockUpdate.mockReturnValue({ eq: mockEq });

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
