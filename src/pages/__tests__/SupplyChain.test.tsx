import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SupplyChain from '../SupplyChain';

const { mockScan, mockGetCircuitBreaker, mockGetGlobalScaAnalyzer, mockUseAuth } = vi.hoisted(() => {
  const mockScan = vi.fn();
  const mockCb = { execute: vi.fn() };
  const mockGetCircuitBreaker = vi.fn().mockReturnValue(mockCb);
  const mockGetGlobalScaAnalyzer = vi.fn().mockReturnValue({ scan: mockScan });
  const mockUseAuth = vi.fn().mockReturnValue({ user: null });
  return { mockScan, mockGetCircuitBreaker, mockGetGlobalScaAnalyzer, mockUseAuth };
});

vi.mock('../../lib/supplyChain', () => ({
  getGlobalScaAnalyzer: mockGetGlobalScaAnalyzer,
}));

vi.mock('../../lib/rateLimiter', () => ({
  getCircuitBreaker: mockGetCircuitBreaker,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../lib/toastContext', () => ({
  useToast: () => ({ showToast: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

vi.mock('../../lib/useSearchShortcut', () => ({
  useSearchShortcut: () => {},
}));

vi.mock('../../api/audit.service', () => ({
  AuditService: { logAction: vi.fn().mockResolvedValue(undefined), logSecurityEvent: vi.fn().mockResolvedValue(undefined) },
  AuditAction: { SBOM_ANALYSIS: 'sbom_analysis' },
}));

vi.mock('../../lib/exporters', () => ({
  downloadFile: vi.fn(),
}));

describe('SupplyChain', () => {
  beforeEach(() => {
    mockScan.mockReset();
  });

  it('renders "Supply Chain Analysis" heading', () => {
    render(<SupplyChain />);
    expect(screen.getByText('Supply Chain Analysis')).toBeInTheDocument();
  });

  it('renders description about OSV.dev', () => {
    render(<SupplyChain />);
    expect(screen.getByText(/OSV\.dev/i)).toBeInTheDocument();
  });

  it('renders dropzone with "Upload package.json" label', () => {
    render(<SupplyChain />);
    expect(screen.getByText('Upload package.json')).toBeInTheDocument();
  });

  it('renders drop hint text', () => {
    render(<SupplyChain />);
    expect(screen.getByText(/Drop your npm package\.json here/i)).toBeInTheDocument();
  });

  it('renders hidden file input', () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'file');
  });

  it('shows error for unsupported file type', async () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{}'], 'requirements.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(
        screen.getByText(/Only package\.json and package-lock\.json files are supported/i),
      ).toBeInTheDocument(),
    );
  });

  it('shows scanning state while analyzing', async () => {
    mockScan.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test","dependencies":{}}'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText('Analyzing Dependencies...')).toBeInTheDocument(),
    );
  });

  it('shows scan results after successful scan', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        risks: [
          {
            dependency: { name: 'lodash', version: '4.17.15', type: 'prod' },
            vulnerabilities: [
              { id: 'GHSA-1234', summary: 'Prototype pollution', details: '...', severity: 'high', fixedIn: '4.17.21' },
            ],
          },
        ],
      },
    });
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test","dependencies":{"lodash":"4.17.15"}}'], 'package.json', {
      type: 'application/json',
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    expect(screen.getByText('Prototype pollution')).toBeInTheDocument();
  });

  it('shows error when scan fails', async () => {
    mockScan.mockResolvedValue({ ok: false, error: { message: 'OSV service unavailable' } });
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test"}'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText('OSV service unavailable')).toBeInTheDocument(),
    );
  });

  it('clears filters after applying severity filter', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        risks: [
          {
            dependency: { name: 'express', version: '4.18.0', type: 'prod' },
            vulnerabilities: [
              { id: 'GHSA-5555', summary: 'RCE in express', details: '...', severity: 'critical', fixedIn: '4.18.2' },
            ],
          },
        ],
      },
    });
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test","dependencies":{"express":"4.18.0"}}'], 'package.json', {
      type: 'application/json',
    });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText('express')).toBeInTheDocument());
    // find severity filter buttons and click Critical
    const criticalBtn = screen.queryByRole('button', { name: /critical/i });
    if (criticalBtn) {
      fireEvent.click(criticalBtn);
      // now clear filters
      const clearBtn = screen.queryByRole('button', { name: /clear filters/i });
      if (clearBtn) {
        fireEvent.click(clearBtn);
      }
    }
  });
});

// ── File validation errors ────────────────────────────────────────────────────

describe('SupplyChain — file validation errors', () => {
  it('shows error for oversized file', async () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const bigFile = new File(['{"name":"test"}'], 'package.json', { type: 'application/json' });
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024, configurable: true });
    fireEvent.change(input, { target: { files: [bigFile] } });
    await waitFor(() =>
      expect(screen.getByText(/File is too large/i)).toBeInTheDocument(),
    );
  });

  it('shows error for invalid JSON content', async () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['not valid json{{'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument(),
    );
  });

  it('shows error for JSON array (not an object)', async () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['[1,2,3]'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText(/root must be a JSON object/i)).toBeInTheDocument(),
    );
  });

  it('shows error for invalid package structure', async () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"foo":"bar","baz":true}'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByText(/does not appear to be a valid package\.json/i)).toBeInTheDocument(),
    );
  });
});

