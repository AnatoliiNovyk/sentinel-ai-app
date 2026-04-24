import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { Plus, FolderKanban, Cloud, Globe, Server, FileCode, Trash2, X, ChevronRight, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import ProjectDetail from './ProjectDetail';
import { riskBand } from '../lib/riskScore';
const ENV_META = {
    external: { label: 'External', icon: Globe, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    cloud: { label: 'Cloud', icon: Cloud, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    internal: { label: 'Internal', icon: Server, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
    iac: { label: 'IaC', icon: FileCode, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};
export default function Projects() {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const load = useCallback(async () => {
        if (!user)
            return;
        const { data } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });
        setProjects(data ?? []);
        setLoading(false);
    }, [user]);
    useEffect(() => {
        load();
    }, [load]);
    const remove = async (id) => {
        await supabase.from('projects').delete().eq('id', id);
        if (selected?.id === id)
            setSelected(null);
        load();
    };
    if (selected) {
        const fresh = projects.find((p) => p.id === selected.id) ?? selected;
        return _jsx(ProjectDetail, { project: fresh, onBack: () => setSelected(null) });
    }
    return (_jsxs("div", { className: "p-8 max-w-7xl", children: [_jsxs("div", { className: "flex items-end justify-between mb-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight text-white", children: "Projects" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Organize your audit targets by environment." })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsxs("button", { onClick: () => setModalOpen(true), className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: [_jsx(Plus, { className: "w-4 h-4" }), " New project"] }) })] }), loading ? (_jsx("div", { className: "text-slate-500 text-sm", children: "Loading projects..." })) : projects.length === 0 ? (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-16 text-center", children: [_jsx(FolderKanban, { className: "w-10 h-10 text-slate-600 mx-auto mb-3" }), _jsx("div", { className: "text-slate-300 font-medium", children: "No projects found" }), _jsx("div", { className: "text-slate-500 text-sm mt-1", children: "Create your first project to start auditing." }), _jsxs("button", { onClick: () => setModalOpen(true), className: "mt-5 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: [_jsx(Plus, { className: "w-4 h-4" }), " New project"] })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", children: projects.map((p) => {
                    const meta = ENV_META[p.environment] ?? ENV_META.external;
                    const Icon = meta.icon;
                    const band = riskBand(p.risk_score ?? 0);
                    return (_jsxs("button", { onClick: () => setSelected(p), className: "group text-left rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-emerald-500/40 hover:bg-slate-900/60 transition", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: `inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${meta.color}`, children: [_jsx(Icon, { className: "w-3 h-3" }), " ", meta.label] }), _jsxs("div", { className: `inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${band.color}`, children: [_jsx(ShieldAlert, { className: "w-3 h-3" }), " ", band.label, " \u00B7 ", p.risk_score ?? 0] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { role: "button", "aria-label": "Delete project", onClick: (e) => {
                                                    e.stopPropagation();
                                                    remove(p.id);
                                                }, className: "opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition cursor-pointer", children: _jsx(Trash2, { className: "w-4 h-4" }) }), _jsx(ChevronRight, { className: "w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition" })] })] }), _jsx("h3", { className: "font-semibold text-white truncate", children: p.name }), _jsx("p", { className: "mt-1 text-sm text-slate-400 line-clamp-2", children: p.description || 'No description' }), _jsx("div", { className: "mt-4 text-xs text-slate-500 font-mono truncate", children: p.target })] }, p.id));
                }) })), modalOpen && _jsx(ProjectModal, { onClose: () => setModalOpen(false), onCreated: load })] }));
}
function ProjectModal({ onClose, onCreated }) {
    const { user, organizations } = useAuth();
    const [name, setName] = useState('');
    const [description] = useState('');
    const [target, setTarget] = useState('');
    const [environment, setEnvironment] = useState('external');
    const [tagsInput] = useState('');
    const [saving, setSaving] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        if (!user || organizations.length === 0) {
            alert('You must be a member of an organization to create a project.');
            return;
        }
        setSaving(true);
        const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
        const { error } = await supabase.from('projects').insert({
            user_id: user.id,
            org_id: organizations[0].id,
            name,
            description,
            target,
            environment,
            tags,
        });
        if (error) {
            alert(`Error creating project: ${error.message}`);
        }
        else {
            onCreated();
            onClose();
        }
        setSaving(false);
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-800", children: [_jsx("h2", { className: "font-semibold text-white", children: "New project" }), _jsx("button", { onClick: onClose, className: "text-slate-500 hover:text-white", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("form", { onSubmit: submit, className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Organization" }), _jsx("div", { className: "text-xs text-emerald-400 bg-emerald-400/5 border border-emerald-400/10 px-3 py-2 rounded-md", children: organizations[0]?.name || 'Loading organization...' })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Name" }), _jsx("input", { required: true, value: name, onChange: (e) => setName(e.target.value), className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none", placeholder: "Production AWS" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Target (Domain or IP)" }), _jsx("input", { required: true, value: target, onChange: (e) => setTarget(e.target.value), className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none", placeholder: "example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Environment" }), _jsx("div", { className: "grid grid-cols-4 gap-2", children: ['external', 'cloud', 'internal', 'iac'].map((env) => (_jsx("button", { type: "button", onClick: () => setEnvironment(env), className: `py-2 rounded-md text-xs font-medium border transition capitalize ${environment === env
                                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                                            : 'border-slate-800 text-slate-400 hover:border-slate-700'}`, children: env }, env))) })] }), _jsxs("div", { className: "pt-2 flex justify-end gap-2", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-sm text-slate-300 hover:text-white", children: "Cancel" }), _jsx("button", { type: "submit", disabled: saving, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: saving ? 'Creating...' : 'Create project' })] })] })] }) }));
}
