import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, BellOff, Check, CheckCheck, Trash2, AlertTriangle,
  FileText, Radar, Info, Zap, ShieldAlert, ArrowRight, X,
  RefreshCw, Filter, Download, Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, type Notification } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { useToast } from '../lib/toastContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(delta / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function groupByDate(items: Notification[]): { label: string; items: Notification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This week', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const n of items) {
    const t = new Date(n.created_at).getTime();
    if (t >= today) groups[0].items.push(n);
    else if (t >= yesterday) groups[1].items.push(n);
    else if (t >= weekAgo) groups[2].items.push(n);
    else groups[3].items.push(n);
  }

  return groups.filter(g => g.items.length > 0);
}

function iconFor(type: string) {
  if (type === 'scan_completed') return Radar;
  if (type === 'report_ready') return FileText;
  if (type === 'critical_finding') return AlertTriangle;
  if (type === 'sla_breach') return Zap;
  if (type === 'project_created') return ShieldAlert;
  return Bell;
}

const TYPE_LABELS: Record<string, string> = {
  scan_completed: 'Scan',
  report_ready: 'Report',
  critical_finding: 'Finding',
  sla_breach: 'SLA',
  project_created: 'Project',
};

const SEV_STYLES: Record<string, { badge: string; dot: string; row: string }> = {
  critical: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dot:   'bg-rose-400',
    row:   'border-rose-500/10 hover:border-rose-500/20',
  },
  warning: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dot:   'bg-amber-400',
    row:   'border-amber-500/10 hover:border-amber-500/20',
  },
  success: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dot:   'bg-emerald-400',
    row:   'border-emerald-500/10 hover:border-emerald-500/20',
  },
  info: {
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    dot:   'bg-sky-400',
    row:   'border-sky-500/10 hover:border-sky-500/20',
  },
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotifRow({
  n,
  onRead,
  onDelete,
}: {
  n: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const Icon = iconFor(n.type);
  const sev = SEV_STYLES[n.severity] ?? SEV_STYLES.info;
  const typeLabel = TYPE_LABELS[n.type] ?? n.type;
  const isUnread = !n.read_at;

  const handleNavigate = () => {
    if (!n.read_at) onRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${sev.row} ${
        isUnread ? 'bg-slate-900/60' : 'bg-slate-900/20'
      }`}
    >
      {/* Icon */}
      <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-md border flex items-center justify-center ${sev.badge}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isUnread && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${sev.dot}`} aria-label="unread" />
          )}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${sev.badge}`}>
            {typeLabel}
          </span>
          <span className="text-xs text-slate-500">{timeAgo(n.created_at)}</span>
        </div>
        <div className="mt-1 text-sm font-medium text-slate-200 leading-snug">{n.title}</div>
        {n.body && <div className="mt-0.5 text-xs text-slate-400 line-clamp-2">{n.body}</div>}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 mt-0.5">
        {n.link && (
          <button
            onClick={handleNavigate}
            title="Go to related page"
            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {isUnread && (
          <button
            onClick={() => onRead(n.id)}
            title="Mark as read"
            className="p-1.5 rounded-md text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(n.id)}
          title="Delete notification"
          className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

type ReadFilter = 'all' | 'unread' | 'read';
type SevFilter  = 'all' | 'critical' | 'warning' | 'success' | 'info';
type TypeFilter = 'all' | 'scan_completed' | 'report_ready' | 'critical_finding' | 'sla_breach' | 'project_created';

export default function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readFilter, setReadFilter]   = useState<ReadFilter>('all');
  const [sevFilter, setSevFilter]     = useState<SevFilter>('all');
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const headerRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    setItems((data ?? []) as Notification[]);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Real-time ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-page:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchAll(true); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchAll]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    await supabase.from('notifications').update({ read_at: now }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
  }, []);

  const deleteOne = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setItems(prev => prev.filter(n => n.id !== id));
    toast.success('Notification deleted.');
  }, [toast]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);
    setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })));
    toast.success('All notifications marked as read.');
  }, [user, toast]);

  const deleteAllRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .not('read_at', 'is', null);
    setItems(prev => prev.filter(n => !n.read_at));
    toast.success('All read notifications deleted.');
  }, [user, toast]);

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const date = new Date().toISOString().split('T')[0];
    const rows = filtered.length > 0 ? filtered : items;
    const lines = ['ID,Title,Body,Type,Severity,Read,Created'];
    for (const n of rows) {
      lines.push([
        n.id,
        `"${(n.title ?? '').replace(/"/g, '""')}"`,
        `"${(n.body ?? '').replace(/"/g, '""')}"`,
        n.type,
        n.severity,
        n.read_at ? 'yes' : 'no',
        n.created_at,
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `notifications-${date}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filtered, items]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const unreadCount   = useMemo(() => items.filter(n => !n.read_at).length, [items]);
  const criticalCount = useMemo(() => items.filter(n => n.severity === 'critical' && !n.read_at).length, [items]);
  const readCount     = useMemo(() => items.filter(n => !!n.read_at).length, [items]);
  const todayCount    = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return items.filter(n => new Date(n.created_at) >= todayStart).length;
  }, [items]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(n => {
      if (readFilter === 'unread' && n.read_at) return false;
      if (readFilter === 'read' && !n.read_at) return false;
      if (sevFilter !== 'all' && n.severity !== sevFilter) return false;
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      if (q && !n.title.toLowerCase().includes(q) && !(n.body ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, readFilter, sevFilter, typeFilter, searchQuery]);

  const paged = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = paged.length < filtered.length;

  const grouped = useMemo(() => groupByDate(paged), [paged]);

  const hasActiveFilter = readFilter !== 'all' || sevFilter !== 'all' || typeFilter !== 'all' || !!searchQuery.trim();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-6 pb-12">
      {/* Sticky sentinel */}
      <div ref={headerRef} className="h-px" />

      {/* Header */}
      <div className={`sticky top-0 z-30 px-8 transition-all duration-200 ${
        stuck ? 'py-3 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 shadow-lg shadow-slate-950/50' : 'pt-8 pb-4 bg-transparent'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Notification Center</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {items.length} total · {unreadCount} unread
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              title="Refresh"
              className="p-2 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            {readCount > 0 && (
              <button
                onClick={deleteAllRead}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear read
              </button>
            )}
            <button
              onClick={exportCsv}
              title="Export as CSV"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-8 grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard label="Total" value={items.length} color="text-slate-200" />
        <StatCard label="Unread" value={unreadCount} color="text-sky-300" sub="awaiting action" />
        <StatCard label="Critical unread" value={criticalCount} color="text-rose-400" />
        <StatCard label="Read" value={readCount} color="text-emerald-400" />
        <StatCard label="Today" value={todayCount} color="text-violet-400" sub="received today" />
      </div>

      {/* Filters */}
      <div className="px-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" /> Filters
            {hasActiveFilter && (
              <button
                onClick={() => { setReadFilter('all'); setSevFilter('all'); setTypeFilter('all'); setSearchQuery(''); setPage(1); }}
                className="ml-auto inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 normal-case tracking-normal font-medium"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search notifications…"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Read status */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider self-center mr-1">Status</span>
            {(['all', 'unread', 'read'] as ReadFilter[]).map(v => (
              <button
                key={v}
                onClick={() => { setReadFilter(v); setPage(1); }}
                className={`text-xs px-2.5 py-1 rounded-md border capitalize transition ${
                  readFilter === v
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {v === 'all' ? 'All' : v === 'unread' ? 'Unread' : 'Read'}
              </button>
            ))}
          </div>

          {/* Severity */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider self-center mr-1">Severity</span>
            {(['all', 'critical', 'warning', 'success', 'info'] as SevFilter[]).map(v => {
              const cls = v === 'all' ? '' : SEV_STYLES[v]?.badge ?? '';
              return (
                <button
                  key={v}
                  onClick={() => { setSevFilter(v); setPage(1); }}
                  className={`text-xs px-2.5 py-1 rounded-md border capitalize transition ${
                    sevFilter === v
                      ? v === 'all'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : cls
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {/* Type */}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider self-center mr-1">Type</span>
            {(['all', 'scan_completed', 'report_ready', 'critical_finding', 'sla_breach', 'project_created'] as TypeFilter[]).map(v => (
              <button
                key={v}
                onClick={() => { setTypeFilter(v); setPage(1); }}
                className={`text-xs px-2.5 py-1 rounded-md border transition ${
                  typeFilter === v
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {v === 'all' ? 'All' : TYPE_LABELS[v] ?? v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="px-8 space-y-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {hasActiveFilter ? (
              <>
                <BellOff className="w-10 h-10 text-slate-700 mb-3" />
                <div className="text-slate-400 font-medium">No notifications match the filters</div>
                <button
                  onClick={() => { setReadFilter('all'); setSevFilter('all'); setTypeFilter('all'); }}
                  className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <Bell className="w-10 h-10 text-slate-700 mb-3" />
                <div className="text-slate-400 font-medium">No notifications yet</div>
                <div className="text-xs text-slate-600 mt-1">
                  Notifications appear here when scans complete, reports are ready, or critical findings are detected.
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {grouped.map(group => (
              <div key={group.label}>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>{group.label}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{group.items.length}</span>
                </div>
                <div className="space-y-2">
                  {group.items.map(n => (
                    <NotifRow key={n.id} n={n} onRead={markRead} onDelete={deleteOne} />
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="text-xs px-4 py-2 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
                >
                  Load more ({filtered.length - paged.length} remaining)
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 pt-2">
              <Info className="w-3.5 h-3.5" />
              Showing {paged.length} of {filtered.length} notifications
            </div>
          </>
        )}
      </div>
    </div>
  );
}
