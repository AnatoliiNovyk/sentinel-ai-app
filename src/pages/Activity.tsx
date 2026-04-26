import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown,
  ExternalLink, Filter, Info, Loader2,
  RefreshCcw, Search, XCircle, Zap, Download,
} from 'lucide-react';
import { supabase, AgentLog, Project } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { downloadFile } from '../lib/exporters';

type ViewTab = 'logs' | 'anomalies';

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

  const [viewTab, setViewTab] = useState<ViewTab>('logs');
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
    { label: 'Total',   value: stats.total,   level: 'all'     as LevelFilter, dot: 'bg-slate-400', sub: undefined },
    { label: 'Info',    value: stats.info,    level: 'info'    as LevelFilter, dot: 'bg-sky-400',     sub: stats.total ? `${Math.round(stats.info / stats.total * 100)}%` : undefined },
    { label: 'Success', value: stats.success, level: 'success' as LevelFilter, dot: 'bg-emerald-400', sub: stats.total ? `${Math.round(stats.success / stats.total * 100)}%` : undefined },
    { label: 'Warn',    value: stats.warn,    level: 'warn'    as LevelFilter, dot: 'bg-amber-400',   sub: stats.total ? `${Math.round(stats.warn / stats.total * 100)}%` : undefined },
    { label: 'Error',   value: stats.error,   level: 'error'   as LevelFilter, dot: 'bg-red-400',     sub: stats.total ? `${Math.round(stats.error / stats.total * 100)}% error rate` : undefined },
  ];

  const exportCsv = useCallback(() => {
    const date = new Date().toISOString().split('T')[0];
    const rows = ['ID,Level,Message,Project,ScanID,CreatedAt'];
    for (const l of filtered) {
      const projName = l.project_id ? (projectMap.get(l.project_id) ?? l.project_id.slice(0, 8)) : '';
      rows.push([
        l.id,
        l.level,
        `"${(l.message ?? '').replace(/"/g, '""')}"`,
        `"${projName.replace(/"/g, '""')}"`,
        l.scan_id ?? '',
        l.created_at,
      ].join(','));
    }
    downloadFile(`activity-${date}.csv`, rows.join('\n'), 'text/csv');
  }, [filtered, projectMap]);

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

          {/* View tabs */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 border border-slate-700">
            <button
              onClick={() => setViewTab('logs')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewTab === 'logs' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Logs
            </button>
            <button
              onClick={() => setViewTab('anomalies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewTab === 'anomalies' ? 'bg-red-900/60 text-red-300 border border-red-700' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Zap className="w-3.5 h-3.5" /> Anomalies
            </button>
          </div>

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

            {/* Export CSV */}
            {logs.length > 0 && (
              <button
                onClick={exportCsv}
                title="Export filtered logs as CSV"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:text-white transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
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
      {viewTab === 'logs' && (
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
            {c.sub && <p className="text-[10px] text-slate-500 mt-0.5">{c.sub}</p>}
          </button>
        ))}
      </div>
      )}

      {/* Anomaly tab */}
      {viewTab === 'anomalies' && !loading && (
        <AnomalyTab logs={logs} projectMap={projectMap} />
      )}
      {viewTab === 'anomalies' && loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" /> Analyzing anomalies…
        </div>
      )}

      {/* Log list */}
      {viewTab === 'logs' && (
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
      )}
    </div>
  );
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

interface Anomaly {
  id: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  count: number;
  windowLabel: string;
}

function detectAnomalies(logs: AgentLog[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // 1. Error spike: bucket by hour, find hours with errors > mean+2σ
  const hourBuckets = new Map<string, number>();
  for (const l of logs) {
    if (l.level !== 'error') continue;
    const d = new Date(l.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    hourBuckets.set(key, (hourBuckets.get(key) ?? 0) + 1);
  }
  const counts = Array.from(hourBuckets.values());
  if (counts.length > 1) {
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const std = Math.sqrt(variance);
    for (const [key, cnt] of hourBuckets.entries()) {
      if (cnt > mean + 2 * std && cnt >= 3) {
        const [y, mo, d, h] = key.split('-').map(Number);
        const dt = new Date(y, mo, d, h);
        anomalies.push({
          id: `error-spike-${key}`,
          severity: cnt > mean + 3 * std ? 'critical' : 'high',
          title: 'Error spike detected',
          description: `${cnt} errors in 1 hour (mean: ${mean.toFixed(1)}, +${((cnt - mean) / std).toFixed(1)}σ)`,
          count: cnt,
          windowLabel: dt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }),
        });
      }
    }
  }

  // 2. Repeated identical error messages
  const msgCount = new Map<string, number>();
  for (const l of logs) {
    if (l.level !== 'error') continue;
    const key = l.message.slice(0, 80);
    msgCount.set(key, (msgCount.get(key) ?? 0) + 1);
  }
  for (const [msg, cnt] of msgCount.entries()) {
    if (cnt >= 5) {
      anomalies.push({
        id: `repeat-err-${msg.slice(0, 30)}`,
        severity: cnt >= 20 ? 'critical' : cnt >= 10 ? 'high' : 'medium',
        title: 'Recurring error pattern',
        description: `"${msg}${msg.length >= 80 ? '…' : ''}" occurred ${cnt} times`,
        count: cnt,
        windowLabel: 'All time',
      });
    }
  }

  // 3. High warn rate: last 6 hours
  const sixH = Date.now() - 6 * 3600000;
  const recentWarn = logs.filter(l => l.level === 'warn' && new Date(l.created_at).getTime() > sixH).length;
  const recentTotal = logs.filter(l => new Date(l.created_at).getTime() > sixH).length;
  if (recentTotal >= 10 && recentWarn / recentTotal > 0.4) {
    anomalies.push({
      id: 'high-warn-rate',
      severity: 'medium',
      title: 'Elevated warning rate',
      description: `${Math.round((recentWarn / recentTotal) * 100)}% of last 6h logs are warnings (${recentWarn}/${recentTotal})`,
      count: recentWarn,
      windowLabel: 'Last 6 hours',
    });
  }

  // 4. No success logs in last 2 hours while other logs exist
  const twoH = Date.now() - 2 * 3600000;
  const recentAll = logs.filter(l => new Date(l.created_at).getTime() > twoH);
  const recentSuccess = recentAll.filter(l => l.level === 'success').length;
  if (recentAll.length >= 5 && recentSuccess === 0) {
    anomalies.push({
      id: 'no-success-2h',
      severity: 'high',
      title: 'No successful operations',
      description: `${recentAll.length} log entries in last 2 hours but 0 successes — agent may be stuck`,
      count: recentAll.length,
      windowLabel: 'Last 2 hours',
    });
  }

  const order = { critical: 0, high: 1, medium: 2 };
  return anomalies.sort((a, b) => order[a.severity] - order[b.severity]);
}

function buildHourlyHeatmap(logs: AgentLog[]): { day: string; hour: number; errors: number; warns: number; total: number }[] {
  const cells: { day: string; hour: number; errors: number; warns: number; total: number }[] = [];
  const now = new Date();
  for (let d = 6; d >= 0; d--) {
    const date = new Date(now.getTime() - d * 86400000);
    const dayLabel = d === 0 ? 'Today' : d === 1 ? 'Yesterday' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    for (let h = 0; h < 24; h++) {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h).getTime();
      const end = start + 3600000;
      const inWindow = logs.filter(l => {
        const t = new Date(l.created_at).getTime();
        return t >= start && t < end;
      });
      cells.push({ day: dayLabel, hour: h, errors: inWindow.filter(l => l.level === 'error').length, warns: inWindow.filter(l => l.level === 'warn').length, total: inWindow.length });
    }
  }
  return cells;
}

