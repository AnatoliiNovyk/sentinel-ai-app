import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, Cloud, Globe, Server, FileCode, Radar, FileText, Activity as ActivityIcon, Play, Sparkles, CheckCircle2, Download, FileJson, ShieldCheck, Network, } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { AVAILABLE_SCANNERS } from '../lib/scanMock';
import { dispatchScan } from '../lib/scanDispatch';
import { errorToUserMessage } from '../lib/errors';
import { buildReport } from '../lib/reportBuilder';
import { toJsonExport, downloadFile } from '../lib/exporters';
import FindingsTab from '../components/FindingsTab';
import AssetGraph from '../components/AssetGraph';
import ReportViewer from '../components/ReportViewer';
import ScanDiff from '../components/ScanDiff';
const ENV_META = {
    external: { label: 'External', icon: Globe, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    cloud: { label: 'Cloud', icon: Cloud, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    internal: { label: 'Internal', icon: Server, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
    iac: { label: 'IaC', icon: FileCode, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};
export default function ProjectDetail({ project, onBack }) {
    const { user } = useAuth();
    const [tab, setTab] = useState('overview');
    const [scans, setScans] = useState([]);
    const [reports, setReports] = useState([]);
    const [vulns, setVulns] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [launching, setLaunching] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const meta = ENV_META[project.environment] ?? ENV_META.external;
    const EnvIcon = meta.icon;
    const load = useCallback(async () => {
        if (!user)
            return;
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
            const scanList = (sRes.data ?? []);
            setScans(scanList);
            setReports((rRes.data ?? []));
            // Filter notifications relevant to this project if possible, or just all
            setNotifications((nRes.data ?? []));
            const scanIds = scanList.map((s) => s.id);
            if (scanIds.length) {
                const { data } = await supabase.from('vulnerabilities').select('*').in('scan_id', scanIds);
                setVulns((data ?? []));
            }
            else {
                setVulns([]);
            }
        }
        catch (err) {
            console.error('Failed to load project details:', err);
        }
    }, [project.id, user]);
    useEffect(() => {
        load();
    }, [load]);
    const totals = useMemo(() => {
        return vulns.reduce((acc, v) => {
            acc[v.severity] = (acc[v.severity] ?? 0) + 1;
            return acc;
        }, {});
    }, [vulns]);
    const defaultScanner = project.environment === 'cloud' ? 'prowler' : project.environment === 'iac' ? 'tfsec' : 'nmap';
    const quickScan = async () => {
        if (!user || launching)
            return;
        setLaunching(true);
        try {
            const result = await dispatchScan(user.id, project.id, defaultScanner, project.target ?? '');
            if (!result.ok) {
                console.error('[ProjectDetail] quickScan failed:', result.error);
                alert(errorToUserMessage(result.error));
                return;
            }
            await load();
        }
        finally {
            setLaunching(false);
        }
    };
    const quickReport = async (kind = 'technical') => {
        if (!user || generating || !scans.length)
            return;
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
            if (newReport)
                setSelectedReport(newReport);
        }
        finally {
            setGenerating(false);
        }
    };
    const activity = useMemo(() => {
        const items = [
            ...scans.map((s) => ({
                at: s.created_at,
                kind: 'scan',
                title: `Scan: ${s.scanner}`,
                detail: `${s.status} with ${vulns.filter(v => v.scan_id === s.id).length} findings`,
            })),
            ...reports.map((r) => ({
                at: r.created_at,
                kind: 'report',
                title: r.title,
                detail: `${r.kind} report generated`,
            })),
            ...notifications.map((n) => ({
                at: n.created_at,
                kind: 'notification',
                title: n.title,
                detail: n.body,
                severity: n.severity,
            })),
        ];
        return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 40);
    }, [scans, reports, notifications, vulns]);
    return (_jsxs("div", { className: "p-8 max-w-6xl", children: [_jsxs("button", { onClick: onBack, className: "inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), " Back to projects"] }), _jsxs("div", { className: "flex items-start justify-between gap-4 mb-6", children: [_jsxs("div", { children: [_jsxs("div", { className: `inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${meta.color}`, children: [_jsx(EnvIcon, { className: "w-3 h-3" }), " ", meta.label] }), _jsx("h1", { className: "mt-2 text-3xl font-bold tracking-tight", children: project.name }), _jsx("p", { className: "mt-1 text-sm text-slate-400 max-w-2xl", children: project.description || 'No description provided.' })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs("button", { onClick: quickScan, disabled: launching, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-3.5 py-2 rounded-md text-sm transition", children: [_jsx(Play, { className: "w-4 h-4" }), " ", launching ? 'Scanning...' : 'Run scan'] }), _jsxs("button", { onClick: () => quickReport('executive'), disabled: generating || !scans.length, title: "Generate executive summary", className: "inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-medium px-3.5 py-2 rounded-md text-sm transition", children: [_jsx(Sparkles, { className: "w-4 h-4" }), " ", generating ? 'Generating...' : 'Executive'] }), _jsxs("button", { onClick: () => quickReport('technical'), disabled: generating || !scans.length, title: "Generate technical report", className: "inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-medium px-3.5 py-2 rounded-md text-sm transition", children: [_jsx(FileJson, { className: "w-4 h-4" }), " ", generating ? 'Generating...' : 'Technical'] })] })] }), _jsx("div", { className: "flex items-center gap-1 mb-6 border-b border-slate-800", children: ['overview', 'topology', 'findings', 'scans', 'reports', 'activity'].map((t) => (_jsx("button", { onClick: () => setTab(t), className: `px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition ${tab === t
                        ? 'border-emerald-500 text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'}`, children: t }, t))) }), tab === 'overview' && (_jsx(OverviewTab, { scans: scans, vulns: vulns, totals: totals, projectName: project.name, onGoToTopology: () => setTab('topology') })), tab === 'topology' && (_jsx("div", { className: "animate-in fade-in zoom-in duration-500", children: _jsx(AssetGraph, { projectName: project.name, vulns: vulns }) })), tab === 'findings' && (_jsx(FindingsTab, { vulns: vulns, onUpdated: (next) => setVulns((prev) => prev.map((v) => (v.id === next.id ? next : v))) })), tab === 'scans' && _jsx(ScansTab, { scans: scans, vulns: vulns, project: project }), tab === 'reports' && _jsx(ReportsTab, { reports: reports, onView: setSelectedReport }), tab === 'activity' && _jsx(ActivityTab, { items: activity }), selectedReport && (_jsx(ReportViewer, { report: selectedReport, onClose: () => setSelectedReport(null) }))] }));
}
function OverviewTab({ scans, vulns, totals, projectName, onGoToTopology, }) {
    const lastScan = scans[0];
    const topFindings = [...vulns]
        .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
        .slice(0, 5);
    const soc2Score = useMemo(() => {
        const penalty = (totals.critical ?? 0) * 15 + (totals.high ?? 0) * 8 + (totals.medium ?? 0) * 3;
        return Math.max(0, 100 - penalty);
    }, [totals]);
    return (_jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6", children: [_jsxs("h3", { className: "font-semibold mb-4 flex items-center gap-2", children: [_jsx(ShieldCheck, { className: "w-4 h-4 text-emerald-400" }), " Posture"] }), vulns.length === 0 ? (_jsxs("div", { className: "py-8 text-center", children: [_jsx(CheckCircle2, { className: "w-8 h-8 text-emerald-500 mx-auto mb-2" }), _jsx("div", { className: "text-sm text-slate-300", children: "No findings on record. Launch a scan to assess posture." })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-6 gap-2 mb-6", children: [_jsxs("div", { className: "rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3 text-center", children: [_jsx("div", { className: "text-[10px] text-emerald-500 uppercase font-bold tracking-tight", children: "SOC2 Readiness" }), _jsxs("div", { className: "text-lg font-bold mt-0.5 text-white", children: [soc2Score, "%"] })] }), ['critical', 'high', 'medium', 'low', 'info'].map((sev) => (_jsxs("div", { className: "rounded-md bg-slate-900/70 border border-slate-800 p-3 text-center", children: [_jsx("div", { className: "text-xs text-slate-500 capitalize", children: sev }), _jsx("div", { className: "text-lg font-bold mt-0.5 text-white", children: totals[sev] ?? 0 })] }, sev)))] }), _jsx("div", { className: "text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2", children: "Top priority findings" }), _jsx("div", { className: "space-y-2", children: topFindings.map((v) => (_jsxs("div", { className: "flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm text-white truncate", children: v.title }), _jsx("div", { className: "text-xs text-slate-500 font-mono truncate", children: v.asset })] }), _jsx("span", { className: `text-[11px] px-2 py-0.5 rounded border capitalize shrink-0 ${severityClass(v.severity)}`, children: v.severity })] }, v.id))) })] }))] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col h-[320px]", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("h3", { className: "font-semibold flex items-center gap-2", children: [_jsx(Network, { className: "w-4 h-4 text-sky-400" }), " Topology preview"] }), _jsx("button", { onClick: onGoToTopology, className: "text-[10px] uppercase font-bold text-slate-500 hover:text-slate-300 transition", children: "View" })] }), _jsx("div", { className: "flex-1 overflow-hidden scale-75 origin-top", children: _jsx(AssetGraph, { projectName: projectName, vulns: vulns }) })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-6", children: [_jsx("h3", { className: "font-semibold mb-4", children: "Latest scan" }), lastScan ? (_jsxs("div", { className: "space-y-3 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Scanner" }), _jsx("span", { className: "text-white font-medium", children: lastScan.scanner })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Status" }), _jsx("span", { className: "text-emerald-400 capitalize", children: lastScan.status })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-slate-500", children: "Completed" }), _jsx("span", { className: "text-white", children: new Date(lastScan.created_at).toLocaleDateString() })] }), _jsxs("div", { className: "mt-4 pt-4 border-t border-slate-800", children: [_jsx("h4", { className: "text-[11px] font-semibold text-slate-500 uppercase mb-2", children: "Recommended" }), _jsx("div", { className: "flex flex-wrap gap-2", children: AVAILABLE_SCANNERS.slice(0, 2).map(s => (_jsx("span", { className: "px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-300", children: s.label }, s.id))) })] })] })) : (_jsx("div", { className: "text-sm text-slate-500 italic", children: "No scans performed yet." }))] })] })] }));
}
function ScansTab({ scans, vulns, project }) {
    const vulnsByScan = useMemo(() => {
        return vulns.reduce((acc, v) => {
            var _a;
            (acc[_a = v.scan_id] ?? (acc[_a] = [])).push(v);
            return acc;
        }, {});
    }, [vulns]);
    if (scans.length === 0) {
        return (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-16 text-center", children: [_jsx(Radar, { className: "w-8 h-8 text-slate-600 mx-auto mb-2" }), _jsx("div", { className: "text-sm text-slate-400", children: "No scans yet for this project." })] }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [scans.filter(s => s.status === 'completed').length >= 2 && (_jsx(ScanDiff, { scans: scans, vulns: vulns })), _jsx("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden", children: scans.map((s) => {
                    const scanVulns = vulnsByScan[s.id] ?? [];
                    return (_jsxs("div", { className: "px-6 py-4 flex items-center justify-between group hover:bg-slate-900/50 transition", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-9 h-9 rounded-md bg-slate-800 flex items-center justify-center", children: _jsx(Radar, { className: "w-4 h-4 text-emerald-400" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-medium text-white", children: s.scanner }), _jsxs("div", { className: "text-xs text-slate-500", children: [new Date(s.created_at).toLocaleString(), " \u00B7 ", scanVulns.length, " findings"] })] })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx("button", { onClick: () => downloadFile(`${project.name}_${s.id}.json`, toJsonExport(project, s, scanVulns), 'application/json'), "aria-label": "Download JSON export", title: "Download JSON export", className: "p-2 text-slate-500 hover:text-white transition", children: _jsx(Download, { className: "w-4 h-4" }) }) })] }, s.id));
                }) })] }));
}
function ReportsTab({ reports, onView }) {
    const kindMeta = {
        executive: { label: 'Executive', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
        technical: { label: 'Technical', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    };
    if (reports.length === 0) {
        return (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-16 text-center", children: [_jsx(FileText, { className: "w-8 h-8 text-slate-600 mx-auto mb-2" }), _jsx("div", { className: "text-sm font-medium text-slate-300", children: "No reports yet" }), _jsx("div", { className: "text-xs text-slate-500 mt-1", children: "Use the buttons above to generate an Executive or Technical report." })] }));
    }
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: reports.map((r) => {
            const meta = kindMeta[r.kind] ?? { label: r.kind, color: 'text-slate-400 bg-slate-800 border-slate-700' };
            const charCount = r.content.length;
            const lineCount = r.content.split('\n').length;
            return (_jsxs("button", { onClick: () => onView(r), className: "group text-left rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 hover:bg-slate-900/60 transition-all duration-200", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 mb-3", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/5 transition", children: _jsx(FileText, { className: "w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition" }) }), _jsx("span", { className: `text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${meta.color}`, children: meta.label })] }), _jsx("div", { className: "text-sm font-semibold text-white group-hover:text-emerald-400 transition leading-tight mb-1", children: r.title }), _jsx("div", { className: "text-xs text-slate-500 mb-3", children: new Date(r.created_at).toLocaleString() }), _jsxs("div", { className: "flex items-center gap-3 text-[10px] text-slate-600 font-mono border-t border-slate-800 pt-3", children: [_jsxs("span", { children: [charCount.toLocaleString(), " chars"] }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: [lineCount, " lines"] }), _jsx("span", { className: "ml-auto text-emerald-500 opacity-0 group-hover:opacity-100 transition font-sans font-medium", children: "Open \u2192" })] })] }, r.id));
        }) }));
}
function ActivityTab({ items }) {
    if (items.length === 0) {
        return (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-16 text-center", children: [_jsx(ActivityIcon, { className: "w-8 h-8 text-slate-600 mx-auto mb-2" }), _jsx("div", { className: "text-sm text-slate-400", children: "No recent activity." })] }));
    }
    return (_jsx("div", { className: "relative border-l border-slate-800 ml-3 pl-6 space-y-6", children: items.map((it, i) => (_jsxs("div", { className: "relative", children: [_jsx("span", { className: `absolute -left-[33px] top-1.5 w-3 h-3 rounded-full border-2 border-slate-950 ${it.kind === 'scan' ? 'bg-sky-500' : it.kind === 'report' ? 'bg-emerald-500' : 'bg-amber-500'}` }), _jsx("div", { className: "text-sm font-medium text-white", children: it.title }), it.detail && _jsx("div", { className: "text-xs text-slate-500 mt-0.5", children: it.detail }), _jsx("div", { className: "text-[10px] text-slate-600 mt-1 uppercase", children: new Date(it.at).toLocaleTimeString() })] }, i))) }));
}
function severityWeight(s) {
    return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[s] ?? 0;
}
function severityClass(s) {
    return {
        critical: 'text-red-400 border-red-500/30 bg-red-500/10',
        high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
        medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
        low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
        info: 'text-slate-400 border-slate-700 bg-slate-800/40',
    }[s] ?? 'text-slate-400 border-slate-700 bg-slate-800/40';
}
