import { useMemo } from 'react';
import {
  Shield, AlertTriangle, CheckCircle2, Activity, Timer, Radar,
  TrendingDown, TrendingUp, Minus, Users, Target, CheckCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Project, Vulnerability, DEFAULT_SLA_CONFIG } from '../../lib/supabase';
import { SparkKpi, SummaryPill } from './DashboardCharts';
import { Sparkline } from '../../components/Sparkline';

// ─── Types ────────────────────────────────────────────────────────────────

type TeamMember = {
  id: string;
  role: string;
  auth?: { users?: { email?: string } };
};

type ProbeSmokeStatus = {
  status: 'ok' | 'error' | 'unknown';
  reachable: boolean | null;
  httpStatus: number | null;
  requestId: string | null;
  probedUrl: string | null;
  error: string | null;
  generatedAt: string | null;
};

type SlaRow = {
  v: Vulnerability;
  ageDays: number;
  budget: number;
  overdue: boolean;
  remaining: number;
};

type WeeklySloSummary = {
  total: number;
  completed: number;
  failed: number;
  successRate: number;
  failureRate: number;
  avgDuration: number;
  p95Duration: number;
  slaBreaches: number;
  slaBreachRate: number;
  thresholdsOk: boolean;
};

// ─── Project health component ──────────────────────────────────────────────

export function ProjectHealthSection({
  projects,
  openVulns,
  riskFilter,
  setRiskFilter,
  onManageProjects,
}: {
  projects: Project[];
  openVulns: Vulnerability[];
  riskFilter: 'all' | 'critical' | 'high' | 'medium' | 'low';
  setRiskFilter: (f: 'all' | 'critical' | 'high' | 'medium' | 'low') => void;
  onManageProjects: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Project risk</h2>
        <Target className="w-4 h-4 text-emerald-400" />
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
                    <div className={`h-full ${barColor} transition-all duration-700 rounded-full`} ref={(el) => { if (el) el.style.width = `${score}%`; }} />
                  </div>
                </div>
              );
            })}
        </div>
      )}
      <button onClick={onManageProjects} className="mt-5 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition">
        Manage projects <TrendingUp className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── KPI Row component ────────────────────────────────────────────────────

export function KpiRow({
  projects,
  openVulns,
  resolvedVulns,
  activeScans,
  completedScans,
  wowDelta,
  resRate,
  severitySparklines,
}: {
  projects: Project[];
  openVulns: Vulnerability[];
  resolvedVulns: Vulnerability[];
  activeScans: number;
  completedScans: number;
  wowDelta: number;
  resRate: number;
  severitySparklines: { critical: number[]; resolved: number[]; projects: number[]; scans: number[] };
}) {
  return (
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
  );
}

// ─── Weekly SLO Summary component ──────────────────────────────────────────

