import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Activity, ArrowRight, Clock, Timer, Radar, TrendingDown, TrendingUp, Minus, } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, DEFAULT_SLA_CONFIG } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import Sparkline from '../components/Sparkline';
export default function Dashboard() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [scans, setScans] = useState([]);
    const [projects, setProjects] = useState([]);
    const [vulns, setVulns] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (!user)
            return;
        const fetchAll = async () => {
            const [scansRes, projectsRes, vulnsRes] = await Promise.all([
                supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${user.id}` }, () => fetchAll())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vulnerabilities', filter: `user_id=eq.${user.id}` }, () => fetchAll())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user]);
    // ── Derived data ─────────────────────────────────────────────────────────
    const openVulns = vulns.filter(v => v.status === 'open' || v.status === 'in_progress');
    const resolvedVulns = vulns.filter(v => v.status === 'resolved');
    const trend30 = useMemo(() => buildTrend(vulns, 30), [vulns]);
    const trend14 = useMemo(() => buildTrend(vulns, 14), [vulns]);
    const maxTrend = Math.max(1, ...trend14.map(d => Math.max(d.opened, d.closed)));
    // Sparklines for KPI cards (30-day daily counts per severity)
    const severitySparklines = useMemo(() => buildSeveritySparklines(vulns, 30), [vulns]);
    // Week-over-week delta
    const thisWeek = trend30.slice(-7).reduce((s, d) => s + d.opened, 0);
    const lastWeek = trend30.slice(-14, -7).reduce((s, d) => s + d.opened, 0);
    const wowDelta = thisWeek - lastWeek;
    // Resolution rate
    const resRate = vulns.length === 0 ? 0 : Math.round((resolvedVulns.length / vulns.length) * 100);
    // SLA
    const SLA_DAYS = { ...DEFAULT_SLA_CONFIG, ...(profile?.sla_config ?? {}) };
    const now = Date.now();
    const slaRows = openVulns
        .filter(v => v.severity === 'critical' || v.severity === 'high' || v.severity === 'medium')
        .map(v => {
        const ageDays = (now - new Date(v.created_at).getTime()) / 86400000;
        const budget = SLA_DAYS[v.severity] ?? 30;
        return { v, ageDays, budget, overdue: ageDays > budget, remaining: budget - ageDays };
    })
        .sort((a, b) => b.ageDays - a.ageDays);
    const overdueCount = slaRows.filter(r => r.overdue).length;
    const overdueRows = slaRows.filter(r => r.overdue);
    const atRiskRows = slaRows.filter(r => !r.overdue && r.ageDays / r.budget >= 0.75);
    const healthyRows = slaRows.filter(r => !r.overdue && r.ageDays / r.budget < 0.75);
    // BUG-06: SLA breach notifications — debounced to prevent duplicate writes
    // when WebSocket change + poll fire simultaneously, or multiple tabs are open.
    useEffect(() => {
        if (!user || vulns.length === 0)
            return;
        const newlyBreached = slaRows.filter(r => r.overdue && !r.v.sla_breached_at).slice(0, 10);
        const atRisk = slaRows.filter(r => !r.overdue && !r.v.sla_warned_at && r.ageDays / r.budget >= 0.75).slice(0, 10);
        if (newlyBreached.length === 0 && atRisk.length === 0)
            return;
        // Debounce: wait 1.5s before writing, so rapid re-renders collapse into one write
        const timer = setTimeout(async () => {
            const stamp = new Date().toISOString();
            for (const { v, budget, ageDays } of newlyBreached) {
                // Conditional update: only succeeds if sla_breached_at is still null (row-level dedup)
                const { error } = await supabase
                    .from('vulnerabilities').update({ sla_breached_at: stamp })
                    .eq('id', v.id).is('sla_breached_at', null);
                if (error)
                    continue;
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
                if (error)
                    continue;
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
    }, [user, vulns]);
    const completedScans = scans.filter(s => s.status === 'completed').length;
    const activeScans = scans.filter(s => s.status === 'running' || s.status === 'queued').length;
    return (_jsxs("div", { className: "p-8 max-w-7xl space-y-8", children: [_jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-sm text-slate-500", children: ["Welcome back", profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''] }), _jsx("h1", { className: "mt-1 text-3xl font-bold tracking-tight", children: "Security posture" })] }), _jsxs("button", { onClick: () => navigate('/chat'), className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: ["Launch AI audit ", _jsx(ArrowRight, { className: "w-4 h-4" })] })] }), _jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-5 gap-4", children: [_jsx(SparkKpi, { label: "Projects", value: projects.length, icon: Shield, accent: "emerald", sparkData: severitySparklines.projects, sparkColor: "#10b981", subLabel: `${completedScans} scans` }), _jsx(SparkKpi, { label: "Open findings", value: openVulns.length, icon: AlertTriangle, accent: "red", sparkData: severitySparklines.critical, sparkColor: "#ef4444", subLabel: wowDelta === 0 ? 'vs last week' : `${wowDelta > 0 ? '+' : ''}${wowDelta} vs last week`, trend: wowDelta }), _jsx(SparkKpi, { label: "Critical", value: openVulns.filter(v => v.severity === 'critical').length, icon: AlertTriangle, accent: "red", sparkData: severitySparklines.critical, sparkColor: "#ef4444" }), _jsx(SparkKpi, { label: "Resolved", value: resolvedVulns.length, icon: CheckCircle2, accent: "emerald", sparkData: severitySparklines.resolved, sparkColor: "#10b981", subLabel: `${resRate}% resolution rate` }), _jsx(SparkKpi, { label: "Active scans", value: activeScans, icon: Activity, accent: "sky", sparkData: severitySparklines.scans, sparkColor: "#38bdf8", subLabel: `${completedScans} completed` })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6", children: [_jsxs("div", { className: "flex items-start justify-between mb-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold", children: "Remediation trend" }), _jsx("p", { className: "text-xs text-slate-500 mt-0.5", children: "Opened vs. closed findings \u2014 last 14 days" })] }), _jsxs("div", { className: "flex items-center gap-4 text-xs", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 text-slate-400", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-red-500" }), " Opened"] }), _jsxs("span", { className: "inline-flex items-center gap-1.5 text-slate-400", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500" }), " Closed"] })] })] }), _jsx(AreaTrendChart, { trend: trend14, max: maxTrend }), _jsx("div", { className: "flex justify-between mt-2 px-1", children: trend14.filter((_, i) => i % 3 === 0 || i === trend14.length - 1).map(d => (_jsx("span", { className: "text-[10px] text-slate-600", children: d.label }, d.day))) }), _jsxs("div", { className: "grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800", children: [_jsx(SummaryPill, { label: "Opened (14d)", value: trend14.reduce((s, d) => s + d.opened, 0), color: "text-red-400" }), _jsx(SummaryPill, { label: "Closed (14d)", value: trend14.reduce((s, d) => s + d.closed, 0), color: "text-emerald-400" }), _jsx(SummaryPill, { label: "Net delta", value: trend14.reduce((s, d) => s + d.opened - d.closed, 0), color: trend14.reduce((s, d) => s + d.opened - d.closed, 0) > 0 ? 'text-red-400' : 'text-emerald-400', signed: true })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsx("h2", { className: "font-semibold", children: "Project risk" }), _jsx(Radar, { className: "w-4 h-4 text-emerald-400" })] }), projects.length === 0 ? (_jsx("div", { className: "flex-1 flex items-center justify-center text-slate-500 text-sm", children: "No projects" })) : (_jsx("div", { className: "flex-1 space-y-4 overflow-auto scrollbar-thin", children: [...projects].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).map(p => {
                                    const score = p.risk_score || 0;
                                    const barColor = score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-orange-500' : score >= 15 ? 'bg-amber-400' : 'bg-emerald-500';
                                    const textColor = score >= 70 ? 'text-red-400' : score >= 40 ? 'text-orange-400' : score >= 15 ? 'text-amber-400' : 'text-emerald-400';
                                    return (_jsxs("div", { className: "group", children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsx("span", { className: "text-sm text-slate-300 truncate pr-2 group-hover:text-white transition", title: p.name, children: p.name }), _jsx("span", { className: `text-[10px] font-bold tabular-nums ${textColor}`, children: score })] }), _jsx("div", { className: "h-1.5 rounded-full bg-slate-800 overflow-hidden", children: _jsx("div", { className: `h-full ${barColor} transition-all duration-700 rounded-full`, style: { width: `${score}%` } }) })] }, p.id));
                                }) })), _jsxs("button", { onClick: () => navigate('/projects'), className: "mt-5 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition", children: ["Manage projects ", _jsx(ArrowRight, { className: "w-3 h-3" })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "font-semibold", children: "SLA watch" }), _jsx("div", { className: "flex items-center gap-1.5", children: overdueCount > 0 && (_jsxs("span", { className: "text-xs px-2 py-0.5 rounded-md border bg-red-500/10 border-red-500/30 text-red-300", children: [overdueCount, " overdue"] })) })] }), slaRows.length === 0 ? (_jsxs("div", { className: "py-8 text-center text-slate-500 text-sm", children: [_jsx(Timer, { className: "w-6 h-6 mx-auto mb-2 text-slate-700" }), "All SLAs on track"] })) : (_jsxs("div", { className: "space-y-3 max-h-64 overflow-auto pr-1 scrollbar-thin", children: [overdueRows.length > 0 && _jsx(SlaGroup, { label: "Overdue", tone: "red", rows: overdueRows.slice(0, 3) }), atRiskRows.length > 0 && _jsx(SlaGroup, { label: "At risk", tone: "amber", rows: atRiskRows.slice(0, 3) }), healthyRows.length > 0 && overdueRows.length === 0 && _jsx(SlaGroup, { label: "Healthy", tone: "slate", rows: healthyRows.slice(0, 3) })] }))] }), _jsxs("div", { className: "lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-5", children: [_jsx("h2", { className: "font-semibold", children: "Recent scans" }), _jsx("button", { onClick: () => navigate('/scans'), className: "text-xs text-emerald-400 hover:text-emerald-300 transition", children: "View all" })] }), loading ? (_jsx("div", { className: "py-10 text-center text-slate-500 text-sm", children: "Loading..." })) : scans.length === 0 ? (_jsxs("div", { className: "py-10 text-center", children: [_jsx(Radar, { className: "w-8 h-8 text-slate-700 mx-auto mb-2" }), _jsx("div", { className: "text-sm text-slate-500", children: "No scans yet" })] })) : (_jsx("div", { className: "divide-y divide-slate-800/50", children: scans.slice(0, 6).map(s => (_jsxs("div", { className: "py-3 flex items-center justify-between group", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: `w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${s.status === 'completed' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' :
                                                        s.status === 'failed' ? 'text-red-400 border-red-500/20 bg-red-500/5' :
                                                            'text-sky-400 border-sky-500/20 bg-sky-500/5 animate-pulse'}`, children: _jsx(Activity, { className: "w-4 h-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "text-sm font-medium text-white group-hover:text-emerald-400 transition truncate", children: [s.scanner, " scan"] }), _jsxs("div", { className: "text-xs text-slate-500 mt-0.5 font-mono", children: [s.project_id.slice(0, 8).toUpperCase(), " \u00B7 ", new Date(s.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })] })] })] }), _jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [_jsxs("div", { className: "hidden sm:flex items-center gap-2 text-[10px] font-mono", children: [(s.severity_summary?.critical ?? 0) > 0 && _jsxs("span", { className: "text-red-400", children: [s.severity_summary.critical, "C"] }), (s.severity_summary?.high ?? 0) > 0 && _jsxs("span", { className: "text-orange-400", children: [s.severity_summary.high, "H"] }), (s.severity_summary?.medium ?? 0) > 0 && _jsxs("span", { className: "text-yellow-400", children: [s.severity_summary.medium, "M"] })] }), _jsx(StatusBadge, { status: s.status })] })] }, s.id))) }))] })] })] }));
}
/* ── Sub-components ─────────────────────────────────────────────────────────── */
function SparkKpi({ label, value, icon: Icon, accent, sparkData, sparkColor, subLabel, trend, }) {
    const iconColors = {
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
    }[accent];
    const TrendIcon = trend === undefined || trend === 0 ? Minus : trend > 0 ? TrendingUp : TrendingDown;
    const trendColor = trend === undefined || trend === 0 ? 'text-slate-500' : trend > 0 ? 'text-red-400' : 'text-emerald-400';
    return (_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-4 hover:border-slate-700 transition flex flex-col gap-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs text-slate-400", children: label }), _jsx("div", { className: `w-7 h-7 rounded-md border flex items-center justify-center ${iconColors}`, children: _jsx(Icon, { className: "w-3.5 h-3.5" }) })] }), _jsx("div", { className: "text-3xl font-bold tracking-tight tabular-nums", children: value }), _jsxs("div", { className: "flex items-end justify-between gap-2", children: [_jsx("div", { className: "flex-1 min-w-0", children: subLabel && (_jsxs("div", { className: `flex items-center gap-1 text-[10px] ${trendColor}`, children: [trend !== undefined && _jsx(TrendIcon, { className: "w-3 h-3" }), _jsx("span", { className: "text-slate-500 truncate", children: subLabel })] })) }), _jsx(Sparkline, { data: sparkData.length ? sparkData : [0, 0], color: sparkColor, width: 80, height: 28 })] })] }));
}
function AreaTrendChart({ trend, max }) {
    if (!trend.length)
        return null;
    const W = 600, H = 140, pad = 8;
    const w = W - pad * 2, h = H - pad * 2;
    const px = (i) => pad + (i / (trend.length - 1)) * w;
    const py = (v) => pad + h - (v / max) * h;
    const line = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ');
    const area = (arr) => `${line(arr)} L ${px(arr.length - 1)} ${H} L ${px(0)} ${H} Z`;
    const opened = trend.map(d => d.opened);
    const closed = trend.map(d => d.closed);
    return (_jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full", preserveAspectRatio: "none", style: { height: 140 }, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "grad-opened", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#ef4444", stopOpacity: "0.25" }), _jsx("stop", { offset: "100%", stopColor: "#ef4444", stopOpacity: "0" })] }), _jsxs("linearGradient", { id: "grad-closed", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0%", stopColor: "#10b981", stopOpacity: "0.25" }), _jsx("stop", { offset: "100%", stopColor: "#10b981", stopOpacity: "0" })] })] }), [0.25, 0.5, 0.75, 1].map(f => (_jsx("line", { x1: pad, x2: W - pad, y1: pad + h * (1 - f), y2: pad + h * (1 - f), stroke: "#1e293b", strokeWidth: "1", strokeDasharray: "4 4" }, f))), _jsx("path", { d: area(opened), fill: "url(#grad-opened)" }), _jsx("path", { d: area(closed), fill: "url(#grad-closed)" }), _jsx("path", { d: line(opened), fill: "none", stroke: "#ef4444", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: line(closed), fill: "none", stroke: "#10b981", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
function SummaryPill({ label, value, color, signed }) {
    return (_jsxs("div", { children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: label }), _jsxs("div", { className: `text-xl font-bold tabular-nums ${color}`, children: [signed && value > 0 ? '+' : '', value] })] }));
}
/* ── Data helpers ────────────────────────────────────────────────────────────── */
function buildTrend(vulns, days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        buckets.push({ day: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), opened: 0, closed: 0 });
    }
    const idx = (iso) => buckets.findIndex(b => b.day === iso.slice(0, 10));
    for (const v of vulns) {
        const oi = idx(v.created_at);
        if (oi >= 0)
            buckets[oi].opened++;
        if ((v.status === 'resolved' || v.status === 'false_positive') && v.status_updated_at) {
            const ci = idx(v.status_updated_at);
            if (ci >= 0)
                buckets[ci].closed++;
        }
    }
    return buckets;
}
function buildSeveritySparklines(vulns, days) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const critical = Array(days).fill(0);
    const resolved = Array(days).fill(0);
    const projects = Array(days).fill(0).map((_, i) => i + 1); // monotonic
    const scansArr = Array(days).fill(0);
    for (const v of vulns) {
        const ageDays = Math.floor((today.getTime() - new Date(v.created_at).setHours(0, 0, 0, 0)) / 86400000);
        const dayIdx = days - 1 - ageDays;
        if (dayIdx >= 0 && dayIdx < days) {
            if (v.severity === 'critical')
                critical[dayIdx]++;
            if (v.status === 'resolved')
                resolved[dayIdx]++;
        }
    }
    return { critical, resolved, projects, scans: scansArr };
}
/* ── Shared sub-components ───────────────────────────────────────────────────── */
function SlaGroup({ label, tone, rows }) {
    const toneCls = {
        red: 'text-red-300 bg-red-500/5 border-red-500/20',
        amber: 'text-amber-300 bg-amber-500/5 border-amber-500/20',
        slate: 'text-slate-300 bg-slate-800/30 border-slate-700',
    }[tone];
    return (_jsxs("div", { className: `rounded-md border ${toneCls} p-2.5`, children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] uppercase tracking-wider font-medium mb-2 opacity-80", children: [_jsx("span", { children: label }), _jsx("span", { children: rows.length })] }), _jsx("div", { className: "space-y-2", children: rows.map(({ v, ageDays, budget, overdue, remaining }) => (_jsxs("div", { className: "text-xs", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "truncate text-slate-100", title: v.title, children: v.title }), _jsx("span", { className: `shrink-0 font-mono ${overdue ? 'text-red-400' : tone === 'amber' ? 'text-amber-300' : 'text-slate-400'}`, children: overdue ? `+${Math.floor(ageDays - budget)}d` : `${Math.max(0, Math.ceil(remaining))}d left` })] }), _jsx("div", { className: "mt-1 h-1 rounded-full bg-slate-800 overflow-hidden", children: _jsx("div", { className: `h-full ${overdue ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}`, style: { width: `${Math.min(100, (ageDays / budget) * 100)}%` } }) }), _jsxs("div", { className: "flex items-center gap-1.5 mt-1 text-[10px] text-slate-500", children: [_jsx(Clock, { className: "w-3 h-3" }), _jsx("span", { className: "uppercase", children: v.severity }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: ["SLA ", budget, "d"] })] })] }, v.id))) })] }));
}
function StatusBadge({ status }) {
    const map = {
        queued: 'bg-slate-700/50 text-slate-300',
        running: 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
        completed: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
        failed: 'bg-red-500/10 text-red-300 border border-red-500/20',
    };
    return (_jsx("span", { className: `inline-flex items-center text-xs px-2 py-1 rounded-md ${map[status] ?? map.queued}`, children: status }));
}
