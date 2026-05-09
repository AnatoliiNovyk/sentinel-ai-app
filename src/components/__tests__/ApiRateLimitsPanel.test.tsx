import { act } from '@testing-library/react';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ApiRateLimitsPanel } from '../ApiRateLimitsPanel';

// ── rateLimitService mocks ────────────────────────────────────────────────────

const { mockGetRateLimitConfig, mockGetCurrentUsage } = vi.hoisted(() => ({
  mockGetRateLimitConfig: vi.fn(),
  mockGetCurrentUsage: vi.fn(),
}));

vi.mock('../../lib/rateLimitService', () => ({
  getRateLimitConfig: mockGetRateLimitConfig,
  getCurrentUsage: mockGetCurrentUsage,
}));

const FREE_LIMITS = {
  scans_per_month: 10,
  reports_per_day: 5,
  chat_messages_per_hour: 20,
  api_calls_per_second: 1,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(async () => {
  // Flush any pending async state updates to prevent act() warnings
  await act(async () => {});
});

describe('ApiRateLimitsPanel — loading state', () => {
  beforeEach(() => {
    // Never resolve so loading stays visible
    mockGetRateLimitConfig.mockReturnValue(new Promise(() => {}));
    mockGetCurrentUsage.mockResolvedValue(0);
  });

  it('shows "Loading rate limit information..." while fetching', async () => {
    await act(async () => {
      render(<ApiRateLimitsPanel userId="user-1" planId="free" />);
    });
    expect(screen.getByText(/Loading rate limit information/i)).toBeInTheDocument();
  });
});

describe('ApiRateLimitsPanel — loaded state', () => {
  beforeEach(() => {
    mockGetRateLimitConfig.mockResolvedValue(FREE_LIMITS);
    mockGetCurrentUsage.mockResolvedValue(0);
  });

  it('shows "API Rate Limits" heading after load', async () => {
    render(<ApiRateLimitsPanel userId="user-1" planId="free" />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /API Rate Limits/i })).toBeInTheDocument(),
    );
  });

  it('shows the plan id', async () => {
    render(<ApiRateLimitsPanel userId="user-1" planId="basic" />);
    mockGetRateLimitConfig.mockResolvedValue({
      scans_per_month: 100,
      reports_per_day: 50,
      chat_messages_per_hour: 100,
      api_calls_per_second: 5,
    });
    await waitFor(() => expect(screen.getByText(/basic/i)).toBeInTheDocument());
  });

  it('renders all 4 metric labels', async () => {
    render(<ApiRateLimitsPanel userId="user-1" planId="free" />);
    await waitFor(() => {
      expect(screen.getByText('Scans/Month')).toBeInTheDocument();
      expect(screen.getByText('Reports/Day')).toBeInTheDocument();
      expect(screen.getByText('Chat/Hour')).toBeInTheDocument();
      expect(screen.getByText('API/Sec')).toBeInTheDocument();
    });
  });

  it('renders usage description text for each metric', async () => {
    render(<ApiRateLimitsPanel userId="user-1" planId="free" />);
    await waitFor(() => {
      expect(screen.getByText('Vulnerability scans executed')).toBeInTheDocument();
      expect(screen.getByText('Security reports generated')).toBeInTheDocument();
    });
  });

  it('shows current/limit usage numbers', async () => {
    mockGetCurrentUsage.mockResolvedValue(3);
    render(<ApiRateLimitsPanel userId="user-1" planId="free" />);
    await waitFor(() => {
      // usage (3) and limit (10) render in separate <span> elements
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/\/\s*10/).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('ApiRateLimitsPanel — warning state', () => {
  it('shows AlertCircle icon when metric is exceeded', async () => {
    mockGetRateLimitConfig.mockResolvedValue(FREE_LIMITS);
    // Return usage >= limit for first metric call (scans_per_month = 10, usage = 10 → exceeded)
    mockGetCurrentUsage.mockResolvedValue(10);

    const { container } = render(<ApiRateLimitsPanel userId="user-1" planId="free" />);
    await waitFor(() =>
      // When exceeded, a red-bordered card appears
      expect(container.querySelector('[class*="red-500"]')).toBeInTheDocument(),
    );
  });

  it('shows nearing-limit warning when usage is above 75% but below limit', async () => {
    mockGetRateLimitConfig.mockResolvedValue(FREE_LIMITS);
    mockGetCurrentUsage
      .mockResolvedValueOnce(8) // scans_per_month: 8/10 = 80%
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    render(<ApiRateLimitsPanel userId="user-1" planId="free" />);

    await waitFor(() =>
      expect(screen.getByText(/Nearing limit\. Consider upgrading your plan\./i)).toBeInTheDocument(),
    );
  });
});

describe('ApiRateLimitsPanel — usage calls and plan CTA', () => {
  beforeEach(() => {
    mockGetRateLimitConfig.mockResolvedValue(FREE_LIMITS);
    mockGetCurrentUsage.mockResolvedValue(0);
  });

  it('calls getCurrentUsage for all 4 metric keys with the current user id', async () => {
    const callsBefore = mockGetCurrentUsage.mock.calls.length;
    render(<ApiRateLimitsPanel userId="user-42" planId="free" />);

    await waitFor(() =>
      expect(mockGetCurrentUsage.mock.calls.length).toBe(callsBefore + 4),
    );

    expect(mockGetCurrentUsage).toHaveBeenCalledWith('user-42', 'scans_per_month');
    expect(mockGetCurrentUsage).toHaveBeenCalledWith('user-42', 'reports_per_day');
    expect(mockGetCurrentUsage).toHaveBeenCalledWith('user-42', 'chat_messages_per_hour');
    expect(mockGetCurrentUsage).toHaveBeenCalledWith('user-42', 'api_calls_per_second');
  });

  it('shows upgrade CTA for free plan', async () => {
    render(<ApiRateLimitsPanel userId="user-1" planId="free" />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /View Plans/i })).toBeInTheDocument(),
    );
  });

  it('shows upgrade CTA for basic plan', async () => {
    render(<ApiRateLimitsPanel userId="user-1" planId="basic" />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /View Plans/i })).toBeInTheDocument(),
    );
  });

  it('hides upgrade CTA for non-free/basic plans', async () => {
    render(<ApiRateLimitsPanel userId="user-1" planId="pro" />);

    await waitFor(() =>
      expect(screen.queryByRole('link', { name: /View Plans/i })).not.toBeInTheDocument(),
    );
  });
});
