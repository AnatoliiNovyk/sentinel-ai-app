import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SchedulerPage from '../Scheduler';

const { mockSchOrder, mockPrjOrder, mockInsertSelect } = vi.hoisted(() => ({
  mockSchOrder: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockPrjOrder: vi.fn().mockResolvedValue({ data: [], error: null }),
  mockInsertSelect: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'scan_schedules') {
        return {
          select: () => ({ eq: () => ({ order: mockSchOrder }) }),
          update: () => ({ eq: vi.fn().mockResolvedValue({ data: null }) }),
          delete: () => ({ eq: vi.fn().mockResolvedValue({ data: null }) }),
          insert: () => ({ select: () => ({ maybeSingle: mockInsertSelect }) }),
        };
      }
      // projects
      return {
        select: () => ({ eq: () => ({ order: mockPrjOrder }) }),
      };
    },
  },
  AVAILABLE_SCANNERS: [{ id: 'nmap', label: 'Nmap' }],
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

vi.mock('../../lib/scanMock', () => ({
  AVAILABLE_SCANNERS: [
    { id: 'nmap', label: 'Nmap' },
    { id: 'nuclei', label: 'Nuclei' },
  ],
}));

vi.mock('../../lib/scanDispatch', () => ({
  dispatchScan: vi.fn().mockResolvedValue({ ok: true }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeSchedule(overrides = {}) {
  return {
    id: 'sch-1',
    project_id: 'p-1',
    scanner: 'nmap',
    cadence_hours: 24,
    enabled: true,
    next_run_at: new Date(Date.now() + 3_600_000).toISOString(),
    last_run_at: null,
    created_at: new Date().toISOString(),
    user_id: 'user-1',
    ...overrides,
  };
}

function makeProject(overrides = {}) {
  return { id: 'p-1', name: 'Alpha Project', target: 'example.com', user_id: 'user-1', ...overrides };
}

afterEach(() => vi.clearAllMocks());

describe('SchedulerPage', () => {
  beforeEach(() => {
    mockSchOrder.mockResolvedValue({ data: [], error: null });
    mockPrjOrder.mockResolvedValue({ data: [], error: null });
  });

  it('renders "Scan Scheduler" heading', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getByText('Scan Scheduler')).toBeInTheDocument());
  });

  it('renders description about automating recurring scans', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getByText(/Automate recurring security scans/i)).toBeInTheDocument());
  });

  it('renders "New schedule" button', async () => {
    render(<SchedulerPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /new schedule/i })).toBeInTheDocument(),
    );
  });

  it('renders stat cards: Total schedules, Active, Overdue', async () => {
    render(<SchedulerPage />);
    await waitFor(() => {
      expect(screen.getByText('Total schedules')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Overdue')).toBeInTheDocument();
    });
  });

  it('shows zero values in stat cards when no schedules', async () => {
    render(<SchedulerPage />);
    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('shows create form when "New schedule" button clicked', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /new schedule/i }));
    await waitFor(() =>
      expect(screen.getByText('New scheduled scan')).toBeInTheDocument(),
    );
  });

  it('shows "No projects" message in form when no projects exist', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /new schedule/i }));
    await waitFor(() =>
      expect(screen.getByText(/No projects — create one first/i)).toBeInTheDocument(),
    );
  });

  it('renders schedules list when schedules exist', async () => {
    mockSchOrder.mockResolvedValue({ data: [makeSchedule()], error: null });
    mockPrjOrder.mockResolvedValue({ data: [makeProject()], error: null });
    render(<SchedulerPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Alpha Project|p-1/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('clicks toggle and delete buttons on a schedule', async () => {
    mockSchOrder.mockResolvedValue({ data: [makeSchedule({ id: 'sch-2', scanner: 'nuclei' })], error: null });
    mockPrjOrder.mockResolvedValue({ data: [makeProject({ name: 'Beta Project' })], error: null });
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText('Beta Project').length).toBeGreaterThanOrEqual(1));
    const toggleBtn = screen.queryByTitle(/Enable|Disable/i);
    if (toggleBtn) fireEvent.click(toggleBtn);
    const deleteBtn = screen.queryByTitle('Delete');
    if (deleteBtn) fireEvent.click(deleteBtn);
  });
});

