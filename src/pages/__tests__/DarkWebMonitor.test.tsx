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

describe('OsintAnalyzer (DarkWebMonitor)', () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 });
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
