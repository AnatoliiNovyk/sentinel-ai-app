import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ActivityPage from '../Activity';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const { mockDownloadFile } = vi.hoisted(() => ({
  mockDownloadFile: vi.fn(),
}));
vi.mock('../../lib/exporters', () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
}));

vi.mock('../../context/useAuth', () => {
  // Stable reference: prevents useCallback/useEffect re-firing on every render
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

// All mock fns hoisted so vi.mock factories can reference them
const {
  mockRange,
  mockProjectsEq,
  mockChannel,
  mockRemoveChannel,
} = vi.hoisted(() => ({
  mockRange:       vi.fn().mockReturnValue({ data: [], error: null }),
  mockProjectsEq:  vi.fn().mockResolvedValue({ data: [], error: null }),
  mockChannel:     vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
  mockRemoveChannel: vi.fn(),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: (table: string) => {
        if (table === 'projects') {
          return { select: () => ({ eq: mockProjectsEq }) };
        }
        // agent_logs: select().order().range().eq?().eq?() → chainable thenable
        return {
          select: () => ({
            order: () => ({
              range: (...args: unknown[]) => {
                const result = mockRange(...args); // sync, returns { data, error }
                const chain: {
                  eq: (..._: unknown[]) => typeof chain;
                  then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
                  catch: (fn: (e: unknown) => unknown) => Promise<unknown>;
                  finally: (fn: () => void) => Promise<unknown>;
                } = {
                  eq: (..._: unknown[]) => chain,
                  then: (resolve, reject?) => Promise.resolve(result).then(resolve, reject),
                  catch: (fn) => Promise.resolve(result).catch(fn),
                  finally: (fn) => Promise.resolve(result).finally(fn),
                };
                return chain;
              },
            }),
          }),
        };
      },
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    },
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

const MOCK_LOGS = [
  {
    id: 'log-1',
    user_id: 'user-1',
    project_id: 'proj-1',
    scan_id: 'scan-abc123',
    level: 'info',
    message: 'Scan started for target example.com',
    created_at: new Date().toISOString(),
  },
  {
    id: 'log-2',
    user_id: 'user-1',
    project_id: null,
    scan_id: null,
    level: 'error',
    message: 'Edge function unreachable',
    created_at: new Date().toISOString(),
  },
  {
    id: 'log-3',
    user_id: 'user-1',
    project_id: 'proj-1',
    scan_id: null,
    level: 'success',
    message: 'Scan completed successfully',
    created_at: new Date().toISOString(),
  },
];

const MOCK_PROJECTS = [
  { id: 'proj-1', name: 'Alpha Project', user_id: 'user-1', org_id: 'org-1', description: '', target: 'example.com', environment: 'external', created_at: '2026-01-01T00:00:00Z', tags: [], risk_score: 0 },
];

function setupMocks(logs = MOCK_LOGS) {
  mockRange.mockReturnValue({ data: logs, error: null });
  mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
}

beforeEach(() => {
  setupMocks();
});


// ── Tests ─────────────────────────────────────────────────────────────────

describe('Activity — layout', () => {
  it('renders "Activity Log" heading', async () => {
    render(<ActivityPage />);
    expect(await screen.findByText('Activity Log')).toBeInTheDocument();
  });

  it('renders Logs and Anomalies tab buttons', async () => {
    render(<ActivityPage />);
    expect(await screen.findByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Anomalies')).toBeInTheDocument();
  });

  it('renders stat cards for log levels', async () => {
    render(<ActivityPage />);
    expect(await screen.findByText('Activity Log')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warn')).toBeInTheDocument();
  });
});

describe('Activity — log entries', () => {
  it('renders log messages from supabase', async () => {
    render(<ActivityPage />);
    expect(await screen.findByText('Scan started for target example.com')).toBeInTheDocument();
    expect(screen.getByText('Edge function unreachable')).toBeInTheDocument();
  });

  it('renders level badge for each log entry', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    const infoBadges = screen.getAllByText('info');
    expect(infoBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders scan id for logs that have scan_id', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    expect(screen.getByText('scan:scan-a')).toBeInTheDocument();
  });

  it('shows empty state message when no logs match filters', async () => {
    mockRange.mockReturnValue({ data: [], error: null });
    render(<ActivityPage />);
    expect(await screen.findByText('No log entries match your filters')).toBeInTheDocument();
  });
});

describe('Activity — filters', () => {
  it('toggle Filters button shows/hides filter panel', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    const filterBtn = screen.getByTitle('Toggle filters');
    fireEvent.click(filterBtn);
    expect(await screen.findByText('All levels')).toBeInTheDocument();
  });

  it('Auto-refresh toggle button shows Live state by default', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('Export CSV button appears when logs are loaded', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    expect(screen.getByTitle('Export filtered logs as CSV')).toBeInTheDocument();
  });
});

describe('Activity — tab switching', () => {
  it('clicking Anomalies tab switches view', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByText('Anomalies'));
    expect(screen.queryByText('Scan started for target example.com')).not.toBeInTheDocument();
  });
});

describe('Activity — exportCsv function', () => {
  it('Export CSV button click calls downloadFile', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    const csvBtn = screen.getByTitle('Export filtered logs as CSV');
    fireEvent.click(csvBtn);
    expect(mockDownloadFile).toHaveBeenCalled();
  });
});

// ── Anomaly tab ───────────────────────────────────────────────────────────────

describe('Activity — anomaly tab', () => {
  it('shows "No log data to analyze" when no logs exist', async () => {
    mockRange.mockReturnValue({ data: [], error: null });
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('No log data to analyze')).toBeInTheDocument(),
    );
  });

  it('renders "Detected Anomalies" heading in anomaly tab with logs', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('Detected Anomalies')).toBeInTheDocument(),
    );
  });

  it('shows "No anomalies detected" for small log set without patterns', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText(/No anomalies detected in current log sample/i)).toBeInTheDocument(),
    );
  });

  it('renders 7-Day Hourly Activity Heatmap in anomaly tab', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('7-Day Hourly Activity Heatmap')).toBeInTheDocument(),
    );
  });

  it('shows "Errors by Project" when error logs with project_id exist', async () => {
    const logsWithProjError = [
      ...MOCK_LOGS,
      {
        id: 'log-err-proj',
        user_id: 'user-1',
        project_id: 'proj-1',
        scan_id: null,
        level: 'error',
        message: 'Critical project error',
        created_at: new Date().toISOString(),
      },
    ];
    mockRange.mockReturnValue({ data: logsWithProjError, error: null });
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    render(<ActivityPage />);
    await screen.findByText('Critical project error');
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('Errors by Project')).toBeInTheDocument(),
    );
  });

  it('shows "Top Error Patterns" when multiple repeated error messages exist', async () => {
    const errorLogs = Array.from({ length: 6 }, (_, i) => ({
      id: `err-${i}`,
      user_id: 'user-1',
      project_id: null,
      scan_id: null,
      level: 'error',
      message: 'Repeated edge function error',
      created_at: new Date().toISOString(),
    }));
    mockRange.mockReturnValue({ data: errorLogs, error: null });
    render(<ActivityPage />);
    await waitFor(() =>
      expect(screen.getAllByText('Repeated edge function error').length).toBeGreaterThanOrEqual(1),
    );
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('Top Error Patterns')).toBeInTheDocument(),
    );
  });
});

