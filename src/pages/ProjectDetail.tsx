import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Cloud,
  Globe,
  Server,
  FileCode,
  Radar,
  FileText,
  Activity,
  Play,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  ShieldCheck,
} from 'lucide-react';
import { supabase, Project, Scan, Report, Vulnerability, Notification } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_SCANNERS, runMockScan } from '../lib/scanMock';
import { buildReport } from '../lib/reportBuilder';
import { toSarif, toJsonExport, downloadFile } from '../lib/exporters';
import FindingsTab from '../components/FindingsTab';

const ENV_META: Record<string, { label: string; icon: typeof Cloud; color: string }> = {
  external: { label: 'External', icon: Globe, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  cloud: { label: 'Cloud', icon: Cloud, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  internal: { label: 'Internal', icon: Server, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  iac: { label: 'IaC', icon: FileCode, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};

type Tab = 'overview' | 'findings' | 'scans' | 'reports' | 'activity';

type ActivityItem = {
  at: string;
  kind: 'scan' | 'report' | 'notification';
  title: string;
  detail?: string;
  severity?: string;
};

export default function ProjectDetail({ project, onBack }: { project: Project; onBack: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [scans, setScans] = useState<Scan[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [launching, setLaunching] = useState(false);
  const [generating, setGenerating] = useState(false);

  const meta = ENV_META[project.environment] ?? ENV_META.external;
  const Icon = meta.icon;

  const load = async () => {
    if (!user) return;
    const [sRes, rRes, nRes] = await Promise.all([
      supabase
        .from('scans')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', project.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('project_id', project.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .contains('metadata', { project_id: project.id })
        .order('created_at', { ascending: false })
        .limit(25),
    ]);
    const scanList = (sRes.data ?? []) as Scan[];
    setScans(scanList);
    setReports((rRes.data ?? []) as Report[]);
    setNotifications((nRes.data ?? []) as Notification[]);

    const scanIds = scanList.map((s) => s.id);
    if (scanIds.length) {
      const { data } = await supabase.from('vulnerabilities').select('*').in('scan_id', scanIds);
      setVulns((data ?? []) as Vulnerability[]);
    } else {
      setVulns([]);
    }
  };

  useEffect(() => {
    load();
  }, [project.id, user?.id]);

  const totals = vulns.reduce(
    (acc, v) => {
      acc[v.severity] = (acc[v.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const defaultScanner =
    project.environment === 'cloud' ? 'prowler' : project.environment === 'iac' ? 'tfsec' : 'nmap';

  const quickScan = async () => {
    if (!user || launching) return;
    setLaunching(true);
    await runMockScan(user.id, project.id, defaultScanner);
    await load();
    setLaunching(false);
  };

  const quickReport = async () => {
    if (!user || generating) return;
    setGenerating(true);
    const content = buildReport('executive', project, scans, vulns);
    const title = `Executive Summary - ${project.name}`;
    const { data: report } = await supabase
      .from('reports')
      .insert({ user_id: user.id, project_id: project.id, kind: 'executive', title, content })
      .select()
      .maybeSingle();
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'report_ready',
      title: 'Executive report ready',
      body: `${title} has been generated.`,
      link: 'reports',
      severity: 'success',
      metadata: { report_id: report?.id, project_id: project.id, kind: 'executive' },
    });
    await load();
    setGenerating(false);
  };

  const activity: ActivityItem[] = [
    ...scans.map((s) => ({
      at: s.created_at,
      kind: 'scan' as const,
      title: `${s.scanner} scan ${s.status}`,
      detail: `${s.severity_summary?.critical ?? 0}C · ${s.severity_summary?.high ?? 0}H · ${s.severity_summary?.medium ?? 0}M`,
    })),
    ...reports.map((r) => ({
      at: r.created_at,
      kind: 'report' as const,
      title: r.title,
      detail: `${r.kind} report`,
    })),
    ...notifications.map((n) => ({
      at: n.created_at,
      kind: 'notification' as const,
      title: n.title,
      detail: n.body,
      severity: n.severity,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  return (
    <div className="p-8 max-w-6xl">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to projects
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${meta.color}`}>
            <Icon className="w-3 h-3" /> {meta.label}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            {project.description || 'No description provided.'}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-900/50 border border-slate-800 px-2.5 py-1 rounded-md">
            {project.target}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={quickScan}
            disabled={launching}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-3.5 py-2 rounded-md text-sm transition"
          >
            <Play className="w-4 h-4" /> {launching ? 'Scanning...' : 'Run scan'}
          </button>
          <button
            onClick={quickReport}
            disabled={generating}
            className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 disabled:opacity-60 text-slate-200 font-medium px-3.5 py-2 rounded-md text-sm transition"
          >
            <Sparkles className="w-4 h-4" /> {generating ? 'Generating...' : 'Report'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Scans" value={scans.length} icon={Radar} tint="text-sky-400 border-sky-500/20 bg-sky-500/10" />
        <StatCard
          label="Critical"
          value={totals.critical ?? 0}
          icon={AlertTriangle}
          tint="text-red-400 border-red-500/20 bg-red-500/10"
        />
        <StatCard
          label="High"
          value={totals.high ?? 0}
          icon={AlertTriangle}
          tint="text-orange-400 border-orange-500/20 bg-orange-500/10"
        />
        <StatCard
          label="Medium"
          value={totals.medium ?? 0}
          icon={AlertTriangle}
          tint="text-yellow-400 border-yellow-500/20 bg-yellow-500/10"
        />
        <StatCard
          label="Reports"
          value={reports.length}
          icon={FileText}
          tint="text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
        />
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-800">
        {(['overview', 'findings', 'scans', 'reports', 'activity'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition ${
              tab === t
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab scans={scans} vulns={vulns} totals={totals} />
      )}
      {tab === 'findings' && (
        <FindingsTab
          vulns={vulns}
          onUpdated={(next) => setVulns((prev) => prev.map((v) => (v.id === next.id ? next : v)))}
        />
      )}
      {tab === 'scans' && <ScansTab scans={scans} vulns={vulns} project={project} />}
      {tab === 'reports' && <ReportsTab reports={reports} />}
      {tab === 'activity' && <ActivityTab items={activity} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number;
  icon: typeof Radar;
  tint: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${tint}`}>
      <div className="flex items-center gap-2 text-xs opacity-80">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function OverviewTab({
  scans,
  vulns,
  totals,
}: {
  scans: Scan[];
  vulns: Vulnerability[];
  totals: Record<string, number>;
}) {
  const lastScan = scans[0];
  const topFindings = [...vulns]
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Posture
        </h3>
        {vulns.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <div className="text-sm text-slate-300">No findings on record. Launch a scan to assess posture.</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2 mb-5">
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
                <div key={sev} className="rounded-md bg-slate-900/70 border border-slate-800 p-3 text-center">
                  <div className="text-xs text-slate-500 capitalize">{sev}</div>
                  <div className="text-lg font-bold mt-0.5 text-white">{totals[sev] ?? 0}</div>
                </div>
              ))}
            </div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Top priority findings
            </div>
            <div className="space-y-2">
              {topFindings.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{v.title}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{v.asset}</div>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded border capitalize shrink-0 ${severityClass(v.severity)}`}
                  >
                    {v.severity}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <h3 className="font-semibold mb-4">Latest scan</h3>
        {lastScan ? (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Scanner</div>
              <div className="text-sm text-white mt-0.5">{lastScan.scanner}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Status</div>
              <div className="text-sm text-white mt-0.5 capitalize">{lastScan.status}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Run</div>
              <div className="text-sm text-white mt-0.5">{new Date(lastScan.created_at).toLocaleString()}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">No scans yet.</div>
        )}
        <div className="mt-6 pt-5 border-t border-slate-800">
          <h4 className="text-sm font-semibold mb-2">Recommended scanners</h4>
          <ul className="space-y-1.5 text-xs text-slate-400">
            {AVAILABLE_SCANNERS.slice(0, 3).map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-medium text-slate-200">{s.label}</span>
                <span className="truncate">· {s.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ScansTab({ scans, vulns, project }: { scans: Scan[]; vulns: Vulnerability[]; project: Project }) {
  if (scans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
        <Radar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <div className="text-sm text-slate-400">No scans yet for this project.</div>
      </div>
    );
  }
  const vulnsByScan = vulns.reduce((acc, v) => {
    (acc[v.scan_id] ??= []).push(v);
    return acc;
  }, {} as Record<string, Vulnerability[]>);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden">
      {scans.map((s) => {
        const scanVulns = vulnsByScan[s.id] ?? [];
        return (
          <div key={s.id} className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                  <Radar className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white">{s.scanner}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {new Date(s.created_at).toLocaleString()} · {scanVulns.length} findings
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    downloadFile(
                      `${project.name}_${s.scanner}_${s.id.slice(0, 6)}.sarif.json`,
                      toSarif(project, s, scanVulns),
                      'application/json'
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
                  title="Export SARIF"
                >
                  <Download className="w-3.5 h-3.5" /> SARIF
                </button>
                <button
                  onClick={() =>
                    downloadFile(
                      `${project.name}_${s.scanner}_${s.id.slice(0, 6)}.json`,
                      toJsonExport(project, s, scanVulns),
                      'application/json'
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
                  title="Export JSON"
                >
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportsTab({ reports }: { reports: Report[] }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <div className="text-sm text-slate-400">No reports yet for this project.</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden">
      {reports.map((r) => (
        <div key={r.id} className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">{r.title}</div>
            <div className="text-xs text-slate-500 mt-0.5 capitalize">
              {r.kind} · {new Date(r.created_at).toLocaleString()}
            </div>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 capitalize">
            {r.kind}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
        <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <div className="text-sm text-slate-400">Activity will appear here as scans and reports run.</div>
      </div>
    );
  }
  return (
    <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-4">
      {items.map((it, i) => (
        <div key={i} className="relative">
          <span
            className={`absolute -left-[33px] top-1.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
              it.kind === 'scan'
                ? 'bg-sky-400'
                : it.kind === 'report'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
            }`}
          />
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white">{it.title}</div>
              <div className="text-xs text-slate-500">{new Date(it.at).toLocaleString()}</div>
            </div>
            {it.detail && <div className="text-xs text-slate-400 mt-0.5">{it.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function severityWeight(s: string): number {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[s] ?? 0;
}

function severityClass(s: string): string {
  return (
    {
      critical: 'text-red-400 border-red-500/30 bg-red-500/10',
      high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
      medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
      low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      info: 'text-slate-400 border-slate-700 bg-slate-800/40',
    }[s] ?? 'text-slate-400 border-slate-700 bg-slate-800/40'
  );
}
