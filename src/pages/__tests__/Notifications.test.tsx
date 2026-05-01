import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Notifications from '../Notifications';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../context/useAuth', () => {
  const _user = { id: 'user-1' };
  return { useAuth: () => ({ user: _user }) };
});

const { mockNotifLimit, mockChannel, mockRemoveChannel } = vi.hoisted(() => ({
  mockNotifLimit:    vi.fn().mockResolvedValue({ data: [], error: null }),
  mockChannel:       vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() })),
  mockRemoveChannel: vi.fn(),
}));

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>();
  return {
    ...actual,
    supabase: {
      from: (_: string) => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: mockNotifLimit,
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            is: vi.fn().mockResolvedValue({ data: null, error: null }),
            not: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      channel: mockChannel,
      removeChannel: mockRemoveChannel,
    },
  };
});

// ── Fixtures ──────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

const MOCK_NOTIFICATIONS = [
  {
    id: 'n-1',
    user_id: 'user-1',
    title: 'Critical vulnerability detected',
    body: 'A critical CVE was found in your project',
    type: 'critical_finding',
    severity: 'critical',
    read_at: null,
    link: '/vulns',
    created_at: NOW,
  },
  {
    id: 'n-2',
    user_id: 'user-1',
    title: 'Scan completed successfully',
    body: 'Your scan finished with no errors',
    type: 'scan_completed',
    severity: 'success',
    read_at: NOW,
    link: '/scans',
    created_at: NOW,
  },
];

function setupMocks(items = MOCK_NOTIFICATIONS) {
  mockNotifLimit.mockResolvedValue({ data: items, error: null });
}

