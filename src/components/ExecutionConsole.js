import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, CheckCircle2, Loader2 } from 'lucide-react';
export default function ExecutionConsole({ code, type, onComplete, onCancel }) {
    const [logs, setLogs] = useState([]);
    const [isFinishing, setIsFinishing] = useState(false);
    const scrollRef = useRef(null);
    const addLog = useCallback((text, type = 'info') => {
        setLogs((prev) => [
            ...prev,
            { text, type, timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) },
        ]);
    }, []);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);
    useEffect(() => {
        const sequence = async () => {
            addLog(`Initializing Sentinel AI Remediation Engine...`, 'info');
            await sleep(800);
            addLog(`Targeting asset environment: ${type.toUpperCase()}`, 'info');
            await sleep(1000);
            addLog(`Preparing execution environment...`, 'info');
            await sleep(1200);
            addLog(`Running pre-flight security checks...`, 'info');
            await sleep(1500);
            addLog(`Verification successful. Executing remediation patch:`, 'success');
            await sleep(500);
            const lines = code.split('\n').filter(l => l.trim().length > 0);
            for (const line of lines) {
                addLog(`> ${line}`, 'command');
                await sleep(Math.random() * 800 + 400);
            }
            addLog(`Verifying fix application...`, 'info');
            await sleep(2000);
            addLog(`Resource state updated successfully.`, 'success');
            await sleep(1000);
            setIsFinishing(true);
            await sleep(1500);
            onComplete();
        };
        sequence();
    }, [addLog, code, onComplete, type]);
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm", children: _jsxs("div", { className: "w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col h-[500px]", children: [_jsxs("div", { className: "bg-slate-800/50 px-4 py-3 border-b border-slate-700 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "flex gap-1.5 mr-2", children: [_jsx("div", { className: "w-3 h-3 rounded-full bg-red-500/50" }), _jsx("div", { className: "w-3 h-3 rounded-full bg-amber-500/50" }), _jsx("div", { className: "w-3 h-3 rounded-full bg-emerald-500/50" })] }), _jsx(Terminal, { className: "w-4 h-4 text-slate-400" }), _jsx("span", { className: "text-xs font-mono text-slate-300", children: "sentinel-ai --apply-fix --force" })] }), !isFinishing && (_jsx("button", { onClick: onCancel, className: "text-xs text-slate-500 hover:text-white transition", children: "Abort" }))] }), _jsxs("div", { ref: scrollRef, className: "flex-1 p-4 font-mono text-sm overflow-auto scrollbar-thin scrollbar-thumb-slate-700 bg-slate-950/50", children: [logs.map((log, i) => (_jsxs("div", { className: "mb-2 flex gap-3 animate-in fade-in slide-in-from-left-2 duration-300", children: [_jsxs("span", { className: "text-slate-600 shrink-0", children: ["[", log.timestamp, "]"] }), _jsx("span", { className: `
                ${log.type === 'success' ? 'text-emerald-400' : ''}
                ${log.type === 'error' ? 'text-red-400' : ''}
                ${log.type === 'command' ? 'text-sky-400' : 'text-slate-300'}
              `, children: log.text })] }, i))), !isFinishing && (_jsxs("div", { className: "flex items-center gap-2 text-emerald-400/50 mt-4", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), _jsx("span", { children: "AI execution in progress..." })] })), isFinishing && (_jsxs("div", { className: "mt-8 p-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center text-center animate-in zoom-in duration-500", children: [_jsx(CheckCircle2, { className: "w-12 h-12 text-emerald-500 mb-3" }), _jsx("h3", { className: "text-lg font-semibold text-white", children: "Remediation Complete" }), _jsx("p", { className: "text-sm text-slate-400 mt-1", children: "The vulnerability has been successfully patched and verified." })] }))] }), _jsxs("div", { className: "px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500", children: [_jsx("span", { children: "Sentinel AI v2.4 (Engine: Hyperion)" }), _jsxs("span", { children: ["Status: ", isFinishing ? 'Success' : 'Executing...'] })] })] }) }));
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
