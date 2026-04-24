import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, Filter, Pencil, Save, ShieldOff, Sparkles, Timer, X } from 'lucide-react';
import { supabase, VULN_STATUSES, DEFAULT_SLA_CONFIG } from '../lib/supabase';
import { downloadFile, toCsvExport } from '../lib/exporters';
import { recomputeRiskScoreFromScanId } from '../lib/riskScore';
import { useAuth } from '../context/useAuth';
function slaStateFor(v, sla, now) {
    if (v.status !== 'open' && v.status !== 'in_progress')
        return 'na';
    if (v.severity === 'info')
        return 'na';
    const budget = sla[v.severity] ?? 30;
    const ageDays = (now - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > budget)
        return 'overdue';
    if (ageDays / budget >= 0.75)
        return 'at_risk';
    return 'healthy';
}
const STATUS_META = {
    open: { label: 'Open', tone: 'text-red-300 border-red-500/30 bg-red-500/10', dot: 'bg-red-400' },
    in_progress: { label: 'In progress', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10', dot: 'bg-sky-400' },
    accepted: { label: 'Accepted risk', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10', dot: 'bg-amber-400' },
    resolved: { label: 'Resolved', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-400' },
    false_positive: { label: 'False positive', tone: 'text-slate-300 border-slate-700 bg-slate-800/60', dot: 'bg-slate-400' },
};
const SEVERITY_WEIGHT = {
    critical: 5, high: 4, medium: 3, low: 2, info: 1,
};
function severityClass(s) {
    return {
        critical: 'text-red-400 border-red-500/30 bg-red-500/10',
        high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
        medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
        low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
        info: 'text-slate-400 border-slate-700 bg-slate-800/40',
    }[s];
}
export default function FindingsTab({ vulns, onUpdated, }) {
    const { profile } = useAuth();
    const [statusFilter, setStatusFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [slaFilter, setSlaFilter] = useState('all');
    const [expanded, setExpanded] = useState(null);
    const slaConfig = useMemo(() => ({ ...DEFAULT_SLA_CONFIG, ...(profile?.sla_config ?? {}) }), [profile?.sla_config]);
    const now = Date.now();
    const counts = useMemo(() => {
        const c = { all: vulns.length };
        for (const s of VULN_STATUSES)
            c[s] = 0;
        for (const v of vulns)
            c[v.status] = (c[v.status] ?? 0) + 1;
        return c;
    }, [vulns]);
    const slaCounts = useMemo(() => {
        let overdue = 0;
        let atRisk = 0;
        for (const v of vulns) {
            const s = slaStateFor(v, slaConfig, now);
            if (s === 'overdue')
                overdue++;
            else if (s === 'at_risk')
                atRisk++;
        }
        return { overdue, atRisk };
    }, [vulns, slaConfig, now]);
    const filtered = useMemo(() => {
        return [...vulns]
            .filter((v) => (statusFilter === 'all' ? true : v.status === statusFilter))
            .filter((v) => (severityFilter === 'all' ? true : v.severity === severityFilter))
            .filter((v) => {
            if (slaFilter === 'all')
                return true;
            const s = slaStateFor(v, slaConfig, now);
            return slaFilter === 'overdue' ? s === 'overdue' : s === 'at_risk';
        })
            .sort((a, b) => {
            if (a.status !== b.status) {
                const aOpen = a.status === 'open' || a.status === 'in_progress' ? 0 : 1;
                const bOpen = b.status === 'open' || b.status === 'in_progress' ? 0 : 1;
                if (aOpen !== bOpen)
                    return aOpen - bOpen;
            }
            return SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
        });
    }, [vulns, statusFilter, severityFilter, slaFilter, slaConfig, now]);
    if (vulns.length === 0) {
        return (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-16 text-center", children: [_jsx(CheckCircle2, { className: "w-8 h-8 text-emerald-500 mx-auto mb-2" }), _jsx("div", { className: "text-sm text-slate-400", children: "No findings to triage. Run a scan to populate this view." })] }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("div", { className: "inline-flex items-center gap-1.5 text-xs text-slate-500 pr-2", children: [_jsx(Filter, { className: "w-3.5 h-3.5" }), " Status"] }), _jsxs(FilterPill, { active: statusFilter === 'all', onClick: () => setStatusFilter('all'), children: ["All ", _jsxs("span", { className: "ml-1 text-slate-500", children: ["(", counts.all, ")"] })] }), VULN_STATUSES.map((s) => (_jsxs(FilterPill, { active: statusFilter === s, onClick: () => setStatusFilter(s), children: [_jsx("span", { className: `inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_META[s].dot}` }), STATUS_META[s].label, _jsxs("span", { className: "ml-1 text-slate-500", children: ["(", counts[s] ?? 0, ")"] })] }, s))), _jsx("div", { className: "w-px h-5 bg-slate-800 mx-2" }), _jsxs("div", { className: "inline-flex items-center gap-1.5 text-xs text-slate-500 pr-2", children: [_jsx(AlertTriangle, { className: "w-3.5 h-3.5" }), " Severity"] }), ['all', 'critical', 'high', 'medium', 'low', 'info'].map((s) => (_jsx(FilterPill, { active: severityFilter === s, onClick: () => setSeverityFilter(s), children: _jsx("span", { className: "capitalize", children: s }) }, s))), _jsx("div", { className: "w-px h-5 bg-slate-800 mx-2" }), _jsxs("div", { className: "inline-flex items-center gap-1.5 text-xs text-slate-500 pr-2", children: [_jsx(Timer, { className: "w-3.5 h-3.5" }), " SLA"] }), _jsx(FilterPill, { active: slaFilter === 'all', onClick: () => setSlaFilter('all'), children: "Any" }), _jsxs(FilterPill, { active: slaFilter === 'overdue', onClick: () => setSlaFilter('overdue'), children: [_jsx("span", { className: "inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-red-400" }), "Overdue ", _jsxs("span", { className: "ml-1 text-slate-500", children: ["(", slaCounts.overdue, ")"] })] }), _jsxs(FilterPill, { active: slaFilter === 'at_risk', onClick: () => setSlaFilter('at_risk'), children: [_jsx("span", { className: "inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-amber-400" }), "At risk ", _jsxs("span", { className: "ml-1 text-slate-500", children: ["(", slaCounts.atRisk, ")"] })] }), _jsx("div", { className: "ml-auto", children: _jsxs("button", { onClick: () => downloadFile(`findings_${statusFilter}_${severityFilter}_sla-${slaFilter}.csv`, toCsvExport(filtered), 'text/csv'), disabled: filtered.length === 0, className: "inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 disabled:opacity-50 px-2.5 py-1.5 rounded-md transition text-slate-300", title: "Export filtered findings as CSV", children: [_jsx(Download, { className: "w-3.5 h-3.5" }), " Export CSV (", filtered.length, ")"] }) })] }), _jsx("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden", children: filtered.length === 0 ? (_jsxs("div", { className: "p-10 text-center", children: [_jsx(ShieldOff, { className: "w-7 h-7 text-slate-600 mx-auto mb-2" }), _jsx("div", { className: "text-sm text-slate-400", children: "No findings match the current filters." })] })) : (filtered.map((v) => (_jsx(FindingRow, { vuln: v, slaState: slaStateFor(v, slaConfig, now), expanded: expanded === v.id, onToggle: () => setExpanded(expanded === v.id ? null : v.id), onUpdated: onUpdated }, v.id)))) })] }));
}
function FilterPill({ active, onClick, children, }) {
    return (_jsx("button", { onClick: onClick, className: `inline-flex items-center text-xs px-2.5 py-1 rounded-md border transition ${active
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
            : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`, children: children }));
}
function FindingRow({ vuln, slaState, expanded, onToggle, onUpdated, }) {
    const [editing, setEditing] = useState(false);
    const [noteDraft, setNoteDraft] = useState(vuln.note);
    const [saving, setSaving] = useState(false);
    const changeStatus = async (status) => {
        setSaving(true);
        const { data } = await supabase
            .from('vulnerabilities')
            .update({ status, status_updated_at: new Date().toISOString() })
            .eq('id', vuln.id)
            .select()
            .maybeSingle();
        if (data) {
            onUpdated(data);
            recomputeRiskScoreFromScanId(vuln.scan_id).catch(() => { });
        }
        setSaving(false);
    };
    const saveNote = async () => {
        setSaving(true);
        const { data } = await supabase
            .from('vulnerabilities')
            .update({ note: noteDraft, status_updated_at: new Date().toISOString() })
            .eq('id', vuln.id)
            .select()
            .maybeSingle();
        if (data)
            onUpdated(data);
        setSaving(false);
        setEditing(false);
    };
    const cancelEdit = () => {
        setNoteDraft(vuln.note);
        setEditing(false);
    };
    const statusMeta = STATUS_META[vuln.status];
    return (_jsxs("div", { className: "px-5 py-3", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("button", { onClick: onToggle, className: "mt-1 text-slate-500 hover:text-white transition shrink-0", "aria-label": "Toggle details", children: expanded ? _jsx(ChevronDown, { className: "w-4 h-4" }) : _jsx(ChevronRight, { className: "w-4 h-4" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: `text-[11px] px-2 py-0.5 rounded border capitalize shrink-0 ${severityClass(vuln.severity)}`, children: vuln.severity }), _jsxs("span", { className: `inline-flex items-center text-[11px] px-2 py-0.5 rounded border ${statusMeta.tone}`, children: [_jsx("span", { className: `inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${statusMeta.dot}` }), statusMeta.label] }), slaState === 'overdue' && (_jsxs("span", { className: "inline-flex items-center text-[11px] px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-300", children: [_jsx(Timer, { className: "w-3 h-3 mr-1" }), " SLA overdue"] })), slaState === 'at_risk' && (_jsxs("span", { className: "inline-flex items-center text-[11px] px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300", children: [_jsx(Timer, { className: "w-3 h-3 mr-1" }), " SLA at risk"] })), _jsx("div", { className: "text-sm font-medium text-white truncate", children: vuln.title })] }), _jsx("div", { className: "mt-1 text-xs text-slate-500 font-mono truncate", children: vuln.asset })] }), _jsx("select", { value: vuln.status, disabled: saving, onChange: (e) => changeStatus(e.target.value), className: "shrink-0 bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60", children: VULN_STATUSES.map((s) => (_jsx("option", { value: s, children: STATUS_META[s].label }, s))) })] }), expanded && (_jsxs("div", { className: "mt-3 ml-7 space-y-3", children: [vuln.description && (_jsxs("div", { children: [_jsx("div", { className: "text-[11px] text-slate-500 uppercase tracking-wider mb-1", children: "Description" }), _jsx("p", { className: "text-sm text-slate-300 leading-relaxed", children: vuln.description })] })), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 text-xs", children: [vuln.cve_id && (_jsx(MetaCell, { label: "CVE", value: vuln.cve_id })), vuln.mitre_tactic && (_jsx(MetaCell, { label: "MITRE", value: vuln.mitre_tactic })), vuln.cis_control && (_jsx(MetaCell, { label: "CIS Control", value: vuln.cis_control }))] }), vuln.remediation && (_jsxs("div", { children: [_jsxs("div", { className: "text-[11px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1", children: [_jsx(Sparkles, { className: "w-3 h-3 text-emerald-400" }), " Remediation"] }), _jsx("p", { className: "text-sm text-slate-300 leading-relaxed", children: vuln.remediation })] })), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("div", { className: "text-[11px] text-slate-500 uppercase tracking-wider", children: "Analyst note" }), !editing && (_jsxs("button", { onClick: () => setEditing(true), className: "inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition", children: [_jsx(Pencil, { className: "w-3 h-3" }), " ", vuln.note ? 'Edit' : 'Add'] }))] }), editing ? (_jsxs("div", { className: "space-y-2", children: [_jsx("textarea", { value: noteDraft, onChange: (e) => setNoteDraft(e.target.value), rows: 3, placeholder: "Add context, owner, ticket ID, mitigation details...", className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none resize-none" }), _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsxs("button", { onClick: cancelEdit, className: "inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 transition", children: [_jsx(X, { className: "w-3.5 h-3.5" }), " Cancel"] }), _jsxs("button", { onClick: saveNote, disabled: saving, className: "inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-2.5 py-1.5 rounded-md text-xs transition", children: [_jsx(Save, { className: "w-3.5 h-3.5" }), " ", saving ? 'Saving...' : 'Save note'] })] })] })) : vuln.note ? (_jsx("p", { className: "text-sm text-slate-300 whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2", children: vuln.note })) : (_jsx("p", { className: "text-xs text-slate-600 italic", children: "No note yet." }))] }), _jsxs("div", { className: "text-[11px] text-slate-600", children: ["Last updated ", new Date(vuln.status_updated_at).toLocaleString()] })] }))] }));
}
function MetaCell({ label, value }) {
    return (_jsxs("div", { className: "rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2", children: [_jsx("div", { className: "text-[10px] text-slate-500 uppercase tracking-wider", children: label }), _jsx("div", { className: "text-xs text-slate-200 font-mono mt-0.5 truncate", children: value })] }));
}
