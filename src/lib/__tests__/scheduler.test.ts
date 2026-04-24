import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchDueSchedules } from '../scheduler';

const { mockSelectSchedules, mockUpdateSchedule, mockGetProject, mockDispatchScan } = vi.hoisted(() => ({
  mockSelectSchedules: vi.fn(),
  mockUpdateSchedule: vi.fn().mockResolvedValue({ error: null }),
  mockGetProject: vi.fn(),
  mockDispatchScan: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'scan_schedules') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => ({
                  limit: mockSelectSchedules,
                }),
              }),
            }),
          }),
          update: () => ({
            eq: mockUpdateSchedule,
          }),
        };
      }
      if (table === 'projects') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockGetProject,
            }),
          }),
        };
      }
      return {};
    },
  },
}));

vi.mock('../scanDispatch', () => ({
  dispatchScan: mockDispatchScan,
}));

describe('dispatchDueSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSchedule.mockResolvedValue({ error: null });
    mockDispatchScan.mockResolvedValue({ ok: true });
  });

  it('returns 0 when there are no due schedules', async () => {
    mockSelectSchedules.mockResolvedValue({ data: [], error: null });
    const result = await dispatchDueSchedules('user-1');
    expect(result).toBe(0);
  });

  it('returns 0 when supabase returns null data', async () => {
    mockSelectSchedules.mockResolvedValue({ data: null, error: null });
    const result = await dispatchDueSchedules('user-1');
    expect(result).toBe(0);
  });

  it('fires one scan for one due schedule and returns 1', async () => {
    mockSelectSchedules.mockResolvedValue({
      data: [
        {
          id: 'sched-1',
          user_id: 'user-1',
          project_id: 'proj-1',
          scanner: 'nmap',
          cadence_hours: 24,
          enabled: true,
          next_run_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    mockGetProject.mockResolvedValue({ data: { target: 'example.com' }, error: null });

    const result = await dispatchDueSchedules('user-1');
    expect(result).toBe(1);
    expect(mockDispatchScan).toHaveBeenCalledWith('user-1', 'proj-1', 'nmap', 'example.com');
  });

  it('uses empty string as target when project has no target', async () => {
    mockSelectSchedules.mockResolvedValue({
      data: [
        {
          id: 'sched-2',
          user_id: 'user-1',
          project_id: 'proj-2',
          scanner: 'prowler',
          cadence_hours: 12,
          enabled: true,
          next_run_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    mockGetProject.mockResolvedValue({ data: null, error: null });

    await dispatchDueSchedules('user-1');
    expect(mockDispatchScan).toHaveBeenCalledWith('user-1', 'proj-2', 'prowler', '');
  });

  it('counts only successfully dispatched scans', async () => {
    mockSelectSchedules.mockResolvedValue({
      data: [
        {
          id: 'sched-3',
          user_id: 'user-1',
          project_id: 'proj-3',
          scanner: 'tfsec',
          cadence_hours: 6,
          enabled: true,
          next_run_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'sched-4',
          user_id: 'user-1',
          project_id: 'proj-4',
          scanner: 'nmap',
          cadence_hours: 6,
          enabled: true,
          next_run_at: '2026-01-01T00:00:00Z',
        },
      ],
      error: null,
    });
    mockGetProject.mockResolvedValue({ data: { target: 'host.local' }, error: null });
    // First succeeds, second fails
    mockDispatchScan
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: 'failed' });

    const result = await dispatchDueSchedules('user-1');
    expect(result).toBe(1);
  });
});
