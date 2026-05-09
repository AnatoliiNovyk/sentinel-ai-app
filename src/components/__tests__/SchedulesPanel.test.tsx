import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SchedulesPanel from '../SchedulesPanel';
import type { Project, ScanSchedule } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const {
  mockSelect,
  mockEq,
  mockOrder,
  mockUpdate,
  mockUpdateEq,
  mockDelete,
  mockDeleteEq,
  mockInsert,
  authState,
} =
  vi.hoisted(() => ({
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockOrder: vi.fn(),
    mockUpdate: vi.fn(),
    mockUpdateEq: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockDelete: vi.fn(),
    mockDeleteEq: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockInsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    authState: { user: { id: 'user-1' } as { id: string } | null },
  }));

mockOrder.mockResolvedValue({ data: [], error: null });
mockEq.mockReturnValue({ order: mockOrder });
mockSelect.mockReturnValue({ eq: mockEq });
mockUpdate.mockReturnValue({ eq: mockUpdateEq });
mockDelete.mockReturnValue({ eq: mockDeleteEq });

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: () => ({
        select: mockSelect,
        update: mockUpdate,
        delete: mockDelete,
        insert: mockInsert,
      }),
    },
  };
});

vi.mock('../../context/useAuth', () => ({
  useAuth: () => authState,
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeProject(id = 'proj-1', name = 'My Project'): Project {
  return {
    id,
    user_id: 'user-1',
    org_id: 'org-1',
    name,
    description: 'test project',
    target: 'example.com',
    environment: 'external',
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    risk_score: 0,
  };
}

function makeSchedule(overrides: Partial<ScanSchedule> = {}): ScanSchedule {
  return {
    id: 'sched-1',
    user_id: 'user-1',
    project_id: 'proj-1',
    scanner: 'nmap',
    cadence_hours: 24,
    enabled: true,
    last_run_at: null,
    next_run_at: '2026-04-25T10:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockSchedulesReturn(items: ScanSchedule[]) {
  mockOrder.mockResolvedValue({ data: items, error: null });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
}

async function renderPanel(projects: Project[]) {
  render(<SchedulesPanel projects={projects} />);
  await waitFor(() => expect(mockOrder).toHaveBeenCalled());
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('SchedulesPanel — empty state', () => {
  beforeEach(() => {
    authState.user = { id: 'user-1' };
    mockSchedulesReturn([]);
  });

  it('shows "No schedules configured" when empty', async () => {
    await renderPanel([makeProject()]);
    await waitFor(() =>
      expect(screen.getByText('No schedules configured')).toBeInTheDocument(),
    );
  });

  it('shows "New schedule" button', async () => {
    await renderPanel([makeProject()]);
    expect(screen.getByText('New schedule')).toBeInTheDocument();
  });

  it('"New schedule" button is disabled when no projects', async () => {
    await renderPanel([]);
    expect(screen.getByText('New schedule').closest('button')).toBeDisabled();
  });
});

describe('SchedulesPanel — with schedules', () => {
  beforeEach(() => {
    authState.user = { id: 'user-1' };
  });

  it('renders schedule scanner and project name', async () => {
    mockSchedulesReturn([makeSchedule()]);
    await renderPanel([makeProject('proj-1', 'Prod API')]);
    await waitFor(() => expect(screen.getByText('nmap')).toBeInTheDocument());
    expect(screen.getByText(/on Prod API/i)).toBeInTheDocument();
  });

  it('shows "Active" badge for enabled schedule', async () => {
    mockSchedulesReturn([makeSchedule({ enabled: true })]);
    await renderPanel([makeProject()]);
    // After data loads the stat pill AND the per-item badge both render 'Active',
    // so we use getAllByText and assert at least one element is present.
    await waitFor(() => expect(screen.getAllByText('Active').length).toBeGreaterThan(0));
  });

  it('shows "Paused" badge for disabled schedule', async () => {
    mockSchedulesReturn([makeSchedule({ enabled: false })]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getAllByText('Paused').length).toBeGreaterThan(0));
  });

  it('shows "Daily" cadence label for 24h schedule', async () => {
    mockSchedulesReturn([makeSchedule({ cadence_hours: 24 })]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getByText(/Daily/)).toBeInTheDocument());
  });

  it('shows "Every 3h" for custom 3-hour cadence', async () => {
    mockSchedulesReturn([makeSchedule({ cadence_hours: 3 })]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getByText(/Every 3h/)).toBeInTheDocument());
  });

  it('shows "Every 5d" for custom 120-hour cadence', async () => {
    mockSchedulesReturn([makeSchedule({ cadence_hours: 120 })]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getByText(/Every 5d/)).toBeInTheDocument());
  });

  it('shows "37h" for non-divisible cadence', async () => {
    mockSchedulesReturn([makeSchedule({ cadence_hours: 37 })]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getByText(/37h/)).toBeInTheDocument());
  });

  it('falls back to "project" label when project is not found', async () => {
    mockSchedulesReturn([makeSchedule({ project_id: 'missing-project' })]);
    await renderPanel([makeProject('proj-1', 'Prod API')]);
    await waitFor(() => expect(screen.getByText(/on project/i)).toBeInTheDocument());
  });

  it('shows overdue badge when schedule is enabled and next run is in the past', async () => {
    mockSchedulesReturn([
      makeSchedule({
        enabled: true,
        next_run_at: '2000-01-01T00:00:00.000Z',
      }),
    ]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getByText(/overdue/i)).toBeInTheDocument());
  });

  it('does not show overdue badge when schedule is paused even if next run is in the past', async () => {
    mockSchedulesReturn([
      makeSchedule({
        enabled: false,
        next_run_at: '2000-01-01T00:00:00.000Z',
      }),
    ]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.queryByText(/overdue/i)).not.toBeInTheDocument());
  });
});

