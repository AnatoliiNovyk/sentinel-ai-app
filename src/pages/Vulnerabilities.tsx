import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bug, Search, Filter, X, CheckSquare, Square, Download,
  CheckCheck, AlertTriangle, ArrowUpDown, ExternalLink,
  Clock, ShieldOff, RefreshCw, ChevronDown, Info,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, type Vulnerability, type Project, type Scan } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { useToast } from '../lib/toastContext';
import { downloadFile } from '../lib/exporters';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

const SEV_STYLES: Record<string, { badge: string; dot: string }> = {
  critical: { badge: 'text-red-300 bg-red-500/10 border-red-500/20',     dot: 'bg-red-400' },
  high:     { badge: 'text-orange-300 bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-400' },
  medium:   { badge: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-400' },
  low:      { badge: 'text-sky-300 bg-sky-500/10 border-sky-500/20',     dot: 'bg-sky-400' },
  info:     { badge: 'text-slate-300 bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-400' },
};

const STATUS_STYLES: Record<string, string> = {
  open:          'text-red-300 bg-red-500/10 border-red-500/20',
  in_progress:   'text-amber-300 bg-amber-500/10 border-amber-500/20',
  accepted:      'text-slate-300 bg-slate-500/10 border-slate-500/20',
  resolved:      'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  false_positive:'text-violet-300 bg-violet-500/10 border-violet-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', accepted: 'Accepted',
  resolved: 'Resolved', false_positive: 'False Positive',
};

type SevFilter    = 'all' | 'critical' | 'high' | 'medium' | 'low' | 'info';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'accepted' | 'resolved' | 'false_positive';
type SortKey      = 'severity' | 'newest' | 'oldest' | 'title' | 'project';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ageDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, onClick, active }: {
  label: string; value: number; color: string;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left w-full transition ${
        active ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
      }`}
    >
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </button>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

function BulkBar({
  count, onResolve, onFalsePositive, onAccept, onClose,
}: {
  count: number;
  onResolve: () => void;
  onFalsePositive: () => void;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex-wrap">
      <span className="text-sm font-medium text-emerald-300">{count} selected</span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={onResolve}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition"
        >
          <CheckCheck className="w-3.5 h-3.5" /> Resolve
        </button>
        <button
          onClick={onAccept}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700 transition"
        >
          <ShieldOff className="w-3.5 h-3.5" /> Accept risk
        </button>
        <button
          onClick={onFalsePositive}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition"
        >
          <X className="w-3.5 h-3.5" /> False positive
        </button>
      </div>
      <button onClick={onClose} title="Clear selection" className="ml-auto text-slate-500 hover:text-white transition p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Vulnerability row ────────────────────────────────────────────────────────

function VulnRow({
  v, project, scan, selected, onToggle,
}: {
  v: Vulnerability;
  project?: Project;
  scan?: Scan;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const navigate = useNavigate();
  const sev  = SEV_STYLES[v.severity] ?? SEV_STYLES.info;
  const age  = ageDays(v.created_at);
  const isBreached = !!v.sla_breached_at;

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border transition-all cursor-default ${
        selected ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800/60 hover:border-slate-700'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(v.id)}
        className="mt-0.5 shrink-0 text-slate-500 hover:text-emerald-400 transition"
        aria-label={selected ? 'Deselect' : 'Select'}
      >
        {selected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
      </button>

      {/* Severity dot */}
      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border capitalize ${sev.badge}`}>
            {v.severity}
          </span>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_STYLES[v.status] ?? STATUS_STYLES.open}`}>
            {STATUS_LABELS[v.status] ?? v.status}
          </span>
          {isBreached && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-red-300 bg-red-500/10 border-red-500/20 flex items-center gap-1">
              <Clock className="w-3 h-3" /> SLA breached
            </span>
          )}
          {v.cve_id && (
            <a
              href={`https://nvd.nist.gov/vuln/detail/${v.cve_id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[10px] font-mono text-sky-400 hover:text-sky-300 hover:underline px-1.5 py-0.5 rounded border border-sky-500/20 bg-sky-500/5 flex items-center gap-1"
            >
              {v.cve_id} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        <div className="mt-1.5 text-sm font-medium text-slate-200 leading-snug">{v.title}</div>

        <div className="mt-1 flex items-center gap-3 flex-wrap text-[10px] text-slate-500">
          {v.asset && <span className="font-mono truncate max-w-xs" title={v.asset}>{v.asset}</span>}
          {project && (
            <button
              onClick={() => navigate('/projects')}
              className="inline-flex items-center gap-0.5 text-slate-400 hover:text-emerald-400 transition"
            >
              {project.name} <ArrowRight className="w-2.5 h-2.5" />
            </button>
          )}
          {scan && (
            <span className="text-slate-600">
              Scan: {scan.scanner ?? 'unknown'}
            </span>
          )}
          <span className="text-slate-600">{age}d ago</span>
        </div>

        {v.note && (
          <div className="mt-1.5 text-xs text-slate-500 italic line-clamp-1">Note: {v.note}</div>
        )}
      </div>

      {/* CVSS */}
      {v.cvss && (
        <div className="shrink-0 text-center hidden sm:block">
          <div className={`text-base font-bold tabular-nums ${
            Number(v.cvss) >= 9 ? 'text-red-400' :
            Number(v.cvss) >= 7 ? 'text-orange-400' :
            Number(v.cvss) >= 4 ? 'text-yellow-400' : 'text-slate-400'
          }`}>{Number(v.cvss).toFixed(1)}</div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider">CVSS</div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function Vulnerabilities() {
  const { user } = useAuth();
  const toast = useToast();
  const [vulns, setVulns]       = useState<Vulnerability[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scans, setScans]       = useState<Scan[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch]         = useState('');
  const [sevFilter, setSevFilter]   = useState<SevFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [hasCve, setHasCve]         = useState(false);
  const [slaBreached, setSlaBreached] = useState(false);
  const [sortBy, setSortBy]         = useState<SortKey>('severity');
  const [page, setPage]             = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Header sticky
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { threshold: 1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Keyboard shortcut for search ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const [vRes, pRes, sRes] = await Promise.all([
      supabase
        .from('vulnerabilities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', user.id),
      supabase.from('scans').select('id,scanner,project_id,created_at').eq('user_id', user.id),
    ]);

    setVulns((vRes.data ?? []) as Vulnerability[]);
    setProjects((pRes.data ?? []) as Project[]);
    setScans((sRes.data ?? []) as unknown as Scan[]);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Real-time ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`vulns-page:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'vulnerabilities',
        filter: `user_id=eq.${user.id}`,
      }, () => { fetchAll(true); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchAll]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { total: vulns.length, critical: 0, high: 0, medium: 0, open: 0, breached: 0 };
    for (const v of vulns) {
      if (v.severity === 'critical') s.critical++;
      if (v.severity === 'high') s.high++;
      if (v.severity === 'medium') s.medium++;
      if (v.status === 'open' || v.status === 'in_progress') s.open++;
      if (v.sla_breached_at) s.breached++;
    }
    return s;
  }, [vulns]);

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vulns.filter(v => {
      if (sevFilter !== 'all' && v.severity !== sevFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (projectFilter !== 'all') {
        const scan = scans.find(s => s.id === v.scan_id);
        if (!scan || scan.project_id !== projectFilter) return false;
      }
      if (hasCve && !v.cve_id) return false;
      if (slaBreached && !v.sla_breached_at) return false;
      if (q) {
        const proj = scans.find(s => s.id === v.scan_id);
        const projName = (projects.find(p => p.id === proj?.project_id)?.name ?? '').toLowerCase();
        return (
          v.title.toLowerCase().includes(q) ||
          (v.asset ?? '').toLowerCase().includes(q) ||
          (v.cve_id ?? '').toLowerCase().includes(q) ||
          projName.includes(q)
        );
      }
      return true;
    });
  }, [vulns, sevFilter, statusFilter, projectFilter, hasCve, slaBreached, search, scans, projects]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'severity') {
        const sd = (SEV_ORDER[b.severity] ?? 0) - (SEV_ORDER[a.severity] ?? 0);
        return sd !== 0 ? sd : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'project') {
        const pa = scans.find(s => s.id === a.scan_id);
        const pb = scans.find(s => s.id === b.scan_id);
        const na = projects.find(p => p.id === pa?.project_id)?.name ?? '';
        const nb = projects.find(p => p.id === pb?.project_id)?.name ?? '';
        return na.localeCompare(nb);
      }
      /* c8 ignore next */
      return 0;
    });
  }, [filtered, sortBy, scans, projects]);

  const paged   = useMemo(() => sorted.slice(0, page * PAGE_SIZE), [sorted, page]);
  const hasMore = paged.length < sorted.length;

  const hasActiveFilter = sevFilter !== 'all' || statusFilter !== 'all' || projectFilter !== 'all' || hasCve || slaBreached || search;

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleOne  = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  });
  const toggleAll  = () => setSelected(prev => prev.size === paged.length ? new Set() : new Set(paged.map(v => v.id)));
  const clearSel   = () => setSelected(new Set());

  // ── Bulk status update ────────────────────────────────────────────────────
  const bulkUpdate = useCallback(async (newStatus: Vulnerability['status']) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selected);
    const now  = new Date().toISOString();
    await supabase
      .from('vulnerabilities')
      .update({ status: newStatus, status_updated_at: now })
      .in('id', ids);
    setVulns(prev => prev.map(v => ids.includes(v.id) ? { ...v, status: newStatus, status_updated_at: now } : v));
    clearSel();
    setBulkLoading(false);
    toast.success(`${ids.length} finding${ids.length > 1 ? 's' : ''} marked as ${STATUS_LABELS[newStatus]}.`);
  }, [selected, toast]);

  // ── Export ────────────────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [exportOpen]);

  const doExport = (fmt: 'csv' | 'json') => {
    const date = new Date().toISOString().split('T')[0];
    const rows  = selected.size > 0 ? sorted.filter(v => selected.has(v.id)) : sorted;
    if (fmt === 'csv') {
      const lines = ['ID,Title,Severity,Status,Asset,CVE,CVSS,Project,AgeDays'];
      for (const v of rows) {
        const scan = scans.find(s => s.id === v.scan_id);
        const proj = projects.find(p => p.id === scan?.project_id);
        lines.push([
          v.id,
          `"${v.title.replace(/"/g, '""')}"`,
          v.severity,
          v.status,
          `"${(v.asset ?? '').replace(/"/g, '""')}"`,
          v.cve_id ?? '',
          v.cvss ?? '',
          `"${(proj?.name ?? '').replace(/"/g, '""')}"`,
          ageDays(v.created_at),
        ].join(','));
      }
      downloadFile(`vulnerabilities-${date}.csv`, lines.join('\n'), 'text/csv');
    } else {
      const payload = rows.map(v => {
        const scan = scans.find(s => s.id === v.scan_id);
        const proj = projects.find(p => p.id === scan?.project_id);
        return {
          id: v.id, title: v.title, severity: v.severity, status: v.status,
          asset: v.asset, cve_id: v.cve_id, cvss: v.cvss,
          project: proj?.name, scanner: scan?.scanner,
          created_at: v.created_at, age_days: ageDays(v.created_at),
          sla_breached: !!v.sla_breached_at,
        };
      });
      downloadFile(`vulnerabilities-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
    }
    setExportOpen(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl space-y-6 pb-12">
      <div ref={sentinelRef} className="h-px" />

      {/* Sticky header */}
      <div className={`sticky top-0 z-30 px-8 transition-all duration-200 ${
        stuck ? 'py-3 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 shadow-lg shadow-slate-950/50' : 'pt-8 pb-4 bg-transparent'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Bug className="w-5 h-5 text-red-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Vulnerabilities</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {vulns.length} total across all projects
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

            {/* Export dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Export {selected.size > 0 && `(${selected.size})`}
                <ChevronDown className="w-3 h-3" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-1.5 w-40 rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => doExport('csv')}
                    className="w-full text-left text-sm px-3 py-2.5 hover:bg-slate-800 text-slate-300 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" /> CSV
                  </button>
                  <button
                    onClick={() => doExport('json')}
                    className="w-full text-left text-sm px-3 py-2.5 hover:bg-slate-800 text-slate-300 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" /> JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-8 grid grid-cols-2 sm:grid-cols-6 gap-4">
        <StatCard label="Total" value={stats.total} color="text-slate-200"
          onClick={() => { setSevFilter('all'); setStatusFilter('all'); }}
          active={sevFilter === 'all' && statusFilter === 'all'} />
        <StatCard label="Critical" value={stats.critical} color="text-red-400"
          onClick={() => setSevFilter(sevFilter === 'critical' ? 'all' : 'critical')}
          active={sevFilter === 'critical'} />
        <StatCard label="High" value={stats.high} color="text-orange-400"
          onClick={() => setSevFilter(sevFilter === 'high' ? 'all' : 'high')}
          active={sevFilter === 'high'} />
        <StatCard label="Medium" value={stats.medium} color="text-yellow-400"
          onClick={() => setSevFilter(sevFilter === 'medium' ? 'all' : 'medium')}
          active={sevFilter === 'medium'} />
        <StatCard label="Open" value={stats.open} color="text-amber-300"
          onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
          active={statusFilter === 'open'} />
        <StatCard label="SLA breached" value={stats.breached} color="text-rose-400"
          onClick={() => setSlaBreached(v => !v)}
          active={slaBreached} />
      </div>

      {/* Filters */}
      <div className="px-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
          {/* Row 1: search + sort */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search findings… (Ctrl+F)"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              {([['severity', 'Severity'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['title', 'A→Z'], ['project', 'Project']] as [SortKey, string][]).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setSortBy(v)}
                  className={`text-xs px-2 py-1 rounded-md border transition ${
                    sortBy === v
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {hasActiveFilter && (
              <button
                onClick={() => { setSearch(''); setSevFilter('all'); setStatusFilter('all'); setProjectFilter('all'); setHasCve(false); setSlaBreached(false); setPage(1); }}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition ml-auto"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>

          {/* Row 2: severity filter pills */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Filter className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            <span className="text-[10px] text-slate-600 uppercase tracking-wider mr-1">Severity</span>
            {(['all', 'critical', 'high', 'medium', 'low', 'info'] as SevFilter[]).map(v => (
              <button
                key={v}
                onClick={() => { setSevFilter(v); setPage(1); }}
                className={`text-xs px-2 py-0.5 rounded-md border capitalize transition ${
                  sevFilter === v
                    ? v === 'all'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : SEV_STYLES[v]?.badge ?? ''
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Row 3: status + project + toggles */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider mr-1">Status</span>
            {(['all', 'open', 'in_progress', 'accepted', 'resolved', 'false_positive'] as StatusFilter[]).map(v => (
              <button
                key={v}
                onClick={() => { setStatusFilter(v); setPage(1); }}
                className={`text-xs px-2 py-0.5 rounded-md border transition ${
                  statusFilter === v
                    ? v === 'all'
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : STATUS_STYLES[v] ?? ''
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {STATUS_LABELS[v] ?? v}
              </button>
            ))}
          </div>

          {/* Row 4: project selector + toggles */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-slate-600 uppercase tracking-wider">Project</span>
            <select
              title="Filter by project"
              value={projectFilter}
              onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
              className="text-xs px-2 py-1 bg-slate-900 border border-slate-700 rounded-md text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox" checked={hasCve}
                onChange={e => { setHasCve(e.target.checked); setPage(1); }}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30"
              />
              Has CVE
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox" checked={slaBreached}
                onChange={e => { setSlaBreached(e.target.checked); setPage(1); }}
                className="rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/30"
              />
              SLA breached
            </label>
          </div>
        </div>
      </div>

      {/* Bulk selection + action bar */}
      {paged.length > 0 && (
        <div className="px-8 flex items-center gap-3 flex-wrap">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            {selected.size === paged.length && paged.length > 0
              ? <><CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> Deselect all</>
              : <><Square className="w-3.5 h-3.5" /> Select all ({paged.length})</>
            }
          </button>
          {sorted.length > 0 && (
            <span className="text-[10px] text-slate-600">
              Showing {paged.length} of {sorted.length} {sorted.length !== vulns.length ? `(filtered from ${vulns.length})` : ''}
            </span>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="px-8">
          <BulkBar
            count={selected.size}
            onResolve={() => bulkUpdate('resolved')}
            onFalsePositive={() => bulkUpdate('false_positive')}
            onAccept={() => bulkUpdate('accepted')}
            onClose={clearSel}
          />
        </div>
      )}

      {/* List */}
      <div className="px-8 space-y-2">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-lg bg-slate-800/40 animate-pulse" />
          ))
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {hasActiveFilter ? (
              <>
                <AlertTriangle className="w-10 h-10 text-slate-700 mb-3" />
                <div className="text-slate-400 font-medium">No vulnerabilities match the filters</div>
                <button
                  onClick={() => { setSearch(''); setSevFilter('all'); setStatusFilter('all'); setProjectFilter('all'); setHasCve(false); setSlaBreached(false); }}
                  className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <Bug className="w-10 h-10 text-slate-700 mb-3" />
                <div className="text-slate-400 font-medium">No vulnerabilities found</div>
                <div className="text-xs text-slate-600 mt-1">Run a scan on any project to discover findings.</div>
              </>
            )}
          </div>
        ) : (
          paged.map(v => {
            const scan = scans.find(s => s.id === v.scan_id);
            const project = projects.find(p => p.id === scan?.project_id);
            return (
              <VulnRow
                key={v.id}
                v={v}
                project={project}
                scan={scan as Scan | undefined}
                selected={selected.has(v.id)}
                onToggle={toggleOne}
              />
            );
          })
        )}

        {hasMore && (
          <div className="text-center pt-3">
            <button
              onClick={() => setPage(p => p + 1)}
              className="text-xs px-4 py-2 rounded-md border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition"
            >
              Load more ({sorted.length - paged.length} remaining)
            </button>
          </div>
        )}

        {paged.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 pt-2">
            <Info className="w-3.5 h-3.5" />
            {selected.size > 0
              ? `${selected.size} of ${paged.length} selected — bulk actions available above`
              : `${paged.length} of ${sorted.length} vulnerabilities shown`}
          </div>
        )}
      </div>

      {/* Bulk loading overlay */}
      {bulkLoading && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-8 py-6 flex items-center gap-3 shadow-2xl">
            <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
            <span className="text-sm text-slate-200">Updating findings…</span>
          </div>
        </div>
      )}
    </div>
  );
}
