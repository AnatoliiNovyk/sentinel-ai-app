import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Clock, Plus, Trash2, Power, PowerOff, Calendar, Loader2, ChevronDown, Radar, Check, } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { AVAILABLE_SCANNERS } from '../lib/scanMock';
const CADENCES = [
    { hours: 6, label: 'Every 6 h' },
    { hours: 12, label: 'Every 12 h' },
    { hours: 24, label: 'Daily' },
    { hours: 48, label: 'Every 2 days' },
    { hours: 168, label: 'Weekly' },
    { hours: 720, label: 'Monthly' },
];
function fmtDate(iso) {
    if (!iso)
        return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function nextRunColor(iso) {
    if (!iso)
        return 'text-slate-500';
    const diff = new Date(iso).getTime() - Date.now();
    if (diff < 0)
        return 'text-red-400';
    if (diff < 3600000)
        return 'text-amber-400';
    return 'text-slate-400';
}
export default function SchedulerPage() {
    const { user } = useAuth();
    const [schedules, setSchedules] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);
    // New schedule form state
    const [formProject, setFormProject] = useState('');
    const [formScanner, setFormScanner] = useState(AVAILABLE_SCANNERS[0].id);
    const [formCadence, setFormCadence] = useState(24);
    const load = async () => {
        if (!user)
            return;
        const [schRes, prjRes] = await Promise.all([
            supabase.from('scan_schedules').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('projects').select('*').eq('user_id', user.id).order('name'),
        ]);
        setSchedules((schRes.data ?? []));
        setProjects((prjRes.data ?? []));
        if ((prjRes.data ?? []).length && !formProject)
            setFormProject(prjRes.data[0].id);
        setLoading(false);
    };
    useEffect(() => { load(); }, [user]);
    const toggle = async (s) => {
        await supabase.from('scan_schedules').update({ enabled: !s.enabled }).eq('id', s.id);
        setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, enabled: !x.enabled } : x));
    };
    const remove = async (id) => {
        await supabase.from('scan_schedules').delete().eq('id', id);
        setSchedules(prev => prev.filter(x => x.id !== id));
    };
    const create = async () => {
        if (!user || !formProject || saving)
            return;
        setSaving(true);
        const next = new Date(Date.now() + formCadence * 3600 * 1000).toISOString();
        const { data } = await supabase
            .from('scan_schedules')
            .insert({
            user_id: user.id,
            project_id: formProject,
            scanner: formScanner,
            cadence_hours: formCadence,
            enabled: true,
            next_run_at: next,
        })
            .select()
            .maybeSingle();
        if (data)
            setSchedules(prev => [data, ...prev]);
        setShowForm(false);
        setSaving(false);
    };
    const projectName = (id) => projects.find(p => p.id === id)?.name ?? id.slice(0, 8);
    const scannerLabel = (id) => AVAILABLE_SCANNERS.find(s => s.id === id)?.label ?? id;
    const active = schedules.filter(s => s.enabled).length;
    const overdue = schedules.filter(s => s.enabled && s.next_run_at && new Date(s.next_run_at) < new Date()).length;
    return (_jsxs("div", { className: "p-8 max-w-5xl space-y-8", children: [_jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Scan Scheduler" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Automate recurring security scans across your projects." })] }), _jsxs("button", { onClick: () => setShowForm(v => !v), className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: [_jsx(Plus, { className: "w-4 h-4" }), "New schedule"] })] }), _jsxs("div", { className: "grid grid-cols-3 gap-4", children: [_jsx(Stat, { label: "Total schedules", value: schedules.length, icon: Calendar, color: "text-slate-400 bg-slate-800 border-slate-700" }), _jsx(Stat, { label: "Active", value: active, icon: Power, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" }), _jsx(Stat, { label: "Overdue", value: overdue, icon: Clock, color: overdue > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-slate-500 bg-slate-900 border-slate-800' })] }), showForm && (_jsxs("div", { className: "rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-5 animate-in slide-in-from-top-2 duration-200", children: [_jsx("h2", { className: "font-semibold text-emerald-300", children: "New scheduled scan" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs text-slate-400 mb-1.5", children: "Project" }), projects.length === 0 ? (_jsx("p", { className: "text-xs text-slate-500 italic", children: "No projects \u2014 create one first." })) : (_jsxs("div", { className: "relative", children: [_jsx("select", { value: formProject, onChange: e => setFormProject(e.target.value), className: "w-full appearance-none bg-slate-900 border border-slate-700 rounded-md pl-3 pr-8 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none", children: projects.map(p => _jsx("option", { value: p.id, children: p.name }, p.id)) }), _jsx(ChevronDown, { className: "absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" })] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-slate-400 mb-1.5", children: "Scanner" }), _jsxs("div", { className: "relative", children: [_jsx("select", { value: formScanner, onChange: e => setFormScanner(e.target.value), className: "w-full appearance-none bg-slate-900 border border-slate-700 rounded-md pl-3 pr-8 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none", children: AVAILABLE_SCANNERS.map(s => _jsx("option", { value: s.id, children: s.label }, s.id)) }), _jsx(ChevronDown, { className: "absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs text-slate-400 mb-1.5", children: "Frequency" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: CADENCES.map(c => (_jsx("button", { onClick: () => setFormCadence(c.hours), className: `px-2.5 py-1.5 text-xs rounded-md border transition ${formCadence === c.hours
                                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                                                : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'}`, children: c.label }, c.hours))) })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-3 pt-2", children: [_jsx("button", { onClick: () => setShowForm(false), className: "text-sm text-slate-500 hover:text-white transition px-3 py-2", children: "Cancel" }), _jsxs("button", { onClick: create, disabled: saving || !formProject, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: [saving ? _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : _jsx(Check, { className: "w-4 h-4" }), "Create schedule"] })] })] })), loading ? (_jsxs("div", { className: "flex items-center gap-3 text-slate-500 py-12 justify-center", children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin" }), " Loading schedules..."] })) : schedules.length === 0 ? (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-16 text-center", children: [_jsx(Radar, { className: "w-8 h-8 text-slate-700 mx-auto mb-3" }), _jsx("div", { className: "text-sm font-medium text-slate-300", children: "No schedules yet" }), _jsx("div", { className: "text-xs text-slate-600 mt-1", children: "Create your first scheduled scan above." })] })) : (_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden", children: [_jsxs("div", { className: "grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-5 py-3 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold", children: [_jsx("span", { children: "Project" }), _jsx("span", { children: "Scanner" }), _jsx("span", { children: "Frequency" }), _jsx("span", { children: "Last run" }), _jsx("span", { children: "Next run" }), _jsx("span", {})] }), _jsx("div", { className: "divide-y divide-slate-800/50", children: schedules.map(s => {
                            const cadenceLabel = CADENCES.find(c => c.hours === s.cadence_hours)?.label ?? `${s.cadence_hours}h`;
                            return (_jsxs("div", { className: `grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-5 py-4 items-center hover:bg-slate-900/50 transition group ${!s.enabled ? 'opacity-50' : ''}`, children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("div", { className: `w-2 h-2 rounded-full shrink-0 ${s.enabled ? 'bg-emerald-400' : 'bg-slate-600'}` }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm font-medium text-white truncate", children: projectName(s.project_id) }), _jsx("div", { className: "text-[10px] text-slate-500 font-mono", children: s.project_id.slice(0, 8).toUpperCase() })] })] }), _jsx("div", { className: "text-xs text-slate-300 font-mono", children: scannerLabel(s.scanner) }), _jsx("div", { className: "text-xs text-slate-400", children: cadenceLabel }), _jsx("div", { className: "text-xs text-slate-500", children: fmtDate(s.last_run_at) }), _jsxs("div", { className: `text-xs font-mono ${nextRunColor(s.next_run_at)}`, children: [fmtDate(s.next_run_at), s.next_run_at && new Date(s.next_run_at) < new Date() && (_jsx("span", { className: "ml-1 text-[10px] text-red-400 font-sans", children: "(overdue)" }))] }), _jsxs("div", { className: "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition", children: [_jsx("button", { onClick: () => toggle(s), title: s.enabled ? 'Disable' : 'Enable', className: `p-1.5 rounded transition ${s.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`, children: s.enabled ? _jsx(Power, { className: "w-3.5 h-3.5" }) : _jsx(PowerOff, { className: "w-3.5 h-3.5" }) }), _jsx("button", { onClick: () => remove(s.id), title: "Delete", className: "p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition", children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] }, s.id));
                        }) })] })), _jsx("p", { className: "text-[11px] text-slate-600", children: "Schedules are checked every 5 minutes while you have Sentinel AI open. Close the app to pause execution." })] }));
}
function Stat({ label, value, icon: Icon, color }) {
    return (_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 transition", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-sm text-slate-400", children: label }), _jsx("div", { className: `w-8 h-8 rounded-md border flex items-center justify-center ${color}`, children: _jsx(Icon, { className: "w-4 h-4" }) })] }), _jsx("div", { className: "mt-3 text-3xl font-bold tabular-nums", children: value })] }));
}