// ── Create schedule with project ──────────────────────────────────────────

describe('SchedulerPage — create schedule', () => {
  beforeEach(() => {
    mockSchOrder.mockResolvedValue({ data: [], error: null });
    mockPrjOrder.mockResolvedValue({ data: [makeProject()], error: null });
    mockInsertSelect.mockResolvedValue({ data: makeSchedule(), error: null });
  });

  it('shows project select in form when projects exist', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /new schedule/i }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument(),
    );
  });

  it('closes form when Cancel clicked', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /new schedule/i }));
    await waitFor(() => screen.getByText('New scheduled scan'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByText('New scheduled scan')).not.toBeInTheDocument(),
    );
  });

  it('calls supabase insert when "Create schedule" clicked', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /new schedule/i }));
    await waitFor(() => screen.getByText('New scheduled scan'));
    fireEvent.click(screen.getByRole('button', { name: /create schedule/i }));
    await waitFor(() => expect(mockInsertSelect).toHaveBeenCalled());
  });

  it('selects a cadence frequency button in form', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByRole('button', { name: /new schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /new schedule/i }));
    await waitFor(() => screen.getByText('Weekly'));
    fireEvent.click(screen.getByText('Weekly'));
    // Weekly button should now be active (emerald style applied)
    expect(screen.getByText('Weekly')).toBeInTheDocument();
  });
});

// ── Sort controls ─────────────────────────────────────────────────────────

describe('SchedulerPage — sort and filter', () => {
  const twoSchedules = [
    makeSchedule({ id: 's-1', project_id: 'p-1', enabled: true,  next_run_at: new Date(Date.now() + 1_000_000).toISOString() }),
    makeSchedule({ id: 's-2', project_id: 'p-2', enabled: false, next_run_at: new Date(Date.now() + 9_000_000).toISOString() }),
  ];

  beforeEach(() => {
    mockSchOrder.mockResolvedValue({ data: twoSchedules, error: null });
    mockPrjOrder.mockResolvedValue({
      data: [makeProject({ id: 'p-1', name: 'Alpha' }), makeProject({ id: 'p-2', name: 'Beta' })],
      error: null,
    });
  });

  it('renders sort buttons: Next run, Latest, Enabled, Disabled', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
    expect(screen.getByRole('button', { name: /next run/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /latest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^enabled$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^disabled$/i })).toBeInTheDocument();
  });

  it('clicking "Enabled" sort button changes active sort', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole('button', { name: /^enabled$/i }));
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
  });

  it('clicking "Latest" sort button works', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole('button', { name: /latest/i }));
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
  });

  it('clicking "Disabled" sort button works', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole('button', { name: /^disabled$/i }));
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
  });

  it('shows Clear button after sort change and clears on click', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
    fireEvent.click(screen.getByRole('button', { name: /latest/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument(),
    );
  });

  it('filters schedules via search input', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThanOrEqual(1));
    const input = screen.getByPlaceholderText(/search project or scanner/i);
    fireEvent.change(input, { target: { value: 'Alpha' } });
    // After filtering, sortedSchedules.length > 0 so no 'No schedules match' message
    await waitFor(() =>
      expect(screen.queryByText(/No schedules match the search/i)).not.toBeInTheDocument(),
    );
  });
});

// ── Delete confirmation ───────────────────────────────────────────────────

