import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OsintAnalyzer from '../DarkWebMonitor';
import { AuditService } from '../../api/audit.service';

const { mockScan, mockCheck, mockGetRateLimiter, mockGetGlobalDarkWebMonitor, authState } = vi.hoisted(() => {
  const mockScan = vi.fn();
  const mockCheck = vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 });
  const mockLimiter = { check: mockCheck };
  const mockGetRateLimiter = vi.fn().mockReturnValue(mockLimiter);
  const mockGetGlobalDarkWebMonitor = vi.fn().mockReturnValue({ scan: mockScan });
  const authState: { user: null | { id: string; app_metadata?: { org_id?: string } } } = { user: null };
  return { mockScan, mockCheck, mockGetRateLimiter, mockGetGlobalDarkWebMonitor, authState };
});

vi.mock('../../lib/darkWebMonitor', () => ({
  getGlobalDarkWebMonitor: mockGetGlobalDarkWebMonitor,
}));

vi.mock('../../lib/rateLimiter', () => ({
  getRateLimiter: mockGetRateLimiter,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../lib/toastContext', () => ({
  useToast: () => ({ showToast: vi.fn(), info: vi.fn(), error: vi.fn(), success: vi.fn(), warn: vi.fn() }),
}));

vi.mock('../../api/audit.service', () => ({
  AuditService: { logAction: vi.fn().mockResolvedValue(undefined), logSecurityEvent: vi.fn().mockResolvedValue(undefined) },
  AuditAction: { DARK_WEB_SCAN: 'dark_web_scan' },
}));

vi.mock('../../lib/exporters', () => ({
  downloadFile: vi.fn(),
}));

