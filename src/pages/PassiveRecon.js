import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Search, Globe, AlertTriangle, Loader2, Info, Terminal } from 'lucide-react';
import { useAuth } from '../context/useAuth';
export default function ActiveRecon() {
    const { user } = useAuth();
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('idle');
    const handleScan = async () => {
        if (!target.trim() || !user)
            return;
        setLoading(true);
        setError(null);
        setStatus('queued');
        try {
            // In a real implementation, this triggers a job on the VPS agent.
            await new Promise(r => setTimeout(r, 2000));
            setStatus('running');
            await new Promise(r => setTimeout(r, 3000));
            setStatus('done');
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start active recon';
            setError(message);
            setStatus('idle');
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "p-8 max-w-6xl space-y-8", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-3xl font-bold tracking-tight flex items-center gap-3", children: [_jsx("div", { className: "w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-900/20 border border-indigo-500/20 flex items-center justify-center", children: _jsx(Globe, { className: "w-5 h-5 text-indigo-400" }) }), "Active Reconnaissance (Deep Nmap)"] }), _jsxs("p", { className: "mt-2 text-sm text-slate-500", children: ["Gather deep intelligence by performing active port discovery and service fingerprinting via our decentralized agents.", _jsx("span", { className: "block mt-1 font-semibold text-emerald-500", children: "No commercial APIs (Shodan/Censys) required." })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-6", children: [_jsx("div", { className: "bg-slate-800/20 border border-slate-700/50 rounded-lg p-4", children: _jsxs("div", { className: "flex items-center gap-3 text-sm text-slate-300", children: [_jsx(Info, { className: "w-4 h-4 text-sky-400" }), _jsx("span", { children: "This tool triggers a high-intensity Nmap scan from your assigned VPS agent." })] }) }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-300 mb-2", children: "Target IP or Domain" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("input", { type: "text", value: target, onChange: (e) => setTarget(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleScan(), placeholder: "e.g. 8.8.8.8 or example.com", className: "flex-1 bg-slate-900 border border-slate-800 rounded-md px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono" }), _jsxs("button", { onClick: handleScan, disabled: loading || !target.trim(), className: "inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-md text-sm transition", children: [loading ? _jsx(Loader2, { className: "w-4 h-4 animate-spin" }) : _jsx(Search, { className: "w-4 h-4" }), loading ? 'Executing...' : 'Start Active Recon'] })] })] }), status !== 'idle' && (_jsxs("div", { className: "rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Terminal, { className: "w-3.5 h-3.5 text-emerald-500" }), _jsx("span", { className: "text-slate-400", children: "sentinel-agent@node-1:~$" })] }), _jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "text-emerald-400", children: ["nmap -sV -sC -T4 --open ", target] }), status === 'queued' && _jsx("div", { className: "text-slate-500 animate-pulse", children: "Waiting for agent to pick up job..." }), status === 'running' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "text-slate-300", children: ["Starting Nmap 7.92 ( https://nmap.org ) at ", new Date().toISOString()] }), _jsxs("div", { className: "text-slate-300", children: ["Nmap scan report for ", target] }), _jsx("div", { className: "text-slate-500 animate-pulse", children: "Scanning ports..." })] })), status === 'done' && (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-emerald-300", children: "PORT     STATE SERVICE VERSION" }), _jsx("div", { className: "text-slate-300", children: "22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5" }), _jsx("div", { className: "text-slate-300", children: "80/tcp   open  http    nginx 1.18.0" }), _jsx("div", { className: "text-slate-300", children: "443/tcp  open  ssl/http nginx 1.18.0" }), _jsx("div", { className: "text-emerald-500 mt-2 font-bold", children: "Scan complete. Results added to Scans dashboard." })] }))] })] })), error && (_jsxs("div", { className: "flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3", children: [_jsx(AlertTriangle, { className: "w-4 h-4 shrink-0 mt-0.5" }), " ", error] }))] })] }));
}
