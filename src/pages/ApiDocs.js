import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Terminal, Copy, Check, Info, Code } from 'lucide-react';
export default function ApiDocs() {
    const [copied, setCopied] = useState(null);
    const copy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };
    const curlScan = `curl -X POST https://your-project.supabase.co/functions/v1/scan-dispatch \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scan_id": "auto-generated-uuid",
    "project_id": "your-project-uuid",
    "scanner": "nmap",
    "target": "example.com"
  }'`;
    const cliExample = `#!/bin/bash
# sentinel-cli - Simple wrapper for Sentinel AI REST API

API_KEY="YOUR_API_KEY"
ENDPOINT="https://your-project.supabase.co/functions/v1/scan-dispatch"

if [ "$1" == "scan" ]; then
  curl -s -X POST $ENDPOINT \\
    -H "Authorization: Bearer $API_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{\\"scan_id\\": \\"$(uuidgen)\\", \\"project_id\\": \\"$2\\", \\"scanner\\": \\"$3\\", \\"target\\": \\"$4\\"}"
  echo "\\nScan queued successfully."
else
  echo "Usage: ./sentinel-cli scan <project_id> <scanner> <target>"
fi`;
    return (_jsxs("div", { className: "p-8 max-w-5xl space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "REST API & CLI" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Programmatic access to Sentinel AI for your custom automation workflows." })] }), _jsxs("div", { className: "flex items-start gap-2 text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4", children: [_jsx(Info, { className: "w-4 h-4 shrink-0 mt-0.5" }), _jsxs("p", { children: ["To authenticate, you need to use your Personal Access Token (API Key) generated from the Settings page. Pass it in the ", _jsx("code", { children: "Authorization: Bearer" }), " header."] })] }), _jsxs("div", { className: "space-y-6", children: [_jsxs("h2", { className: "text-xl font-semibold flex items-center gap-2 border-b border-slate-800 pb-2", children: [_jsx(Code, { className: "w-5 h-5 text-emerald-400" }), " Start a Scan (REST API)"] }), _jsx("p", { className: "text-sm text-slate-400", children: "Trigger a new scan job asynchronously. The job will be picked up by your VPS Agent." }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col", children: [_jsxs("div", { className: "px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30", children: [_jsx("span", { className: "text-xs font-mono text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 rounded", children: "POST /scan-dispatch" }), _jsx("button", { onClick: () => copy(curlScan, 'curl'), className: "text-xs flex items-center gap-1 text-slate-400 hover:text-white transition", children: copied === 'curl' ? _jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), " Copy cURL"] }) })] }), _jsx("div", { className: "p-4 bg-[#0d1117] font-mono text-sm overflow-x-auto text-slate-300", children: _jsx("pre", { children: _jsx("code", { children: curlScan }) }) })] })] }), _jsxs("div", { className: "space-y-6 mt-12", children: [_jsxs("h2", { className: "text-xl font-semibold flex items-center gap-2 border-b border-slate-800 pb-2", children: [_jsx(Terminal, { className: "w-5 h-5 text-sky-400" }), " Sentinel CLI (Bash Wrapper)"] }), _jsxs("p", { className: "text-sm text-slate-400", children: ["You can create a simple CLI wrapper to trigger scans directly from your terminal. Save this as ", _jsx("code", { children: "sentinel-cli" }), " and ", _jsx("code", { children: "chmod +x sentinel-cli" }), "."] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col", children: [_jsxs("div", { className: "px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30", children: [_jsx("span", { className: "text-xs font-mono text-sky-400 font-semibold px-2 py-1 bg-sky-500/10 rounded", children: "sentinel-cli" }), _jsx("button", { onClick: () => copy(cliExample, 'cli'), className: "text-xs flex items-center gap-1 text-slate-400 hover:text-white transition", children: copied === 'cli' ? _jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), " Copy Script"] }) })] }), _jsx("div", { className: "p-4 bg-[#0d1117] font-mono text-sm overflow-x-auto text-slate-300", children: _jsx("pre", { children: _jsx("code", { children: cliExample }) }) })] })] })] }));
}