// ── Search and filter ─────────────────────────────────────────────────────────

describe('Activity — search and filter interactions', () => {
  it('search input filters displayed log messages', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    fireEvent.change(screen.getByPlaceholderText('Search logs…'), {
      target: { value: 'Edge function' },
    });
    await waitFor(() => {
      expect(screen.getByText('Edge function unreachable')).toBeInTheDocument();
      expect(screen.queryByText('Scan started for target example.com')).not.toBeInTheDocument();
    });
  });

  it('stat card "Error" click sets level filter (re-fetches)', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    const callsBefore = mockRange.mock.calls.length;
    fireEvent.click(screen.getByText('Error'));
    // re-fetch is triggered — mockRange should be called again
    await waitFor(() =>
      expect(mockRange.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('level filter pill in filter panel triggers re-fetch', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByTitle('Toggle filters'));
    await screen.findByText('All levels');
    const callsBefore = mockRange.mock.calls.length;
    // Click "error" level pill
    const errorPill = screen.getAllByRole('button', { name: /^error$/i }).find(
      b => b.classList.contains('rounded-full'),
    );
    if (errorPill) fireEvent.click(errorPill);
    await waitFor(() =>
      expect(mockRange.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('auto-refresh toggle switches to Paused state', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByTitle('Pause live updates'));
    await waitFor(() => expect(screen.getByText('Paused')).toBeInTheDocument());
  });

  it('re-enable auto-refresh toggles back to Live', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByTitle('Pause live updates'));
    await waitFor(() => screen.getByText('Paused'));
    fireEvent.click(screen.getByTitle('Enable live updates'));
    await waitFor(() => expect(screen.getByText('Live')).toBeInTheDocument());
  });

  it('project filter dropdown shows project options', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByTitle('Toggle filters'));
    await waitFor(() => {
      const select = screen.getByTitle('Filter by project');
      expect(select).toBeInTheDocument();
    });
    await waitFor(() =>
      expect(screen.getAllByText('Alpha Project').length).toBeGreaterThanOrEqual(1),
    );
  });

  it('project filter dropdown onChange selects a project and resets page', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByTitle('Toggle filters'));
    await waitFor(() => screen.getByTitle('Filter by project'));
    await waitFor(() =>
      expect(screen.getAllByText('Alpha Project').length).toBeGreaterThanOrEqual(1),
    );
    const select = screen.getByTitle('Filter by project');
    const callsBefore = mockRange.mock.calls.length;
    fireEvent.change(select, { target: { value: 'proj-1' } });
    await waitFor(() =>
      expect(mockRange.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('clicking Logs tab when on Anomalies tab switches back to logs view', async () => {
    render(<ActivityPage />);
    await screen.findByText('Activity Log');
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.queryByText('Scan started for target example.com')).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText('Logs'));
    await waitFor(() =>
      expect(screen.getByText('Scan started for target example.com')).toBeInTheDocument(),
    );
  });
});