const ANOM_COLORS: Record<string, string> = {
  critical: 'border-red-500/40 bg-red-900/20 text-red-300',
  high:     'border-orange-500/40 bg-orange-900/20 text-orange-300',
  medium:   'border-amber-500/40 bg-amber-900/20 text-amber-300',
};
const ANOM_DOT: Record<string, string> = { critical: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-amber-400' };

function AnomalyTab({ logs, projectMap }: { logs: AgentLog[]; projectMap: Map<string, string> }) {
  const anomalies = useMemo(() => detectAnomalies(logs), [logs]);
  const heatmap   = useMemo(() => buildHourlyHeatmap(logs), [logs]);
  const days = useMemo(() => [...new Set(heatmap.map(c => c.day))], [heatmap]);
  const maxTotal = useMemo(() => Math.max(...heatmap.map(c => c.total), 1), [heatmap]);

  const topErrors = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of logs) {
      if (l.level !== 'error') continue;
      const k = l.message.slice(0, 60);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [logs]);

  const errorMax = topErrors[0]?.[1] ?? 1;

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-500">
        <Zap className="w-8 h-8 opacity-30" />
        <p className="text-sm">No log data to analyze</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Anomaly cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-slate-200">Detected Anomalies</h2>
          {anomalies.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/40 border border-red-700 text-red-300 font-bold">{anomalies.length}</span>
          )}
        </div>
        {anomalies.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 flex flex-col items-center gap-2 text-slate-500">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 opacity-70" />
            <p className="text-sm">No anomalies detected in current log sample</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {anomalies.map(a => (
              <div key={a.id} className={`rounded-xl border p-4 ${ANOM_COLORS[a.severity]}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${ANOM_DOT[a.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{a.title}</span>
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${ANOM_COLORS[a.severity]}`}>{a.severity}</span>
                    </div>
                    <p className="text-xs mt-1 opacity-80">{a.description}</p>
                    <p className="text-[10px] mt-1 opacity-50 uppercase tracking-wide">{a.windowLabel}</p>
                  </div>
                  <span className="text-xl font-bold opacity-60 shrink-0">{a.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 7-day hourly heatmap */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-slate-200">7-Day Hourly Activity Heatmap</h2>
          <span className="text-xs text-slate-500 ml-auto">Red = errors · Orange = warnings · Blue = activity</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="w-24 text-[10px] text-slate-600 font-normal text-left pb-1 pr-2">Day</th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="text-[9px] text-slate-700 font-normal pb-1 text-center w-6">
                    {h % 6 === 0 ? `${h}h` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td className="text-[10px] text-slate-500 pr-2 py-0.5 whitespace-nowrap">{day}</td>
                  {Array.from({ length: 24 }, (_, h) => {
                    const cell = heatmap.find(c => c.day === day && c.hour === h);
                    const intensity = cell ? cell.total / maxTotal : 0;
                    const hasErr = (cell?.errors ?? 0) > 0;
                    const hasWarn = (cell?.warns ?? 0) > 0;
                    const bg = hasErr
                      ? `rgba(239,68,68,${0.15 + intensity * 0.7})`
                      : hasWarn
                      ? `rgba(245,158,11,${0.12 + intensity * 0.6})`
                      : cell && cell.total > 0
                      ? `rgba(99,102,241,${0.1 + intensity * 0.5})`
                      : 'transparent';
                    return (
                      <td key={h} className="py-0.5">
                        <div
                          className="w-5 h-5 rounded-sm mx-auto"
                          ref={(el) => { if (el) el.style.backgroundColor = bg; }}
                          title={cell && cell.total > 0 ? `${day} ${h}:00 — ${cell.total} logs, ${cell.errors} errors, ${cell.warns} warns` : undefined}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top error patterns */}
      {topErrors.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <XCircle className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-slate-200">Top Error Patterns</h2>
          </div>
          <div className="space-y-2">
            {topErrors.map(([msg, cnt], i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-4 text-right shrink-0">{i + 1}.</span>
                <span className="flex-1 text-xs text-slate-300 font-mono truncate">{msg}{msg.length >= 60 ? '…' : ''}</span>
                <span className="text-xs font-bold text-red-400 shrink-0 w-8 text-right">{cnt}×</span>
                <div className="w-24 h-1.5 rounded-full bg-slate-800 shrink-0">
                  <div
                    className="h-full rounded-full bg-red-500"
                    ref={(el) => { if (el) el.style.width = `${(cnt / errorMax) * 100}%`; }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project error breakdown */}
      {projectMap.size > 0 && (() => {
        const projErr = new Map<string, number>();
        for (const l of logs) {
          if (l.level === 'error' && l.project_id) {
            projErr.set(l.project_id, (projErr.get(l.project_id) ?? 0) + 1);
          }
        }
        const sorted = [...projErr.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
        if (sorted.length === 0) return null;
        const maxE = sorted[0][1];
        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">Errors by Project</h2>
            </div>
            <div className="space-y-2">
              {sorted.map(([pid, cnt]) => (
                <div key={pid} className="flex items-center gap-3">
                  <span className="flex-1 text-xs text-slate-300 truncate">{projectMap.get(pid) ?? pid.slice(0, 8)}</span>
                  <span className="text-xs font-bold text-amber-400 w-8 text-right shrink-0">{cnt}</span>
                  <div className="w-24 h-1.5 rounded-full bg-slate-800 shrink-0">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      ref={(el) => { if (el) el.style.width = `${(cnt / maxE) * 100}%`; }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
