import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown,
  ExternalLink, Filter, Info, Loader2,
  RefreshCcw, Search, XCircle,
} from 'lucide-react';
import { supabase, AgentLog, Project } from '../lib/supabase';
import { useAuth } from '../context/useAuth';

const PAGE_SIZE = 50;

type LevelFilter = 'all' | 'info' | 'success' | 'error' | 'warn';

const LEVEL_COLORS: Record<string, string> = {
  info:    'text-sky-400 bg-sky-900/30 border-sky-800',
  success: 'text-emerald-400 bg-emerald-900/30 border-emerald-800',
  error:   'text-red-400 bg-red-900/30 border-red-800',
  warn:    'text-amber-400 bg-amber-900/30 border-amber-800',
};

const LEVEL_DOT: Record<string, string> = {
  info:    'bg-sky-400',
  success: 'bg-emerald-400',
  error:   'bg-red-400',
  warn:    'bg-amber-400',
};

const LEVEL_ICON: Record<string, React.ReactNode> = {
  info:    <Info className="w-3.5 h-3.5" />,
  success: <CheckCircle2 className="w-3.5 h-3.5" />,
  error:   <XCircle className="w-3.5 h-3.5" />,
  warn:    <AlertTriangle className="w-3.5 h-3.5" />,
};

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function groupByDay(logs: AgentLog[]): Map<string, AgentLog[]> {
  const map = new Map<string, AgentLog[]>();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const log of logs) {
    const d = new Date(log.created_at);
    let label: string;
    if (d.toDateString() === today) label = 'Today';
    else if (d.toDateString() === yesterday) label = 'Yesterday';
    else label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const arr = map.get(label) ?? [];
    arr.push(log);
    map.set(label, arr);
  }
  return map;
}

interface LogRowProps {
  log: AgentLog;
  projectMap: Map<string, string>;
  onProjectClick: (id: string) => void;
}

