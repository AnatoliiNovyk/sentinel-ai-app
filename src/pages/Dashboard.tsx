import { useEffect, useMemo, useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, Activity,
  ArrowRight, Clock, Timer, Radar, TrendingDown, TrendingUp, Minus, Zap, Search, ArrowUpDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, Scan, Project, Vulnerability, DEFAULT_SLA_CONFIG } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import Sparkline from '../components/Sparkline';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveJobs, setLiveJobs] = useState<{id:string;scanner:string;target:string;status:string;created_at:string;project_id:string}[]>([]);
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [findingsSearch, setFindingsSearch] = useState('');
  const [findingsSort, setFindingsSort] = useState<'severity' | 'newest' | 'oldest' | 'title'>('severity');

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [scansRes, projectsRes, vulnsRes, jobsRes] = await Promise.all([
        supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('vulnerabilities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
        supabase.from('scan_jobs').select('id,scanner,target,status,created_at,project_id').eq('user_id', user.id).in('status', ['pending','running']).order('created_at', { ascending: false }).limit(20),
      ]);
      setScans(scansRes.data ?? []);
      setProjects(projectsRes.data ?? []);
      setVulns(vulnsRes.data ?? []);
      setLiveJobs((jobsRes.data ?? []) as typeof liveJobs);
      setLoading(false);
    };
    fetchAll();
    const channel = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vulnerabilities', filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scan_jobs', filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ─────────────────────────────────────────────────────────
  const openVulns = vulns.filter(v => v.status === 'open' || v.status === 'in_progress');
  const resolvedVulns = vulns.filter(v => v.status === 'resolved');

  const trend30 = useMemo(() => buildTrend(vulns, 30), [vulns]);
  const trend14 = useMemo(() => buildTrend(vulns, 14), [vulns]);
  const maxTrend = Math.max(1, ...trend14.map(d => Math.max(d.opened, d.closed)));

  // Sparklines for KPI cards (30-day daily counts per severity)
  const severitySparklines = useMemo(() => buildSeveritySparklines(vulns, 30), [vulns]);

  // Week-over-week delta
  const thisWeek  = trend30.slice(-7).reduce((s, d) => s + d.opened, 0);
  const lastWeek  = trend30.slice(-14, -7).reduce((s, d) => s + d.opened, 0);
  const wowDelta  = thisWeek - lastWeek;

  // Resolution rate
  const resRate = vulns.length === 0 ? 0 : Math.round((resolvedVulns.length / vulns.length) * 100);

  // SLA
  const SLA_DAYS: Record<string, number> = { ...DEFAULT_SLA_CONFIG, ...(profile?.sla_config ?? {}) };
  const now = Date.now();
  const slaRows = openVulns
    .filter(v => v.severity === 'critical' || v.severity === 'high' || v.severity === 'medium')
    .map(v => {
      const ageDays   = (now - new Date(v.created_at).getTime()) / 86_400_000;
      const budget    = SLA_DAYS[v.severity] ?? 30;
      return { v, ageDays, budget, overdue: ageDays > budget, remaining: budget - ageDays };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
  const overdueCount = slaRows.filter(r => r.overdue).length;
  const overdueRows  = slaRows.filter(r => r.overdue);
  const atRiskRows   = slaRows.filter(r => !r.overdue && r.ageDays / r.budget >= 0.75);
  const healthyRows  = slaRows.filter(r => !r.overdue && r.ageDays / r.budget < 0.75);

  // BUG-06: SLA breach notifications — debounced to prevent duplicate writes
  // when WebSocket change + poll fire simultaneously, or multiple tabs are open.
  useEffect(() => {
    if (!user || vulns.length === 0) return;
    const newlyBreached = slaRows.filter(r => r.overdue && !r.v.sla_breached_at).slice(0, 10);
    const atRisk = slaRows.filter(r => !r.overdue && !r.v.sla_warned_at && r.ageDays / r.budget >= 0.75).slice(0, 10);
    if (newlyBreached.length === 0 && atRisk.length === 0) return;

    // Debounce: wait 1.5s before writing, so rapid re-renders collapse into one write
    const timer = setTimeout(async () => {
      const stamp = new Date().toISOString();
      for (const { v, budget, ageDays } of newlyBreached) {
        // Conditional update: only succeeds if sla_breached_at is still null (row-level dedup)
        const { error } = await supabase
          .from('vulnerabilities').update({ sla_breached_at: stamp })
          .eq('id', v.id).is('sla_breached_at', null);
        if (error) continue;
        await supabase.from('notifications').insert({
          user_id: user.id, type: 'sla_breach',
          title: `SLA breached: ${v.severity.toUpperCase()} finding overdue`,
          body: `${v.title} is ${Math.floor(ageDays - budget)}d past its ${budget}-day SLA.`,
          link: 'findings', severity: v.severity === 'critical' ? 'critical' : 'warning',
          metadata: { vulnerability_id: v.id },
        });
      }
      for (const { v, budget, remaining } of atRisk) {
        const { error } = await supabase
          .from('vulnerabilities').update({ sla_warned_at: stamp })
          .eq('id', v.id).is('sla_warned_at', null);
        if (error) continue;
        await supabase.from('notifications').insert({
          user_id: user.id, type: 'sla_warning',
          title: `SLA at risk: ${v.severity.toUpperCase()} finding nearing deadline`,
          body: `${v.title} has ${Math.max(0, Math.ceil(remaining))}d left of its ${budget}-day SLA.`,
          link: 'findings', severity: 'warning',
          metadata: { vulnerability_id: v.id },
        });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, vulns]);  // eslint-disable-line react-hooks/exhaustive-deps

  const completedScans = scans.filter(s => s.status === 'completed').length;
  const activeScans    = liveJobs.length + scans.filter(s => s.status === 'running' || s.status === 'queued').length;

  return (
    <div className="p-8 max-w-7xl space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-slate-500">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Security posture</h1>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
        >
          Launch AI audit <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── KPI row with sparklines ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SparkKpi
          label="Projects"
          value={projects.length}
          icon={Shield}
          accent="emerald"
          sparkData={severitySparklines.projects}
          sparkColor="#10b981"
          subLabel={`${completedScans} scans`}
        />
        <SparkKpi
          label="Open findings"
          value={openVulns.length}
          icon={AlertTriangle}
          accent="red"
          sparkData={severitySparklines.critical}
          sparkColor="#ef4444"
          subLabel={wowDelta === 0 ? 'vs last week' : `${wowDelta > 0 ? '+' : ''}${wowDelta} vs last week`}
          trend={wowDelta}
        />
        <SparkKpi
          label="Critical"
          value={openVulns.filter(v => v.severity === 'critical').length}
          icon={AlertTriangle}
          accent="red"
          sparkData={severitySparklines.critical}
          sparkColor="#ef4444"
        />
        <SparkKpi
          label="Resolved"
          value={resolvedVulns.length}
          icon={CheckCircle2}
          accent="emerald"
          sparkData={severitySparklines.resolved}
          sparkColor="#10b981"
          subLabel={`${resRate}% resolution rate`}
        />
        <SparkKpi
          label="Active scans"
          value={activeScans}
          icon={Activity}
          accent="sky"
          sparkData={severitySparklines.scans}
          sparkColor="#38bdf8"
          subLabel={`${completedScans} completed`}
        />
      </div>

      {/* ── Main content 3-col ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend chart — 2 col */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="font-semibold">Remediation trend</h2>
              <p className="text-xs text-slate-500 mt-0.5">Opened vs. closed findings — last 14 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Opened
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Closed
              </span>
            </div>
          </div>

          {/* SVG area chart */}
          <AreaTrendChart trend={trend14} max={maxTrend} />

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 px-1">
            {trend14.filter((_, i) => i % 3 === 0 || i === trend14.length - 1).map(d => (
              <span key={d.day} className="text-[10px] text-slate-600">{d.label}</span>
            ))}
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800">
            <SummaryPill label="Opened (14d)" value={trend14.reduce((s, d) => s + d.opened, 0)} color="text-red-400" />
            <SummaryPill label="Closed (14d)" value={trend14.reduce((s, d) => s + d.closed, 0)} color="text-emerald-400" />
            <SummaryPill label="Net delta" value={trend14.reduce((s, d) => s + d.opened - d.closed, 0)} color={trend14.reduce((s, d) => s + d.opened - d.closed, 0) > 0 ? 'text-red-400' : 'text-emerald-400'} signed />
          </div>
        </div>

        {/* Project health — 1 col */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Project risk</h2>
            <Radar className="w-4 h-4 text-emerald-400" />
          </div>
          {projects.length > 0 && (
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r)}
                  className={`text-xs px-2 py-1 rounded-md border transition capitalize ${
                    riskFilter === r
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {r === 'all' ? 'All' : r}
                </button>
              ))}
            </div>
          )}
          {projects.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">No projects</div>
          ) : (
            <div className="flex-1 space-y-4 overflow-auto scrollbar-thin">
              {[...projects]
                .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
                .filter(p => {
                  const score = p.risk_score || 0;
                  if (riskFilter === 'all') return true;
                  if (riskFilter === 'critical') return score >= 70;
                  if (riskFilter === 'high') return score >= 40 && score < 70;
                  if (riskFilter === 'medium') return score >= 15 && score < 40;
                  if (riskFilter === 'low') return score < 15;
                  return true;
                })
                .map(p => {
                  const score = p.risk_score || 0;
                  const barColor = score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-orange-500' : score >= 15 ? 'bg-amber-400' : 'bg-emerald-500';
                  const textColor = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-orange-400' : score >= 15 ? 'text-amber-400' : 'text-emerald-400';
                  return (
                    <div key={p.id} className="group">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-slate-300 truncate pr-2 group-hover:text-white transition" title={p.name}>{p.name}</span>
                        <span className={`text-[10px] font-bold tabular-nums ${textColor}`}>{score}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full ${barColor} transition-all duration-700 rounded-full`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
          <button onClick={() => navigate('/projects')} className="mt-5 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition">
            Manage projects <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Bottom row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA Watch */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">SLA watch</h2>
            <div className="flex items-center gap-1.5">
              {overdueCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md border bg-red-500/10 border-red-500/30 text-red-300">
                  {overdueCount} overdue
                </span>
              )}
            </div>
          </div>
          {slaRows.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              <Timer className="w-6 h-6 mx-auto mb-2 text-slate-700" />
              All SLAs on track
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-auto pr-1 scrollbar-thin">
              {overdueRows.length > 0 && <SlaGroup label="Overdue" tone="red" rows={overdueRows.slice(0, 3)} />}
              {atRiskRows.length > 0 && <SlaGroup label="At risk" tone="amber" rows={atRiskRows.slice(0, 3)} />}
              {healthyRows.length > 0 && overdueRows.length === 0 && <SlaGroup label="Healthy" tone="slate" rows={healthyRows.slice(0, 3)} />}
            </div>
          )}
        </div>

        {/* Live jobs + Recent scans */}
        <div className="lg:col-span-2 space-y-4">
          {liveJobs.length > 0 && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-sky-400 animate-pulse" />
                <span className="text-sm font-semibold text-sky-300">Live scans ({liveJobs.length})</span>
              </div>
              <div className="space-y-2">
                {liveJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping shrink-0" />
                      <span className="font-medium text-white">{job.scanner}</span>
                      <span className="text-slate-400 truncate font-mono">{job.target}</span>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded border text-[10px] font-semibold ${
                      job.status === 'running'
                        ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
                        : 'text-slate-400 bg-slate-800 border-slate-700'
                    }`}>{job.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Recent scans</h2>
            <button onClick={() => navigate('/scans')} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
              View all
            </button>
          </div>
          {loading ? (
            <div className="py-10 text-center text-slate-500 text-sm">Loading...</div>
          ) : scans.length === 0 ? (
            <div className="py-10 text-center">
              <Radar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <div className="text-sm text-slate-500">No scans yet</div>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {scans.slice(0, 6).map(s => (
                <div key={s.id} className="py-3 flex items-center justify-between group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                      s.status === 'completed' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' :
                      s.status === 'failed'    ? 'text-red-400 border-red-500/20 bg-red-500/5' :
                      'text-sky-400 border-sky-500/20 bg-sky-500/5 animate-pulse'
                    }`}>
                      <Activity className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white group-hover:text-emerald-400 transition truncate">
                        {s.scanner} scan
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                        {s.project_id.slice(0, 8).toUpperCase()} · {new Date(s.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono">
                      {(s.severity_summary?.critical ?? 0) > 0 && <span className="text-red-400">{s.severity_summary.critical}C</span>}
                      {(s.severity_summary?.high ?? 0) > 0 && <span className="text-orange-400">{s.severity_summary.high}H</span>}
                      {(s.severity_summary?.medium ?? 0) > 0 && <span className="text-yellow-400">{s.severity_summary.medium}M</span>}
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* ── Top open findings ──────────────────────────────────────────── */}
      {openVulns.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Top open findings</h2>
              <p className="text-xs text-slate-500 mt-0.5">Highest-severity unresolved vulnerabilities across all projects</p>
            </div>
            <button onClick={() => navigate('/projects')} className="text-xs text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {/* Search + sort controls */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                value={findingsSearch}
                onChange={e => setFindingsSearch(e.target.value)}
                placeholder="Search findings…"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              {([['severity', 'Severity'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['title', 'A→Z']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFindingsSort(val)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition ${
                    findingsSort === val
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {(findingsSearch || findingsSort !== 'severity') && (
              <button
                onClick={() => { setFindingsSearch(''); setFindingsSort('severity'); }}
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-amber-500/40 hover:text-amber-300 px-2.5 py-1.5 rounded-md transition text-slate-400"
              >
                ✕ Clear
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-800/50">
            {(() => {
              const SEV_W: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
              const q = findingsSearch.trim().toLowerCase();
              const filtered = openVulns.filter(v =>
                !q || v.title.toLowerCase().includes(q) || (v.asset ?? '').toLowerCase().includes(q) || (v.cve_id ?? '').toLowerCase().includes(q)
              );
              const sorted = [...filtered].sort((a, b) => {
                if (findingsSort === 'severity') {
                  const sd = (SEV_W[b.severity] ?? 0) - (SEV_W[a.severity] ?? 0);
                  return sd !== 0 ? sd : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                }
                if (findingsSort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                if (findingsSort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                if (findingsSort === 'title') return a.title.localeCompare(b.title);
                return 0;
              });
              const displayed = sorted.slice(0, 10);
              if (displayed.length === 0) return (
                <div className="py-8 text-center text-sm text-slate-500">No findings match the search.</div>
              );
              return displayed.map(v => {
                const proj = projects.find(p => p.id === v.project_id);
                const ageDays = Math.floor((Date.now() - new Date(v.created_at).getTime()) / 86_400_000);
                const sevColors: Record<string, string> = {
                  critical: 'text-red-300 bg-red-500/10 border-red-500/20',
                  high:     'text-orange-300 bg-orange-500/10 border-orange-500/20',
                  medium:   'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
                  low:      'text-slate-300 bg-slate-500/10 border-slate-500/20',
                  info:     'text-sky-300 bg-sky-500/10 border-sky-500/20',
                };
                return (
                  <div key={v.id} className="py-3 flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${sevColors[v.severity] ?? sevColors.info}`}>
                      {v.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{v.title}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                        {proj && <span className="truncate">{proj.name}</span>}
                        {v.cve_id && (
                          <a
                            href={`https://nvd.nist.gov/vuln/detail/${v.cve_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-400 hover:text-sky-300 hover:underline font-mono shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            {v.cve_id}
                          </a>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">{ageDays}d</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function SparkKpi({
  label, value, icon: Icon, accent, sparkData, sparkColor, subLabel, trend,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
  accent: 'emerald' | 'sky' | 'red';
  sparkData: number[];
  sparkColor: string;
  subLabel?: string;
  trend?: number;
}) {
  const iconColors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    sky:     'text-sky-400 bg-sky-500/10 border-sky-500/20',
    red:     'text-red-400 bg-red-500/10 border-red-500/20',
  }[accent];

  const TrendIcon = trend === undefined || trend === 0 ? Minus : trend > 0 ? TrendingUp : TrendingDown;
  const trendColor = trend === undefined || trend === 0 ? 'text-slate-500' : trend > 0 ? 'text-red-400' : 'text-emerald-400';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 hover:border-slate-700 transition flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <div className={`w-7 h-7 rounded-md border flex items-center justify-center ${iconColors}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight tabular-nums">{value}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex-1 min-w-0">
          {subLabel && (
            <div className={`flex items-center gap-1 text-[10px] ${trendColor}`}>
              {trend !== undefined && <TrendIcon className="w-3 h-3" />}
              <span className="text-slate-500 truncate">{subLabel}</span>
            </div>
          )}
        </div>
        <Sparkline data={sparkData.length ? sparkData : [0, 0]} color={sparkColor} width={80} height={28} />
      </div>
    </div>
  );
}

function AreaTrendChart({ trend, max }: { trend: { day: string; label: string; opened: number; closed: number }[]; max: number }) {
  if (!trend.length) return null;

  const W = 600, H = 140, pad = 8;
  const w = W - pad * 2, h = H - pad * 2;

  const px = (i: number) => pad + (i / (trend.length - 1)) * w;
  const py = (v: number) => pad + h - (v / max) * h;

  const line = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ');

  const area = (arr: number[]) =>
    `${line(arr)} L ${px(arr.length - 1)} ${H} L ${px(0)} ${H} Z`;

  const opened = trend.map(d => d.opened);
  const closed  = trend.map(d => d.closed);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
      <defs>
        <linearGradient id="grad-opened" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-closed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad} x2={W - pad} y1={pad + h * (1 - f)} y2={pad + h * (1 - f)}
          stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      {/* Areas */}
      <path d={area(opened)} fill="url(#grad-opened)" />
      <path d={area(closed)}  fill="url(#grad-closed)" />
      {/* Lines */}
      <path d={line(opened)} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={line(closed)}  fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SummaryPill({ label, value, color, signed }: { label: string; value: number; color: string; signed?: boolean }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>
        {signed && value > 0 ? '+' : ''}{value}
      </div>
    </div>
  );
}

/* ── Data helpers ────────────────────────────────────────────────────────────── */

function buildTrend(vulns: Vulnerability[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: { day: string; label: string; opened: number; closed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ day: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), opened: 0, closed: 0 });
  }
  const idx = (iso: string) => buckets.findIndex(b => b.day === iso.slice(0, 10));
  for (const v of vulns) {
    const oi = idx(v.created_at);
    if (oi >= 0) buckets[oi].opened++;
    if ((v.status === 'resolved' || v.status === 'false_positive') && v.status_updated_at) {
      const ci = idx(v.status_updated_at);
      if (ci >= 0) buckets[ci].closed++;
    }
  }
  return buckets;
}

function buildSeveritySparklines(vulns: Vulnerability[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const critical = Array(days).fill(0);
  const resolved = Array(days).fill(0);
  const projects = Array(days).fill(0).map((_, i) => i + 1); // monotonic
  const scansArr  = Array(days).fill(0);

  for (const v of vulns) {
    const ageDays = Math.floor((today.getTime() - new Date(v.created_at).setHours(0,0,0,0)) / 86_400_000);
    const dayIdx  = days - 1 - ageDays;
    if (dayIdx >= 0 && dayIdx < days) {
      if (v.severity === 'critical') critical[dayIdx]++;
      if (v.status === 'resolved')   resolved[dayIdx]++;
    }
  }

  return { critical, resolved, projects, scans: scansArr };
}

/* ── Shared sub-components ───────────────────────────────────────────────────── */

function SlaGroup({ label, tone, rows }: {
  label: string;
  tone: 'red' | 'amber' | 'slate';
  rows: { v: Vulnerability; ageDays: number; budget: number; overdue: boolean; remaining: number }[];
}) {
  const toneCls = {
    red:   'text-red-300 bg-red-500/5 border-red-500/20',
    amber: 'text-amber-300 bg-amber-500/5 border-amber-500/20',
    slate: 'text-slate-300 bg-slate-800/30 border-slate-700',
  }[tone];
  return (
    <div className={`rounded-md border ${toneCls} p-2.5`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-medium mb-2 opacity-80">
        <span>{label}</span><span>{rows.length}</span>
      </div>
      <div className="space-y-2">
        {rows.map(({ v, ageDays, budget, overdue, remaining }) => (
          <div key={v.id} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-100" title={v.title}>{v.title}</span>
              <span className={`shrink-0 font-mono ${overdue ? 'text-red-400' : tone === 'amber' ? 'text-amber-300' : 'text-slate-400'}`}>
                {overdue ? `+${Math.floor(ageDays - budget)}d` : `${Math.max(0, Math.ceil(remaining))}d left`}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${overdue ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (ageDays / budget) * 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" /><span className="uppercase">{v.severity}</span><span>·</span><span>SLA {budget}d</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued:    'bg-slate-700/50 text-slate-300',
    running:   'bg-sky-500/10 text-sky-300 border border-sky-500/20',
    completed: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    failed:    'bg-red-500/10 text-red-300 border border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-1 rounded-md ${map[status] ?? map.queued}`}>
      {status}
    </span>
  );
}