describe('OsintAnalyzer (DarkWebMonitor)', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('renders OSINT Analyzer heading', () => {
    render(<OsintAnalyzer />);
    expect(screen.getByText('OSINT Analyzer')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<OsintAnalyzer />);
    expect(screen.getByText(/Analyze digital footprints/i)).toBeInTheDocument();
  });

  it('renders info banner about internal database', () => {
    render(<OsintAnalyzer />);
    expect(screen.getByText(/5\.4B\+ anonymized leak records/i)).toBeInTheDocument();
  });

  it('renders input placeholder', () => {
    render(<OsintAnalyzer />);
    expect(screen.getByPlaceholderText(/Enter email, domain or username/i)).toBeInTheDocument();
  });

  it('renders Analyze button disabled when input is empty', () => {
    render(<OsintAnalyzer />);
    const btn = screen.getByRole('button', { name: /analyze/i });
    expect(btn).toBeDisabled();
  });

  it('enables Analyze button when input has value', () => {
    render(<OsintAnalyzer />);
    const input = screen.getByPlaceholderText(/Enter email, domain or username/i);
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    const btn = screen.getByRole('button', { name: /analyze/i });
    expect(btn).not.toBeDisabled();
  });

  it('shows "No Leaks Detected" result after clean scan', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: { breachCount: 0, breaches: [], scannedAt: '2026-04-24T00:00:00Z', riskScore: 0, riskLevel: 'low', recommendedActions: [] },
    });
    render(<OsintAnalyzer />);
    const input = screen.getByPlaceholderText(/Enter email, domain or username/i);
    fireEvent.change(input, { target: { value: 'clean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('No Leaks Detected')).toBeInTheDocument());
  });

  it('shows breach count for a positive result', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        breachCount: 3,
        breaches: [
          { source: 'LinkedIn', severity: 'high', dataClasses: ['email', 'password'], breachDate: '2021-01-01' },
        ],
        scannedAt: '2026-04-24T00:00:00Z',
        riskScore: 75,
        riskLevel: 'high',
        recommendedActions: ['Change your password'],
      },
    });
    render(<OsintAnalyzer />);
    const input = screen.getByPlaceholderText(/Enter email, domain or username/i);
    fireEvent.change(input, { target: { value: 'victim@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('3 Breaches Found')).toBeInTheDocument());
  });

  it('shows error message when scan fails', async () => {
    mockScan.mockResolvedValue({ ok: false, error: { message: 'Scan service unavailable' } });
    render(<OsintAnalyzer />);
    const input = screen.getByPlaceholderText(/Enter email, domain or username/i);
    fireEvent.change(input, { target: { value: 'fail@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('Scan service unavailable')).toBeInTheDocument());
  });

  it('shows "Analysis Results" heading after first result', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: { breachCount: 0, breaches: [], scannedAt: '2026-04-24T00:00:00Z', riskScore: 0, riskLevel: 'low', recommendedActions: [] },
    });
    render(<OsintAnalyzer />);
    const input = screen.getByPlaceholderText(/Enter email, domain or username/i);
    fireEvent.change(input, { target: { value: 'query@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('Analysis Results')).toBeInTheDocument());
  });

  it('shows rate limit error when rate limit exceeded', async () => {
    mockCheck.mockReturnValue({ allowed: false, retryAfterMs: 30000 });
    render(<OsintAnalyzer />);
    const input = screen.getByPlaceholderText(/Enter email, domain or username/i);
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument());
  });
});

describe('OsintAnalyzer — Phishing Drill Plan', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('does NOT show Phishing Drill Plan panel before any scan', () => {
    render(<OsintAnalyzer />);
    expect(screen.queryByText('Phishing Drill Plan')).not.toBeInTheDocument();
  });

  it('does NOT show Phishing Drill Plan panel when scan has no breaches', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: { breachCount: 0, breaches: [], scannedAt: '2026-04-29T00:00:00Z', riskScore: 0, riskLevel: 'low', recommendedActions: [] },
    });
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: 'clean@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('Analysis Results')).toBeInTheDocument());
    expect(screen.queryByText('Phishing Drill Plan')).not.toBeInTheDocument();
  });

  it('shows Phishing Drill Plan panel when scan returns high-risk breach result', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        breachCount: 2,
        breaches: [
          { source: 'LinkedIn', severity: 'high', dataClasses: ['email', 'password'], breachDate: '2021-01-01' },
        ],
        scannedAt: '2026-04-29T00:00:00Z',
        riskScore: 80,
        riskLevel: 'high',
        recommendedActions: ['Change passwords'],
      },
    });
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: 'victim@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('Phishing Drill Plan')).toBeInTheDocument());
  });

  it('expands Phishing Drill Plan when toggle button clicked', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        breachCount: 1,
        breaches: [{ source: 'Adobe', severity: 'critical', dataClasses: ['email'], breachDate: '2020-06-01' }],
        scannedAt: '2026-04-29T00:00:00Z',
        riskScore: 90,
        riskLevel: 'critical',
        recommendedActions: ['Rotate credentials'],
      },
    });
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: 'hacked@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('Phishing Drill Plan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Phishing Drill Plan'));
    await waitFor(() =>
      expect(screen.getByText(/running controlled phishing simulations/i)).toBeInTheDocument()
    );
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HIGH_RISK_DATA = {
  ok: true,
  data: {
    breachCount: 2,
    breaches: [
      { source: 'LinkedIn', severity: 'high', dataClasses: ['email', 'password'], breachDate: '2021-01-01' },
    ],
    scannedAt: '2026-04-29T00:00:00Z',
    riskScore: 80,
    riskLevel: 'high',
    recommendedActions: ['Change passwords'],
  },
};

async function renderWithResult(scanResult: typeof HIGH_RISK_DATA, queryStr = 'victim@example.com') {
  mockScan.mockResolvedValue(scanResult);
  render(<OsintAnalyzer />);
  fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: queryStr } });
  fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
  await waitFor(() => expect(screen.getByText('Analysis Results')).toBeInTheDocument());
}

// ─── Input validation ──────────────────────────────────────────────────────────