function LogRow({ log, projectMap, onProjectClick }: LogRowProps) {
  const projName = log.project_id ? (projectMap.get(log.project_id) ?? log.project_id.slice(0, 8)) : null;

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-800/40 transition-colors border-b border-slate-800/50 last:border-0">
      {/* Level badge */}
      <span className={`flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide shrink-0 ${LEVEL_COLORS[log.level] ?? ''}`}>
        {LEVEL_ICON[log.level]}
        {log.level}
      </span>

      {/* Message */}
      <span className="flex-1 text-sm text-slate-200 font-mono leading-relaxed break-all">
        {log.message}
      </span>

      {/* Meta */}
      <div className="flex items-center gap-3 shrink-0 ml-2">
        {projName && (
          <button
            onClick={() => log.project_id && onProjectClick(log.project_id)}
            title="Open project"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-400 transition"
          >
            <ExternalLink className="w-3 h-3" />
            {projName}
          </button>
        )}
        {log.scan_id && (
          <span className="text-xs text-slate-600 font-mono" title={log.scan_id}>
            scan:{log.scan_id.slice(0, 6)}
          </span>
        )}
        <span className="text-xs text-slate-600 whitespace-nowrap">{formatAge(log.created_at)}</span>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs]       = useState<AgentLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage]       = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filters
  const [search, setSearch]           = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sticky header sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const projectMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach(p => m.set(p.id, p.name));
    return m;
  }, [projects]);

  // Load projects
  useEffect(() => {
    if (!user) return;
    supabase.from('projects').select('id,name').eq('user_id', user.id)
      .then(({ data }) => setProjects((data ?? []) as Project[]));
  }, [user]);

  const fetchLogs = useCallback(async (pageNum: number, append = false) => {
    if (!user) return;
    if (pageNum === 0) setLoading(true); else setLoadingMore(true);

    let q = supabase
      .from('agent_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE);

    if (levelFilter !== 'all') q = q.eq('level', levelFilter);
    if (projectFilter !== 'all') q = q.eq('project_id', projectFilter);

    const { data } = await q;
    const rows = (data ?? []) as AgentLog[];

    setLogs(prev => append ? [...prev, ...rows] : rows);
    setHasMore(rows.length === PAGE_SIZE + 1);
    if (rows.length > PAGE_SIZE) rows.pop();

    if (pageNum === 0) setLoading(false); else setLoadingMore(false);
  }, [user, levelFilter, projectFilter]);

  // Initial + filter change
  useEffect(() => {
    setPage(0);
    fetchLogs(0, false);
  }, [fetchLogs]);

  // Real-time INSERT subscription
  useEffect(() => {
    if (!autoRefresh) return;
    const ch = supabase.channel('activity_all_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' },
        (payload) => {
          const newLog = payload.new as AgentLog;
          setLogs(prev => [newLog, ...prev.slice(0, PAGE_SIZE * (page + 1) - 1)]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [autoRefresh, page]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchLogs(next, true);
  };

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.message.toLowerCase().includes(q) ||
      (l.scan_id ?? '').toLowerCase().includes(q) ||
      (l.project_id ? (projectMap.get(l.project_id) ?? '').toLowerCase().includes(q) : false)
    );
  }, [logs, search, projectMap]);

  // Stats
  const stats = useMemo(() => ({
    total:   logs.length,
    info:    logs.filter(l => l.level === 'info').length,
    success: logs.filter(l => l.level === 'success').length,
    warn:    logs.filter(l => l.level === 'warn').length,
    error:   logs.filter(l => l.level === 'error').length,
  }), [logs]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const statCards = [
    { label: 'Total',   value: stats.total,   level: 'all'     as LevelFilter, dot: 'bg-slate-400' },
    { label: 'Info',    value: stats.info,    level: 'info'    as LevelFilter, dot: 'bg-sky-400' },
    { label: 'Success', value: stats.success, level: 'success' as LevelFilter, dot: 'bg-emerald-400' },
    { label: 'Warn',    value: stats.warn,    level: 'warn'    as LevelFilter, dot: 'bg-amber-400' },
    { label: 'Error',   value: stats.error,   level: 'error'   as LevelFilter, dot: 'bg-red-400' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Sticky header sentinel */}
      <div ref={sentinelRef} className="h-px w-full" />

      {/* Header */}
      <div className={`sticky top-0 z-20 -mx-6 px-6 py-4 transition-all ${stuck ? 'bg-slate-950/95 backdrop-blur border-b border-slate-800 shadow-lg' : ''}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-slate-100">Activity Log</h1>
          </div>
          <span className="text-sm text-slate-500">Agent audit trail across all projects</span>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search logs…"
                className="pl-8 pr-4 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-violet-500 w-52"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(p => !p)}
              title="Toggle filters"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition ${showFilters ? 'bg-violet-600 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-violet-500'}`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
            </button>

            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(p => !p)}
              title={autoRefresh ? 'Pause live updates' : 'Enable live updates'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition ${autoRefresh ? 'bg-emerald-900/40 border-emerald-700 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
          </div>
        </div>

        {/* Filters row */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            {/* Level pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(['all', 'info', 'success', 'warn', 'error'] as LevelFilter[]).map(lv => (
                <button
                  key={lv}
                  onClick={() => setLevelFilter(lv)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                    levelFilter === lv
                      ? lv === 'all'
                        ? 'bg-slate-600 border-slate-500 text-white'
                        : `${LEVEL_COLORS[lv]} opacity-100`
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {lv !== 'all' && <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[lv]}`} />}
                  {lv === 'all' ? 'All levels' : lv}
                </button>
              ))}
            </div>

            {/* Project select */}
            <select
              title="Filter by project"
              value={projectFilter}
              onChange={e => { setProjectFilter(e.target.value); setPage(0); }}
              className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-violet-500 text-slate-300"
            >
              <option value="all">All projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map(c => (
          <button
            key={c.label}
            onClick={() => setLevelFilter(c.level)}
            className={`text-left p-4 rounded-xl border transition-all ${
              levelFilter === c.level
                ? 'border-violet-500 bg-violet-900/20'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span className="text-xs text-slate-400 uppercase tracking-wide font-semibold">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{c.value.toLocaleString()}</p>
          </button>
        ))}
      </div>

      {/* Log list */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading activity log…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-500">
            <Activity className="w-8 h-8 opacity-40" />
            <p className="text-sm">No log entries match your filters</p>
          </div>
        ) : (
          <>
            {Array.from(grouped.entries()).map(([day, dayLogs]) => (
              <div key={day}>
                {/* Day separator */}
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/60 border-b border-slate-700">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{day}</span>
                  <span className="text-xs text-slate-600">{dayLogs.length} entries</span>
                </div>
                {dayLogs.map(log => (
                  <LogRow
                    key={log.id}
                    log={log}
                    projectMap={projectMap}
                    onProjectClick={id => navigate(`/projects?id=${id}`)}
                  />
                ))}
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center py-4 border-t border-slate-800">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
