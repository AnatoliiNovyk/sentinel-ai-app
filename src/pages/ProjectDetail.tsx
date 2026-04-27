import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Cloud,
  Globe,
  Server,
  FileCode,
  Radar,
  FileText,
  Activity as ActivityIcon,
  Play,
  Sparkles,
  CheckCircle2,
  Download,
  FileJson,
  ShieldCheck,
  Network,
  Zap,
  RotateCcw,
  ChevronDown,
  Search,
  SlidersHorizontal,
  ChevronRight,
  FolderKanban,
  TrendingUp,
  TrendingDown,
  Gauge,
} from 'lucide-react';
import { supabase, Project, Scan, Report, Vulnerability, Notification } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { dispatchScan } from '../lib/scanDispatch';
import { errorToUserMessage } from '../lib/errors';
import { buildReport } from '../lib/reportBuilder';
import { toJsonExport, downloadFile } from '../lib/exporters';
import { useRef } from 'react';
import FindingsTab from '../components/FindingsTab';
import AssetGraph from '../components/AssetGraph';
import ReportViewer from '../components/ReportViewer';
import ScanDiff from '../components/ScanDiff';
import AgentLogsPanel from '../components/AgentLogsPanel';

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
  const [liveJobs, setLiveJobs] = useState<{id:string;scanner:string;target:string;status:string;started_at:string|null;created_at:string}[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const meta = ENV_META[project.environment] ?? ENV_META.external;
  const EnvIcon = meta.icon;

  const load = useCallback(async () => {
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

      // Live jobs for progress indicator
      const { data: jobsData } = await supabase
        .from('scan_jobs')
        .select('id,scanner,target,status,started_at,created_at')
        .eq('project_id', project.id)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(10);
      setLiveJobs((jobsData ?? []) as typeof liveJobs);
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  }, [project.id, user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    if (exportOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`project-detail-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scans', filter: `project_id=eq.${project.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vulnerabilities' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scan_jobs', filter: `project_id=eq.${project.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, project.id]);

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

  const exportFindings = (fmt: 'csv' | 'json') => {
    const date = new Date().toISOString().split('T')[0];
    if (fmt === 'csv') {
      const rows = ['ID,Title,Severity,Status,Asset,CVE,CVSS'];
      for (const v of vulns) {
        rows.push(`${v.id},"${v.title}",${v.severity},${v.status},${v.asset},${v.cve ?? ''},${v.cvss ?? ''}`);
      }
      downloadFile(`${project.name}-findings-${date}.csv`, rows.join('\n'), 'text/csv');
    } else {
      const payload = vulns.map(v => ({
        id: v.id,
        title: v.title,
        severity: v.severity,
        status: v.status,
        asset: v.asset,
        description: v.description,
        remediation: v.remediation,
        cve: v.cve,
        cvss: v.cvss,
      }));
      downloadFile(`${project.name}-findings-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
    }
    setExportOpen(false);
  };

  const exportScans = () => {
    const date = new Date().toISOString().split('T')[0];
    const payload = scans.map(s => ({
      id: s.id,
      scanner: s.scanner,
      target: s.target,
      status: s.status,
      findingsCount: vulns.filter(v => v.scan_id === s.id).length,
      createdAt: s.created_at,
      completedAt: s.completed_at,
    }));
    downloadFile(`${project.name}-scans-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
    setExportOpen(false);
  };

  const exportAll = () => {
    const date = new Date().toISOString().split('T')[0];
    const payload = {
      exportedAt: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        environment: project.environment,
        target: project.target,
        riskScore: project.risk_score,
      },
      summary: {
        scanCount: scans.length,
        findingsCount: vulns.length,
        criticalCount: vulns.filter(v => v.severity === 'critical').length,
        highCount: vulns.filter(v => v.severity === 'high').length,
      },
      scans: scans.map(s => ({
        id: s.id,
        scanner: s.scanner,
        target: s.target,
        status: s.status,
        createdAt: s.created_at,
        completedAt: s.completed_at,
      })),
      findings: vulns.map(v => ({
        id: v.id,
        title: v.title,
        severity: v.severity,
        status: v.status,
        asset: v.asset,
        cve: v.cve,
        cvss: v.cvss,
      })),
    };
    downloadFile(`${project.name}-all-data-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
    setExportOpen(false);
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
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-white transition"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          Projects
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        <span className="text-slate-300 truncate max-w-xs">{project.name}</span>
      </nav>

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
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 px-3.5 py-2 rounded-md text-sm transition"
            >
              <Download className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                <div className="p-1">
                  <button
                    onClick={() => exportFindings('csv')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Findings as CSV
                  </button>
                  <button
                    onClick={() => exportFindings('json')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Findings as JSON
                  </button>
                  <div className="my-1 border-t border-slate-700" />
                  <button
                    onClick={exportScans}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Scans History
                  </button>
                  <div className="my-1 border-t border-slate-700" />
                  <button
                    onClick={exportAll}
                    className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded transition flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> All Project Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-800">
        {(['overview', 'topology', 'findings', 'scans', 'reports', 'activity'] as Tab[]).map((t) => {
          const counts: Partial<Record<Tab, number>> = {
            findings: vulns.length,
            scans: scans.length,
            reports: reports.length,
            activity: activity.length,
          };
          const count = counts[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition ${
                tab === t
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
              {count !== undefined && count > 0 && (
                <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                  tab === t ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <OverviewTab 
          scans={scans} 
          vulns={vulns} 
          totals={totals} 
          projectName={project.name} 
          onGoToTopology={() => setTab('topology')}
          project={project}
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
      {tab === 'scans' && <ScansTab scans={scans} vulns={vulns} project={project} liveJobs={liveJobs} onRescan={async (scanner) => {
          if (!user) return;
          const result = await dispatchScan(user.id, project.id, scanner, project.target ?? '');
          if (!result.ok) alert(errorToUserMessage(result.error));
          else await load();
        }} />}
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
  project,
}: {
  scans: Scan[];
  vulns: Vulnerability[];
  totals: Record<string, number>;
  projectName: string;
  onGoToTopology: () => void;
  project: Project;
}) {
  const lastScan = scans[0];
  const topFindings = [...vulns]
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    .slice(0, 5);

  const soc2Score = useMemo(() => {
    const penalty = (totals.critical ?? 0) * 15 + (totals.high ?? 0) * 8 + (totals.medium ?? 0) * 3;
    return Math.max(0, 100 - penalty);
  }, [totals]);

  const vulnsByScanCount = useMemo(() => {
    return vulns.reduce((acc, v) => {
      acc[v.scan_id] = (acc[v.scan_id] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [vulns]);

  const trend = useMemo(() => {
    if (scans.length < 2) return null;
    const curr = vulnsByScanCount[scans[0].id] ?? 0;
    const prev = vulnsByScanCount[scans[1].id] ?? 0;
    return curr - prev;
  }, [scans, vulnsByScanCount]);

  const openCount     = vulns.filter(v => v.status === 'open' || v.status === 'in_progress').length;
  const resolvedCount = vulns.filter(v => v.status === 'resolved').length;
  const avgAgeDays    = vulns.length === 0 ? 0 : Math.round(
    vulns.filter(v => v.status === 'open' || v.status === 'in_progress')
      .reduce((s, v) => s + (Date.now() - new Date(v.created_at).getTime()) / 86_400_000, 0) /
    Math.max(1, openCount)
  );

  return (
    <div className="space-y-6">
      {/* Quick-stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total findings', value: vulns.length,   color: 'text-slate-200' },
          { label: 'Open',           value: openCount,      color: 'text-red-400'   },
          { label: 'Resolved',       value: resolvedCount,  color: 'text-emerald-400' },
          { label: 'Reports',        value: scans.length,   color: 'text-sky-400', sub: 'scans run' },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
            <div className="text-xs text-slate-400 mb-1">{c.label}</div>
            <div className={`text-3xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
            {c.sub && <div className="text-[10px] text-slate-600 mt-0.5">{c.sub}</div>}
            {'label' in c && c.label === 'Open' && openCount > 0 && (
              <div className="text-[10px] text-slate-600 mt-0.5">avg {avgAgeDays}d old</div>
            )}
          </div>
        ))}
      </div>

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
            <div className="grid grid-cols-6 gap-2 mb-4">
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

            {trend !== null && (
              <div className={`flex items-center gap-1.5 mb-4 text-xs font-medium px-3 py-2 rounded-lg border ${
                trend > 0 ? 'text-red-400 bg-red-500/5 border-red-500/20'
                : trend < 0 ? 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20'
                : 'text-slate-400 bg-slate-800/50 border-slate-700'
              }`}>
                {trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : trend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                {trend > 0 ? `+${trend} findings vs previous scan` : trend < 0 ? `${Math.abs(trend)} fewer findings vs previous scan` : 'No change vs previous scan'}
              </div>
            )}

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

        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5">
          <h3 className="font-semibold mb-1 flex items-center gap-2 text-sm">
            <Gauge className="w-4 h-4 text-violet-400" /> Risk Posture
          </h3>
          <RiskGauge score={project.risk_score ?? 0} />
          {lastScan && (
            <div className="text-xs text-slate-500 flex justify-between mb-3">
              <span>Last: <span className="text-slate-300 font-medium">{lastScan.scanner}</span></span>
              <span className={lastScan.status === 'completed' ? 'text-emerald-400' : lastScan.status === 'failed' ? 'text-red-400' : 'text-sky-400'}>
                {lastScan.status}
              </span>
            </div>
          )}
          <div className="border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Scan history</span>
              <span className="text-[10px] text-slate-600">{scans.length} total</span>
            </div>
            <ScanHistoryChart scans={scans} vulnsByScan={vulnsByScanCount} />
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/>completed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block"/>failed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-sky-500 inline-block"/>running</span>
            </div>
          </div>
        </div>

        <WebhookPanel project={project} />
      </div>
    </div>
    </div>
  );
}

// ─── Webhook Panel ────────────────────────────────────────────────────────────
function WebhookPanel({ project }: { project: Project }) {
  const [url, setUrl] = useState(project.webhook_url ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    const clean = url.trim();
    await supabase.from('projects').update({ webhook_url: clean || null }).eq('id', project.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
      <h3 className="font-semibold mb-1 flex items-center gap-2 text-sm">
        <Zap className="w-4 h-4 text-amber-400" /> Webhook alerts
      </h3>
      <p className="text-xs text-slate-500 mb-4">
        Receive a POST request when critical or high findings are detected.
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.slack.com/services/…"
          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium transition"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="text-[11px] text-slate-600 mt-2">
        Payload: <code className="text-slate-500">event, project_id, target, findings_count, findings[]</code>
      </p>
    </div>
  );
}

function ScansTab({ scans, vulns, project, liveJobs, onRescan }: {
  scans: Scan[];
  vulns: Vulnerability[];
  project: Project;
  liveJobs: {id:string;scanner:string;target:string;status:string;started_at:string|null;created_at:string}[];
  onRescan: (scanner: string) => Promise<void>;
}) {
  const [rescanning, setRescanning] = useState<string | null>(null);
  const [scanSearch, setScanSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'running' | 'failed'>('all');

  const handleRescan = async (scanner: string) => {
    setRescanning(scanner);
    try {
      await onRescan(scanner);
    } finally {
      setRescanning(null);
    }
  };
  const vulnsByScan = useMemo(() => {
    return vulns.reduce((acc, v) => {
      (acc[v.scan_id] ??= []).push(v);
      return acc;
    }, {} as Record<string, Vulnerability[]>);
  }, [vulns]);

  const filteredScans = useMemo(() => {
    const q = scanSearch.trim().toLowerCase();
    return scans.filter(s => {
      const matchSearch = !q || s.scanner.toLowerCase().includes(q) || (s.target ?? '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [scans, scanSearch, statusFilter]);

  if (scans.length === 0) {
    return (
      <div className="space-y-6">
        <AgentLogsPanel projectId={project.id} />
        {liveJobs.length > 0 && <ScanProgressBanner jobs={liveJobs} />}
        <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
          <Radar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <div className="text-sm text-slate-400">No scans yet for this project.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AgentLogsPanel projectId={project.id} />
      {liveJobs.length > 0 && <ScanProgressBanner jobs={liveJobs} />}
      {/* Scan search + status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            value={scanSearch}
            onChange={e => setScanSearch(e.target.value)}
            placeholder="Search by scanner or target…"
            className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          {(['all', 'completed', 'pending', 'running', 'failed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-2.5 py-1.5 rounded-md border transition capitalize ${
                statusFilter === s
                  ? s === 'completed' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : s === 'failed' ? 'border-red-500/50 bg-red-500/10 text-red-300'
                    : s === 'running' ? 'border-sky-500/50 bg-sky-500/10 text-sky-300'
                    : 'border-slate-600 bg-slate-800 text-white'
                  : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>
      {/* F-07: Continuous Monitoring Diff */}
      {scans.filter(s => s.status === 'completed').length >= 2 && (
        <ScanDiff scans={scans} vulns={vulns} />
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden">
      {filteredScans.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-500">No scans match the current filter.</div>
      ) : filteredScans.map((s) => {
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
                onClick={() => handleRescan(s.scanner)}
                disabled={rescanning === s.scanner || liveJobs.some(j => j.scanner === s.scanner)}
                title="Re-run this scan"
                aria-label="Re-run scan"
                className="p-2 text-slate-500 hover:text-emerald-400 transition disabled:opacity-40"
              >
                <RotateCcw className={`w-4 h-4 ${rescanning === s.scanner ? 'animate-spin' : ''}`} />
              </button>
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

// ─── Scan Progress Banner ─────────────────────────────────────────────────────
function ScanProgressBanner({ jobs }: {
  jobs: {id:string;scanner:string;target:string;status:string;started_at:string|null;created_at:string}[];
}) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
        <span className="text-sm font-semibold text-sky-300">
          {jobs.length === 1 ? 'Scan in progress' : `${jobs.length} scans in progress`}
        </span>
      </div>
      {jobs.map((job) => (
        <div key={job.id} className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-white">{job.scanner}</span>
              <span className="text-slate-400 font-mono truncate ml-2">{job.target}</span>
              <span className={`ml-2 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                job.status === 'running'
                  ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
                  : 'text-slate-400 bg-slate-800 border-slate-700'
              }`}>{job.status}</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  job.status === 'running'
                    ? 'bg-sky-500 w-3/4 animate-pulse'
                    : 'bg-slate-600 w-1/6'
                }`}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsTab({ reports, onView }: { reports: Report[]; onView: (r: Report) => void }) {
  const [kindFilter, setKindFilter] = useState<'all' | 'executive' | 'technical'>('all');
  const kindMeta: Record<string, { label: string; color: string }> = {
    executive: { label: 'Executive', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    technical: { label: 'Technical', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  };
  const filteredReports = kindFilter === 'all' ? reports : reports.filter(r => r.kind === kindFilter);

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
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {(['all', 'executive', 'technical'] as const).map(k => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className={`text-xs px-3 py-1.5 rounded-md border transition capitalize ${
              kindFilter === k
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
            }`}
          >
            {k === 'all' ? 'All types' : k}
          </button>
        ))}
        <span className="ml-2 text-xs text-slate-500">{filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {filteredReports.length === 0 ? (
        <div className="col-span-2 rounded-xl border border-dashed border-slate-800 p-12 text-center">
          <FileText className="w-7 h-7 text-slate-600 mx-auto mb-2" />
          <div className="text-sm text-slate-500">No reports match this filter.</div>
        </div>
      ) : filteredReports.map((r) => {
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

function RiskGauge({ score }: { score: number }) {
  const s = Math.min(100, Math.max(0, score));
  const R = 80;
  const CX = 100;
  const CY = 105;
  const color = s < 34 ? '#10b981' : s < 67 ? '#f59e0b' : '#ef4444';
  const label = s < 34 ? 'LOW RISK' : s < 67 ? 'MEDIUM RISK' : 'HIGH RISK';

  // Background: left (20,105) → top → right (180,105), sweep=1 (clockwise through top in SVG)
  const bgPath = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

  let valuePath = '';
  if (s > 0 && s < 100) {
    // Angle in SVG clockwise terms: starts at 180° (left), goes to 180°+(s/100)*180°
    const angleRad = Math.PI + (s / 100) * Math.PI;
    const ex = (CX + R * Math.cos(angleRad)).toFixed(2);
    const ey = (CY + R * Math.sin(angleRad)).toFixed(2);
    valuePath = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${ex} ${ey}`;
  } else if (s === 100) {
    valuePath = bgPath;
  }

  return (
    <svg viewBox="0 0 200 120" className="w-full h-[110px]">
      <path d={bgPath} fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
      {valuePath && (
        <path d={valuePath} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
      )}
      <text x="100" y="100" textAnchor="middle" fill="white" fontSize="30" fontWeight="700">{s}</text>
      <text x="100" y="116" textAnchor="middle" fill="#64748b" fontSize="9">{label}</text>
    </svg>
  );
}

function ScanHistoryChart({ scans, vulnsByScan }: { scans: Scan[]; vulnsByScan: Record<string, number> }) {
  const recent = [...scans].slice(0, 10).reverse();
  if (recent.length === 0) {
    return <div className="h-[66px] flex items-center justify-center text-xs text-slate-600">No scan data</div>;
  }
  const counts = recent.map(s => vulnsByScan[s.id] ?? 0);
  const maxCount = Math.max(...counts, 1);
  const CHART_H = 46;
  const BAR_W = 14;
  const GAP = 3;
  const totalW = recent.length * (BAR_W + GAP) - GAP;
  const offsetX = (200 - totalW) / 2;

  return (
    <svg viewBox="0 0 200 66" className="w-full h-[66px]">
      {recent.map((s, i) => {
        const count = counts[i];
        const h = Math.max(4, (count / maxCount) * CHART_H);
        const x = offsetX + i * (BAR_W + GAP);
        const y = CHART_H - h;
        const color =
          s.status === 'failed' ? '#ef4444'
          : s.status === 'running' ? '#3b82f6'
          : s.status === 'completed' ? '#10b981'
          : '#475569';
        return (
          <g key={s.id}>
            <rect x={x} y={y} width={BAR_W} height={h} rx="2" fill={color} opacity="0.85" />
            <text x={x + BAR_W / 2} y="62" textAnchor="middle" fill="#475569" fontSize="8">
              {count > 0 ? count : '✓'}
            </text>
          </g>
        );
      })}
    </svg>
  );
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