// ── Load more and navigation ──────────────────────────────────────────────────

describe('Activity — load more and navigation', () => {
  it('shows "Load more" button when PAGE_SIZE+1 items returned', async () => {
    const manyLogs = Array.from({ length: 51 }, (_, i) => ({
      id: `log-bulk-${i}`,
      user_id: 'user-1',
      project_id: null,
      scan_id: null,
      level: 'info',
      message: `Bulk log entry ${i}`,
      created_at: new Date().toISOString(),
    }));
    mockRange.mockReturnValue({ data: manyLogs, error: null });
    render(<ActivityPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument(),
    );
  });

  it('clicking "Load more" triggers additional fetch', async () => {
    const manyLogs = Array.from({ length: 51 }, (_, i) => ({
      id: `log-bulk-${i}`,
      user_id: 'user-1',
      project_id: null,
      scan_id: null,
      level: 'info',
      message: `Bulk log entry ${i}`,
      created_at: new Date().toISOString(),
    }));
    mockRange.mockReturnValue({ data: manyLogs, error: null });
    render(<ActivityPage />);
    await waitFor(() => screen.getByRole('button', { name: /load more/i }));
    const callsBefore = mockRange.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    await waitFor(() =>
      expect(mockRange.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('clicking project link in log row calls navigate', async () => {
    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');
    const projectBtn = screen.getAllByTitle('Open project')[0];
    fireEvent.click(projectBtn);
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/projects'));
  });
});

// ── Additional anomaly coverage ───────────────────────────────────────────────

describe('Activity — anomaly edge cases', () => {
  beforeEach(() => {
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    mockChannel.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    });
    vi.clearAllMocks();
    mockProjectsEq.mockResolvedValue({ data: MOCK_PROJECTS, error: null });
    mockChannel.mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    });
  });

  it('shows error spike anomaly when one hour has many more errors than average', async () => {
    const now = new Date();
    const makeError = (hoursAgo: number, id: string) => ({
      id,
      user_id: 'user-1',
      project_id: null,
      scan_id: null,
      level: 'error',
      message: `Error in spike ${id}`,
      created_at: new Date(now.getTime() - hoursAgo * 3600000).toISOString(),
    });
    // 20 errors in hour 0, 1 error in each of 9 other hours
    // counts=[20,1,1,...,1] → mean=2.9, std≈5.7 → 20 > mean+2σ=14.3 ✓ AND ≥3 ✓
    const spikeLogs = [
      ...Array.from({ length: 20 }, (_, i) => makeError(0, `spike-now-${i}`)),
      ...Array.from({ length: 9 }, (_, i) => makeError(i + 2, `baseline-h${i + 2}`)),
    ];
    mockRange.mockReturnValue({ data: spikeLogs, error: null });
    render(<ActivityPage />);
    await waitFor(() =>
      expect(screen.getAllByText(/Error in spike/i).length).toBeGreaterThanOrEqual(1),
    );
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('Error spike detected')).toBeInTheDocument(),
    );
  });

  it('shows elevated warning rate anomaly when >40% of recent logs are warnings', async () => {
    const now = new Date();
    // 10+ logs in last 6h with >40% being warns
    const warnLogs = Array.from({ length: 6 }, (_, i) => ({
      id: `warn-${i}`,
      user_id: 'user-1',
      project_id: null,
      scan_id: null,
      level: 'warn',
      message: `Warning event ${i}`,
      created_at: new Date(now.getTime() - i * 600000).toISOString(), // recent
    }));
    const otherLogs = Array.from({ length: 4 }, (_, i) => ({
      id: `info-${i}`,
      user_id: 'user-1',
      project_id: null,
      scan_id: null,
      level: 'info',
      message: `Info event ${i}`,
      created_at: new Date(now.getTime() - i * 600000).toISOString(),
    }));
    mockRange.mockReturnValue({ data: [...warnLogs, ...otherLogs], error: null });
    render(<ActivityPage />);
    await waitFor(() =>
      expect(screen.getAllByText(/Warning event|Info event/i).length).toBeGreaterThanOrEqual(1),
    );
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('Elevated warning rate')).toBeInTheDocument(),
    );
  });
});

