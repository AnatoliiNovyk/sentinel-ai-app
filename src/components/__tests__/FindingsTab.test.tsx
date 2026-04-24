import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi } from 'vitest';
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
