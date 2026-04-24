import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, X, Power, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { AVAILABLE_SCANNERS } from '../lib/scanMock';
const CADENCES = [
    { hours: 1, label: 'Every hour' },
    { hours: 6, label: 'Every 6 hours' },
    { hours: 24, label: 'Daily' },
    { hours: 24 * 7, label: 'Weekly' },
    { hours: 24 * 30, label: 'Monthly' },
];
function cadenceLabel(hours) {
    const m = CADENCES.find((c) => c.hours === hours);
    if (m)
        return m.label;
    if (hours < 24)
        return `Every ${hours}h`;
    if (hours % 24 === 0)
        return `Every ${hours / 24}d`;
    return `${hours}h`;
}
export default function SchedulesPanel({ projects }) {
    const { user } = useAuth();
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const load = useCallback(async () => {
        if (!user)
            return;
        const { data } = await supabase
            .from('scan_schedules')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        setSchedules((data ?? []));
        setLoading(false);
    }, [user]);
    useEffect(() => {
        load();
    }, [load]);
    const toggle = async (s) => {
        const next = !s.enabled;
        setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: next } : x)));
        await supabase.from('scan_schedules').update({ enabled: next }).eq('id', s.id);
    };
    const remove = async (id) => {
        setSchedules((prev) => prev.filter((x) => x.id !== id));
        await supabase.from('scan_schedules').delete().eq('id', id);
    };
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("div", { className: "text-sm text-slate-400", children: "Automated scans that run on a recurring schedule. Due jobs are dispatched while the app is open." }), _jsxs("button", { onClick: () => setModalOpen(true), disabled: projects.length === 0, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-semibold px-3 py-1.5 rounded-md text-xs transition", children: [_jsx(Plus, { className: "w-3.5 h-3.5" }), " New schedule"] })] }), loading ? (_jsx("div", { className: "text-slate-500 text-sm", children: "Loading..." })) : schedules.length === 0 ? (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-12 text-center", children: [_jsx(CalendarClock, { className: "w-8 h-8 text-slate-600 mx-auto mb-2" }), _jsx("div", { className: "text-slate-300 font-medium", children: "No schedules configured" }), _jsx("div", { className: "text-slate-500 text-sm mt-1", children: "Create one to run scans automatically." })] })) : (_jsx("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden divide-y divide-slate-800", children: schedules.map((s) => {
                    const project = projects.find((p) => p.id === s.project_id);
                    return (_jsxs("div", { className: "px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: `w-9 h-9 rounded-md flex items-center justify-center ${s.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'}`, children: _jsx(CalendarClock, { className: "w-4 h-4" }) }), _jsxs("div", { children: [_jsxs("div", { className: "text-sm font-medium text-white", children: [s.scanner, " ", _jsxs("span", { className: "text-slate-500 font-normal", children: ["on ", project?.name ?? 'project'] })] }), _jsxs("div", { className: "text-xs text-slate-500 mt-0.5", children: [cadenceLabel(s.cadence_hours), " \u00B7 next ", new Date(s.next_run_at).toLocaleString()] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-[11px] px-2 py-0.5 rounded-md border ${s.enabled
                                            ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                                            : 'text-slate-400 border-slate-700 bg-slate-800/50'}`, children: s.enabled ? 'Active' : 'Paused' }), _jsx("button", { onClick: () => toggle(s), className: "p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-900 transition", title: s.enabled ? 'Pause' : 'Resume', children: _jsx(Power, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => remove(s.id), className: "p-2 rounded-md text-slate-400 hover:text-rose-300 hover:bg-slate-900 transition", title: "Delete", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }, s.id));
                }) })), modalOpen && (_jsx(NewScheduleModal, { projects: projects, onClose: () => setModalOpen(false), onCreated: () => {
                    setModalOpen(false);
                    load();
                } }))] }));
}
function NewScheduleModal({ projects, onClose, onCreated, }) {
    const { user } = useAuth();
    const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
    const [scanner, setScanner] = useState(AVAILABLE_SCANNERS[0].id);
    const [cadence, setCadence] = useState(24);
    const [saving, setSaving] = useState(false);
    const save = async () => {
        if (!user || !projectId)
            return;
        setSaving(true);
        const next = new Date(Date.now() + cadence * 3600 * 1000).toISOString();
        await supabase.from('scan_schedules').insert({
            user_id: user.id,
            project_id: projectId,
            scanner,
            cadence_hours: cadence,
            enabled: true,
            next_run_at: next,
        });
        setSaving(false);
        onCreated();
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-800", children: [_jsx("h2", { className: "font-semibold", children: "New schedule" }), _jsx("button", { onClick: onClose, className: "text-slate-500 hover:text-white", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Project" }), _jsx("select", { value: projectId, onChange: (e) => setProjectId(e.target.value), className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none", children: projects.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Scanner" }), _jsx("select", { value: scanner, onChange: (e) => setScanner(e.target.value), className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none", children: AVAILABLE_SCANNERS.map((s) => (_jsxs("option", { value: s.id, children: [s.label, " \u2014 ", s.description] }, s.id))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Cadence" }), _jsx("div", { className: "grid grid-cols-3 gap-2", children: CADENCES.map((c) => (_jsx("button", { onClick: () => setCadence(c.hours), className: `py-2 rounded-md text-xs font-medium border transition ${cadence === c.hours
                                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                                            : 'border-slate-800 text-slate-400 hover:border-slate-700'}`, children: c.label }, c.hours))) })] }), _jsxs("div", { className: "pt-2 flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-slate-300 hover:text-white", children: "Cancel" }), _jsx("button", { onClick: save, disabled: saving || !projectId, className: "bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: saving ? 'Saving...' : 'Create schedule' })] })] })] }) }));
}