// ── Date group label coverage ─────────────────────────────────────────────────

describe('Activity — date grouping labels', () => {
  it('groups logs created yesterday under "Yesterday" label', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const logsYesterday = [
      {
        id: 'log-yest',
        user_id: 'user-1',
        project_id: null,
        scan_id: null,
        level: 'info',
        message: 'Yesterday log entry',
        created_at: yesterday.toISOString(),
      },
    ];
    mockRange.mockReturnValue({ data: logsYesterday, error: null });
    render(<ActivityPage />);
    expect(await screen.findByText('Yesterday log entry')).toBeInTheDocument();
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('groups logs older than yesterday under weekday+date label', async () => {
    const olderDate = new Date();
    olderDate.setDate(olderDate.getDate() - 5);
    const logsOld = [
      {
        id: 'log-old',
        user_id: 'user-1',
        project_id: null,
        scan_id: null,
        level: 'warn',
        message: 'Old activity log entry',
        created_at: olderDate.toISOString(),
      },
    ];
    mockRange.mockReturnValue({ data: logsOld, error: null });
    render(<ActivityPage />);
    expect(await screen.findByText('Old activity log entry')).toBeInTheDocument();
    // Should show neither Today nor Yesterday for a 5-days-old log
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
  });
});

describe('Activity — loading and realtime callbacks', () => {
  it('renders anomalies heatmap for info-only logs (no error/warn)', async () => {
    const infoOnlyLogs = [
      {
        id: 'log-info-only',
        user_id: 'user-1',
        project_id: null,
        scan_id: null,
        level: 'info',
        message: 'Only informational activity',
        created_at: new Date().toISOString(),
      },
    ];
    mockRange.mockReturnValue({ data: infoOnlyLogs, error: null });

    render(<ActivityPage />);
    await screen.findByText('Only informational activity');
    fireEvent.click(screen.getByText('Anomalies'));
    await waitFor(() =>
      expect(screen.getByText('7-Day Hourly Activity Heatmap')).toBeInTheDocument(),
    );
  });

  it('shows "Analyzing anomalies…" when switching to anomalies tab while loading', async () => {
    let resolveLogs: ((value: { data: unknown[]; error: null }) => void) | null = null;
    mockRange.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogs = resolve;
        }),
    );

    render(<ActivityPage />);
    fireEvent.click(screen.getByText('Anomalies'));
    expect(screen.getByText(/Analyzing anomalies/i)).toBeInTheDocument();

    // Resolve pending fetch to avoid leaving a hanging promise in test environment.
    resolveLogs!({ data: [], error: null });
  });

  it('prepends new log from realtime INSERT channel callback', async () => {
    const onMock = vi.fn().mockReturnThis();
    const subscribeMock = vi.fn().mockReturnThis();
    mockChannel.mockReturnValue({ on: onMock, subscribe: subscribeMock });

    render(<ActivityPage />);
    await screen.findByText('Scan started for target example.com');

    const insertHandler = onMock.mock.calls.find(
      (call) => call[0] === 'postgres_changes',
    )?.[2] as ((payload: { new: unknown }) => void) | undefined;

    expect(insertHandler).toBeDefined();

    await act(async () => {
      insertHandler?.({
        new: {
          id: 'log-live-1',
          user_id: 'user-1',
          project_id: null,
          scan_id: null,
          level: 'info',
          message: 'Realtime inserted log',
          created_at: new Date().toISOString(),
        },
      });
    });

    expect(screen.getByText('Realtime inserted log')).toBeInTheDocument();
  });
});