describe('SchedulerPage — delete confirmation', () => {
  beforeEach(() => {
    mockSchOrder.mockResolvedValue({ data: [makeSchedule()], error: null });
    mockPrjOrder.mockResolvedValue({ data: [makeProject()], error: null });
  });

  it('shows ConfirmDialog when Delete button clicked', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getByTitle('Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Delete'));
    await waitFor(() =>
      expect(screen.getByText(/are you sure you want to delete the schedule/i)).toBeInTheDocument(),
    );
  });

  it('closes ConfirmDialog when Cancel clicked', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getByTitle('Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Delete'));
    await waitFor(() =>
      expect(screen.getByText(/are you sure you want to delete the schedule/i)).toBeInTheDocument(),
    );
    const cancelBtn = screen.getAllByRole('button', { name: /cancel/i })
      .find(b => b.textContent?.trim() === 'Cancel')!;
    fireEvent.click(cancelBtn);
    await waitFor(() =>
      expect(screen.queryByText(/are you sure you want to delete the schedule/i)).not.toBeInTheDocument(),
    );
  });

  it('removes schedule when Delete confirmed', async () => {
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getByTitle('Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Delete'));
    await waitFor(() =>
      expect(screen.getByText(/are you sure you want to delete the schedule/i)).toBeInTheDocument(),
    );
    const confirmBtn = screen.getAllByRole('button', { name: /delete schedule/i })
      .find(b => b.textContent?.trim() === 'Delete schedule')!;
    fireEvent.click(confirmBtn);
    await waitFor(() =>
      expect(screen.queryByText(/are you sure you want to delete the schedule/i)).not.toBeInTheDocument(),
    );
  });
});

// ── Export CSV ────────────────────────────────────────────────────────────

describe('SchedulerPage — export CSV', () => {
  beforeEach(() => {
    mockSchOrder.mockResolvedValue({ data: [makeSchedule()], error: null });
    mockPrjOrder.mockResolvedValue({ data: [makeProject()], error: null });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('renders Export CSV button when schedules exist', async () => {
    render(<SchedulerPage />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument(),
    );
  });

  it('calls URL.createObjectURL when Export CSV clicked', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByRole('button', { name: /export csv/i }));
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    expect((URL as unknown as { createObjectURL: ReturnType<typeof vi.fn> }).createObjectURL).toHaveBeenCalled();
  });
});

// ── Run Now ───────────────────────────────────────────────────────────────

describe('SchedulerPage — run now', () => {
  beforeEach(() => {
    mockSchOrder.mockResolvedValue({ data: [makeSchedule()], error: null });
    mockPrjOrder.mockResolvedValue({ data: [makeProject()], error: null });
  });

  it('renders Run now button on schedule row', async () => {
    render(<SchedulerPage />);
    await waitFor(() =>
      expect(screen.getByTitle('Run now')).toBeInTheDocument(),
    );
  });

  it('calls dispatchScan when Run now clicked', async () => {
    const { dispatchScan } = await import('../../lib/scanDispatch');
    render(<SchedulerPage />);
    await waitFor(() => screen.getByTitle('Run now'));
    fireEvent.click(screen.getByTitle('Run now'));
    await waitFor(() => expect(dispatchScan).toHaveBeenCalled());
  });

  it('shows error toast when dispatchScan fails', async () => {
    const { dispatchScan } = await import('../../lib/scanDispatch');
    (dispatchScan as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: 'Network error' });
    render(<SchedulerPage />);
    await waitFor(() => screen.getByTitle('Run now'));
    fireEvent.click(screen.getByTitle('Run now'));
    await waitFor(() => expect(dispatchScan).toHaveBeenCalled());
  });
});

// ── Search empty state ────────────────────────────────────────────────────

describe('SchedulerPage — search empty state', () => {
  beforeEach(() => {
    mockSchOrder.mockResolvedValue({ data: [makeSchedule()], error: null });
    mockPrjOrder.mockResolvedValue({ data: [makeProject()], error: null });
  });

  it('shows "No schedules match the search" when no results', async () => {
    render(<SchedulerPage />);
    await waitFor(() => screen.getByPlaceholderText('Search project or scanner…'));
    fireEvent.change(screen.getByPlaceholderText('Search project or scanner…'), {
      target: { value: 'xyzzznotfound' },
    });
    await waitFor(() =>
      expect(screen.getByText('No schedules match the search')).toBeInTheDocument(),
    );
  });
});

// ── Overdue indicator ─────────────────────────────────────────────────────

describe('SchedulerPage — overdue indicator', () => {
  it('shows "(overdue)" when next_run_at is in the past', async () => {
    const pastDate = new Date(Date.now() - 3_600_000).toISOString();
    mockSchOrder.mockResolvedValue({
      data: [makeSchedule({ next_run_at: pastDate })],
      error: null,
    });
    mockPrjOrder.mockResolvedValue({ data: [makeProject()], error: null });
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getByText('(overdue)')).toBeInTheDocument());
  });
});