describe('OsintAnalyzer — input validation', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('shows validation error for input with script tag', async () => {
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: '<script>alert(1)</script>' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText(/Query contains invalid characters/i)).toBeInTheDocument());
  });

  it('shows validation error for SQL injection attempt', async () => {
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: "' OR 1=1; DROP TABLE users;--" } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText(/Query contains invalid characters/i)).toBeInTheDocument());
  });

  it('shows validation error for query too long (>253 chars)', async () => {
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: 'a'.repeat(254) } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText(/Query is too long/i)).toBeInTheDocument());
  });

  it('submits on Enter key press', async () => {
    mockScan.mockResolvedValue({
      ok: true,
      data: { breachCount: 0, breaches: [], scannedAt: '2026-04-24T00:00:00Z', riskScore: 0, riskLevel: 'low', recommendedActions: [] },
    });
    render(<OsintAnalyzer />);
    const input = screen.getByPlaceholderText(/Enter email, domain or username/i);
    fireEvent.change(input, { target: { value: 'enter@example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(mockScan).toHaveBeenCalledWith('enter@example.com'));
  });
});

// ─── Summary stats ─────────────────────────────────────────────────────────────

describe('OsintAnalyzer — summary stats', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('shows "Total scanned" stat after scan', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    expect(screen.getByText('Total scanned')).toBeInTheDocument();
  });

  it('shows "Total breaches" stat after scan', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    expect(screen.getByText('Total breaches')).toBeInTheDocument();
  });

  it('shows "Clean" stat after scan', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    expect(screen.getByText('Clean')).toBeInTheDocument();
  });

  it('shows "Errors" stat after scan', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    expect(screen.getByText('Errors')).toBeInTheDocument();
  });
});

// ─── Risk Distribution chart ───────────────────────────────────────────────────

describe('OsintAnalyzer — Risk Distribution chart', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('shows "Risk Distribution" toggle button after scan', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    expect(screen.getByText('Risk Distribution')).toBeInTheDocument();
  });

  it('expands Risk Distribution chart when toggled', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    fireEvent.click(screen.getByText('Risk Distribution'));
    await waitFor(() => expect(screen.getByText('High risk')).toBeInTheDocument());
  });

  it('collapses Risk Distribution chart on second click', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    fireEvent.click(screen.getByText('Risk Distribution'));
    await waitFor(() => expect(screen.getByText('High risk')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Risk Distribution'));
    // After collapse, the "▲ collapse" label disappears (chart is hidden)
    await waitFor(() => expect(screen.queryByText('▲ collapse')).not.toBeInTheDocument());
  });
});

// ─── Filter & Sort ─────────────────────────────────────────────────────────────

describe('OsintAnalyzer — filter and sort', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('shows severity filter buttons after scan', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    const allBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'All');
    expect(allBtn).toBeDefined();
  });

  it('clicking "high" severity filter shows no match message when no high results visible under filter', async () => {
    // low result only
    mockScan.mockResolvedValue({
      ok: true,
      data: { breachCount: 0, breaches: [], scannedAt: '2026-01-01T00:00:00Z', riskScore: 5, riskLevel: 'low', recommendedActions: [] },
    });
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: 'low@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('Analysis Results')).toBeInTheDocument());
    const highBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'high');
    fireEvent.click(highBtn!);
    await waitFor(() => expect(screen.getByText(/No results match the selected filter/i)).toBeInTheDocument());
  });

  it('shows "Clear filters" button when filter or sort is non-default', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    const highBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'high');
    fireEvent.click(highBtn!);
    await waitFor(() => expect(screen.getByText(/Clear filters/i)).toBeInTheDocument());
  });

  it('"Clear filters" button resets filter', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    const highBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === 'high');
    fireEvent.click(highBtn!);
    await waitFor(() => screen.getByText(/Clear filters/i));
    fireEvent.click(screen.getByText(/Clear filters/i));
    await waitFor(() => expect(screen.queryByText(/Clear filters/i)).not.toBeInTheDocument());
  });

  it('shows sort buttons: Newest, Risk ↓, Risk ↑, A→Z', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    expect(screen.getByText('Newest')).toBeInTheDocument();
    expect(screen.getByText('Risk ↓')).toBeInTheDocument();
    expect(screen.getByText('Risk ↑')).toBeInTheDocument();
    expect(screen.getByText('A→Z')).toBeInTheDocument();
  });
});

// ─── Export ────────────────────────────────────────────────────────────────────

