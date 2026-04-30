import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from '../NotificationBell';
import type { Notification } from '../../lib/supabase';

// ── Mocks ─────────────────────────────────────────────────────────────────

const { mockSelect, mockEq, mockOrder, mockLimit, mockUpdate, mockDelete, mockChannel, mockNavigate } = vi.hoisted(
  () => ({
    mockSelect: vi.fn(),
    mockEq: vi.fn(),
    mockOrder: vi.fn(),
    mockLimit: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockChannel: {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    },
    mockNavigate: vi.fn(),
  }),
);

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    }),
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  },
}));

// useNavigate mock (NotificationBell uses navigate)
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    user_id: 'user-1',
    type: 'scan_completed',
    title: 'Scan finished',
    body: 'Your nmap scan is done.',
    link: 'scans',
    severity: 'info',
    metadata: {},
    read_at: null,
    created_at: '2026-04-24T10:00:00Z',
    ...overrides,
  };
}

// Configures the supabase chain to return given items
function mockFetchReturns(items: Notification[]) {
  mockLimit.mockResolvedValue({ data: items, error: null });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockEq.mockReturnValue({ order: mockOrder });
  mockSelect.mockReturnValue({ eq: mockEq });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('NotificationBell — closed state', () => {
  beforeEach(() => {
    mockFetchReturns([]);
  });

  it('renders the Bell button', async () => {
    render(<NotificationBell />);
    expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
  });

  it('does not show badge when no unread notifications', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(mockLimit).toHaveBeenCalled());
    // Badge should not exist
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('shows unread badge with count when unread exist', async () => {
    mockFetchReturns([makeNotif(), makeNotif()]);
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('shows "9+" badge when more than 9 unread', async () => {
    const notifs = Array.from({ length: 11 }, () => makeNotif());
    mockFetchReturns(notifs);
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('9+')).toBeInTheDocument());
  });
});

describe('NotificationBell — open popover', () => {
  beforeEach(() => {
    mockFetchReturns([]);
  });

  it('opens popover when Bell button clicked', async () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });

  it('renders notification titles in list', async () => {
    mockFetchReturns([
      makeNotif({ title: 'Scan Done', read_at: null }),
      makeNotif({ title: 'Report Ready', read_at: '2026-04-24T09:00:00Z' }),
    ]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    expect(await screen.findByText('Scan Done')).toBeInTheDocument();
    expect(screen.getByText('Report Ready')).toBeInTheDocument();
  });

  it('shows "Mark all read" button (enabled when unread exist)', async () => {
    mockFetchReturns([makeNotif()]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Mark all read/i })).not.toBeDisabled(),
    );
  });

  it('"Mark all read" button is disabled when all already read', async () => {
    mockFetchReturns([makeNotif({ read_at: '2026-04-24T08:00:00Z' })]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Mark all read/i })).toBeDisabled(),
    );
  });
});

describe('NotificationBell — markAllRead', () => {
  beforeEach(() => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
  });

  it('clicking Mark all read calls supabase update', async () => {
    mockFetchReturns([makeNotif(), makeNotif()]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByRole('button', { name: /Mark all read/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Mark all read/i }));
    });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('after markAllRead unread badge disappears', async () => {
    mockFetchReturns([makeNotif()]);
    render(<NotificationBell />);
    await waitFor(() => screen.getByText('1'));
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByRole('button', { name: /Mark all read/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mark all read/i }));
    // After mark-all-read, setItems runs synchronously → unread=0 → button becomes disabled
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Mark all read/i })).toBeDisabled(),
    );
  });
});

describe('NotificationBell — onItemClick', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUpdate.mockClear();
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('clicking unread notification marks it read and navigates', async () => {
    const notif = makeNotif({ title: 'Click me', link: 'scans', read_at: null });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByText('Click me'));
    await act(async () => {
      fireEvent.click(screen.getByText('Click me'));
    });
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/scans');
  });

  it('clicking notification with link=dashboard navigates to /', async () => {
    const notif = makeNotif({ title: 'Dashboard notif', link: 'dashboard', read_at: null });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByText('Dashboard notif'));
    await act(async () => {
      fireEvent.click(screen.getByText('Dashboard notif'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicking notification with invalid link does not navigate', async () => {
    const notif = makeNotif({ title: 'Invalid link', link: 'unknown-page', read_at: null });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByText('Invalid link'));
    await act(async () => {
      fireEvent.click(screen.getByText('Invalid link'));
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clicking already-read notification does not call update', async () => {
    const notif = makeNotif({ title: 'Already read', link: 'reports', read_at: '2026-01-01T00:00:00Z' });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByText('Already read'));
    await act(async () => {
      fireEvent.click(screen.getByText('Already read'));
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/reports');
  });
});

describe('NotificationBell — dismiss', () => {
  beforeEach(() => {
    mockDelete.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // In case parent button's onItemClick fires (stopPropagation may be async)
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('clicking dismiss (X) removes notification from list', async () => {
    const notif = makeNotif({ title: 'Dismiss me' });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByText('Dismiss me'));
    fireEvent.click(screen.getByLabelText('Dismiss'));
    await waitFor(() => expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument());
  });

  it('dismiss calls supabase delete', async () => {
    const notif = makeNotif({ title: 'To delete' });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByText('To delete'));
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Dismiss'));
    });
    expect(mockDelete).toHaveBeenCalled();
  });
});

describe('NotificationBell — iconFor and severity badges', () => {
  beforeEach(() => {
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
  });

  it('shows critical severity badge in header', async () => {
    mockFetchReturns([makeNotif({ severity: 'critical' })]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText(/1 critical/i)).toBeInTheDocument());
  });

  it('shows warning severity badge in header', async () => {
    mockFetchReturns([makeNotif({ severity: 'warning' })]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText(/1 warning/i)).toBeInTheDocument());
  });

  it('renders report_ready type notification (FileText icon path)', async () => {
    const notif = makeNotif({ type: 'report_ready', title: 'Report ready' });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText('Report ready')).toBeInTheDocument());
  });

  it('renders critical_finding type notification (AlertTriangle icon path)', async () => {
    const notif = makeNotif({ type: 'critical_finding', title: 'Critical finding!' });
    mockFetchReturns([notif]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => expect(screen.getByText('Critical finding!')).toBeInTheDocument());
  });
});

describe('NotificationBell — popover close on outside click', () => {
  it('closes popover when clicking outside', async () => {
    mockFetchReturns([]);
    render(
      <div>
        <NotificationBell />
        <div data-testid="outside">Outside</div>
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => screen.getByText("You're all caught up"));
    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'));
    await waitFor(() =>
      expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument(),
    );
  });
});
