import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
