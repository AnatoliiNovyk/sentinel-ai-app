import { Shield, LayoutDashboard, MessageSquare, Radar, FileText, Settings, LogOut, FolderKanban, ShieldCheck, CalendarClock, Network, Eye, Search, Terminal, Code, Box, Crosshair, ArrowUp, Command, Menu, X as XIcon, Bell, Bug, Activity } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import NotificationBell from './NotificationBell';
import CommandPalette from './CommandPalette';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isHttpsAgentUrl, isMixedContentAgentUrl, probeAgentHealth } from '../lib/agentHealth';
import { supabase } from '../lib/supabase';

const DEFAULT_AGENT_HEALTH_URL = (import.meta.env.VITE_AGENT_HEALTH_URL as string | undefined)
  ?? 'http://95.67.75.146:9090/health';

type AgentHealth = {
  status: 'starting' | 'ok' | 'error';
  uptime: number;
  jobsProcessed: number;
  jobsFailed: number;
  lastJobAt: string | null;
  lastError: string | null;
};

type ProbeSmokeStatus = {
  status: 'ok' | 'error' | 'unknown';
  generatedAt: string | null;
};

function AgentStatus({ userId, orgId }: { userId: string | null; orgId: string | null }) {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [blockedByPolicy, setBlockedByPolicy] = useState(false);
  const [tlsOrCorsHint, setTlsOrCorsHint] = useState(false);
  const [probeSmoke, setProbeSmoke] = useState<ProbeSmokeStatus>({ status: 'unknown', generatedAt: null });
  const [agentUrl, setAgentUrl] = useState<string>(() =>
    localStorage.getItem('agentHealthUrl') ?? DEFAULT_AGENT_HEALTH_URL,
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'agentHealthUrl') {
        setAgentUrl(e.newValue ?? DEFAULT_AGENT_HEALTH_URL);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const poll = useCallback(async () => {
    try {
      const latestUrl = localStorage.getItem('agentHealthUrl') ?? DEFAULT_AGENT_HEALTH_URL;
      if (latestUrl !== agentUrl) {
        setAgentUrl(latestUrl);
      }
      const probe = await probeAgentHealth(latestUrl);
      if (probe.reachable && probe.health && typeof probe.health === 'object') {
        const data = probe.health as AgentHealth;
        setHealth(data);
        setReachable(true);
        setBlockedByPolicy(false);
        setTlsOrCorsHint(false);
      } else {
        const mixedContentBlocked = isMixedContentAgentUrl(latestUrl) && probe.via === 'direct';
        setReachable(false);
        setBlockedByPolicy(mixedContentBlocked);
        setTlsOrCorsHint(!mixedContentBlocked && isHttpsAgentUrl(latestUrl));
        setHealth(null);
      }
    } catch {
      setReachable(false);
      setHealth(null);
      setBlockedByPolicy(false);
      setTlsOrCorsHint(isHttpsAgentUrl(localStorage.getItem('agentHealthUrl') ?? DEFAULT_AGENT_HEALTH_URL));
    }
  }, [agentUrl]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  const pollProbeSmoke = useCallback(async () => {
    if (!userId && !orgId) {
      setProbeSmoke({ status: 'unknown', generatedAt: null });
      return;
    }

    try {
      let query = supabase
        .from('audit_logs')
        .select('status,created_at,metadata')
        .eq('action', 'agent_health_probe_smoke');

      if (orgId) {
        query = query.eq('org_id', orgId);
      } else if (userId) {
        query = query.eq('user_id', userId);
      }

      const res = await query.order('created_at', { ascending: false }).limit(1);
      const row = (res.data ?? [])[0] as { status?: string; created_at?: string; metadata?: unknown } | undefined;
      const meta = row?.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : null;

      const status = meta?.status === 'ok' || meta?.status === 'error'
        ? meta.status
        : row?.status === 'success'
          ? 'ok'
          : row?.status === 'failure'
            ? 'error'
            : 'unknown';

      const generatedAt = typeof meta?.generated_at === 'string' ? meta.generated_at : (row?.created_at ?? null);
      setProbeSmoke({ status, generatedAt });
    } catch {
      setProbeSmoke({ status: 'unknown', generatedAt: null });
    }
  }, [orgId, userId]);

  useEffect(() => {
    pollProbeSmoke();
    const id = setInterval(pollProbeSmoke, 60_000);
    return () => clearInterval(id);
  }, [pollProbeSmoke]);

  const dotColor =
    reachable === null ? 'bg-slate-600' :
    !reachable ? 'bg-red-500' :
    health?.status === 'ok' ? 'bg-emerald-400' : 'bg-amber-400';

  const label =
    reachable === null ? 'Checking agent…' :
    blockedByPolicy ? 'Agent check blocked (HTTPS -> HTTP)' :
    tlsOrCorsHint ? 'Agent HTTPS check failed (TLS/CORS)' :
    !reachable ? 'Agent offline' :
    `Agent online · ${health?.jobsProcessed ?? 0} jobs`;

  const uptime = health ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '';
  const probeLabel =
    probeSmoke.status === 'ok'
      ? `Probe OK${probeSmoke.generatedAt ? ` · ${formatRelativeMinutes(probeSmoke.generatedAt)}` : ''}`
      : probeSmoke.status === 'error'
        ? `Probe Fail${probeSmoke.generatedAt ? ` · ${formatRelativeMinutes(probeSmoke.generatedAt)}` : ''}`
        : 'Probe n/a';
  const probeTone =
    probeSmoke.status === 'ok'
      ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
      : probeSmoke.status === 'error'
        ? 'text-red-300 border-red-500/30 bg-red-500/10'
        : 'text-slate-300 border-slate-500/30 bg-slate-500/10';

  return (
    <div className="relative group flex items-center gap-2 cursor-default">
      <span className={`w-2 h-2 rounded-full ${dotColor} ${reachable ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-slate-500 hidden sm:block">{label}</span>
      <span className={`hidden md:inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${probeTone}`} title={probeSmoke.generatedAt ? `Last probe: ${new Date(probeSmoke.generatedAt).toLocaleString()}` : 'No probe run data'}>
        {probeLabel}
      </span>
      {reachable && health && (
        <div className="absolute top-6 right-0 hidden group-hover:block z-50 w-56 rounded-lg border border-slate-700 bg-slate-900 shadow-xl p-3 text-xs">
          <div className="font-semibold text-emerald-400 mb-2">Sentinel Agent</div>
          <div className="space-y-1 text-slate-400">
            <div className="flex justify-between"><span>Status</span><span className="text-white capitalize">{health.status}</span></div>
            <div className="flex justify-between"><span>Uptime</span><span className="text-white">{uptime}</span></div>
            <div className="flex justify-between"><span>Jobs processed</span><span className="text-white">{health.jobsProcessed}</span></div>
            <div className="flex justify-between"><span>Jobs failed</span><span className="text-red-400">{health.jobsFailed}</span></div>
            {health.lastJobAt && <div className="flex justify-between"><span>Last job</span><span className="text-white">{new Date(health.lastJobAt).toLocaleTimeString()}</span></div>}
            {health.lastError && <div className="mt-1 text-red-400 truncate" title={health.lastError}>⚠ {health.lastError}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export type AppPage = 'dashboard' | 'chat' | 'scans' | 'projects' | 'reports' | 'settings';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/chat': 'AI Assistant',
  '/projects': 'Projects',
  '/scans': 'Scans',
  '/vulnerabilities': 'Vulnerabilities',
  '/activity':   'Activity Log',
  '/reports': 'Reports',
  '/compliance': 'Compliance',
  '/scheduler':  'Scan Scheduler',
  '/attack-map': 'Attack Surface Map',
  '/recon':      'Active Recon (Nmap)',
  '/dark-web':   'OSINT Analyzer',
  '/supply-chain':'Supply Chain Analysis',
  '/kill-chain': 'AI Red Team',
  '/integrations':'CI/CD Integrations',
  '/api':        'REST API & CLI',
  '/notifications': 'Notifications',
  '/settings':   'Settings',
};

const nav: { id: string; label: string; icon: typeof LayoutDashboard; path: string }[] = [
  { id: 'dashboard',  label: 'Dashboard',   icon: LayoutDashboard, path: '/' },
  { id: 'chat',        label: 'AI Assistant', icon: MessageSquare,   path: '/chat' },
  { id: 'projects',    label: 'Projects',     icon: FolderKanban,    path: '/projects' },
  { id: 'scans',       label: 'Scans',        icon: Radar,           path: '/scans' },
  { id: 'vulnerabilities', label: 'Vulnerabilities', icon: Bug,        path: '/vulnerabilities' },
  { id: 'activity',         label: 'Activity Log',    icon: Activity,   path: '/activity' },
  { id: 'reports',     label: 'Reports',      icon: FileText,        path: '/reports' },
  { id: 'compliance',  label: 'Compliance',   icon: ShieldCheck,     path: '/compliance' },
  { id: 'scheduler',   label: 'Scheduler',    icon: CalendarClock,   path: '/scheduler' },
  { id: 'attack-map',  label: 'Attack Map',   icon: Network,         path: '/attack-map' },
  { id: 'dark-web',    label: 'OSINT Analyzer',  icon: Eye,             path: '/dark-web' },
  { id: 'recon',       label: 'Active Recon',    icon: Search,          path: '/recon' },
  { id: 'supply-chain',label: 'Supply Chain',  icon: Box,             path: '/supply-chain' },
  { id: 'kill-chain',  label: 'AI Red Team',   icon: Crosshair,       path: '/kill-chain' },
  { id: 'integrations',label: 'Integrations',  icon: Terminal,        path: '/integrations' },
  { id: 'api',         label: 'API & CLI',     icon: Code,            path: '/api' },
  { id: 'notifications', label: 'Notifications', icon: Bell,            path: '/notifications' },
  { id: 'settings',    label: 'Settings',     icon: Settings,        path: '/settings' },
];

export default function AppLayout() {
  const location = useLocation();
  const { profile, signOut, user, organizations } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setShowScrollTop(false);
  }, [location.pathname]);

  const scrollToTop = () => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const initials =
    (profile?.full_name || profile?.email || 'U')
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-slate-800 flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex lg:shrink-0
      `}>
        <div className="h-16 flex items-center justify-between gap-2 px-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-950" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold">Sentinel AI</span>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition"
            aria-label="Close menu"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ id, label, icon: Icon, path }) => {
            return (
              <NavLink
                key={id}
                to={path}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-xs font-semibold flex items-center justify-center text-emerald-300">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{profile?.full_name || 'User'}</div>
              <div className="text-xs text-slate-500 truncate">{profile?.email}</div>
            </div>
            <button
              onClick={signOut}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-900 rounded transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
      <main ref={mainRef} className="flex-1 overflow-y-auto flex flex-col relative min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-950/85 backdrop-blur flex items-center justify-between px-4 sm:px-8 overflow-visible">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              {(() => {
                const match = nav.find(n => n.path === location.pathname);
                if (!match) return PAGE_TITLES[location.pathname] || 'Sentinel AI';
                const Icon = match.icon;
                return (
                  <>
                    <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    {match.label}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              title="Command palette (Ctrl+K)"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-300 border border-slate-800 hover:border-slate-700 bg-slate-900/50 transition"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search…</span>
              <span className="flex items-center gap-0.5 ml-1 text-slate-600"><Command className="w-3 h-3" />K</span>
            </button>
            <AgentStatus userId={user?.id ?? null} orgId={organizations?.[0]?.id ?? null} />
            <NotificationBell />
          </div>
        </header>
        <div className="flex-1">
          <Outlet />
        </div>
        {/* Command Palette */}
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            aria-label="Back to top"
            className="fixed bottom-8 right-8 z-50 w-10 h-10 rounded-full bg-slate-800 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-700 text-slate-300 hover:text-emerald-300 flex items-center justify-center shadow-lg transition-all duration-200"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </main>
    </div>
  );
}

function formatRelativeMinutes(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'n/a';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

