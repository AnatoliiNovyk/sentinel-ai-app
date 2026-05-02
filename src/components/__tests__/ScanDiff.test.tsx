import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScanDiff from '../ScanDiff';
import type { Scan, Vulnerability } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockDownloadFile = vi.fn();
vi.mock('../../lib/exporters', () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeScan(id: string, createdAt: string, status: Scan['status'] = 'completed'): Scan {
  return {
    id,
    project_id: 'proj-1',
    user_id: 'user-1',
    scanner: 'nmap',
    status,
    is_mock: false,
    severity_summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    started_at: createdAt,
    completed_at: createdAt,
    created_at: createdAt,
  };
}

function makeVuln(
  id: string,
  scanId: string,
  title: string,
  asset: string,
  severity: Vulnerability['severity'] = 'high',
): Vulnerability {
  return {
    id,
    scan_id: scanId,
    user_id: 'user-1',
    title,
    description: 'desc',
    severity,
    cve_id: '',
    mitre_tactic: '',
    cis_control: '',
    asset,
    remediation: 'fix it',
    remediation_code: '',
    remediation_type: '',
    created_at: '2026-01-01T00:00:00Z',
    status: 'open',
    note: '',
    status_updated_at: '2026-01-01T00:00:00Z',
    sla_breached_at: null,
    sla_warned_at: null,
  };
}

const SCAN_NEW = makeScan('scan-new', '2026-04-24T10:00:00Z');
const SCAN_OLD = makeScan('scan-old', '2026-04-23T10:00:00Z');

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ScanDiff', () => {
  describe('empty / insufficient data', () => {
    it('shows "No diff available yet" when no scans provided', () => {
      render(<ScanDiff scans={[]} vulns={[]} />);
      expect(screen.getByText('No diff available yet')).toBeInTheDocument();
    });

    it('shows empty state when only one completed scan', () => {
      render(<ScanDiff scans={[SCAN_NEW]} vulns={[]} />);
      expect(screen.getByText('No diff available yet')).toBeInTheDocument();
    });

    it('ignores non-completed scans for diff calculation', () => {
      const runningScan = makeScan('scan-run', '2026-04-24T09:00:00Z', 'running');
      render(<ScanDiff scans={[SCAN_NEW, runningScan]} vulns={[]} />);
      expect(screen.getByText('No diff available yet')).toBeInTheDocument();
    });
  });

  describe('diff classification', () => {
    it('classifies NEW findings (in latest, not in previous)', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'SQL Injection', 'api.example.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      expect(screen.getByText('new')).toBeInTheDocument();
    });

    it('classifies FIXED findings (in previous, not in latest)', () => {
      const vulns = [
        makeVuln('v2', 'scan-old', 'Open SSH Port', 'bastion.example.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      expect(screen.getByText('fixed')).toBeInTheDocument();
    });

    it('classifies PERSISTED findings (in both scans)', () => {
      const vulns = [
        makeVuln('v3', 'scan-new', 'XSS Vulnerability', 'web.example.com'),
        makeVuln('v4', 'scan-old', 'XSS Vulnerability', 'web.example.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      expect(screen.getByText('persisted')).toBeInTheDocument();
    });

    it('shows correct counts in summary pills', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'New Bug', 'host1.com'),       // new
        makeVuln('v2', 'scan-old', 'Old Bug', 'host2.com'),        // fixed
        makeVuln('v3', 'scan-new', 'Both Bug', 'host3.com'),       // persisted
        makeVuln('v4', 'scan-old', 'Both Bug', 'host3.com'),       // persisted
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      // Count and label are rendered in separate <div>s within each stat button;
      // match the button whose accessible text content is "<count> <label>"
      expect(screen.getByRole('button', { name: /^1\s+New$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^1\s+Fixed$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^1\s+Persisted$/i })).toBeInTheDocument();
    });
  });

  describe('trend indicator', () => {
    it('shows "+N new risks" when new > fixed', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'Bug A', 'host1.com'),
        makeVuln('v2', 'scan-new', 'Bug B', 'host2.com'),
        // nothing fixed
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      expect(screen.getByText('+2 new risks')).toBeInTheDocument();
    });

    it('shows "N fewer risks" when fixed > new', () => {
      const vulns = [
        makeVuln('v1', 'scan-old', 'Bug A', 'host1.com'),
        makeVuln('v2', 'scan-old', 'Bug B', 'host2.com'),
        // nothing new
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      expect(screen.getByText('2 fewer risks')).toBeInTheDocument();
    });

    it('shows "No change" when new === fixed', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'New Bug', 'host1.com'),
        makeVuln('v2', 'scan-old', 'Fixed Bug', 'host2.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      expect(screen.getByText('No change')).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('displays the "Scan Diff" heading', () => {
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={[]} />);
      expect(screen.getByText('Scan Diff')).toBeInTheDocument();
    });

    it('shows severity badge for listed findings', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'Critical RCE', 'prod.example.com', 'critical'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      expect(screen.getByText('critical')).toBeInTheDocument();
    });

    it('Export CSV button calls downloadFile', async () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'SQL Injection', 'api.example.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      const csvBtn = screen.getByRole('button', { name: /export diff as csv/i });
      expect(csvBtn).toBeInTheDocument();
      fireEvent.click(csvBtn);
      expect(mockDownloadFile).toHaveBeenCalledWith(
        'scan-diff.csv',
        expect.stringContaining('Status'),
        'text/csv',
      );
    });

    it('filter buttons change visible findings', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'New finding', 'host1.com'),
        makeVuln('v2', 'scan-old', 'Fixed finding', 'host2.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      // Click "New" filter button
      const newBtn = screen.getByRole('button', { name: /^new$/i });
      fireEvent.click(newBtn);
      // Should show only new findings
      expect(screen.queryByText('Fixed finding')).not.toBeInTheDocument();

      // Click "Fixed" filter button
      const fixedBtn = screen.getByRole('button', { name: /^fixed$/i });
      fireEvent.click(fixedBtn);
      expect(screen.queryByText('New finding')).not.toBeInTheDocument();

      // Click "All" to reset
      const allBtn = screen.getByRole('button', { name: /^all$/i });
      fireEvent.click(allBtn);
    });

    it('sorts diff with multiple statuses: new before persisted before fixed', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'Fixed finding', 'host1.com'),
        makeVuln('v2', 'scan-old', 'Fixed finding', 'host1.com'),  // persisted
        makeVuln('v3', 'scan-old', 'Old finding only', 'host2.com'), // fixed
        makeVuln('v4', 'scan-new', 'New finding only', 'host3.com'), // new
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      const statuses = screen.getAllByText(/^(new|fixed|persisted)$/).map(el => el.textContent);
      const newIdx = statuses.indexOf('new');
      const persistedIdx = statuses.indexOf('persisted');
      const fixedIdx = statuses.indexOf('fixed');
      // new should appear before persisted which appears before fixed
      expect(newIdx).toBeLessThan(persistedIdx);
      expect(persistedIdx).toBeLessThan(fixedIdx);
    });

    it('diff search filters by title', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'SQL Injection vulnerability', 'host1.com'),
        makeVuln('v2', 'scan-new', 'XSS Attack', 'host2.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      const searchInput = screen.getByPlaceholderText(/search title or asset/i);
      fireEvent.change(searchInput, { target: { value: 'sql' } });
      expect(screen.getByText('SQL Injection vulnerability')).toBeInTheDocument();
      expect(screen.queryByText('XSS Attack')).not.toBeInTheDocument();
    });

    it('diff search filters by asset name', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'Vuln A', 'api.example.com'),
        makeVuln('v2', 'scan-new', 'Vuln B', 'db.example.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      const searchInput = screen.getByPlaceholderText(/search title or asset/i);
      fireEvent.change(searchInput, { target: { value: 'api.example' } });
      expect(screen.getByText('Vuln A')).toBeInTheDocument();
      expect(screen.queryByText('Vuln B')).not.toBeInTheDocument();
    });

    it('shows "No entries match" message when filter excludes all', () => {
      const vulns = [
        makeVuln('v1', 'scan-new', 'New finding', 'host1.com'),
        makeVuln('v2', 'scan-old', 'Fixed finding', 'host2.com'),
      ];
      render(<ScanDiff scans={[SCAN_NEW, SCAN_OLD]} vulns={vulns} />);
      // Click "Persisted" filter - no persisted findings exist
      const persistedBtn = screen.getByRole('button', { name: /^persisted$/i });
      fireEvent.click(persistedBtn);
      expect(screen.getByText(/no entries match the current filters/i)).toBeInTheDocument();
    });
  });
});
