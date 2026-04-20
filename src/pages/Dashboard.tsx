import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Activity, TrendingUp, Radar, ArrowRight, Clock, Timer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, Scan, Project, Vulnerability, DEFAULT_SLA_CONFIG } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [scansRes, projectsRes, vulnsRes] = await Promise.all([
        supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('vulnerabilities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
      ]);
      setScans(scansRes.data ?? []);
      setProjects(projectsRes.data ?? []);
      setVulns(vulnsRes.data ?? []);
      setLoading(false);
    };
    fetchAll();
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${user.id}` },
        () => fetchAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vulnerabilities', filter: `user_id=eq.${user.id}` },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const totals = scans.reduce(
    (acc, s) => ({
      critical: acc.critical + (s.severity_summary?.critical ?? 0),
      high: acc.high + (s.severity_summary?.high ?? 0),
      medium: acc.medium + (s.severity_summary?.medium ?? 0),
      low: acc.low + (s.severity_summary?.low ?? 0),
    }),
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  const completedScans = scans.filter((s) => s.status === 'completed').length;
  const activeScans = scans.filter((s) => s.status === 'running' || s.status === 'queued').length;

  const SLA_DAYS: Record<'critical' | 'high' | 'medium' | 'low', number> = {
    ...DEFAULT_SLA_CONFIG,
    ...(profile?.sla_config ?? {}),
  };
  const now = Date.now();
  const openVulns = vulns.filter((v) => v.status === 'open' || v.status === 'in_progress');
  const slaRows = openVulns
    .filter((v) => v.severity === 'critical' || v.severity === 'high' || v.severity === 'medium')
    .map((v) => {
      const ageDays = (now - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const budget = SLA_DAYS[v.severity as 'critical' | 'high' | 'medium'] ?? 30;
      return { v, ageDays, budget, overdue: ageDays > budget, remaining: budget - ageDays };
    })
    .sort((a, b) => b.ageDays - a.ageDays);
  const overdueCount = slaRows.filter((r) => r.overdue).length;
  const atRiskCount = slaRows.filter((r) => !r.overdue && r.ageDays / r.budget >= 0.75).length;
  const overdueRows = slaRows.filter((r) => r.overdue);
  const atRiskRows = slaRows.filter((r) => !r.overdue && r.ageDays / r.budget >= 0.75);
  const healthyRows = slaRows.filter((r) => !r.overdue && r.ageDays / r.budget < 0.75);

  const trend = buildTrend(vulns, 14);
  const maxTrend = Math.max(1, ...trend.map((d) => Math.max(d.opened, d.closed)));

  useEffect(() => {
    if (!user || vulns.length === 0) return;
    const newlyBreached = slaRows.filter((r) => r.overdue && !r.v.sla_breached_at).slice(0, 10);
    const atRisk = slaRows
      .filter(
        (r) =>
          !r.overdue &&
          !r.v.sla_warned_at &&
          r.ageDays / r.budget >= 0.75,
      )
      .slice(0, 10);
    if (newlyBreached.length === 0 && atRisk.length === 0) return;
    (async () => {
      const stamp = new Date().toISOString();
      for (const { v, budget, ageDays } of newlyBreached) {
        const { error } = await supabase
          .from('vulnerabilities')
          .update({ sla_breached_at: stamp })
          .eq('id', v.id)
          .is('sla_breached_at', null);
        if (error) continue;
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'sla_breach',
          title: `SLA breached: ${v.severity.toUpperCase()} finding overdue`,
          body: `${v.title} is ${Math.floor(ageDays - budget)}d past its ${budget}-day SLA.`,
          link: 'findings',
          severity: v.severity === 'critical' ? 'critical' : 'warning',
          metadata: { vulnerability_id: v.id, budget_days: budget, age_days: Math.floor(ageDays) },
        });
      }
      for (const { v, budget, ageDays, remaining } of atRisk) {
        const { error } = await supabase
          .from('vulnerabilities')
          .update({ sla_warned_at: stamp })
          .eq('id', v.id)
          .is('sla_warned_at', null);
        if (error) continue;
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'sla_warning',
          title: `SLA at risk: ${v.severity.toUpperCase()} finding nearing deadline`,
          body: `${v.title} has ${Math.max(0, Math.ceil(remaining))}d left of its ${budget}-day SLA.`,
          link: 'findings',
          severity: 'warning',
          metadata: {
            vulnerability_id: v.id,
            budget_days: budget,
            age_days: Math.floor(ageDays),
            remaining_days: Math.ceil(remaining),
          },
        });
      }
    })();
  }, [user, vulns, slaRows]);

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-sm text-slate-500">Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Security posture</h1>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
        >
          Launch AI audit <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Projects" value={projects.length} icon={Shield} accent="emerald" />
        <KpiCard label="Active scans" value={activeScans} icon={Activity} accent="sky" />
        <KpiCard label="Completed" value={completedScans} icon={CheckCircle2} accent="teal" />
        <KpiCard label="Critical findings" value={totals.critical} icon={AlertTriangle} accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold">Remediation trend</h2>
              <p className="text-xs text-slate-500 mt-0.5">Opened vs. closed findings over the last 14 days</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500" /> Opened</span>
              <span className="inline-flex items-center gap-1.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Closed</span>
            </div>
          </div>
          <div className="flex items-end gap-1.5 h-36">
            {trend.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-0.5 group relative">
                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition bg-slate-900 border border-slate-700 text-[10px] text-slate-200 rounded px-1.5 py-1 whitespace-nowrap z-10">
                  {d.label}: +{d.opened} / -{d.closed}
                </div>
                <div className="w-full flex items-end gap-0.5 h-full">
                  <div className="flex-1 bg-red-500/70 rounded-sm" style={{ height: `${(d.opened / maxTrend) * 100}%` }} />
                  <div className="flex-1 bg-emerald-500/70 rounded-sm" style={{ height: `${(d.closed / maxTrend) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-2">
            <span>{trend[0]?.label}</span>
            <span>{trend[trend.length - 1]?.label}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">SLA watch</h2>
            <div className="flex items-center gap-1.5">
              {overdueCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md border bg-red-500/10 border-red-500/30 text-red-300">
                  {overdueCount} overdue
                </span>
              )}
              {atRiskCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md border bg-amber-500/10 border-amber-500/30 text-amber-300">
                  {atRiskCount} at risk
                </span>
              )}
              {overdueCount === 0 && atRiskCount === 0 && (
                <span className="text-xs px-2 py-0.5 rounded-md border bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
                  On track
                </span>
              )}
            </div>
          </div>
          {slaRows.length === 0 ? (
            <div className="text-sm text-slate-500 py-6 text-center">
              <Timer className="w-6 h-6 mx-auto mb-2 text-slate-700" />
              No open findings under SLA tracking
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-auto pr-1">
              {overdueRows.length > 0 && (
                <SlaGroup label="Overdue" tone="red" rows={overdueRows.slice(0, 4)} />
              )}
              {atRiskRows.length > 0 && (
                <SlaGroup label="At risk" tone="amber" rows={atRiskRows.slice(0, 4)} />
              )}
              {overdueRows.length === 0 && atRiskRows.length === 0 && healthyRows.length > 0 && (
                <SlaGroup label="Healthy" tone="slate" rows={healthyRows.slice(0, 4)} />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">Findings by severity</h2>
            <TrendingUp className="w-4 h-4 text-slate-500" />
          </div>
          <div className="space-y-4">
            {[
              { label: 'Critical', value: totals.critical, color: 'bg-red-500' },
              { label: 'High', value: totals.high, color: 'bg-orange-500' },
              { label: 'Medium', value: totals.medium, color: 'bg-yellow-500' },
              { label: 'Low', value: totals.low, color: 'bg-sky-500' },
            ].map((row) => {
              const total = Math.max(1, totals.critical + totals.high + totals.medium + totals.low);
              const pct = (row.value / total) * 100;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-300">{row.label}</span>
                    <span className="text-slate-500">{row.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full ${row.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <h2 className="font-semibold mb-4">Compliance coverage</h2>
          <div className="space-y-4 text-sm">
            {[
              { label: 'CIS Controls v8', pct: 72 },
              { label: 'MITRE ATT&CK', pct: 58 },
              { label: 'SOC2 Type II', pct: 81 },
            ].map((c) => (
              <div key={c.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-300">{c.label}</span>
                  <span className="text-emerald-400 text-xs font-medium">{c.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold">Recent scans</h2>
          <button onClick={() => navigate('/scans')} className="text-sm text-emerald-400 hover:text-emerald-300">
            View all
          </button>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading...</div>
        ) : scans.length === 0 ? (
          <div className="p-12 text-center">
            <Radar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <div className="text-slate-300 font-medium">No scans yet</div>
            <div className="text-slate-500 text-sm mt-1">Start your first audit via the AI Assistant.</div>
            <button
              onClick={() => navigate('/chat')}
              className="mt-5 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              Launch AI audit
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {scans.slice(0, 6).map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-900/40 transition">
                <div>
                  <div className="text-sm font-medium text-white">{s.scanner}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-red-400">{s.severity_summary?.critical ?? 0}C</span>
                    <span className="text-orange-400">{s.severity_summary?.high ?? 0}H</span>
                    <span className="text-yellow-400">{s.severity_summary?.medium ?? 0}M</span>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
  accent: 'emerald' | 'sky' | 'teal' | 'red';
}) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    teal: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 transition">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <div className={`w-8 h-8 rounded-md border flex items-center justify-center ${colors}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function buildTrend(vulns: Vulnerability[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: { day: string; label: string; opened: number; closed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      day: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      opened: 0,
      closed: 0,
    });
  }
  const idxFor = (iso: string) => buckets.findIndex((b) => b.day === iso.slice(0, 10));
  for (const v of vulns) {
    const openIdx = idxFor(v.created_at);
    if (openIdx >= 0) buckets[openIdx].opened++;
    if ((v.status === 'resolved' || v.status === 'false_positive') && v.status_updated_at) {
      const ci = idxFor(v.status_updated_at);
      if (ci >= 0) buckets[ci].closed++;
    }
  }
  return buckets;
}

function SlaGroup({
  label,
  tone,
  rows,
}: {
  label: string;
  tone: 'red' | 'amber' | 'slate';
  rows: { v: Vulnerability; ageDays: number; budget: number; overdue: boolean; remaining: number }[];
}) {
  const toneCls = {
    red: 'text-red-300 bg-red-500/5 border-red-500/20',
    amber: 'text-amber-300 bg-amber-500/5 border-amber-500/20',
    slate: 'text-slate-300 bg-slate-800/30 border-slate-700',
  }[tone];
  return (
    <div className={`rounded-md border ${toneCls} p-2.5`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-medium mb-2 opacity-80">
        <span>{label}</span>
        <span>{rows.length}</span>
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
                className={`h-full ${overdue ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-400' : v.severity === 'critical' ? 'bg-orange-500' : v.severity === 'high' ? 'bg-yellow-500' : 'bg-sky-500'}`}
                style={{ width: `${Math.min(100, (ageDays / budget) * 100)}%` }}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />
              <span className="uppercase">{v.severity}</span>
              <span>·</span>
              <span>SLA {budget}d</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'bg-slate-700/50 text-slate-300',
    running: 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
    completed: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-300 border border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-1 rounded-md ${map[status] ?? map.queued}`}>
      {status}
    </span>
  );
}