describe('OsintAnalyzer — export', () => {
  let mockDownloadFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
    const exportersMod = await import('../../lib/exporters');
    mockDownloadFile = vi.mocked(exportersMod.downloadFile);
    mockDownloadFile.mockClear();
  });

  it('clicking CSV export calls downloadFile with .csv filename', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    fireEvent.click(screen.getByRole('button', { name: /csv/i }));
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.csv$/),
      expect.any(String),
      'text/csv',
    );
  });

  it('clicking JSON export calls downloadFile with .json filename', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    fireEvent.click(screen.getByRole('button', { name: /json/i }));
    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.json$/),
      expect.any(String),
      'application/json',
    );
  });
});

// ─── Clear history & remove result ─────────────────────────────────────────────

describe('OsintAnalyzer — clear history and remove result', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('"Clear" button removes all results', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    expect(screen.getByText('Analysis Results')).toBeInTheDocument();
    // The clear history button has aria-label="Clear history"
    fireEvent.click(screen.getByRole('button', { name: /Clear history/i }));
    await waitFor(() => expect(screen.queryByText('Analysis Results')).not.toBeInTheDocument());
  });
});

// ─── Phishing Drill — copy scenario ──────────────────────────────────────────

describe('OsintAnalyzer — Phishing Drill copy', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it('clicking Copy button in expanded phishing drill triggers copyDrill', async () => {
    await renderWithResult(HIGH_RISK_DATA);
    // Expand phishing drill panel
    const expandBtn = screen.getByRole('button', { name: /Phishing Drill Plan/i });
    fireEvent.click(expandBtn);
    // Click the first Copy button inside the drill scenarios
    const copyBtns = screen.getAllByRole('button', { name: /Copy/i });
    expect(copyBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(copyBtns[0]);
    // After click, clipboard.writeText should have been called
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});

// ─── Breach medium/low severity branches ──────────────────────────────────────

describe('OsintAnalyzer — breach severity medium and low', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('renders medium severity breach badge', async () => {
    const mediumData = {
      ok: true,
      data: {
        breachCount: 1,
        breaches: [
          { source: 'Twitter', severity: 'medium', dataClasses: ['email'], breachDate: '2022-03-15' },
        ],
        scannedAt: '2026-04-29T00:00:00Z',
        riskScore: 45,
        riskLevel: 'medium',
        recommendedActions: ['Enable 2FA'],
      },
    };
    await renderWithResult(mediumData as typeof HIGH_RISK_DATA);
    expect(screen.getByText(/medium Severity/i)).toBeInTheDocument();
  });

  it('renders low severity breach badge', async () => {
    const lowData = {
      ok: true,
      data: {
        breachCount: 1,
        breaches: [
          { source: 'Forum', severity: 'low', dataClasses: ['username'], breachDate: '2023-06-01' },
        ],
        scannedAt: '2026-04-29T00:00:00Z',
        riskScore: 15,
        riskLevel: 'low',
        recommendedActions: [],
      },
    };
    await renderWithResult(lowData as typeof HIGH_RISK_DATA);
    expect(screen.getByText(/low Severity/i)).toBeInTheDocument();
  });
});

// ─── AuditService.logSecurityEvent coverage (user logged in) ──────────────────

describe('OsintAnalyzer — logSecurityEvent when user is logged in', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
    localStorage.clear();
  });

  it('calls AuditService.logSecurityEvent when user is present and scan succeeds', async () => {
    authState.user = { id: 'user-1', app_metadata: { org_id: 'org-1' } };
    (AuditService.logSecurityEvent as ReturnType<typeof vi.fn>).mockClear();
    mockScan.mockResolvedValue({
      ok: true,
      data: {
        breachCount: 1,
        breaches: [{ source: 'TestDB', severity: 'high', dataClasses: ['email'], breachDate: '2024-01-01' }],
        scannedAt: '2026-04-29T00:00:00Z',
        riskScore: 75,
        riskLevel: 'high',
        recommendedActions: ['Change passwords'],
      },
    });
    render(<OsintAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText(/Enter email, domain or username/i), { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await waitFor(() => expect(screen.getByText('Analysis Results')).toBeInTheDocument());
    expect((AuditService.logSecurityEvent as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    authState.user = null;
  });
});
