import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppLayout from '../AppLayout';

const { mockSignOut, mockProfile, mockLocation } = vi.hoisted(() => ({
  mockSignOut: vi.fn().mockResolvedValue(undefined),
  mockProfile: { full_name: 'Jane Doe', email: 'jane@test.com' },
  mockLocation: { pathname: '/' },
}));

vi.mock('../../context/useAuth', () => {
  const _signOut = mockSignOut;
  const _profile = mockProfile;
  return { useAuth: () => ({ profile: _profile, signOut: _signOut }) };
});

vi.mock('react-router-dom', () => ({
  NavLink: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: (arg: { isActive: boolean }) => string;
  }) => (
    <a href={to} className={typeof className === 'function' ? className({ isActive: to === '/' }) : className}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet-content">Outlet</div>,
  useLocation: () => mockLocation,
  useNavigate: () => vi.fn(),
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock('../NotificationBell', () => ({
  default: () => <div data-testid="notification-bell">NotificationBell</div>,
}));

describe('AppLayout — sidebar', () => {
  it('renders "Sentinel AI" brand in sidebar', () => {
    render(<AppLayout />);
    expect(screen.getAllByText('Sentinel AI').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Dashboard nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
  });

  it('renders AI Assistant nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /AI Assistant/i })).toBeInTheDocument();
  });

  it('renders Projects nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /Projects/i })).toBeInTheDocument();
  });

  it('renders Settings nav link', () => {
    render(<AppLayout />);
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });

  it('renders user full name in sidebar footer', () => {
    render(<AppLayout />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('renders user email in sidebar footer', () => {
    render(<AppLayout />);
    expect(screen.getByText('jane@test.com')).toBeInTheDocument();
  });

  it('renders user initials (JD)', () => {
    render(<AppLayout />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('calls signOut when sign out button is clicked', () => {
    render(<AppLayout />);
    fireEvent.click(screen.getByTitle('Sign out'));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('AppLayout — header', () => {
  beforeEach(() => {
    mockLocation.pathname = '/';
  });

  it('renders NotificationBell in header', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('renders page title "Dashboard" for "/" path', () => {
    render(<AppLayout />);
    // "Dashboard" appears both in sidebar nav link and in header — verify header presence
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThanOrEqual(2);
  });

  it('renders page title "AI Assistant" for "/chat" path', () => {
    mockLocation.pathname = '/chat';
    render(<AppLayout />);
    // "AI Assistant" appears both in sidebar nav link and in header
    expect(screen.getAllByText('AI Assistant').length).toBeGreaterThanOrEqual(2);
  });

  it('renders Outlet content area', () => {
    render(<AppLayout />);
    expect(screen.getByTestId('outlet-content')).toBeInTheDocument();
  });
});

describe('AppLayout — Scans link', () => {
  it('renders Scans nav link pointing to /scans', () => {
    render(<AppLayout />);
    const link = screen.getByRole('link', { name: /Scans/i });
    expect(link).toHaveAttribute('href', '/scans');
  });
});
