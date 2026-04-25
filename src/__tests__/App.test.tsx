import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import App from '../App';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockUseAuth } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
}));

// ── Context mock ──────────────────────────────────────────────────────────────
vi.mock('../context/useAuth', () => ({ useAuth: mockUseAuth }));

// ── AuthProvider passthrough ──────────────────────────────────────────────────
vi.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Page mocks (prevent supabase / heavy deps) ────────────────────────────────
vi.mock('../pages/Landing', () => ({ default: () => <div>Landing Page</div> }));
vi.mock('../pages/Auth', () => ({ default: () => <div>Auth Page</div> }));
vi.mock('../pages/Dashboard', () => ({ default: () => <div>Dashboard Page</div> }));
vi.mock('../pages/Chat', () => ({ default: () => <div>Chat Page</div> }));
vi.mock('../pages/Projects', () => ({ default: () => <div>Projects Page</div> }));
vi.mock('../pages/Scans', () => ({ default: () => <div>Scans Page</div> }));
vi.mock('../pages/Reports', () => ({ default: () => <div>Reports Page</div> }));
vi.mock('../pages/Settings', () => ({ default: () => <div>Settings Page</div> }));
vi.mock('../pages/Compliance', () => ({ default: () => <div>Compliance Page</div> }));
vi.mock('../pages/Scheduler', () => ({ default: () => <div>Scheduler Page</div> }));
vi.mock('../pages/NotFound', () => ({ default: () => <div>Not Found Page</div> }));
vi.mock('../pages/AttackSurfaceMap', () => ({ default: () => <div>Attack Map Page</div> }));
vi.mock('../pages/DarkWebMonitor', () => ({ default: () => <div>Dark Web Page</div> }));
vi.mock('../pages/PassiveRecon', () => ({ default: () => <div>Passive Recon Page</div> }));
vi.mock('../pages/SupplyChain', () => ({ default: () => <div>Supply Chain Page</div> }));
vi.mock('../pages/KillChain', () => ({ default: () => <div>Kill Chain Page</div> }));
vi.mock('../pages/Integrations', () => ({ default: () => <div>Integrations Page</div> }));
vi.mock('../pages/ApiDocs', () => ({ default: () => <div>Api Docs Page</div> }));
vi.mock('../pages/PublicReport', () => ({
  default: ({ token }: { token: string }) => <div>Public Report: {token}</div>,
}));

// ── AppLayout mock (renders child routes via Outlet) ──────────────────────────
vi.mock('../components/AppLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <div data-testid="app-layout"><Outlet /></div> };
});

// ─────────────────────────────────────────────────────────────────────────────

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('loading state', () => {
    it('shows loading spinner while auth is initializing', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: true });
      render(<App />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('does not render page content while loading', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: true });
      render(<App />);
      expect(screen.queryByText('Landing Page')).not.toBeInTheDocument();
      expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
    });
  });

  describe('share token', () => {
    it('renders PublicReport when share token is in URL (no auth required)', () => {
      vi.stubGlobal('location', { ...window.location, search: '?share=abc123' });
      mockUseAuth.mockReturnValue({ user: null, loading: false });
      render(<App />);
      expect(screen.getByText('Public Report: abc123')).toBeInTheDocument();
    });

    it('renders PublicReport even for authenticated users with share token', () => {
      vi.stubGlobal('location', { ...window.location, search: '?share=xyz789' });
      mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
      render(<App />);
      expect(screen.getByText('Public Report: xyz789')).toBeInTheDocument();
    });
  });

  describe('unauthenticated routing', () => {
    it('renders Landing page at /landing route for unauthenticated user', () => {
      window.history.pushState({}, '', '/landing');
      mockUseAuth.mockReturnValue({ user: null, loading: false });
      render(<App />);
      expect(screen.getByText('Landing Page')).toBeInTheDocument();
    });

    it('renders Auth page at /auth route for unauthenticated user', () => {
      window.history.pushState({}, '', '/auth');
      mockUseAuth.mockReturnValue({ user: null, loading: false });
      render(<App />);
      expect(screen.getByText('Auth Page')).toBeInTheDocument();
    });

    it('does not render AppLayout for unauthenticated user', () => {
      window.history.pushState({}, '', '/landing');
      mockUseAuth.mockReturnValue({ user: null, loading: false });
      render(<App />);
      expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
    });
  });

  describe('authenticated routing', () => {
    it('renders AppLayout for authenticated user', () => {
      mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
      render(<App />);
      expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    });

    it('renders Dashboard at index route for authenticated user', () => {
      mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, loading: false });
      render(<App />);
      expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    });
  });
});
