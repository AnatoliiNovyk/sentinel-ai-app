import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Activity, TrendingUp, Zap, BookOpen, AlertCircle, Download, FileText, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { computeCompliance } from '../lib/compliance';
import { buildEvidencePackage, buildEvidenceMarkdown, printReportAsPDF } from '../lib/evidencePackage';
import { downloadFile } from '../lib/exporters';
export default function Compliance() {
    const { user, profile } = useAuth();
    const [vulns, setVulns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    useEffect(() => {
        if (!user)
            return;
        (async () => {
            const { data } = await supabase
                .from('vulnerabilities')
                .select('*')
                .eq('user_id', user.id);
            setVulns((data ?? []));
            setLoading(false);
        })();
    }, [user]);
    const result = useMemo(() => computeCompliance(vulns), [vulns]);
    if (loading) {
        return (_jsx("div", { className: "p-8 flex items-center justify-center min-h-64", children: _jsxs("div", { className: "flex items-center gap-3 text-slate-500", children: [_jsx(ShieldCheck, { className: "w-5 h-5 animate-pulse text-emerald-400" }), "Computing compliance posture..."] }) }));
    }
    const soc2Color = result.soc2Overall >= 80 ? 'text-emerald-400' :
        result.soc2Overall >= 60 ? 'text-yellow-400' :
            result.soc2Overall >= 40 ? 'text-orange-400' : 'text-red-400';
    const soc2BgColor = result.soc2Overall >= 80 ? 'from-emerald-500/20 to-emerald-500/0' :
        result.soc2Overall >= 60 ? 'from-yellow-500/20 to-yellow-500/0' :
            result.soc2Overall >= 40 ? 'from-orange-500/20 to-orange-500/0' : 'from-red-500/20 to-red-500/0';
    const soc2Ring = result.soc2Overall >= 80 ? 'stroke-emerald-500' :
        result.soc2Overall >= 60 ? 'stroke-yellow-400' :
            result.soc2Overall >= 40 ? 'stroke-orange-400' : 'stroke-red-500';
    const circumference = 2 * Math.PI * 52;
    const dash = (result.soc2Overall / 100) * circumference;
    const exportEvidence = async (format) => {
        setExporting(true);
        try {
            const org = profile?.company || profile?.email || 'My Organization';
            const pkg = buildEvidencePackage(vulns, org);
            if (format === 'json') {
                downloadFile(`sentinel-evidence-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(pkg, null, 2), 'application/json');
            }
            else if (format === 'markdown') {
                const md = buildEvidenceMarkdown(pkg);
                downloadFile(`sentinel-evidence-${new Date().toISOString().split('T')[0]}.md`, md, 'text/markdown');
            }
            else {
                const md = buildEvidenceMarkdown(pkg);
                printReportAsPDF(`${org} — Compliance Evidence Report`, md);
            }
        }
        finally {
            setExporting(false);
        }
    };
    return (_jsxs("div", { className: "p-8 max-w-7xl space-y-8", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Compliance" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Automated mapping of your findings to SOC 2, CIS Controls v8, MITRE ATT&CK and NIST CSF." })] }), _jsx("div", { className: "flex items-center gap-2 shrink-0", children: _jsxs("div", { className: "relative group", children: [_jsxs("button", { disabled: exporting || vulns.length === 0, className: "inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 disabled:opacity-40 text-slate-300 px-3 py-2 rounded-md text-sm transition", children: [_jsx(Download, { className: "w-3.5 h-3.5" }), " Export evidence"] }), _jsxs("div", { className: "absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-10 hidden group-hover:block group-focus-within:block", children: [_jsxs("button", { onClick: () => exportEvidence('json'), className: "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition", children: [_jsx(FileText, { className: "w-3.5 h-3.5 text-sky-400" }), " JSON package"] }), _jsxs("button", { onClick: () => exportEvidence('markdown'), className: "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition", children: [_jsx(FileText, { className: "w-3.5 h-3.5 text-emerald-400" }), " Markdown report"] }), _jsxs("button", { onClick: () => exportEvidence('pdf'), className: "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 rounded-b-xl transition", children: [_jsx(Printer, { className: "w-3.5 h-3.5 text-violet-400" }), " Export PDF"] })] })] }) })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { className: `md:col-span-1 rounded-xl border border-slate-800 bg-gradient-to-b ${soc2BgColor} bg-slate-900/30 p-6 flex flex-col items-center justify-center gap-3`, children: [_jsxs("div", { className: "relative w-32 h-32", children: [_jsxs("svg", { viewBox: "0 0 120 120", className: "w-full h-full -rotate-90", children: [_jsx("circle", { cx: "60", cy: "60", r: "52", fill: "none", strokeWidth: "8", className: "stroke-slate-800" }), _jsx("circle", { cx: "60", cy: "60", r: "52", fill: "none", strokeWidth: "8", className: `${soc2Ring} transition-all duration-1000`, strokeDasharray: `${dash} ${circumference - dash}`, strokeLinecap: "round" })] }), _jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center", children: [_jsxs("span", { className: `text-3xl font-bold ${soc2Color}`, children: [result.soc2Overall, "%"] }), _jsx("span", { className: "text-[10px] text-slate-500 uppercase tracking-wider", children: "SOC 2" })] })] }), _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-sm font-semibold text-white", children: "SOC 2 Readiness" }), _jsx("div", { className: "text-xs text-slate-500 mt-0.5", children: result.soc2Overall >= 80 ? 'On track for audit' :
                                            result.soc2Overall >= 60 ? 'Needs improvement' : 'Action required' })] })] }), _jsx(StatCard, { label: "Open findings", value: result.openVulns, icon: AlertTriangle, accent: "red" }), _jsx(StatCard, { label: "Resolved", value: result.resolvedVulns, icon: CheckCircle2, accent: "emerald" }), _jsx(StatCard, { label: "Total assessed", value: result.totalVulns, icon: Activity, accent: "sky" })] }), _jsxs("section", { children: [_jsx(SectionHeader, { icon: BookOpen, title: "SOC 2 Trust Services Criteria", color: "text-sky-400" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4", children: result.soc2Rows.map(row => _jsx(Soc2Card, { row: row }, row.id)) })] }), _jsxs("section", { children: [_jsx(SectionHeader, { icon: ShieldCheck, title: "NIST Cybersecurity Framework (CSF)", color: "text-emerald-400" }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4", children: result.nistRows.map(row => _jsx(NistCard, { row: row }, row.id)) })] }), _jsxs("section", { children: [_jsx(SectionHeader, { icon: TrendingUp, title: "CIS Controls v8", color: "text-amber-400" }), _jsxs("div", { className: "mt-4 rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-[1fr_80px_80px_120px] px-4 py-2 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold", children: [_jsx("span", { children: "Control" }), _jsx("span", { className: "text-center", children: "Findings" }), _jsx("span", { className: "text-center", children: "Critical" }), _jsx("span", { className: "pr-2", children: "Score" })] }), _jsx("div", { className: "divide-y divide-slate-800/50", children: result.cisRows.map(row => _jsx(CisRowItem, { row: row }, row.id)) })] })] }), _jsxs("section", { children: [_jsx(SectionHeader, { icon: Zap, title: "MITRE ATT&CK Tactics", color: "text-red-400" }), _jsx("div", { className: "mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3", children: result.mitreRows.map(row => _jsx(MitreCard, { row: row }, row.id)) })] })] }));
}
/* ── Sub-components ──────────────────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title, color }) {
    return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Icon, { className: `w-4 h-4 ${color}` }), _jsx("h2", { className: "font-semibold text-white", children: title })] }));
}
function StatCard({ label, value, icon: Icon, accent, }) {
    const cls = {
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    }[accent];
    return (_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 transition", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-slate-400", children: label }), _jsx("div", { className: `w-8 h-8 rounded-md border flex items-center justify-center ${cls}`, children: _jsx(Icon, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "mt-3 text-3xl font-bold tracking-tight", children: value })] }));
}
function Soc2Card({ row }) {
    const color = row.score >= 80 ? { bar: 'bg-emerald-500', text: 'text-emerald-400' } :
        row.score >= 60 ? { bar: 'bg-yellow-400', text: 'text-yellow-400' } :
            row.score >= 40 ? { bar: 'bg-orange-400', text: 'text-orange-400' } :
                { bar: 'bg-red-500', text: 'text-red-400' };
    return (_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-4 hover:border-slate-700 transition", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-[10px] font-bold text-slate-500 uppercase tracking-wider", children: row.id }), _jsxs("span", { className: `text-sm font-bold ${color.text}`, children: [row.score, "%"] })] }), _jsx("div", { className: "text-xs text-white font-medium leading-snug mb-3", children: row.label }), _jsx("div", { className: "h-1.5 rounded-full bg-slate-800 overflow-hidden", children: _jsx("div", { className: `h-full ${color.bar} transition-all duration-700 rounded-full`, style: { width: `${row.score}%` } }) })] }));
}
function NistCard({ row }) {
    const scoreColor = row.score >= 80 ? 'text-emerald-400' :
        row.score >= 60 ? 'text-yellow-400' :
            row.score >= 40 ? 'text-orange-400' : 'text-red-400';
    const barColor = row.score >= 80 ? 'bg-emerald-500' :
        row.score >= 60 ? 'bg-yellow-400' :
            row.score >= 40 ? 'bg-orange-400' : 'bg-red-500';
    return (_jsxs("div", { className: `rounded-xl border ${row.bg} p-5 flex flex-col gap-3`, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: `text-xs font-bold uppercase tracking-widest ${row.color}`, children: row.id }), row.openCount > 0 && (_jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono", children: row.openCount }))] }), _jsx("div", { className: "text-sm font-semibold text-white", children: row.label }), _jsxs("div", { className: "mt-auto", children: [_jsxs("div", { className: "flex items-center justify-between text-[10px] text-slate-500 mb-1", children: [_jsx("span", { children: "Score" }), _jsxs("span", { className: `font-bold ${scoreColor}`, children: [row.score, "%"] })] }), _jsx("div", { className: "h-1.5 rounded-full bg-slate-900 overflow-hidden", children: _jsx("div", { className: `h-full ${barColor} transition-all duration-700 rounded-full`, style: { width: `${row.score}%` } }) })] })] }));
}
function CisRowItem({ row }) {
    const scoreColor = row.score >= 80 ? 'text-emerald-400' :
        row.score >= 60 ? 'text-yellow-400' :
            row.score >= 40 ? 'text-orange-400' : 'text-red-400';
    const barColor = row.score >= 80 ? 'bg-emerald-500' :
        row.score >= 60 ? 'bg-yellow-400' :
            row.score >= 40 ? 'bg-orange-500' : 'bg-red-500';
    const statusIcon = row.openCount === 0 ? _jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-500" }) :
        row.criticalCount > 0 ? _jsx(AlertCircle, { className: "w-3.5 h-3.5 text-red-400" }) :
            _jsx(AlertTriangle, { className: "w-3.5 h-3.5 text-yellow-400" });
    return (_jsxs("div", { className: "grid grid-cols-[1fr_80px_80px_120px] px-4 py-3 hover:bg-slate-900/50 transition items-center group", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [statusIcon, _jsxs("div", { className: "min-w-0", children: [_jsx("span", { className: "text-[10px] font-mono text-slate-500", children: row.id }), _jsx("div", { className: "text-sm text-slate-200 truncate", children: row.label })] })] }), _jsx("div", { className: "text-center text-sm font-mono text-slate-300", children: row.openCount }), _jsx("div", { className: "text-center text-sm font-mono", children: row.criticalCount > 0 ? (_jsx("span", { className: "text-red-400 font-bold", children: row.criticalCount })) : (_jsx("span", { className: "text-slate-600", children: "\u2014" })) }), _jsx("div", { className: "pr-2", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden", children: _jsx("div", { className: `h-full ${barColor} transition-all duration-700 rounded-full`, style: { width: `${row.score}%` } }) }), _jsxs("span", { className: `text-xs font-bold ${scoreColor} w-9 text-right`, children: [row.score, "%"] })] }) })] }));
}
function MitreCard({ row }) {
    const intensity = row.openCount === 0 ? 'opacity-20' :
        row.criticalCount > 0 ? 'opacity-100' :
            row.openCount >= 3 ? 'opacity-80' : 'opacity-50';
    const textColor = row.openCount === 0 ? 'text-slate-600' :
        row.criticalCount > 0 ? 'text-white' : 'text-slate-300';
    return (_jsxs("div", { className: `rounded-lg border border-slate-800 bg-slate-900/30 p-4 hover:border-slate-600 transition group`, children: [_jsx("div", { className: `w-2 h-2 rounded-full ${row.color} ${intensity} mb-3 transition-all duration-300` }), _jsx("div", { className: `text-xs font-semibold leading-snug ${textColor} mb-2`, children: row.label }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-[10px] text-slate-600 font-mono", children: row.id }), row.openCount > 0 ? (_jsx("span", { className: `text-[10px] font-bold px-1.5 py-0.5 rounded ${row.criticalCount > 0
                            ? 'text-red-300 bg-red-500/10 border border-red-500/20'
                            : 'text-orange-300 bg-orange-500/10 border border-orange-500/20'}`, children: row.openCount })) : (_jsx(CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-500/50" }))] })] }));
}
