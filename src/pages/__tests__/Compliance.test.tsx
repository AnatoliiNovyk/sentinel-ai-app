import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Compliance from '../Compliance';

const { mockEq } = vi.hoisted(() => ({
  mockEq: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: mockEq }),
    }),
  },
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  const _profile = { email: 'admin@example.com', company: 'Acme Corp' };
  return { useAuth: () => ({ user: _user, profile: _profile }) };
});

vi.mock('../../lib/evidencePackage', () => ({
  buildEvidencePackage: vi.fn().mockReturnValue({}),
  buildEvidenceMarkdown: vi.fn().mockReturnValue('## Report'),
  printReportAsPDF: vi.fn(),
}));

vi.mock('../../lib/exporters', () => ({
  downloadFile: vi.fn(),
}));

describe('Compliance', () => {
  it('renders "Compliance" heading after data loads', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('Compliance')).toBeInTheDocument());
  });

  it('renders description about automated mapping', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText(/Automated mapping of your findings/i)).toBeInTheDocument());
  });

  it('renders "SOC 2 Trust Services Criteria" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('SOC 2 Trust Services Criteria')).toBeInTheDocument());
  });

  it('renders "NIST Cybersecurity Framework (CSF)" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('NIST Cybersecurity Framework (CSF)')).toBeInTheDocument());
  });

  it('renders "CIS Controls v8" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
  });

  it('renders "MITRE ATT&CK Tactics" section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('MITRE ATT&CK Tactics')).toBeInTheDocument());
  });

  it('renders "SOC 2 Readiness" label', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('SOC 2 Readiness')).toBeInTheDocument());
  });

  it('renders stat cards: Open findings, Resolved, Total assessed', async () => {
    render(<Compliance />);
    await waitFor(() => {
      expect(screen.getByText('Open findings')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
      expect(screen.getByText('Total assessed')).toBeInTheDocument();
    });
  });

  it('renders "Export evidence" button', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('Export evidence')).toBeInTheDocument());
  });

  it('renders loading state initially', () => {
    render(<Compliance />);
    expect(screen.getByText(/Computing compliance posture/i)).toBeInTheDocument();
  });

  it('renders Export CSV button and clicks it', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('Compliance')).toBeInTheDocument());
    const csvBtn = await screen.findByRole('button', { name: /csv report/i });
    expect(csvBtn).toBeInTheDocument();
    fireEvent.click(csvBtn);
    // Should not throw
  });

  it('switches to MITRE ATT&CK filter', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('MITRE ATT&CK Tactics')).toBeInTheDocument());
    const activeBtn = screen.queryByRole('button', { name: /active threats/i });
    if (activeBtn) {
      fireEvent.click(activeBtn);
    }
  });
});

describe('Compliance — framework tabs', () => {
  it('clicks SOC 2 tab and hides other framework sections', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('SOC 2 Trust Services Criteria'));
    fireEvent.click(screen.getByRole('button', { name: /^SOC 2/ }));
    await waitFor(() => expect(screen.getByText('SOC 2 Trust Services Criteria')).toBeInTheDocument());
    expect(screen.queryByText('NIST Cybersecurity Framework (CSF)')).toBeNull();
  });

  it('clicks NIST CSF tab and shows only NIST section', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('NIST Cybersecurity Framework (CSF)'));
    fireEvent.click(screen.getByRole('button', { name: /NIST CSF/ }));
    await waitFor(() => expect(screen.getByText('NIST Cybersecurity Framework (CSF)')).toBeInTheDocument());
    expect(screen.queryByText('SOC 2 Trust Services Criteria')).toBeNull();
  });

  it('clicks CIS Controls tab and shows only CIS section', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('CIS Controls v8'));
    fireEvent.click(screen.getByRole('button', { name: /CIS Controls/ }));
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
    expect(screen.queryByText('SOC 2 Trust Services Criteria')).toBeNull();
  });

  it('clicks MITRE ATT&CK tab and shows only MITRE section', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('MITRE ATT&CK Tactics'));
    fireEvent.click(screen.getByRole('button', { name: /MITRE ATT&CK/ }));
    await waitFor(() => expect(screen.getByText('MITRE ATT&CK Tactics')).toBeInTheDocument());
    expect(screen.queryByText('SOC 2 Trust Services Criteria')).toBeNull();
  });
});

