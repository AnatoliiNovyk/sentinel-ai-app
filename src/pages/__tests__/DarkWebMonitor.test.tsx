import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OsintAnalyzer from '../DarkWebMonitor';

const { mockScan, mockCheck, mockGetRateLimiter, mockGetGlobalDarkWebMonitor } = vi.hoisted(() => {
  const mockScan = vi.fn();
  const mockCheck = vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 });
  const mockLimiter = { check: mockCheck };
  const mockGetRateLimiter = vi.fn().mockReturnValue(mockLimiter);
  const mockGetGlobalDarkWebMonitor = vi.fn().mockReturnValue({ scan: mockScan });
  return { mockScan, mockCheck, mockGetRateLimiter, mockGetGlobalDarkWebMonitor };
});

vi.mock('../../lib/darkWebMonitor', () => ({
  getGlobalDarkWebMonitor: mockGetGlobalDarkWebMonitor,
}));

vi.mock('../../lib/rateLimiter', () => ({
  getRateLimiter: mockGetRateLimiter,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../../lib/toastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../../api/audit.service', () => ({
  AuditService: { logAction: vi.fn().mockResolvedValue(undefined) },
  AuditAction: {},
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
