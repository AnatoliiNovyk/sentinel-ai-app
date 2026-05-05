import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, Scan, Project, Vulnerability, DEFAULT_SLA_CONFIG } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { useSearchShortcut } from '../lib/useSearchShortcut';
import {
  buildTrend, buildSeveritySparklines, buildScanVelocity, buildRiskTrend,
  AreaTrendChart, SummaryPill
} from './dashboard/DashboardCharts';
import {
  ProjectHealthSection, KpiRow, WeeklySloSummary, AgentProbeSection,
  SeverityDistribution, VulnerabilityAging, TopRiskyProjects
} from './dashboard/DashboardStats';
import {
  CriticalFindingsBanner, SlaWatch, LiveScans, RecentScans,
  TopOpenFindings, TeamSection, AnalyticsSection
} from './dashboard/DashboardAlerts';

export default function Dashboard() {
  const { user, profile, organizations } = useAuth();
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveJobs, setLiveJobs] = useState<{id:string;scanner:string;target:string;status:string;created_at:string;project_id:string}[]>([]);
  const [teamMembers, setTeamMembers] = useState<{id:string;role:string;auth?:{users?:{email?:string}}[]}[]>([]);
  const [probeSmokeStatus, setProbeSmokeStatus] = useState<{
    status: 'ok' | 'error' | 'unknown';
    reachable: boolean | null;
    httpStatus: number | null;
    requestId: string | null;
    probedUrl: string | null;
    error: string | null;
    generatedAt: string | null;
  }>({
    status: 'unknown', reachable: null, httpStatus: null,
    requestId: null, probedUrl: null, error: null, generatedAt: null,
  });
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [findingsSearch, setFindingsSearch] = useState('');
  const [findingsSort, setFindingsSort] = useState<'severity' | 'newest' | 'oldest' | 'title'>('severity');
  const findingsSearchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(findingsSearchRef, () => setFindingsSearch(''));

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [scansRes, projectsRes, vulnsRes, jobsRes, teamRes] = await Promise.all([
        supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('vulnerabilities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
        supabase.from('scan_jobs').select('id,scanner,target,status,created_at,project_id').eq('user_id', user.id).in('status', ['pending','running']).order('created_at', { ascending: false }).limit(20),
        organizations.length > 0 ? supabase.from('team_members').select('*,auth.users(email,user_metadata)').eq('org_id', organizations[0].id) : Promise.resolve({ data: [] }),
      ]);

      let probeQuery = supabase
        .from('audit_logs')
        .select('status,created_at,metadata')
        .eq('action', 'agent_health_probe_smoke');

      if (organizations.length > 0) {
        probeQuery = probeQuery.eq('org_id', organizations[0].id);
      } else {
        probeQuery = probeQuery.eq('user_id', user.id);
      }

      const probeRes = await probeQuery
        .order('created_at', { ascending: false })
        .limit(1);

      setScans(scansRes.data ?? []);
      setProjects(projectsRes.data ?? []);
      setVulns(vulnsRes.data ?? []);
      setLiveJobs((jobsRes.data ?? []) as typeof liveJobs);
      setTeamMembers((teamRes.data ?? []) as unknown as {id:string;role:string;auth?:{users?:{email?:string}}[]});

      const probeRow = (probeRes.data ?? [])[0] as { created_at?: string; status?: string; metadata?: unknown } | undefined;
      const probeMeta = (probeRow?.metadata && typeof probeRow.metadata === 'object')
        ? (probeRow.metadata as Record<string, unknown>)
        : null;

      const normalizedStatus = probeMeta?.status === 'ok' || probeMeta?.status === 'error'
        ? probeMeta.status
        : (probeRow?.status === 'success' ? 'ok' : probeRow?.status === 'failure' ? 'error' : 'unknown');

      setProbeSmokeStatus({
        status: normalizedStatus,
        reachable: typeof probeMeta?.reachable === 'boolean' ? probeMeta.reachable : null,
        httpStatus: typeof probeMeta?.http_status === 'number' ? probeMeta.http_status : null,
        requestId: typeof probeMeta?.request_id === 'string' ? probeMeta.request_id : null,
        probedUrl: typeof probeMeta?.probed_url === 'string' ? probeMeta.probed_url : null,
        error: typeof probeMeta?.error === 'string' ? probeMeta.error : null,
        generatedAt: typeof probeMeta?.generated_at === 'string' ? probeMeta.generated_at : (probeRow?.created_at ?? null),
      });

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
  }, [user, organizations]);

  // ── Derived data ─────────────────────────────────────────────────
  const openVulns = vulns.filter(v => v.status === 'open' || v.status === 'in_progress');
  const resolvedVulns = vulns.filter(v => v.status === 'resolved');

  // Top 5 critical+high for the alert banner
  const topCritical = useMemo(() => {
    const SEV_W: Record<string, number> = { critical: 2, high: 1 };
    return openVulns
      .filter(v => v.severity === 'critical' || v.severity === 'high')
      .sort((a, b) => (SEV_W[b.severity] ?? 0) - (SEV_W[a.severity] ?? 0))
      .slice(0, 5);
  }, [openVulns]);

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

  // BUG-06: SLA breach notifications — debounced
  useEffect(() => {
    if (!user || vulns.length === 0) return;
    const newlyBreached = slaRows.filter(r => r.overdue && !r.v.sla_breached_at).slice(0, 10);
    const atRisk = slaRows.filter(r => !r.overdue && !r.v.sla_warned_at && r.ageDays / r.budget >= 0.75).slice(0, 10);
    if (newlyBreached.length === 0 && atRisk.length === 0) return;

    const timer = setTimeout(async () => {
      const stamp = new Date().toISOString();
      for (const { v, budget, ageDays } of newlyBreached) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, vulns]);

  const completedScans = scans.filter(s => s.status === 'completed').length;
  const activeScans    = liveJobs.length + scans.filter(s => s.status === 'running' || s.status === 'queued').length;

  const weeklySloSummary = useMemo(() => {
    const nowTs = Date.now();
    const sevenDaysAgo = nowTs - (7 * 24 * 60 * 60 * 1000);
    const weekly = scans.filter((s) => {
      const created = new Date(s.created_at).getTime();
      return Number.isFinite(created) && created >= sevenDaysAgo;
    });

    const total = weekly.length;
    const completed = weekly.filter((s) => s.status === 'completed');
    const failed = weekly.filter((s) => s.status === 'failed').length;
    const successRate = total > 0 ? Math.round((completed.length * 10000) / total) / 100 : 0;
    const failureRate = total > 0 ? Math.round((failed * 10000) / total) / 100 : 0;

    const durations = completed
      .map((s) => {
        if (!s.started_at || !s.completed_at) return null;
        const started = new Date(s.started_at).getTime();
        const done = new Date(s.completed_at).getTime();
        if (!Number.isFinite(started) || !Number.isFinite(done) || done < started) return null;
        return (done - started) / 60000;
      })
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    const avgDuration = durations.length > 0
      ? Math.round((durations.reduce((sum, d) => sum + d, 0) / durations.length) * 100) / 100
      : 0;

    const p95Duration = durations.length > 0
      ? Math.round(durations[Math.max(0, Math.ceil(durations.length * 0.95) - 1)] * 100) / 100
      : 0;

    const slaThresholdMinutes = 60;
    const slaBreaches = durations.filter((d) => d > slaThresholdMinutes).length;
    const slaBreachRate = durations.length > 0 ? Math.round((slaBreaches * 10000) / durations.length) / 100 : 0;

    return {
      total, completed: completed.length, failed,
      successRate, failureRate, avgDuration, p95Duration,
      slaBreaches, slaBreachRate,
      thresholdsOk: successRate >= 95 && failureRate <= 5 && slaBreachRate <= 10,
    };
  }, [scans]);

  // ── Advanced analytics ───────────────────────────────────────
  const scanVelocity = useMemo(() => buildScanVelocity(scans, 14), [scans]);
  const riskTrend = useMemo(() => buildRiskTrend(vulns, projects, 30), [vulns, projects]);
  const slaGauge = useMemo(() => {
    if (slaRows.length === 0) return { pct: 100, within: 0, total: 0, breached: 0 };
    const within = slaRows.filter(r => !r.overdue).length;
    return { pct: Math.round((within / slaRows.length) * 100), within, total: slaRows.length, breached: slaRows.filter(r => r.overdue).length };
  }, [slaRows]);
  const mttr = useMemo(() => {
    const resolved = vulns.filter(v => (v.status === 'resolved' || v.status === 'false_positive') && v.status_updated_at);
    if (resolved.length === 0) return null;
    const avg = resolved.reduce((sum, v) => {
      return sum + (new Date(v.status_updated_at).getTime() - new Date(v.created_at).getTime()) / 86_400_000;
    }, 0) / resolved.length;
    return Math.round(avg);
  }, [vulns]);

  return (
    <div className="p-8 max-w-7xl space-y-8">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-sm text-slate-500">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Security posture</h1>
          {(activeScans > 0 || slaRows.filter(r => r.overdue).length > 0) && (
            <div className="mt-2 flex items-center gap-2">
              {activeScans > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {activeScans} scanning…
                </span>
              )}
              {slaRows.filter(r => r.overdue).length > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                  <Timer className="w-3 h-3" />
                  {slaRows.filter(r => r.overdue).length} SLA overdue
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
        >
          Launch AI audit <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── KPI row ─────────────────────────────────────── */}
      <KpiRow
        projects={projects} openVulns={openVulns} resolvedVulns={resolvedVulns}
        activeScans={activeScans} completedScans={completedScans}
        wowDelta={wowDelta} resRate={resRate} severitySparklines={severitySparklines}
      />

      {/* ── Weekly SLO + Agent Probe ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeeklySloSummary summary={weeklySloSummary} />
        <AgentProbeSection probeSmokeStatus={probeSmokeStatus} />
      </div>

      {/* ── Critical findings alert banner ──────────────────────── */}
      <CriticalFindingsBanner topCritical={topCritical} projects={projects} onViewAll={() => navigate('/projects')} />

      {/* ── Main content 3-col ──────────────────────────────────── */}
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
          <AreaTrendChart trend={trend14} max={maxTrend} />
          <div className="flex justify-between mt-2 px-1">
            {trend14.filter((_, i) => i % 3 === 0 || i === trend14.length - 1).map(d => (
              <span key={d.day} className="text-[10px] text-slate-600">{d.label}</span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800">
            <SummaryPill label="Opened (14d)" value={trend14.reduce((s, d) => s + d.opened, 0)} color="text-red-400" />
            <SummaryPill label="Closed (14d)" value={trend14.reduce((s, d) => s + d.closed, 0)} color="text-emerald-400" />
            <SummaryPill label="Net delta" value={trend14.reduce((s, d) => s + d.opened - d.closed, 0)} color={trend14.reduce((s, d) => s + d.opened - d.closed, 0) > 0 ? 'text-red-400' : 'text-emerald-400'} signed />
          </div>
        </div>

        {/* Project health — 1 col */}
        <ProjectHealthSection
          projects={projects} openVulns={openVulns} riskFilter={riskFilter}
          setRiskFilter={setRiskFilter} onManageProjects={() => navigate('/projects')}
        />
      </div>

      {/* ── Bottom row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SlaWatch slaRows={slaRows} />
        <div className="lg:col-span-2 space-y-4">
          <LiveScans liveJobs={liveJobs} onViewAll={() => navigate('/scans')} />
          <RecentScans scans={scans} loading={loading} onViewAll={() => navigate('/scans')} />
        </div>
        <div className="space-y-4">
          <TeamSection teamMembers={teamMembers} liveJobs={liveJobs} scans={scans} openVulns={openVulns} />
          <SeverityDistribution openVulns={openVulns} />
        </div>
      </div>

      {/* ── Analytics ─────────────────────────────────── */}
      <AnalyticsSection
        scanVelocity={scanVelocity} scans={scans} completedScans={completedScans}
        slaGauge={slaGauge} riskTrend={riskTrend} mttr={mttr}
        vulns={vulns} openVulns={openVulns}
      />

      {/* ── Aging + Top Risky Projects ─────────────────── */}
      {openVulns.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VulnerabilityAging openVulns={openVulns} />
          <TopRiskyProjects openVulns={openVulns} projects={projects} onViewAll={() => navigate('/projects')} />
        </div>
      )}

      {/* ── Top open findings ──────────────────────────────────── */}
      <TopOpenFindings
        openVulns={openVulns} projects={projects}
        findingsSearch={findingsSearch} setFindingsSearch={setFindingsSearch}
        findingsSort={findingsSort} setFindingsSort={setFindingsSort}
        findingsSearchRef={findingsSearchRef} onViewAll={() => navigate('/projects')}
      />
    </div>
  );
}