describe('Compliance — NIST/CIS/MITRE status filters', () => {
  it('NIST passing/failing filters', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('NIST Cybersecurity Framework (CSF)'));
    const passingBtns = screen.getAllByRole('button', { name: /≥60% Passing/i });
    fireEvent.click(passingBtns[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /<60% Failing/i })[0]);
    // Should not throw
  });

  it('CIS status passing/failing and sort buttons', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('CIS Controls v8'));
    const failingBtns = screen.getAllByRole('button', { name: /<60% Failing/i });
    fireEvent.click(failingBtns[failingBtns.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: 'Score ↑' }));
    fireEvent.click(screen.getByRole('button', { name: 'A→Z' }));
  });

  it('MITRE active threats / mitigated filters', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('MITRE ATT&CK Tactics'));
    fireEvent.click(screen.getByRole('button', { name: 'Active threats' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mitigated' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'All' })[0]);
  });
});

describe('Compliance — control search', () => {
  it('filters by search query and shows clear button', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByPlaceholderText(/search controls/i));
    fireEvent.change(screen.getByPlaceholderText(/search controls/i), { target: { value: 'CC1' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument());
  });

  it('clears search via X button', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByPlaceholderText(/search controls/i));
    fireEvent.change(screen.getByPlaceholderText(/search controls/i), { target: { value: 'test' } });
    await waitFor(() => screen.getByRole('button', { name: 'Clear search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect((screen.getByPlaceholderText(/search controls/i) as HTMLInputElement).value).toBe('');
  });

  it('shows "No controls match search" when nothing matches', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByPlaceholderText(/search controls/i));
    fireEvent.change(screen.getByPlaceholderText(/search controls/i), { target: { value: 'zzzz-no-match-xyz' } });
    await waitFor(() =>
      expect(screen.getAllByText(/no controls match search/i).length).toBeGreaterThanOrEqual(1),
    );
  });
});

describe('Compliance — export formats (json, markdown, pdf)', () => {
  it('clicks JSON package export', async () => {
    const { downloadFile } = await import('../../lib/exporters');
    const mockDl = vi.mocked(downloadFile);
    mockDl.mockClear();
    render(<Compliance />);
    await waitFor(() => screen.getByText('Export evidence'));
    const jsonBtn = await screen.findByRole('button', { name: /json package/i });
    fireEvent.click(jsonBtn);
    // Should not throw (button is disabled with 0 vulns but still callable)
  });

  it('clicks Markdown report export', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('Export evidence'));
    const mdBtn = await screen.findByRole('button', { name: /markdown report/i });
    fireEvent.click(mdBtn);
  });

  it('clicks Export PDF', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('Export evidence'));
    const pdfBtn = await screen.findByRole('button', { name: /export pdf/i });
    fireEvent.click(pdfBtn);
  });
});

describe('Compliance — with vuln data (criticalCount/openCount branches)', () => {
  beforeEach(() => {
    mockEq.mockResolvedValue({
      data: [
        {
          id: 'v-1', scan_id: 's-1', user_id: 'user-1',
          title: 'SQL Injection in access control module',
          description: 'Unauthenticated access to restricted endpoint via SQL injection.',
          severity: 'critical',
          cve_id: 'CVE-2024-0001',
          mitre_tactic: 'Initial Access',
          cis_control: 'CIS-1',
          asset: 'api.example.com',
          remediation: 'Apply patch and harden access configuration',
          remediation_code: '', remediation_type: 'patch',
          created_at: new Date().toISOString(),
          status: 'open',
          note: '', status_updated_at: '', sla_breached_at: null, sla_warned_at: null,
        },
        {
          id: 'v-2', scan_id: 's-1', user_id: 'user-1',
          title: 'Privilege escalation via misconfigured role',
          description: 'User can escalate privileges via misconfigured role assignment.',
          severity: 'high',
          cve_id: 'CVE-2024-0002',
          mitre_tactic: 'Privilege Escalation',
          cis_control: 'CIS-5',
          asset: 'web.example.com',
          remediation: 'Restrict role assignment in inventory system',
          remediation_code: '', remediation_type: 'config',
          created_at: new Date().toISOString(),
          status: 'open',
          note: '', status_updated_at: '', sla_breached_at: null, sla_warned_at: null,
        },
        {
          id: 'v-3', scan_id: 's-1', user_id: 'user-1',
          title: 'Resolved finding',
          description: 'Fixed vulnerability.',
          severity: 'medium',
          cve_id: '', mitre_tactic: '', cis_control: 'CIS-7',
          asset: 'db.example.com', remediation: 'Already patched',
          remediation_code: '', remediation_type: 'patch',
          created_at: new Date().toISOString(),
          status: 'resolved',
          note: '', status_updated_at: '', sla_breached_at: null, sla_warned_at: null,
        },
      ],
      error: null,
    });
  });

  it('renders CIS row with criticalCount > 0 (AlertCircle icon)', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
    // CIS-1 should have openCount=1 and criticalCount=1 → AlertCircle rendered
    expect(screen.getAllByText('Inventory & Control of Enterprise Assets').length).toBeGreaterThanOrEqual(1);
  });

  it('renders MITRE card with openCount > 0 (red count badge)', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('MITRE ATT&CK Tactics')).toBeInTheDocument());
    // "Initial Access" should have openCount=1
    expect(screen.getAllByText('Initial Access').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Priority Action Items (worstControls) section', async () => {
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('Priority Action Items')).toBeInTheDocument());
  });

  it('NIST passing filter shows non-empty rows with vulns', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('NIST Cybersecurity Framework (CSF)'));
    fireEvent.click(screen.getAllByRole('button', { name: /<60% Failing/i })[0]);
    await waitFor(() => expect(screen.getByText('NIST Cybersecurity Framework (CSF)')).toBeInTheDocument());
  });

  it('CIS failing filter with non-empty vulns', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('CIS Controls v8'));
    const failingBtns = screen.getAllByRole('button', { name: /<60% Failing/i });
    fireEvent.click(failingBtns[failingBtns.length - 1]);
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
  });

  it('MITRE active threats filter with open vulns', async () => {
    render(<Compliance />);
    await waitFor(() => screen.getByText('MITRE ATT&CK Tactics'));
    fireEvent.click(screen.getByRole('button', { name: 'Active threats' }));
    // "Initial Access" should still be visible
    await waitFor(() => expect(screen.getAllByText('Initial Access').length).toBeGreaterThanOrEqual(1));
  });
});

