import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  mockRange:       vi.fn().mockResolvedValue({ data: [], error: null }),
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
        // agent_logs: select().order().range() → mockRange
        // range() returns a vi.fn() with mockResolvedValue — a real Promise
        // fetchLogs may also call .eq() on range result; handled by mockRange.eq chaining
        return {
          select: () => ({
            order: () => ({
              range: mockRange,
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
  mockRange.mockResolvedValue({ data: logs, error: null });
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
    mockRange.mockResolvedValue({ data: [], error: null });
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
    mockRange.mockResolvedValue({ data: [], error: null });
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
    mockRange.mockResolvedValue({ data: logsWithProjError, error: null });
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
    mockRange.mockResolvedValue({ data: errorLogs, error: null });
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
    mockRange.mockResolvedValue({ data: manyLogs, error: null });
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
    mockRange.mockResolvedValue({ data: manyLogs, error: null });
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