export function WeeklySloSummary({ summary }: { summary: WeeklySloSummary }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Weekly SLO/SLA summary</h2>
          <p className="text-xs text-slate-500 mt-0.5">Executive reliability KPI for the last 7 days</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-md border ${
          summary.thresholdsOk
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
        }`}>
          {summary.thresholdsOk ? 'Thresholds OK' : 'Threshold breach'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <SummaryPill label="Scans" value={summary.total} color="text-slate-200" />
        <SummaryPill label="Completed" value={summary.completed} color="text-emerald-400" />
        <SummaryPill label="Failed" value={summary.failed} color="text-red-400" />
        <SummaryPill label="Success %" value={summary.successRate} color="text-emerald-300" suffix="%" />
        <SummaryPill label="Failure %" value={summary.failureRate} color="text-red-300" suffix="%" />
        <SummaryPill label="Avg min" value={summary.avgDuration} color="text-sky-300" />
        <SummaryPill label="P95 min" value={summary.p95Duration} color="text-violet-300" />
        <SummaryPill label="SLA breach %" value={summary.slaBreachRate} color="text-amber-300" suffix="%" />
      </div>
    </div>
  );
}

// ─── Agent Probe Smoke component ───────────────────────────────────────────

export function AgentProbeSection({ probeSmokeStatus }: { probeSmokeStatus: ProbeSmokeStatus }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">Agent probe smoke</h2>
          <p className="text-xs text-slate-500 mt-0.5">Latest gateway `agent_health_probe` scheduled check</p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-md border ${
          probeSmokeStatus.status === 'ok'
            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            : probeSmokeStatus.status === 'error'
              ? 'bg-red-500/10 text-red-300 border-red-500/30'
              : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
        }`}>
          {probeSmokeStatus.status === 'ok' ? 'OK' : probeSmokeStatus.status === 'error' ? 'Fail' : 'Unknown'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryPill
          label="Reachable"
          value={probeSmokeStatus.reachable === null ? 'n/a' : probeSmokeStatus.reachable ? 'yes' : 'no'}
          color={probeSmokeStatus.reachable === true ? 'text-emerald-300' : probeSmokeStatus.reachable === false ? 'text-red-300' : 'text-slate-300'}
        />
        <SummaryPill
          label="HTTP"
          value={probeSmokeStatus.httpStatus ?? 'n/a'}
          color={typeof probeSmokeStatus.httpStatus === 'number' && probeSmokeStatus.httpStatus < 400 ? 'text-emerald-300' : 'text-amber-300'}
        />
        <SummaryPill
          label="Request ID"
          value={probeSmokeStatus.requestId ? probeSmokeStatus.requestId.slice(0, 12) : 'n/a'}
          color="text-slate-300"
          title={probeSmokeStatus.requestId ?? undefined}
        />
        <SummaryPill
          label="Last run"
          value={probeSmokeStatus.generatedAt ? formatRelativeMinutes(probeSmokeStatus.generatedAt) : 'n/a'}
          color="text-slate-300"
        />
      </div>
      {(probeSmokeStatus.error || probeSmokeStatus.probedUrl) && (
        <div className="mt-3 text-xs text-slate-400 space-y-1">
          {probeSmokeStatus.probedUrl && <div>URL: {probeSmokeStatus.probedUrl}</div>}
          {probeSmokeStatus.error && <div className="text-amber-300">Error: {probeSmokeStatus.error}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Severity Distribution component ───────────────────────────────────────

export function SeverityDistribution({ openVulns }: { openVulns: Vulnerability[] }) {
  const severityDist = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of openVulns) counts[v.severity] = (counts[v.severity] ?? 0) + 1;
    return counts;
  }, [openVulns]);

  return (
    <div className="border-t border-slate-800 pt-4">
      <h3 className="font-semibold text-sm mb-3">Severity distribution</h3>
      {openVulns.length === 0 ? (
        <div className="text-sm text-slate-500">No open findings</div>
      ) : (
        <div className="space-y-2">
          {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => {
            const count = severityDist[sev] ?? 0;
            const pct = openVulns.length === 0 ? 0 : Math.round((count / openVulns.length) * 100);
            const barCls = {
              critical: 'bg-red-500',
              high: 'bg-orange-500',
              medium: 'bg-yellow-400',
              low: 'bg-sky-400',
              info: 'bg-slate-500',
            }[sev];
            const textCls = {
              critical: 'text-red-400',
              high: 'text-orange-400',
              medium: 'text-yellow-400',
              low: 'text-sky-400',
              info: 'text-slate-400',
            }[sev];
            return (
              <div key={sev}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className={`capitalize font-medium ${textCls}`}>{sev}</span>
                  <span className="text-slate-400 tabular-nums">{count} <span className="text-slate-600">({pct}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barCls}`}
                    ref={(el) => { if (el) el.style.width = `${pct}%`; }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Vulnerability Aging component ─────────────────────────────────────────

export function VulnerabilityAging({ openVulns }: { openVulns: Vulnerability[] }) {
  const vulnAgingBuckets = useMemo(() => {
    const buckets = [
      { label: '0–7 days',   min: 0,  max: 7,        count: 0, barCls: 'bg-emerald-500', textCls: 'text-emerald-400' },
      { label: '7–30 days',  min: 7,  max: 30,       count: 0, barCls: 'bg-yellow-400',  textCls: 'text-yellow-400'  },
      { label: '30–90 days', min: 30, max: 90,       count: 0, barCls: 'bg-orange-500',  textCls: 'text-orange-400'  },
      { label: '90d+',       min: 90, max: Infinity, count: 0, barCls: 'bg-red-500',     textCls: 'text-red-400'     },
    ];
    const nowTs = Date.now();
    for (const v of openVulns) {
      const ageDays = (nowTs - new Date(v.created_at).getTime()) / 86_400_000;
      for (const b of buckets) {
        if (ageDays >= b.min && ageDays < b.max) { b.count++; break; }
      }
    }
    return buckets;
  }, [openVulns]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="mb-4">
        <h2 className="font-semibold text-sm">Vulnerability aging</h2>
        <p className="text-xs text-slate-500 mt-0.5">Age distribution of open findings</p>
      </div>
      {(() => {
        const maxCount = Math.max(1, ...vulnAgingBuckets.map(b => b.count));
        return (
          <div className="space-y-3">
            {vulnAgingBuckets.map(b => {
              const pct = Math.round((b.count / maxCount) * 100);
              return (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-medium ${b.textCls}`}>{b.label}</span>
                    <span className="text-slate-300 tabular-nums font-semibold">{b.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${b.barCls}`}
                      ref={(el) => { if (el) el.style.width = `${pct}%`; }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
      <div className="mt-4 pt-3 border-t border-slate-800 flex gap-4 text-xs">
        <span className="text-slate-500">Total open: <span className="text-slate-200 font-semibold">{openVulns.length}</span></span>
        <span className="text-red-400 font-medium">
          Stale (90d+): {vulnAgingBuckets[3].count}
        </span>
      </div>
    </div>
  );
}

// ─── Top Risky Projects component ─────────────────────────────────────────

export function TopRiskyProjects({ openVulns, projects, onViewAll }: {
  openVulns: Vulnerability[];
  projects: Project[];
  onViewAll: () => void;
}) {
  const topRiskyProjects = useMemo(() => {
    return projects
      .map(p => {
        const pVulns = openVulns.filter(v => v.project_id === p.id);
        const critical = pVulns.filter(v => v.severity === 'critical').length;
        const high     = pVulns.filter(v => v.severity === 'high').length;
        const medium   = pVulns.filter(v => v.severity === 'medium').length;
        const total    = pVulns.length;
        return { project: p, critical, high, medium, total };
      })
      .filter(r => r.total > 0)
      .sort((a, b) => (b.critical * 10 + b.high) - (a.critical * 10 + a.high))
      .slice(0, 5);
  }, [projects, openVulns]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-sm">Top risky projects</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ranked by critical + high exposure</p>
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
        >
          All <TrendingUp className="w-3 h-3" />
        </button>
      </div>
      {topRiskyProjects.length === 0 ? (
        <div className="text-sm text-slate-500 py-4">No projects with open findings.</div>
      ) : (
        <div className="space-y-3">
          {topRiskyProjects.map(({ project: p, critical, high, medium, total }) => {
            const maxExposure = topRiskyProjects[0].critical * 10 + topRiskyProjects[0].high;
            const exposure = critical * 10 + high;
            const barPct = maxExposure === 0 ? 0 : Math.round((exposure / maxExposure) * 100);
            return (
              <div
                key={p.id}
                className="flex flex-col gap-1.5 cursor-pointer group"
                onClick={onViewAll}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-200 font-medium truncate group-hover:text-emerald-400 transition max-w-[60%]">
                    {p.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {critical > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-red-300 bg-red-500/10 border-red-500/20 tabular-nums">
                        {critical} crit
                      </span>
                    )}
                    {high > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border text-orange-300 bg-orange-500/10 border-orange-500/20 tabular-nums">
                        {high} high
                      </span>
                    )}
                    {medium > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border text-yellow-300 bg-yellow-500/10 border-yellow-500/20 tabular-nums">
                        {medium}m
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 tabular-nums">{total} total</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-700"
                    ref={(el) => { if (el) el.style.width = `${barPct}%`; }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helper: formatRelativeMinutes ────────────────────────────────────────

function formatRelativeMinutes(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'n/a';
  const diffMs = Date.now() - ts;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(iso).toLocaleDateString();
}
