import { useState, useMemo } from 'react';
import {
  ShieldAlert, ExternalLink, Activity, Zap, Timer, Clock,
  ArrowRight, Search, ArrowUpDown, Users, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Scan, Vulnerability, Project, DEFAULT_SLA_CONFIG } from '../../lib/supabase';
import { Sparkline } from '../../components/Sparkline';
import { SkeletonList } from '../../components/Skeleton';
import { StatusBadge, SlaGroup } from './DashboardAlertsHelpers';
import { ScanVelocityChart, SummaryPill, SlaDonut } from './DashboardCharts';

// ─── Types ────────────────────────────────────────────────────────────

type SlaRow = {
  v: Vulnerability;
  ageDays: number;
  budget: number;
  overdue: boolean;
  remaining: number;
};

// ─── Critical & High Priority Banner ──────────────────────────────────

export function CriticalFindingsBanner({
  topCritical,
  projects,
  onViewAll,
}: {
  topCritical: Vulnerability[];
  projects: Project[];
  onViewAll: () => void;
}) {
  if (topCritical.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          </div>
          <span className="text-sm font-semibold text-red-300">Critical &amp; High Priority</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 font-bold tabular-nums">{topCritical.length}</span>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition"
        >
          View all <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
        {topCritical.map(v => {
          const proj = projects.find(p => p.id === v.project_id);
          const isCrit = v.severity === 'critical';
          return (
            <div key={v.id} className={`rounded-lg border p-3 flex flex-col gap-1 ${
              isCrit ? 'border-red-500/25 bg-red-500/8' : 'border-orange-500/25 bg-orange-500/8'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                  isCrit
                    ? 'text-red-300 bg-red-500/15 border-red-500/30'
                    : 'text-orange-300 bg-orange-500/15 border-orange-500/30'
                }`}>{v.severity}</span>
                {v.cve_id && (
                  <a
                    href={`https://nvd.nist.gov/vuln/detail/${v.cve_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-mono text-sky-400 hover:text-sky-300 hover:underline"
                    onClick={e => e.stopPropagation()}
                  >{v.cve_id}</a>
                )}
              </div>
              <div className="text-xs text-slate-200 font-medium line-clamp-2 leading-tight">{v.title}</div>
              {proj && <div className="text-[10px] text-slate-500 truncate">{proj.name}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SLA Watch ────────────────────────────────────────────────────────

export function SlaWatch({ slaRows }: { slaRows: SlaRow[] }) {
  const overdueRows  = slaRows.filter(r => r.overdue);
  const atRiskRows   = slaRows.filter(r => !r.overdue && r.ageDays / r.budget >= 0.75);
  const healthyRows  = slaRows.filter(r => !r.overdue && r.ageDays / r.budget < 0.75);
  const overdueCount = overdueRows.length;

  return (
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
  );
}

// ─── Live Scans ────────────────────────────────────────────────────────

export function LiveScans({ liveJobs, onViewAll }: { liveJobs: any[]; onViewAll: () => void }) {
  if (liveJobs.length === 0) return null;

  return (
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
  );
}

// ─── Recent Scans ──────────────────────────────────────────────────────

export function RecentScans({
  scans,
  loading,
  onViewAll,
}: {
  scans: Scan[];
  loading: boolean;
  onViewAll: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold">Recent scans</h2>
        <button onClick={onViewAll} className="text-xs text-emerald-400 hover:text-emerald-300 transition">
          View all
        </button>
      </div>
      {loading ? (
        <SkeletonList count={4} />
      ) : scans.length === 0 ? (
        <div className="py-10 text-center">
          <Activity className="w-8 h-8 text-slate-700 mx-auto mb-2" />
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
  );
}

// ─── Top Open Findings ─────────────────────────────────────────────────

export function TopOpenFindings({
  openVulns,
  projects,
  findingsSearch,
  setFindingsSearch,
  findingsSort,
  setFindingsSort,
  findingsSearchRef,
  onViewAll,
}: {
  openVulns: Vulnerability[];
  projects: Project[];
  findingsSearch: string;
  setFindingsSearch: (v: string) => void;
  findingsSort: 'severity' | 'newest' | 'oldest' | 'title';
  setFindingsSort: (v: 'severity' | 'newest' | 'oldest' | 'title') => void;
  findingsSearchRef: React.RefObject<HTMLInputElement>;
  onViewAll: () => void;
}) {
  const filteredFindings = useMemo(() => {
    let list = [...openVulns];
    if (findingsSearch) {
      const q = findingsSearch.toLowerCase();
      list = list.filter(v =>
        v.title.toLowerCase().includes(q) ||
        (v.cve_id ?? '').toLowerCase().includes(q) ||
        (v.description ?? '').toLowerCase().includes(q)
      );
    }
    switch (findingsSort) {
      case 'severity': {
        const SEV_W: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
        list.sort((a, b) => (SEV_W[b.severity] ?? 0) - (SEV_W[a.severity] ?? 0));
        break;
      }
      case 'newest':  list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'oldest':  list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'title':    list.sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return list.slice(0, 10);
  }, [openVulns, findingsSearch, findingsSort]);

  if (openVulns.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Top open findings</h2>
          <p className="text-xs text-slate-500 mt-0.5">Highest-severity unresolved vulnerabilities across all projects</p>
        </div>
        <button onClick={onViewAll} className="text-xs text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      {/* Search + sort controls */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            ref={findingsSearchRef}
            value={findingsSearch}
            onChange={e => setFindingsSearch(e.target.value)}
            placeholder="Search findings…"
            className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
          {(['severity', 'Severity'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['title', 'A→Z'] as const).map(([val, label]) => (
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
            Reset
          </button>
        )}
      </div>
      {/* Findings list */}
      <div className="space-y-2">
        {filteredFindings.map(v => {
          const proj = projects?.find(p => p.id === v.project_id);
          return (
            <div key={v.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-slate-800/30 transition">
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                v.severity === 'critical' ? 'text-red-300 bg-red-500/15 border-red-500/30' :
                v.severity === 'high'     ? 'text-orange-300 bg-orange-500/15 border-orange-500/30' :
                v.severity === 'medium'   ? 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30' :
                'text-sky-300 bg-sky-500/15 border-sky-500/30'
              }`}>{v.severity}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-200 font-medium">{v.title}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                  {v.cve_id && <span className="font-mono text-sky-400">{v.cve_id}</span>}
                  {proj && <span>{proj.name}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team Collaboration ────────────────────────────────────────────────

export function TeamSection({
  teamMembers,
  liveJobs,
  scans,
  openVulns,
}: {
  teamMembers: { id: string; role: string; auth?: { users?: { email?: string } } }[];
  liveJobs: any[];
  scans: Scan[];
  openVulns: Vulnerability[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" /> Team
        </h2>
        <span className="text-xs px-2 py-1 rounded-md bg-slate-800/50 border border-slate-700 text-slate-300">
          {teamMembers.length}
        </span>
      </div>
      {teamMembers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm text-center">
          <div>
            <Users className="w-6 h-6 mx-auto mb-2 text-slate-700" />
            <div>Solo workspace</div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 flex-1">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active members</div>
          <div className="flex flex-wrap gap-2">
            {teamMembers.slice(0, 5).map((tm) => (
              <div key={tm.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-800/50 border border-slate-700 hover:border-emerald-500/40 transition">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs font-semibold text-slate-950">
                  {tm.role === 'owner' ? '👑' : tm.role === 'admin' ? '⚙️' : '👥'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">{(tm.auth?.users?.email ?? '').split('@')[0]}</div>
                  <div className="text-[10px] text-slate-500">{tm.role}</div>
                </div>
              </div>
            ))}
            {teamMembers.length > 5 && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-800/50 border border-slate-700">
                <span className="text-xs font-medium text-slate-400">+{teamMembers.length - 5}</span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider pt-2">Activity (24h)</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Target className="w-3.5 h-3.5 text-sky-400" />
              <span>{liveJobs.length} scans running</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{scans.filter(s => s.status === 'completed').length} completed</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>{openVulns.length} open findings</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Section ─────────────────────────────────────────────────

export function AnalyticsSection({
  scanVelocity,
  scans,
  completedScans,
  slaGauge,
  riskTrend,
  mttr,
  vulns,
  openVulns,
}: {
  scanVelocity: { day: string; label: string; completed: number; failed: number }[];
  scans: Scan[];
  completedScans: number;
  slaGauge: { pct: number; within: number; total: number; breached: number };
  riskTrend: { day: string; label: string; score: number }[];
  mttr: number | null;
  vulns: Vulnerability[];
  openVulns: Vulnerability[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-slate-200">Analytics</h2>
        <span className="text-xs text-slate-600">— trends, velocity & compliance</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scan velocity */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-semibold text-sm">Scan velocity</h3>
              <p className="text-xs text-slate-500 mt-0.5">Daily scans — last 14 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Completed
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-sm bg-red-500" /> Failed
              </span>
            </div>
          </div>
          <ScanVelocityChart data={scanVelocity} />
          <div className="flex justify-between mt-2 px-1">
            {scanVelocity.filter((_, i) => i % 3 === 0 || i === scanVelocity.length - 1).map(d => (
              <span key={d.day} className="text-[10px] text-slate-600">{d.label}</span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-800">
            <SummaryPill label="Total scans" value={scans.length} color="text-slate-200" />
            <SummaryPill label="Completed" value={completedScans} color="text-emerald-400" />
            <SummaryPill label="Failed" value={scans.filter(s => s.status === 'failed').length} color="text-red-400" />
          </div>
        </div>

        {/* SLA Compliance Gauge */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col items-center justify-center gap-4">
          <div className="w-full">
            <h3 className="font-semibold text-sm">SLA compliance</h3>
            <p className="text-xs text-slate-500 mt-0.5">% of findings within deadline</p>
          </div>
          <SlaDonut pct={slaGauge.pct} />
          <div className="w-full grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums">{slaGauge.within}</div>
              <div className="text-[10px] text-slate-500">On track</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400 tabular-nums">{slaGauge.breached}</div>
              <div className="text-[10px] text-slate-500">Breached</div>
            </div>
            <div>
              <div className="text-lg font-bold text-slate-200 tabular-nums">{slaGauge.total}</div>
              <div className="text-[10px] text-slate-500">Total</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk score trend */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-semibold text-sm">Risk score trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">Cumulative org-level risk — last 30 days</p>
            </div>
            <div className="flex items-center gap-1.5">
              {riskTrend.length > 0 && (() => {
                const last = riskTrend[riskTrend.length - 1].score;
                const first = riskTrend[0].score;
                const delta = last - first;
                const color = delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-500';
                const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
                return (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {delta > 0 ? '+' : ''}{delta.toFixed(0)}
                  </span>
                );
              })()}
            </div>
          </div>
          <RiskTrendChart data={riskTrend} />
          <div className="flex justify-between mt-2 px-1">
            {riskTrend.filter((_, i) => i % 6 === 0 || i === riskTrend.length - 1).map(d => (
              <span key={d.day} className="text-[10px] text-slate-600">{d.label}</span>
            ))}
          </div>
        </div>

        {/* MTTR + Severity distribution */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col gap-5">
          {/* MTTR */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Mean time to remediate</h3>
            {mttr === null ? (
              <div className="text-sm text-slate-500">No resolved findings yet</div>
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold tabular-nums text-white">{mttr}</span>
                <span className="text-slate-400 text-sm mb-1">days avg</span>
              </div>
            )}
            {mttr !== null && (
              <div className="mt-2 text-xs text-slate-500">
                Based on {vulns.filter(v => v.status === 'resolved' || v.status === 'false_positive').length} resolved findings
              </div>
            )}
          </div>

          {/* Severity distribution */}
          <SeverityDistribution openVulns={openVulns} />
        </div>
      </div>
    </div>
  );
}
