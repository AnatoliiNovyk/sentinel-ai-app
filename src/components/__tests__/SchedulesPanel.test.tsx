import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SchedulesPanel from '../SchedulesPanel';
import type { Project, ScanSchedule } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockSelect, mockEq, mockOrder, mockUpdate, mockUpdateEq, mockDelete, mockDeleteEq } =
  vi.hoisted(() => ({
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockOrder: vi.fn(),
    mockUpdate: vi.fn(),
    mockUpdateEq: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockDelete: vi.fn(),
    mockDeleteEq: vi.fn().mockResolvedValue({ data: null, error: null }),
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
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  };
});

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
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

// ── Tests ─────────────────────────────────────────────────────────────────

describe('SchedulesPanel — empty state', () => {
  beforeEach(() => {
    mockSchedulesReturn([]);
  });

  it('shows "No schedules configured" when empty', async () => {
    render(<SchedulesPanel projects={[makeProject()]} />);
    await waitFor(() =>
      expect(screen.getByText('No schedules configured')).toBeInTheDocument(),
    );
  });

  it('shows "New schedule" button', async () => {
    render(<SchedulesPanel projects={[makeProject()]} />);
    expect(screen.getByText('New schedule')).toBeInTheDocument();
  });

  it('"New schedule" button is disabled when no projects', async () => {
    render(<SchedulesPanel projects={[]} />);
    expect(screen.getByText('New schedule').closest('button')).toBeDisabled();
  });
});

describe('SchedulesPanel — with schedules', () => {
  it('renders schedule scanner and project name', async () => {
    mockSchedulesReturn([makeSchedule()]);
    render(<SchedulesPanel projects={[makeProject('proj-1', 'Prod API')]} />);
    await waitFor(() => expect(screen.getByText('nmap')).toBeInTheDocument());
    expect(screen.getByText(/on Prod API/i)).toBeInTheDocument();
  });

  it('shows "Active" badge for enabled schedule', async () => {
    mockSchedulesReturn([makeSchedule({ enabled: true })]);
    render(<SchedulesPanel projects={[makeProject()]} />);
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument());
  });

  it('shows "Paused" badge for disabled schedule', async () => {
    mockSchedulesReturn([makeSchedule({ enabled: false })]);
    render(<SchedulesPanel projects={[makeProject()]} />);
    await waitFor(() => expect(screen.getByText('Paused')).toBeInTheDocument());
  });

  it('shows "Daily" cadence label for 24h schedule', async () => {
    mockSchedulesReturn([makeSchedule({ cadence_hours: 24 })]);
    render(<SchedulesPanel projects={[makeProject()]} />);
    await waitFor(() => expect(screen.getByText(/Daily/)).toBeInTheDocument());
  });
});

describe('SchedulesPanel — toggle & delete', () => {
  it('calls supabase update when Power button clicked', async () => {
    mockSchedulesReturn([makeSchedule({ enabled: true })]);
    render(<SchedulesPanel projects={[makeProject()]} />);
    await waitFor(() => expect(screen.getByTitle('Pause')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Pause'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ enabled: false }));
  });

  it('removes schedule from list when Delete button clicked', async () => {
    mockSchedulesReturn([makeSchedule()]);
    render(<SchedulesPanel projects={[makeProject('proj-1', 'Prod API')]} />);
    await waitFor(() => expect(screen.getByTitle('Delete')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Delete'));
    await waitFor(() =>
      expect(screen.queryByText('nmap')).not.toBeInTheDocument(),
    );
  });
});

describe('SchedulesPanel — new schedule modal', () => {
  beforeEach(() => {
    mockSchedulesReturn([]);
  });

  it('opens modal when "New schedule" clicked', async () => {
    render(<SchedulesPanel projects={[makeProject()]} />);
    fireEvent.click(screen.getByText('New schedule'));
    // Modal heading is "New schedule" inside the dialog
    await waitFor(() => {
      const headings = screen.getAllByText('New schedule');
      // Should now have at least 2: button + modal heading
      expect(headings.length).toBeGreaterThanOrEqual(2);
    });
  });
});
