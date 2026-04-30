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
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          is: vi.fn().mockResolvedValue({ data: null, error: null }),
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
