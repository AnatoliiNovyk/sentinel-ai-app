import { ReactNode } from 'react';
import { Shield, LayoutDashboard, MessageSquare, Radar, FileText, Settings, LogOut, FolderKanban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export type AppPage = 'dashboard' | 'chat' | 'scans' | 'projects' | 'reports' | 'settings';

const PAGE_TITLES: Record<AppPage, string> = {
  dashboard: 'Dashboard',
  chat: 'AI Assistant',
  projects: 'Projects',
  scans: 'Scans',
  reports: 'Reports',
  settings: 'Settings',
};

type Props = {
  current: AppPage;
  onNavigate: (p: AppPage) => void;
  children: ReactNode;
};

const nav: { id: AppPage; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'scans', label: 'Scans', icon: Radar },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ current, onNavigate, children }: Props) {
  const { profile, signOut } = useAuth();
  const initials =
    (profile?.full_name || profile?.email || 'U')
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-800">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-slate-950" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold">Sentinel AI</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ id, label, icon: Icon }) => {
            const active = current === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
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
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="sticky top-0 z-30 h-16 border-b border-slate-800 bg-slate-950/85 backdrop-blur flex items-center justify-between px-8">
          <div className="text-sm font-medium text-slate-300">{PAGE_TITLES[current]}</div>
          <div className="flex items-center gap-2">
            <NotificationBell onNavigate={onNavigate} />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  );
}
