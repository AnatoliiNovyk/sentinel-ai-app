import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    mockSchOrder.mockResolvedValue({
      data: [
        {
          id: 'sch-1',
          project_id: 'p-1',
          scanner: 'nmap',
          cadence_hours: 24,
          enabled: true,
          next_run_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          user_id: 'user-1',
        },
      ],
      error: null,
    });
    mockPrjOrder.mockResolvedValue({
      data: [{ id: 'p-1', name: 'Alpha Project' }],
      error: null,
    });
    render(<SchedulerPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Alpha Project|p-1/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('clicks toggle and delete buttons on a schedule', async () => {
    mockSchOrder.mockResolvedValue({
      data: [
        {
          id: 'sch-2',
          project_id: 'p-1',
          scanner: 'nuclei',
          cadence_hours: 24,
          enabled: true,
          next_run_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          user_id: 'user-1',
        },
      ],
      error: null,
    });
    mockPrjOrder.mockResolvedValue({
      data: [{ id: 'p-1', name: 'Beta Project' }],
      error: null,
    });
    render(<SchedulerPage />);
    await waitFor(() => expect(screen.getAllByText('Beta Project').length).toBeGreaterThanOrEqual(1));
    // Click toggle (Enable/Disable button)
    const toggleBtn = screen.queryByTitle(/Enable|Disable/i);
    if (toggleBtn) fireEvent.click(toggleBtn);
    // Click delete
    const deleteBtn = screen.queryByTitle('Delete');
    if (deleteBtn) fireEvent.click(deleteBtn);
    // Confirm delete dialog appears or no throw
  });
});