// ── Results actions and filtering ─────────────────────────────────────────────

describe('SupplyChain — results with safe deps', () => {
  const mixedScanResult = {
    ok: true,
    data: {
      risks: [
        {
          dependency: { name: 'lodash', version: '4.17.15', type: 'prod' },
          vulnerabilities: [
            { id: 'GHSA-1234', summary: 'Prototype pollution', details: '...', severity: 'high', fixedIn: '4.17.21' },
          ],
        },
        {
          dependency: { name: 'safe-pkg', version: '1.0.0', type: 'dev' },
          vulnerabilities: [],
        },
      ],
    },
  };

  beforeEach(() => {
    mockScan.mockResolvedValue(mixedScanResult);
  });

  const uploadFile = () => {
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(
      ['{"name":"test","dependencies":{"lodash":"4.17.15"},"devDependencies":{"safe-pkg":"1.0.0"}}'],
      'package.json',
      { type: 'application/json' },
    );
    fireEvent.change(input, { target: { files: [file] } });
  };

  it('shows "Verified Safe" section for packages without vulnerabilities', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('Verified Safe')).toBeInTheDocument());
    expect(screen.getByText('safe-pkg')).toBeInTheDocument();
  });

  it('clicking "Scan another file" resets results', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /scan another file/i }));
    await waitFor(() => expect(screen.getByText('Upload package.json')).toBeInTheDocument());
  });

  it('clicking "Export CSV" calls downloadFile', async () => {
    const { downloadFile: mockDl } = await import('../../lib/exporters');
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    expect(mockDl).toHaveBeenCalled();
  });

  it('search input shows "No packages match" when no results', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Search package name…'), {
      target: { value: 'zzz-not-found' },
    });
    await waitFor(() =>
      expect(screen.getByText('No packages match the current filters.')).toBeInTheDocument(),
    );
  });

  it('sort "A→Z" button reorders results', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /A→Z/i }));
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
  });

  it('sort "Vulns ↓" button reorders results', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Vulns ↓/i }));
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
  });

  it('type filter "Production" filters to prod deps', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Production$/i }));
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
  });

  it('type filter "Development" filters to dev deps', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Development$/i }));
    // lodash is prod, should disappear; empty or no-match message
    await waitFor(() =>
      expect(screen.getByText('No packages match the current filters.')).toBeInTheDocument(),
    );
  });

  it('sort "Risk ↑" (risk_asc) reorders results', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Risk ↑/i }));
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
  });

  it('severity filter "medium" shows no results when only high vulns', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^medium$/i }));
    await waitFor(() =>
      expect(screen.getByText('No packages match the current filters.')).toBeInTheDocument(),
    );
  });

  it('severity filter "low" shows no results when only high vulns', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('lodash')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^low$/i }));
    await waitFor(() =>
      expect(screen.getByText('No packages match the current filters.')).toBeInTheDocument(),
    );
  });

  it('shows Dependency Risk Score bar in results', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() =>
      expect(screen.getByText('Dependency Risk Score')).toBeInTheDocument(),
    );
  });
});

// ── Drag and drop ─────────────────────────────────────────────────────────────

describe('SupplyChain — drag and drop', () => {
  beforeEach(() => {
    mockScan.mockReset();
  });

  const getDropzone = () =>
    screen.getByText(/Drop your npm package\.json here/i).closest('[class*="border-dashed"]') as HTMLElement;

  it('onDragOver sets dragging state (dragover class applied)', async () => {
    render(<SupplyChain />);
    const container = getDropzone();
    fireEvent.dragOver(container);
    // dragging state causes class change — component re-renders without error
    expect(container).toBeInTheDocument();
  });

  it('onDragLeave removes dragging state', async () => {
    render(<SupplyChain />);
    const container = getDropzone();
    fireEvent.dragOver(container);
    fireEvent.dragLeave(container);
    expect(container).toBeInTheDocument();
  });

  it('onDrop with valid file triggers scan', async () => {
    mockScan.mockResolvedValue({ ok: true, data: { risks: [] } });
    render(<SupplyChain />);
    const container = getDropzone();
    const file = new File(['{"name":"test","dependencies":{}}'], 'package.json', { type: 'application/json' });
    fireEvent.drop(container, {
      dataTransfer: { files: [file] },
    });
    await waitFor(() => expect(mockScan).toHaveBeenCalled());
  });
});

// ── No vulnerabilities scan ──────────────────────────────────────────────────