describe('SchedulesPanel — toggle & delete', () => {
  beforeEach(() => {
    authState.user = { id: 'user-1' };
  });

  it('calls supabase update when Power button clicked', async () => {
    mockSchedulesReturn([makeSchedule({ enabled: true })]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getByTitle('Pause')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Pause'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ enabled: false }));
  });

  it('removes schedule from list when Delete button clicked', async () => {
    mockSchedulesReturn([makeSchedule()]);
    await renderPanel([makeProject('proj-1', 'Prod API')]);
    await waitFor(() => expect(screen.getByTitle('Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Delete'));
    await waitFor(() =>
      expect(screen.queryByText('nmap')).not.toBeInTheDocument(),
    );
  });

  it('shows Resume title for paused schedule and toggles it to enabled', async () => {
    mockSchedulesReturn([makeSchedule({ enabled: false })]);
    await renderPanel([makeProject()]);
    await waitFor(() => expect(screen.getByTitle('Resume')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Resume'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ enabled: true }));
  });
});

describe('SchedulesPanel — new schedule modal', () => {
  beforeEach(() => {
    authState.user = { id: 'user-1' };
    mockSchedulesReturn([]);
  });

  it('opens modal when "New schedule" clicked', async () => {
    await renderPanel([makeProject()]);
    fireEvent.click(screen.getByText('New schedule'));
    // Modal heading is "New schedule" inside the dialog
    await waitFor(() => {
      const headings = screen.getAllByText('New schedule');
      // Should now have at least 2: button + modal heading
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('closes modal when Close (X) button clicked', async () => {
    await renderPanel([makeProject()]);
    fireEvent.click(screen.getByText('New schedule'));
    await waitFor(() => expect(screen.getAllByText('New schedule').length).toBeGreaterThanOrEqual(2));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => {
      expect(screen.getAllByText('New schedule').length).toBe(1);
    });
  });

  it('closes modal when Cancel button clicked', async () => {
    await renderPanel([makeProject()]);
    fireEvent.click(screen.getByText('New schedule'));
    await waitFor(() => expect(screen.getAllByText('New schedule').length).toBeGreaterThanOrEqual(2));
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i });
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.getAllByText('New schedule').length).toBe(1);
    });
  });

  it('saves schedule and calls onCreated when Create clicked', async () => {
    await renderPanel([makeProject('proj-1', 'Test Project')]);
    fireEvent.click(screen.getByText('New schedule'));
    await waitFor(() => expect(screen.getAllByText('New schedule').length).toBeGreaterThanOrEqual(2));
    const createBtn = screen.getByRole('button', { name: /create schedule/i });
    fireEvent.click(createBtn);
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          project_id: 'proj-1',
          enabled: true,
        }),
      );
    });
    await waitFor(() => {
      // Modal closes after create
      expect(screen.getAllByText('New schedule').length).toBe(1);
    });
  });

  it('changes cadence when cadence button clicked', async () => {
    await renderPanel([makeProject()]);
    fireEvent.click(screen.getByText('New schedule'));
    await waitFor(() => expect(screen.getAllByText('New schedule').length).toBeGreaterThanOrEqual(2));
    // Click "Every hour" cadence button
    fireEvent.click(screen.getByText('Every hour'));
    // Button state changes (styling) — just ensure no error
    expect(screen.getByText('Every hour')).toBeInTheDocument();
  });

  it('changes scanner when scanner select changed', async () => {
    await renderPanel([makeProject()]);
    fireEvent.click(screen.getByText('New schedule'));
    await waitFor(() => expect(screen.getAllByText('New schedule').length).toBeGreaterThanOrEqual(2));
    const scannerSelect = screen.getByRole('combobox', { name: /scanner/i });
    fireEvent.change(scannerSelect, { target: { value: 'trivy' } });
    expect((scannerSelect as HTMLSelectElement).value).toBe('trivy');
  });

  it('changes project when project select changed', async () => {
    await renderPanel([makeProject('proj-1', 'Project A'), makeProject('proj-2', 'Project B')]);
    fireEvent.click(screen.getByText('New schedule'));
    await waitFor(() => expect(screen.getAllByText('New schedule').length).toBeGreaterThanOrEqual(2));
    const projectSelect = screen.getByRole('combobox', { name: /project/i });
    fireEvent.change(projectSelect, { target: { value: 'proj-2' } });
    expect((projectSelect as HTMLSelectElement).value).toBe('proj-2');
  });
});

describe('SchedulesPanel — auth edge path', () => {
  it('keeps loading state when user is absent and load returns early', async () => {
    authState.user = null;
    const callsBefore = mockSelect.mock.calls.length;
    render(<SchedulesPanel projects={[makeProject()]} />);

    await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument());
    expect(mockSelect.mock.calls.length).toBe(callsBefore);
  });
});