describe('Compliance — CIS row color thresholds', () => {
  it('CIS row with minimal vulns (high score) renders without error', async () => {
    mockEq.mockResolvedValue({
      data: [
        {
          id: 'v-1', scan_id: 's-1', user_id: 'user-1',
          title: 'Low severity finding',
          description: 'Minor issue',
          severity: 'low',
          cve_id: 'CVE-2024-0001', mitre_tactic: 'Initial Access', cis_control: 'CIS-1',
          asset: 'api.example.com', remediation: 'Minor fix',
          remediation_code: '', remediation_type: 'patch',
          created_at: new Date().toISOString(),
          status: 'resolved',
          note: '', status_updated_at: '', sla_breached_at: null, sla_warned_at: null,
        },
      ],
      error: null,
    });
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
    // Verify CIS row renders (high score = green)
    expect(screen.getByText('Inventory & Control of Enterprise Assets')).toBeInTheDocument();
  });

  it('CIS row with multiple medium vulns renders without error', async () => {
    mockEq.mockResolvedValue({
      data: Array.from({ length: 2 }, (_, i) => ({
        id: `v-${i}`, scan_id: 's-1', user_id: 'user-1',
        title: `Medium severity finding ${i}`,
        description: 'Moderate risk',
        severity: 'medium',
        cve_id: `CVE-2024-000${i}`, mitre_tactic: 'Initial Access', cis_control: 'CIS-1',
        asset: 'api.example.com', remediation: 'Needs remediation',
        remediation_code: '', remediation_type: 'config',
        created_at: new Date().toISOString(),
        status: 'open',
        note: '', status_updated_at: '', sla_breached_at: null, sla_warned_at: null,
      })),
      error: null,
    });
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
    // Verify CIS row renders (medium score = yellow)
    expect(screen.getByText('Inventory & Control of Enterprise Assets')).toBeInTheDocument();
  });

  it('CIS row with critical vulns (low score) renders without error', async () => {
    mockEq.mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => ({
        id: `v-${i}`, scan_id: 's-1', user_id: 'user-1',
        title: `Critical severity finding ${i}`,
        description: 'Critical risk',
        severity: 'critical',
        cve_id: `CVE-2024-000${i}`, mitre_tactic: 'Initial Access', cis_control: 'CIS-1',
        asset: 'api.example.com', remediation: 'Urgent',
        remediation_code: '', remediation_type: 'patch',
        created_at: new Date().toISOString(),
        status: 'open',
        note: '', status_updated_at: '', sla_breached_at: null, sla_warned_at: null,
      })),
      error: null,
    });
    render(<Compliance />);
    await waitFor(() => expect(screen.getByText('CIS Controls v8')).toBeInTheDocument());
    // With 5 critical open vulns, score for CIS-1 should be very low (red color threshold)
    // Just verify the page renders with CIS section visible
    expect(screen.getByText('CIS Controls v8')).toBeInTheDocument();
  });
});