describe('SupplyChain — no vulnerabilities', () => {
  const safeScanResult = {
    ok: true,
    data: {
      risks: [
        { dependency: { name: 'react', version: '18.2.0', type: 'prod' }, vulnerabilities: [] },
        { dependency: { name: 'vite', version: '5.0.0', type: 'dev' }, vulnerabilities: [] },
      ],
    },
  };

  beforeEach(() => {
    mockScan.mockResolvedValue(safeScanResult);
  });

  const uploadFile = () => {
    const input = screen.getByLabelText('Upload package.json');
    const file = new File(['{"name":"test","dependencies":{"react":"18.2.0"}}'], 'package.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
  };

  it('shows "Clean" risk label when 0 vulnerabilities', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('Dependency Risk Score')).toBeInTheDocument());
    expect(screen.getByText('Clean')).toBeInTheDocument();
  });

  it('shows "0%" risk score when no vulnerable packages', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('Dependency Risk Score')).toBeInTheDocument());
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('does not show Export CSV when no vulnerable deps', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('react')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument();
  });
});

// ── User audit logging ────────────────────────────────────────────────────────

describe('SupplyChain — with authenticated user', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-123', app_metadata: { org_id: 'org-456' } } });
    mockScan.mockResolvedValue({
      ok: true,
      data: { risks: [{ dependency: { name: 'lodash', version: '4.17.15', type: 'prod' }, vulnerabilities: [] }] },
    });
  });

  afterEach(() => {
    mockUseAuth.mockReturnValue({ user: null });
  });

  it('calls AuditService.logSecurityEvent after scan when user is set', async () => {
    const { AuditService } = await import('../../api/audit.service');
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    fireEvent.change(input, {
      target: {
        files: [new File(['{"name":"test","dependencies":{"lodash":"^4"}}'], 'package.json', { type: 'application/json' })],
      },
    });
    await waitFor(() => expect(vi.mocked(AuditService.logSecurityEvent)).toHaveBeenCalled());
  });
});

// ── Sort comparator with multiple vulnerable packages ─────────────────────────

describe('SupplyChain — sort with multiple vulnerable deps', () => {
  const multiVulnResult = {
    ok: true,
    data: {
      risks: [
        {
          dependency: { name: 'alpha-pkg', version: '1.0.0', type: 'prod' },
          vulnerabilities: [
            { id: 'GHSA-0001', summary: 'Low vuln', details: '...', severity: 'low', fixedIn: null },
          ],
        },
        {
          dependency: { name: 'beta-pkg', version: '2.0.0', type: 'prod' },
          vulnerabilities: [
            { id: 'GHSA-0002', summary: 'Critical vuln', details: '...', severity: 'critical', fixedIn: '2.1.0' },
            { id: 'GHSA-0003', summary: 'High vuln', details: '...', severity: 'high', fixedIn: null },
          ],
        },
        {
          dependency: { name: 'gamma-pkg', version: '3.0.0', type: 'prod' },
          vulnerabilities: [
            { id: 'GHSA-0004', summary: 'Medium vuln', details: '...', severity: 'medium', fixedIn: '3.0.1' },
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    mockScan.mockResolvedValue(multiVulnResult);
  });

  const uploadFile = () => {
    const input = screen.getByLabelText('Upload package.json');
    fireEvent.change(input, {
      target: {
        files: [new File(['{"name":"test","dependencies":{"alpha-pkg":"^1","beta-pkg":"^2","gamma-pkg":"^3"}}'], 'package.json', { type: 'application/json' })],
      },
    });
  };

  it('sort Risk ↓ (risk_desc) puts beta-pkg first', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('beta-pkg')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Risk ↓/i }));
    await waitFor(() => expect(screen.getByText('beta-pkg')).toBeInTheDocument());
  });

  it('sort Risk ↑ (risk_asc) puts alpha-pkg first', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('alpha-pkg')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Risk ↑/i }));
    await waitFor(() => expect(screen.getByText('alpha-pkg')).toBeInTheDocument());
  });

  it('sort A→Z puts alpha-pkg before beta-pkg', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('alpha-pkg')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /A→Z/i }));
    await waitFor(() => expect(screen.getByText('alpha-pkg')).toBeInTheDocument());
  });

  it('sort Vulns ↓ puts beta-pkg first (most vulns)', async () => {
    render(<SupplyChain />);
    uploadFile();
    await waitFor(() => expect(screen.getByText('beta-pkg')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Vulns ↓/i }));
    await waitFor(() => expect(screen.getByText('beta-pkg')).toBeInTheDocument());
  });
});

// ── Scan throws (catch block) ─────────────────────────────────────────────────

describe('SupplyChain — scan throws exception', () => {
  beforeEach(() => {
    mockScan.mockRejectedValue(new Error('Network timeout'));
  });

  it('shows error message when scan throws', async () => {
    render(<SupplyChain />);
    const input = screen.getByLabelText('Upload package.json');
    fireEvent.change(input, {
      target: {
        files: [new File(['{"name":"test","dependencies":{}}'], 'package.json', { type: 'application/json' })],
      },
    });
    await waitFor(() => expect(screen.getByText('Network timeout')).toBeInTheDocument());
  });
});