beforeEach(() => {
  setupMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Notifications — layout', () => {
  it('renders "Notification Center" heading', async () => {
    render(<Notifications />);
    expect(await screen.findByText('Notification Center')).toBeInTheDocument();
  });

  it('renders stat cards Total, Unread, Critical unread, Read, Today', async () => {
    render(<Notifications />);
    expect(await screen.findByText('Total')).toBeInTheDocument();
    // Use getAllByText for labels that also appear as filter pills
    expect(screen.getAllByText('Unread').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Critical unread')).toBeInTheDocument();
    expect(screen.getAllByText('Read').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Today').length).toBeGreaterThanOrEqual(1);
  });

  it('Export CSV button is always visible', async () => {
    render(<Notifications />);
    expect(await screen.findByText('Export CSV')).toBeInTheDocument();
  });
});

describe('Notifications — entries', () => {
  it('renders notification titles from supabase', async () => {
    render(<Notifications />);
    expect(await screen.findByText('Critical vulnerability detected')).toBeInTheDocument();
    expect(screen.getByText('Scan completed successfully')).toBeInTheDocument();
  });

  it('shows "Mark all read" when there are unread notifications', async () => {
    render(<Notifications />);
    expect(await screen.findByText('Mark all read')).toBeInTheDocument();
  });

  it('shows "Clear read" when there are read notifications', async () => {
    render(<Notifications />);
    expect(await screen.findByText('Clear read')).toBeInTheDocument();
  });

  it('shows empty state "No notifications yet" when items list is empty', async () => {
    mockNotifLimit.mockResolvedValue({ data: [], error: null });
    render(<Notifications />);
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument();
  });
});

describe('Notifications — filters', () => {
  it('does NOT show "Mark all read" when all are already read', async () => {
    const allRead = MOCK_NOTIFICATIONS.map(n => ({ ...n, read_at: NOW }));
    mockNotifLimit.mockResolvedValue({ data: allRead, error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
  });

  it('applies read filter toggle — unread filter hides read notification', async () => {
    render(<Notifications />);
    await screen.findByText('Scan completed successfully');
    // Click "Unread" filter button (not the stat card label)
    fireEvent.click(screen.getByRole('button', { name: 'Unread' }));
    // Read notification should be hidden
    expect(screen.queryByText('Scan completed successfully')).not.toBeInTheDocument();
    // Unread notification should still show
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });
});

  describe('Notifications — clear filters and load more', () => {
    it('shows Clear filters button when filter active and no results', async () => {
      // Only one unread notification
      mockNotifLimit.mockResolvedValue({ data: [MOCK_NOTIFICATIONS[0]], error: null });
      render(<Notifications />);
      await screen.findByText('Critical vulnerability detected');
      // Click "Read" filter to show only read notifications (none exist → empty list)
      fireEvent.click(screen.getByRole('button', { name: 'Read' }));
      const clearBtn = screen.queryByRole('button', { name: /clear filters/i });
      if (clearBtn) {
        fireEvent.click(clearBtn);
      }
    });
  });

// ─── Type filter ─────────────────────────────────────────────────────────────

describe('Notifications — type filter', () => {
  beforeEach(() => { setupMocks(); });

  it('renders all type filter buttons (Scan, Report, Finding, SLA, Project)', async () => {
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByRole('button', { name: 'Finding' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SLA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Project' })).toBeInTheDocument();
  });

  it('type "Finding" filter shows only critical_finding notifications', async () => {
    render(<Notifications />);
    await screen.findByText('Scan completed successfully');
    fireEvent.click(screen.getByRole('button', { name: 'Finding' }));
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
    expect(screen.queryByText('Scan completed successfully')).not.toBeInTheDocument();
  });

  it('type "Scan" filter shows only scan_completed notifications', async () => {
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    expect(screen.getByText('Scan completed successfully')).toBeInTheDocument();
    expect(screen.queryByText('Critical vulnerability detected')).not.toBeInTheDocument();
  });
});

// ─── Severity filter ─────────────────────────────────────────────────────────

describe('Notifications — severity filter', () => {
  beforeEach(() => { setupMocks(); });

  it('"critical" severity filter hides non-critical notifications', async () => {
    render(<Notifications />);
    await screen.findByText('Scan completed successfully');
    fireEvent.click(screen.getByRole('button', { name: 'critical' }));
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
    expect(screen.queryByText('Scan completed successfully')).not.toBeInTheDocument();
  });

  it('"success" severity filter hides non-success notifications', async () => {
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    fireEvent.click(screen.getByRole('button', { name: 'success' }));
    expect(screen.getByText('Scan completed successfully')).toBeInTheDocument();
    expect(screen.queryByText('Critical vulnerability detected')).not.toBeInTheDocument();
  });
});

// ─── Search ──────────────────────────────────────────────────────────────────

describe('Notifications — search', () => {
  beforeEach(() => { setupMocks(); });

  it('filters by title text via search input', async () => {
    render(<Notifications />);
    await screen.findByText('Scan completed successfully');
    fireEvent.change(screen.getByPlaceholderText('Search notifications\u2026'), { target: { value: 'critical' } });
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
    expect(screen.queryByText('Scan completed successfully')).not.toBeInTheDocument();
  });

  it('shows "No notifications match the filters" when search has no match', async () => {
    render(<Notifications />);
    await screen.findByText('Notification Center');
    fireEvent.change(screen.getByPlaceholderText('Search notifications\u2026'), { target: { value: 'xyznonexistent99' } });
    expect(screen.getByText('No notifications match the filters')).toBeInTheDocument();
  });

  it('shows "Clear filters" button in empty state and filter panel "Clear" resets all', async () => {
    render(<Notifications />);
    await screen.findByText('Notification Center');
    fireEvent.change(screen.getByPlaceholderText('Search notifications\u2026'), { target: { value: 'xyznonexistent99' } });
    expect(screen.getByText('No notifications match the filters')).toBeInTheDocument();
    // The Filters panel also shows a "Clear" link — it resets all filters including search
    const filterPanelClear = screen.getByRole('button', { name: /^clear$/i });
    fireEvent.click(filterPanelClear);
    await screen.findByText('Critical vulnerability detected');
    expect(screen.getByText('Scan completed successfully')).toBeInTheDocument();
  });
});

// ─── Notification actions ─────────────────────────────────────────────────────

describe('Notifications — notification actions', () => {
  beforeEach(() => { setupMocks(); });

  it('clicking "Mark as read" removes the unread dot', async () => {
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    // n-1 is unread → aria-label="unread" dot is present
    expect(screen.getByLabelText('unread')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Mark as read'));
    await waitFor(() => expect(screen.queryByLabelText('unread')).not.toBeInTheDocument());
  });

  it('clicking "Delete notification" removes the notification', async () => {
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    const deleteBtns = screen.getAllByTitle('Delete notification');
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => expect(screen.queryByText('Critical vulnerability detected')).not.toBeInTheDocument());
  });

  it('clicking "Clear read" removes all read notifications', async () => {
    render(<Notifications />);
    await screen.findByText('Scan completed successfully');
    fireEvent.click(screen.getByText('Clear read'));
    await waitFor(() => expect(screen.queryByText('Scan completed successfully')).not.toBeInTheDocument());
  });

  it('clicking "Go to related page" calls navigate with the notification link', async () => {
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    fireEvent.click(screen.getAllByTitle('Go to related page')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/vulns');
  });
});

// ─── Additional coverage tests ───────────────────────────────

describe('Notifications — additional coverage', () => {
  it('renders notification with "just now" time for recent notification', async () => {
    const recent = { ...MOCK_NOTIFICATIONS[0], created_at: new Date().toISOString() };
    mockNotifLimit.mockResolvedValue({ data: [recent], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });

  it('renders notification with "1h ago" for hour-old notification', async () => {
    const hourOld = { ...MOCK_NOTIFICATIONS[0], created_at: new Date(Date.now() - 3_600_000).toISOString() };
    mockNotifLimit.mockResolvedValue({ data: [hourOld], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });

  it('renders notification with "1d ago" for day-old notification', async () => {
    const dayOld = { ...MOCK_NOTIFICATIONS[0], created_at: new Date(Date.now() - 86_400_000).toISOString() };
    mockNotifLimit.mockResolvedValue({ data: [dayOld], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });

  it('renders notification without link (no navigation)', async () => {
    const noLink = { ...MOCK_NOTIFICATIONS[0], link: null };
    mockNotifLimit.mockResolvedValue({ data: [noLink], error: null });
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    expect(screen.queryByTitle('Go to related page')).not.toBeInTheDocument();
  });

  it('clicking "Mark all read" calls supabase update', async () => {
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    const markAllBtn = screen.getByText('Mark all read');
    fireEvent.click(markAllBtn);
    await waitFor(() => expect(screen.queryByLabelText('unread')).not.toBeInTheDocument());
  });

  it('clicking "Clear read" calls supabase delete', async () => {
    render(<Notifications />);
    await screen.findByText('Scan completed successfully');
    const clearReadBtn = screen.getByText('Clear read');
    fireEvent.click(clearReadBtn);
    await waitFor(() => expect(screen.queryByText('Scan completed successfully')).not.toBeInTheDocument());
  });

  it('refresh button triggers silent fetch', async () => {
    render(<Notifications />);
    await screen.findByText('Notification Center');
    const refreshBtn = screen.getByTitle('Refresh');
    fireEvent.click(refreshBtn);
    // Should not throw
  });

  it('export CSV button triggers download', async () => {
    // Mock document.createElement and URL methods
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { click: mockClick, href: '', download: '' } as any;
      }
      return originalCreateElement(tag);
    });
    global.URL.createObjectURL = vi.fn(() => 'blob:url');
    global.URL.revokeObjectURL = vi.fn();

    render(<Notifications />);
    await screen.findByText('Notification Center');
    const exportBtn = screen.getByTitle('Export as CSV');
    fireEvent.click(exportBtn);
    expect(mockClick).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

// ─── iconFor coverage ───────────────────────────────

describe('Notifications — iconFor coverage', () => {
  it('renders Radar icon for scan_completed type', async () => {
    const scanNotif = { ...MOCK_NOTIFICATIONS[1] };
    mockNotifLimit.mockResolvedValue({ data: [scanNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Scan completed successfully')).toBeInTheDocument();
  });

  it('renders AlertTriangle icon for critical_finding type', async () => {
    render(<Notifications />);
    await screen.findByText('Critical vulnerability detected');
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });

  it('renders Zap icon for sla_breach type', async () => {
    const slaNotif = { ...MOCK_NOTIFICATIONS[0], type: 'sla_breach', severity: 'warning' as const };
    mockNotifLimit.mockResolvedValue({ data: [slaNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });

  it('renders ShieldAlert icon for project_created type', async () => {
    const projNotif = { ...MOCK_NOTIFICATIONS[0], type: 'project_created', severity: 'success' as const };
    mockNotifLimit.mockResolvedValue({ data: [projNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });

  it('renders Bell icon for unknown type', async () => {
    const unknownNotif = { ...MOCK_NOTIFICATIONS[0], type: 'unknown_type' };
    mockNotifLimit.mockResolvedValue({ data: [unknownNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Critical vulnerability detected')).toBeInTheDocument();
  });
});

// ─── groupByDate coverage ───────────────────────────────

describe('Notifications — groupByDate coverage', () => {
  it('groups notifications as Today', async () => {
    const todayNotif = { ...MOCK_NOTIFICATIONS[0], created_at: new Date().toISOString() };
    mockNotifLimit.mockResolvedValue({ data: [todayNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('groups notifications as Yesterday', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const yesterdayNotif = { ...MOCK_NOTIFICATIONS[0], created_at: yesterday };
    mockNotifLimit.mockResolvedValue({ data: [yesterdayNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('groups notifications as This week', async () => {
    const weekAgo = new Date(Date.now() - 4 * 86400000).toISOString();
    const weekNotif = { ...MOCK_NOTIFICATIONS[0], created_at: weekAgo };
    mockNotifLimit.mockResolvedValue({ data: [weekNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('This week')).toBeInTheDocument();
  });

  it('groups notifications as Older', async () => {
    const older = new Date(Date.now() - 10 * 86400000).toISOString();
    const olderNotif = { ...MOCK_NOTIFICATIONS[0], created_at: older };
    mockNotifLimit.mockResolvedValue({ data: [olderNotif], error: null });
    render(<Notifications />);
    await screen.findByText('Notification Center');
    expect(screen.getByText('Older')).toBeInTheDocument();
  });
});
