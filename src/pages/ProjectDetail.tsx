import { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Cloud,
  Globe,
  Server,
  FileCode,
  Radar,
  FileText,
  Activity as ActivityIcon,
  Play,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  ShieldCheck,
  Network,
} from 'lucide-react';
import { supabase, Project, Scan, Report, Vulnerability, Notification } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_SCANNERS } from '../lib/scanMock';
import { dispatchScan } from '../lib/scanDispatch';
import { errorToUserMessage } from '../lib/errors';
import { buildReport } from '../lib/reportBuilder';
import { toSarif, toJsonExport, downloadFile } from '../lib/exporters';
import FindingsTab from '../components/FindingsTab';
import AssetGraph from '../components/AssetGraph';
import ReportViewer from '../components/ReportViewer';
import ScanDiff from '../components/ScanDiff';

const ENV_META: Record<string, { label: string; icon: typeof Cloud; color: string }> = {
  external: { label: 'External', icon: Globe, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  cloud: { label: 'Cloud', icon: Cloud, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  internal: { label: 'Internal', icon: Server, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  iac: { label: 'IaC', icon: FileCode, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};

type Tab = 'overview' | 'topology' | 'findings' | 'scans' | 'reports' | 'activity';

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
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const meta = ENV_META[project.environment] ?? ENV_META.external;
  const EnvIcon = meta.icon;

  const load = async () => {
    if (!user) return;
    try {
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
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const scanList = (sRes.data ?? []) as Scan[];
      setScans(scanList);
      setReports((rRes.data ?? []) as Report[]);
      
      // Filter notifications relevant to this project if possible, or just all
      setNotifications((nRes.data ?? []) as Notification[]);

      const scanIds = scanList.map((s) => s.id);
      if (scanIds.length) {
        const { data } = await supabase.from('vulnerabilities').select('*').in('scan_id', scanIds);
        setVulns((data ?? []) as Vulnerability[]);
      } else {
        setVulns([]);
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  };

  useEffect(() => {
    load();
  }, [project.id, user?.id]);

  const totals = useMemo(() => {
    return vulns.reduce(
      (acc, v) => {
        acc[v.severity] = (acc[v.severity] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [vulns]);

  const defaultScanner =
    project.environment === 'cloud' ? 'prowler' : project.environment === 'iac' ? 'tfsec' : 'nmap';

  const quickScan = async () => {
    if (!user || launching) return;
    setLaunching(true);
    try {
      const result = await dispatchScan(user.id, project.id, defaultScanner, project.target ?? '');
      if (!result.ok) {
        console.error('[ProjectDetail] quickScan failed:', result.error);
        alert(errorToUserMessage(result.error));
        return;
      }
      await load();
    } finally {
      setLaunching(false);
    }
  };

  const quickReport = async (kind: 'executive' | 'technical' = 'technical') => {
    if (!user || generating || !scans.length) return;
    setGenerating(true);
    try {
      const content = buildReport(kind, project, scans, vulns);
      const { data: newReport } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          project_id: project.id,
          title: `${project.name} — ${kind === 'executive' ? 'Executive Summary' : 'Technical Deep Dive'}`,
          kind,
          content,
        })
        .select()
        .maybeSingle();
      await load();
      if (newReport) setSelectedReport(newReport as Report);
    } finally {
      setGenerating(false);
    }
  };

  const activity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [
      ...scans.map((s) => ({
        at: s.created_at,
        kind: 'scan' as const,
        title: `Scan: ${s.scanner}`,
        detail: `${s.status} with ${vulns.filter(v => v.scan_id === s.id).length} findings`,
      })),
      ...reports.map((r) => ({
        at: r.created_at,
        kind: 'report' as const,
        title: r.title,
        detail: `${r.kind} report generated`,
      })),
      ...notifications.map((n) => ({
        at: n.created_at,
        kind: 'notification' as const,
        title: n.title,
        detail: n.body,
        severity: n.severity,
      })),
    ];
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 40);
  }, [scans, reports, notifications, vulns]);

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
            <EnvIcon className="w-3 h-3" /> {meta.label}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            {project.description || 'No description provided.'}
          </p>
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
            onClick={() => quickReport('executive')}
            disabled={generating || !scans.length}
            title="Generate executive summary"
            className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-medium px-3.5 py-2 rounded-md text-sm transition"
          >
            <Sparkles className="w-4 h-4" /> {generating ? 'Generating...' : 'Executive'}
          </button>
          <button
            onClick={() => quickReport('technical')}
            disabled={generating || !scans.length}
            title="Generate technical report"
            className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-medium px-3.5 py-2 rounded-md text-sm transition"
          >
            <FileJson className="w-4 h-4" /> {generating ? 'Generating...' : 'Technical'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-800">
        {(['overview', 'topology', 'findings', 'scans', 'reports', 'activity'] as Tab[]).map((t) => (
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
        <OverviewTab 
          scans={scans} 
          vulns={vulns} 
          totals={totals} 
          projectName={project.name} 
          onGoToTopology={() => setTab('topology')} 
        />
      )}
      {tab === 'topology' && (
        <div className="animate-in fade-in zoom-in duration-500">
           <AssetGraph projectName={project.name} vulns={vulns} />
        </div>
      )}
      {tab === 'findings' && (
        <FindingsTab
          vulns={vulns}
          onUpdated={(next) => setVulns((prev) => prev.map((v) => (v.id === next.id ? next : v)))}
        />
      )}
      {tab === 'scans' && <ScansTab scans={scans} vulns={vulns} project={project} />}
      {tab === 'reports' && <ReportsTab reports={reports} onView={setSelectedReport} />}
      {tab === 'activity' && <ActivityTab items={activity} />}

      {selectedReport && (
        <ReportViewer report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </div>
  );
}

function OverviewTab({
  scans,
  vulns,
  totals,
  projectName,
  onGoToTopology,
}: {
  scans: Scan[];
  vulns: Vulnerability[];
  totals: Record<string, number>;
  projectName: string;
  onGoToTopology: () => void;
}) {
  const lastScan = scans[0];
  const topFindings = [...vulns]
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    .slice(0, 5);

  const soc2Score = useMemo(() => {
    const penalty = (totals.critical ?? 0) * 15 + (totals.high ?? 0) * 8 + (totals.medium ?? 0) * 3;
    return Math.max(0, 100 - penalty);
  }, [totals]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            <div className="grid grid-cols-6 gap-2 mb-6">
              <div className="rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3 text-center">
                <div className="text-[10px] text-emerald-500 uppercase font-bold tracking-tight">SOC2 Readiness</div>
                <div className="text-lg font-bold mt-0.5 text-white">{soc2Score}%</div>
              </div>
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
                <div key={v.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{v.title}</div>
                    <div className="text-xs text-slate-500 font-mono truncate">{v.asset}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded border capitalize shrink-0 ${severityClass(v.severity)}`}>
                    {v.severity}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col h-[320px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Network className="w-4 h-4 text-sky-400" /> Topology preview
            </h3>
            <button onClick={onGoToTopology} className="text-[10px] uppercase font-bold text-slate-500 hover:text-slate-300 transition">
              View
            </button>
          </div>
          <div className="flex-1 overflow-hidden scale-75 origin-top">
             <AssetGraph projectName={projectName} vulns={vulns} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <h3 className="font-semibold mb-4">Latest scan</h3>
          {lastScan ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Scanner</span>
                <span className="text-white font-medium">{lastScan.scanner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="text-emerald-400 capitalize">{lastScan.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Completed</span>
                <span className="text-white">{new Date(lastScan.created_at).toLocaleDateString()}</span>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800">
                <h4 className="text-[11px] font-semibold text-slate-500 uppercase mb-2">Recommended</h4>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_SCANNERS.slice(0, 2).map(s => (
                    <span key={s.id} className="px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-300">{s.label}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic">No scans performed yet.</div>
          )}
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

  const vulnsByScan = useMemo(() => {
    return vulns.reduce((acc, v) => {
      (acc[v.scan_id] ??= []).push(v);
      return acc;
    }, {} as Record<string, Vulnerability[]>);
  }, [vulns]);

  return (
    <div className="space-y-6">
      {/* F-07: Continuous Monitoring Diff */}
      {scans.filter(s => s.status === 'completed').length >= 2 && (
        <ScanDiff scans={scans} vulns={vulns} />
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden">
      {scans.map((s) => {
        const scanVulns = vulnsByScan[s.id] ?? [];
        return (
          <div key={s.id} className="px-6 py-4 flex items-center justify-between group hover:bg-slate-900/50 transition">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-800 flex items-center justify-center">
                <Radar className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">{s.scanner}</div>
                <div className="text-xs text-slate-500">
                  {new Date(s.created_at).toLocaleString()} · {scanVulns.length} findings
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadFile(`${project.name}_${s.id}.json`, toJsonExport(project, s, scanVulns), 'application/json')}
                aria-label="Download JSON export"
                title="Download JSON export"
                className="p-2 text-slate-500 hover:text-white transition"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function ReportsTab({ reports, onView }: { reports: Report[]; onView: (r: Report) => void }) {
  const kindMeta: Record<string, { label: string; color: string }> = {
    executive: { label: 'Executive', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    technical: { label: 'Technical', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
        <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <div className="text-sm font-medium text-slate-300">No reports yet</div>
        <div className="text-xs text-slate-500 mt-1">Use the buttons above to generate an Executive or Technical report.</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reports.map((r) => {
        const meta = kindMeta[r.kind] ?? { label: r.kind, color: 'text-slate-400 bg-slate-800 border-slate-700' };
        const charCount = r.content.length;
        const lineCount = r.content.split('\n').length;
        return (
          <button
            key={r.id}
            onClick={() => onView(r)}
            className="group text-left rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 hover:bg-slate-900/60 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/5 transition">
                <FileText className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition" />
              </div>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${meta.color}`}>
                {meta.label}
              </span>
            </div>
            <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition leading-tight mb-1">
              {r.title}
            </div>
            <div className="text-xs text-slate-500 mb-3">
              {new Date(r.created_at).toLocaleString()}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-600 font-mono border-t border-slate-800 pt-3">
              <span>{charCount.toLocaleString()} chars</span>
              <span>·</span>
              <span>{lineCount} lines</span>
              <span className="ml-auto text-emerald-500 opacity-0 group-hover:opacity-100 transition font-sans font-medium">Open →</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ActivityTab({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
        <ActivityIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <div className="text-sm text-slate-400">No recent activity.</div>
      </div>
    );
  }
  return (
    <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6">
      {items.map((it, i) => (
        <div key={i} className="relative">
          <span className={`absolute -left-[33px] top-1.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
            it.kind === 'scan' ? 'bg-sky-500' : it.kind === 'report' ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
          <div className="text-sm font-medium text-white">{it.title}</div>
          {it.detail && <div className="text-xs text-slate-500 mt-0.5">{it.detail}</div>}
          <div className="text-[10px] text-slate-600 mt-1 uppercase">{new Date(it.at).toLocaleTimeString()}</div>
        </div>
      ))}
    </div>
  );
}

function severityWeight(s: string): number {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[s] ?? 0;
}

function severityClass(s: string): string {
  return {
    critical: 'text-red-400 border-red-500/30 bg-red-500/10',
    high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    info: 'text-slate-400 border-slate-700 bg-slate-800/40',
  }[s] ?? 'text-slate-400 border-slate-700 bg-slate-800/40';
}
