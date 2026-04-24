import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Target, Zap, ShieldAlert, ArrowDown, Activity, Bug } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateKillChain } from '../lib/aiRedTeam';
export default function KillChain() {
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [vulns, setVulns] = useState([]);
    const [chain, setChain] = useState(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        supabase.from('projects').select('*').order('name').then(({ data }) => {
            if (data && data.length > 0) {
                setProjects(data);
                setProjectId(data[0].id);
            }
        });
    }, []);
    const runSimulation = async () => {
        if (!projectId)
            return;
        setLoading(true);
        setChain(null);
        // Get scans for selected project, then pull open vulnerabilities for those scans.
        const { data: scans } = await supabase.from('scans').select('id').eq('project_id', projectId);
        const scanIds = scans?.map(s => s.id) || [];
        const { data: projVulns } = await supabase
            .from('vulnerabilities')
            .select('*')
            .in('scan_id', scanIds)
            .eq('status', 'open');
        const finalVulns = projVulns || [];
        setVulns(finalVulns);
        const project = projects.find(p => p.id === projectId);
        const result = await generateKillChain(project?.name || 'Unknown', finalVulns);
        setChain(result);
        setLoading(false);
    };
    return (_jsxs("div", { className: "p-8 max-w-5xl space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "AI Red Team Simulation" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Simulate an advanced persistent threat (APT) attack path based on your current vulnerabilities." })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col md:flex-row items-end gap-4", children: [_jsxs("div", { className: "flex-1 w-full", children: [_jsx("label", { htmlFor: "project", className: "block text-sm text-slate-300 mb-1.5", children: "Target Project" }), _jsx("select", { id: "project", value: projectId, onChange: (e) => setProjectId(e.target.value), className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none", children: projects.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id))) })] }), _jsxs("button", { onClick: runSimulation, disabled: loading || !projectId, className: "bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-6 py-2.5 rounded-md flex items-center gap-2 transition w-full md:w-auto justify-center", children: [loading ? _jsx(Activity, { className: "w-4 h-4 animate-spin" }) : _jsx(Target, { className: "w-4 h-4" }), loading ? 'Simulating Attack...' : 'Generate Kill Chain'] })] }), chain && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-8", children: [_jsxs("h2", { className: "text-xl font-semibold flex items-center gap-2", children: [_jsx(Zap, { className: "w-5 h-5 text-red-400" }), " Attack Vector Generated"] }), _jsxs("div", { className: "text-sm text-slate-400", children: ["Based on ", vulns.length, " open vulnerabilities"] })] }), _jsx("div", { className: "relative pl-6 md:pl-8 space-y-8 before:absolute before:inset-0 before:ml-[1.4rem] md:before:ml-[1.9rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-800 before:via-red-500/50 before:to-slate-800", children: chain.map((step, idx) => (_jsxs("div", { className: "relative", children: [_jsxs("div", { className: "md:flex items-center justify-between md:space-x-8", children: [_jsxs("div", { className: "md:w-5/12 mb-3 md:mb-0 hidden md:block text-right", children: [_jsx("div", { className: "text-sm font-bold text-red-400 uppercase tracking-wider", children: step.phase }), _jsxs("div", { className: "text-xs text-slate-500 font-mono mt-1", children: ["MITRE TACTIC: ", step.tactic] })] }), _jsx("div", { className: "absolute left-0 md:left-1/2 -ml-[19px] md:-ml-4 flex h-8 w-8 items-center justify-center rounded-full border-4 border-slate-950 bg-slate-900 shadow text-red-400", children: _jsx(Bug, { className: "h-3.5 w-3.5" }) }), _jsxs("div", { className: "md:w-5/12 ml-6 md:ml-0 rounded-xl border border-red-500/20 bg-red-500/5 p-5 shadow-lg", children: [_jsxs("div", { className: "md:hidden mb-2", children: [_jsx("div", { className: "text-sm font-bold text-red-400 uppercase tracking-wider", children: step.phase }), _jsxs("div", { className: "text-[10px] text-slate-500 font-mono mt-0.5", children: ["MITRE TACTIC: ", step.tactic] })] }), _jsx("p", { className: "text-sm text-slate-300 leading-relaxed", children: step.description }), _jsx("div", { className: "mt-4 pt-4 border-t border-red-500/10", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(ShieldAlert, { className: "w-4 h-4 text-orange-400 shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsxs("div", { className: "text-xs font-semibold text-slate-200", children: ["Exploited Asset: ", step.asset] }), _jsx("div", { className: "text-xs text-slate-400 mt-0.5", children: step.exploited_vuln })] })] }) })] })] }), idx < chain.length - 1 && (_jsx("div", { className: "hidden md:flex justify-center my-4", children: _jsx(ArrowDown, { className: "w-5 h-5 text-red-500/30" }) }))] }, idx))) })] }))] }));
}
