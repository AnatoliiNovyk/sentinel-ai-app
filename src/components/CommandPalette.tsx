import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, FolderKanban, Radar, FileText,
  ShieldCheck, CalendarClock, Network, Eye, Search, Box, Crosshair,
  Terminal, Code, Settings, Command, ArrowRight,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof LayoutDashboard;
  action: () => void;
  keywords?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (path: string) => { navigate(path); onClose(); };

  const items: PaletteItem[] = useMemo(() => [
    { id: 'dashboard',    label: 'Dashboard',          description: 'Overview & recent scans',     icon: LayoutDashboard, action: () => go('/'),             keywords: 'home overview' },
    { id: 'chat',         label: 'AI Assistant',        description: 'Chat with Sentinel AI',       icon: MessageSquare,   action: () => go('/chat'),         keywords: 'ai chat gpt ask question' },
    { id: 'projects',     label: 'Projects',            description: 'Manage audit targets',        icon: FolderKanban,    action: () => go('/projects'),     keywords: 'project target asset' },
    { id: 'scans',        label: 'Scans',               description: 'Run & review security scans', icon: Radar,           action: () => go('/scans'),        keywords: 'scan vulnerability pentest' },
    { id: 'reports',      label: 'Reports',             description: 'AI-generated audit reports',  icon: FileText,        action: () => go('/reports'),      keywords: 'report audit export pdf' },
    { id: 'compliance',   label: 'Compliance',          description: 'Framework & policy checks',   icon: ShieldCheck,     action: () => go('/compliance'),   keywords: 'iso soc2 nist gdpr hipaa pci' },
    { id: 'scheduler',    label: 'Scheduler',           description: 'Automated scan schedules',    icon: CalendarClock,   action: () => go('/scheduler'),    keywords: 'schedule cron auto recurring' },
    { id: 'attack-map',   label: 'Attack Surface Map',  description: 'Visualize attack vectors',    icon: Network,         action: () => go('/attack-map'),   keywords: 'attack surface topology graph' },
    { id: 'dark-web',     label: 'OSINT Analyzer',      description: 'Dark web & threat intel',     icon: Eye,             action: () => go('/dark-web'),     keywords: 'osint dark web leak breach monitor' },
    { id: 'recon',        label: 'Active Recon',        description: 'Nmap & port scanning',        icon: Search,          action: () => go('/recon'),        keywords: 'recon nmap port scan dns' },
    { id: 'supply-chain', label: 'Supply Chain',        description: 'Dependency vulnerability scan',icon: Box,            action: () => go('/supply-chain'), keywords: 'npm package dependency sbom supply' },
    { id: 'kill-chain',   label: 'AI Red Team',         description: 'Kill chain simulation',       icon: Crosshair,       action: () => go('/kill-chain'),   keywords: 'red team kill chain exploit lateral' },
    { id: 'integrations', label: 'Integrations',        description: 'CI/CD & webhook setup',       icon: Terminal,        action: () => go('/integrations'), keywords: 'github jira slack webhook cicd' },
    { id: 'api',          label: 'API & CLI',           description: 'REST API documentation',      icon: Code,            action: () => go('/api'),          keywords: 'api rest cli docs endpoint' },
    { id: 'settings',     label: 'Settings',            description: 'Account & preferences',       icon: Settings,        action: () => go('/settings'),     keywords: 'settings profile account password org' },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item =>
      item.label.toLowerCase().includes(q) ||
      (item.description ?? '').toLowerCase().includes(q) ||
      (item.keywords ?? '').includes(q)
    );
  }, [query, items]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Keep active item in view
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[activeIndex]?.action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 z-[70]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, tools, settings…"
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
            aria-label="Search commands"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
            esc
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600">No results for "{query}"</div>
          ) : filtered.map((item, i) => {
            const Icon = item.icon;
            const isActive = i === activeIndex;
            return (
              <button
                key={item.id}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  isActive ? 'bg-emerald-500/10 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                  isActive ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-slate-600 truncate">{item.description}</div>
                  )}
                </div>
                {isActive && <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-4 py-2 flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1"><kbd className="bg-slate-900 border border-slate-800 px-1 rounded">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-900 border border-slate-800 px-1 rounded">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="bg-slate-900 border border-slate-800 px-1 rounded">esc</kbd> close</span>
          {query.trim() && (
            <span className="text-slate-600">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          )}
          <span className="ml-auto flex items-center gap-1"><Command className="w-3 h-3" />K</span>
        </div>
      </div>
    </div>
  );
}
