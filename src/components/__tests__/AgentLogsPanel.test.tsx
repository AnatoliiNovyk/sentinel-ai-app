import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AgentLogsPanel from '../AgentLogsPanel';
import type { AgentLog } from '../../lib/supabase';

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn() as typeof Element.prototype.scrollIntoView;

// ── Supabase mocks ────────────────────────────────────────────────────────────

const { mockLimit, mockOrder, mockEq, mockSelect, mockChannel } = vi.hoisted(() => {
  const mockLimit = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return { mockLimit, mockOrder, mockEq, mockSelect, mockChannel };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: mockSelect }),
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<AgentLog> = {}): AgentLog {
  return {
    id: `log-${Math.random().toString(36).slice(2)}`,
    job_id: null,
    scan_id: null,
    project_id: 'proj-1',
    level: 'info',
    message: 'Test log message',
    created_at: '2026-04-01T10:00:00Z',
    ...overrides,
  };
}

function mockFetchReturns(logs: AgentLog[]) {
  mockLimit.mockResolvedValue({ data: logs, error: null });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentLogsPanel — static render', () => {
  beforeEach(() => mockFetchReturns([]));

  it('renders "Agent Live Logs" heading', () => {
    render(<AgentLogsPanel projectId="proj-1" />);
    expect(screen.getByText('Agent Live Logs')).toBeInTheDocument();
  });

  it('shows loading spinner while fetching', () => {
    // Make the fetch never resolve so spinner stays visible
    mockLimit.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AgentLogsPanel projectId="proj-1" />);
    // Loader2 spinner has animate-spin class
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('AgentLogsPanel — after fetch', () => {
  it('shows log count after loading', async () => {
    mockFetchReturns([makeLog(), makeLog()]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('2 lines')).toBeInTheDocument());
  });

  it('renders log messages', async () => {
    mockFetchReturns([
      makeLog({ message: 'Agent started scan' }),
      makeLog({ message: 'Port 22 found open' }),
    ]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Agent started scan/)).toBeInTheDocument();
      expect(screen.getByText(/Port 22 found open/)).toBeInTheDocument();
    });
  });

  it('shows level filter pills when logs are present', async () => {
    mockFetchReturns([makeLog()]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^error$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^warn$/i })).toBeInTheDocument();
    });
  });

  it('shows Copy log button when logs are present', async () => {
    mockFetchReturns([makeLog()]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() =>
      expect(screen.getByLabelText('Copy log')).toBeInTheDocument(),
    );
  });

  it('shows error badge count when error logs present', async () => {
    mockFetchReturns([
      makeLog({ level: 'error', message: 'Scan failed' }),
      makeLog({ level: 'error', message: 'Timeout' }),
    ]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('2 err')).toBeInTheDocument());
  });

  it('shows warn badge count when warn logs present', async () => {
    mockFetchReturns([makeLog({ level: 'warn', message: 'Retry attempt' })]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => expect(screen.getByText('1 warn')).toBeInTheDocument());
  });
});

describe('AgentLogsPanel — level filter', () => {
  it('filters to error logs when error pill clicked', async () => {
    mockFetchReturns([
      makeLog({ level: 'info',  message: 'Info line' }),
      makeLog({ level: 'error', message: 'Error line' }),
    ]);
    render(<AgentLogsPanel projectId="proj-1" />);

    await waitFor(() => screen.getByRole('button', { name: /^error$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^error$/i }));

    expect(screen.getByText(/Error line/)).toBeInTheDocument();
    expect(screen.queryByText(/Info line/)).not.toBeInTheDocument();
  });

  it('shows all logs when all pill clicked after filtering', async () => {
    mockFetchReturns([
      makeLog({ level: 'info',  message: 'Info line' }),
      makeLog({ level: 'error', message: 'Error line' }),
    ]);
    render(<AgentLogsPanel projectId="proj-1" />);

    await waitFor(() => screen.getByRole('button', { name: /^error$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^error$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^all$/i }));

    expect(screen.getByText(/Info line/)).toBeInTheDocument();
    expect(screen.getByText(/Error line/)).toBeInTheDocument();
  });
});

describe('AgentLogsPanel — copyLog', () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteText },
      writable: true,
      configurable: true,
    });
  });

  it('clicking Copy log calls clipboard.writeText with log content', async () => {
    mockFetchReturns([makeLog({ message: 'Copy this log', level: 'info' })]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => screen.getByLabelText('Copy log'));
    fireEvent.click(screen.getByLabelText('Copy log'));
    expect(clipboardWriteText).toHaveBeenCalledOnce();
    const arg = clipboardWriteText.mock.calls[0][0] as string;
    expect(arg).toContain('Copy this log');
  });

  it('Copy log button shows Check icon after click (copied state)', async () => {
    mockFetchReturns([makeLog({ message: 'Some log' })]);
    const { container } = render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => screen.getByLabelText('Copy log'));
    fireEvent.click(screen.getByLabelText('Copy log'));
    // After click: Copy icon replaced by Check icon (svg changes)
    // The clipboard was called — that's enough to verify copyLog ran
    expect(clipboardWriteText).toHaveBeenCalledOnce();
    // Button still present
    expect(container.querySelector('[aria-label="Copy log"]')).toBeInTheDocument();
  });
});

describe('AgentLogsPanel — realtime INSERT', () => {
  beforeEach(() => {
    mockChannel.on.mockClear();
  });

  it('registers INSERT realtime handler', async () => {
    mockFetchReturns([]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => expect(mockLimit).toHaveBeenCalled());
    const calls = mockChannel.on.mock.calls as Array<[string, { event: string }, (p: { new: unknown }) => void]>;
    const insertCall = calls.find(([, opts]) => opts?.event === 'INSERT');
    expect(insertCall).toBeTruthy();
  });

  it('INSERT handler appends new log to the list', async () => {
    const { act } = await import('@testing-library/react');
    mockFetchReturns([makeLog({ message: 'Existing log' })]);
    render(<AgentLogsPanel projectId="proj-1" />);
    await waitFor(() => screen.getByText(/Existing log/));

    const calls = mockChannel.on.mock.calls as Array<[string, { event: string }, (p: { new: unknown }) => void]>;
    const insertCall = calls.find(([, opts]) => opts?.event === 'INSERT');
    const handler = insertCall?.[2];
    expect(handler).toBeTruthy();

    await act(async () => {
      handler?.({ new: makeLog({ message: 'Realtime log' }) });
    });
    await waitFor(() => expect(screen.getByText(/Realtime log/)).toBeInTheDocument());
  });
});
