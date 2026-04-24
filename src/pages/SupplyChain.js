import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { PackageSearch, Upload, AlertTriangle, CheckCircle2, Shield, RefreshCw, FileJson } from 'lucide-react';
export default function SupplyChain() {
    const fileRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [results, setResults] = useState(null);
    const [fileName, setFileName] = useState(null);
    const [error, setError] = useState(null);
    const parseVersion = (v) => {
        const match = v.match(/(\d+\.\d+\.\d+)/);
        return match ? match[0] : null;
    };
    const handleFile = async (file) => {
        if (!file.name.endsWith('package.json') && !file.name.endsWith('package-lock.json')) {
            setError('Only package.json and package-lock.json files are supported currently.');
            return;
        }
        setError(null);
        setFileName(file.name);
        setScanning(true);
        setResults(null);
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const deps = [];
            if (file.name.endsWith('package-lock.json')) {
                Object.entries((json.packages || json.dependencies || {})).forEach(([name, pkg]) => {
                    if (!name)
                        return; // skip root project
                    const cleanName = name.replace(/^.*node_modules\//, '');
                    if (pkg.version) {
                        const v = parseVersion(pkg.version);
                        if (v)
                            deps.push({ name: cleanName, version: v, type: pkg.dev ? 'dev' : 'prod' });
                    }
                });
            }
            else {
                if (json.dependencies) {
                    Object.entries(json.dependencies).forEach(([name, version]) => {
                        const v = parseVersion(version);
                        if (v)
                            deps.push({ name, version: v, type: 'prod' });
                    });
                }
                if (json.devDependencies) {
                    Object.entries(json.devDependencies).forEach(([name, version]) => {
                        const v = parseVersion(version);
                        if (v)
                            deps.push({ name, version: v, type: 'dev' });
                    });
                }
            }
            if (deps.length === 0) {
                setError('No dependencies found in package.json.');
                setScanning(false);
                return;
            }
            // Query OSV API in batches
            const scanResults = [];
            for (const dep of deps) {
                try {
                    const res = await fetch('https://api.osv.dev/v1/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            version: dep.version,
                            package: { name: dep.name, ecosystem: 'npm' }
                        })
                    });
                    if (!res.ok)
                        continue;
                    const data = (await res.json());
                    if (data.vulns && data.vulns.length > 0) {
                        const mappedVulns = data.vulns.map((v) => {
                            const affected = v.affected?.[0];
                            const fixed = affected?.ranges?.[0]?.events?.find((e) => Boolean(e.fixed))?.fixed;
                            // Extract severity
                            let severity = 'medium';
                            if (v.severity && v.severity.length > 0) {
                                const score = v.severity[0].score ?? '';
                                if (score.includes('CRITICAL'))
                                    severity = 'critical';
                                else if (score.includes('HIGH'))
                                    severity = 'high';
                                else if (score.includes('LOW'))
                                    severity = 'low';
                            }
                            return {
                                id: v.id,
                                summary: v.summary || 'Known vulnerability',
                                details: v.details || '',
                                severity,
                                fixed_in: fixed
                            };
                        });
                        scanResults.push({ dep, vulns: mappedVulns });
                    }
                    else {
                        scanResults.push({ dep, vulns: [] });
                    }
                }
                catch (err) {
                    console.error(`Failed to scan ${dep.name}:`, err);
                }
            }
            setResults(scanResults);
        }
        catch {
            setError('Failed to parse package.json. Ensure it is valid JSON.');
        }
        finally {
            setScanning(false);
        }
    };
    const SEV_COLORS = {
        critical: 'text-red-400 border-red-500/30 bg-red-500/10',
        high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
        medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
        low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    };
    const vulnerableDeps = results?.filter(r => r.vulns.length > 0) || [];
    const safeDeps = results?.filter(r => r.vulns.length === 0) || [];
    return (_jsxs("div", { className: "p-8 max-w-6xl space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Supply Chain Analysis" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Upload your manifest files to instantly detect vulnerabilities in third-party dependencies via OSV.dev." })] }), !results && !scanning && (_jsxs("div", { onDragOver: (e) => {
                    e.preventDefault();
                    setDragging(true);
                }, onDragLeave: () => setDragging(false), onDrop: (e) => {
                    e.preventDefault();
                    setDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f)
                        handleFile(f);
                }, onClick: () => fileRef.current?.click(), className: `rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${dragging
                    ? 'border-emerald-500/60 bg-emerald-500/5 scale-[1.02]'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'}`, children: [_jsx("div", { className: "w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-xl", children: _jsx(PackageSearch, { className: "w-8 h-8 text-emerald-400" }) }), _jsx("h3", { className: "text-lg font-semibold text-white mb-2", children: "Upload package.json" }), _jsx("p", { className: "text-sm text-slate-400 max-w-sm mx-auto", children: "Drop your npm package.json here or click to browse. We will instantly analyze your dependency tree." }), _jsx("input", { ref: fileRef, type: "file", accept: "application/json,.json", className: "hidden", "aria-label": "Upload package.json", title: "Upload package.json", onChange: (e) => {
                            const f = e.target.files?.[0];
                            if (f)
                                handleFile(f);
                        } })] })), error && (_jsxs("div", { className: "p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3", children: [_jsx(AlertTriangle, { className: "w-5 h-5 shrink-0" }), error] })), scanning && (_jsxs("div", { className: "rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center flex flex-col items-center", children: [_jsx(RefreshCw, { className: "w-10 h-10 text-emerald-400 animate-spin mb-4" }), _jsx("h3", { className: "text-lg font-semibold text-white", children: "Analyzing Dependencies..." }), _jsx("p", { className: "text-sm text-slate-400 mt-1", children: "Querying Open Source Vulnerability Database" })] })), results && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-xl font-semibold flex items-center gap-2", children: [_jsx(FileJson, { className: "w-5 h-5 text-emerald-400" }), " ", fileName] }), _jsxs("button", { onClick: () => { setResults(null); setFileName(null); }, className: "text-sm text-slate-400 hover:text-white flex items-center gap-2", children: [_jsx(Upload, { className: "w-4 h-4" }), " Scan another file"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-5", children: [_jsx("div", { className: "text-sm text-slate-500 mb-1", children: "Total Dependencies" }), _jsx("div", { className: "text-3xl font-bold text-white", children: results.length })] }), _jsxs("div", { className: "rounded-xl border border-red-500/20 bg-red-500/5 p-5", children: [_jsx("div", { className: "text-sm text-red-400 mb-1", children: "Vulnerable Packages" }), _jsx("div", { className: "text-3xl font-bold text-red-400", children: vulnerableDeps.length })] }), _jsxs("div", { className: "rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5", children: [_jsx("div", { className: "text-sm text-emerald-400 mb-1", children: "Safe Packages" }), _jsx("div", { className: "text-3xl font-bold text-emerald-400", children: safeDeps.length })] })] }), vulnerableDeps.length > 0 && (_jsxs("div", { className: "space-y-4", children: [_jsxs("h3", { className: "font-semibold text-lg text-red-400 flex items-center gap-2 mt-8", children: [_jsx(AlertTriangle, { className: "w-5 h-5" }), " Vulnerable Dependencies"] }), _jsx("div", { className: "grid grid-cols-1 gap-4", children: vulnerableDeps.map((r, i) => (_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/40 p-5", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("div", { children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h4", { className: "text-lg font-bold text-white", children: r.dep.name }), _jsxs("span", { className: "text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded", children: ["v", r.dep.version] }), _jsx("span", { className: "text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded uppercase", children: r.dep.type })] }) }), _jsxs("span", { className: "text-sm font-semibold text-red-400", children: [r.vulns.length, " vulnerabilities"] })] }), _jsx("div", { className: "space-y-3", children: r.vulns.map(v => (_jsx("div", { className: "rounded-lg border border-slate-700/50 bg-slate-800/30 p-4", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { className: `text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${SEV_COLORS[v.severity] || SEV_COLORS.medium}`, children: v.severity }), _jsx("a", { href: `https://osv.dev/vulnerability/${v.id}`, target: "_blank", rel: "noreferrer", className: "text-xs text-sky-400 hover:underline", children: v.id })] }), _jsx("p", { className: "text-sm text-slate-200 mt-2 font-medium", children: v.summary })] }), v.fixed_in && (_jsxs("div", { className: "shrink-0 text-right", children: [_jsx("div", { className: "text-[10px] text-slate-500 uppercase font-bold mb-0.5", children: "Fixed in" }), _jsx("div", { className: "text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20", children: v.fixed_in })] }))] }) }, v.id))) })] }, i))) })] })), safeDeps.length > 0 && (_jsxs("div", { className: "mt-8", children: [_jsxs("h3", { className: "font-semibold text-lg text-emerald-400 flex items-center gap-2 mb-4", children: [_jsx(CheckCircle2, { className: "w-5 h-5" }), " Verified Safe"] }), _jsx("div", { className: "flex flex-wrap gap-2", children: safeDeps.map((r, i) => (_jsxs("div", { className: "inline-flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-slate-400", children: [_jsx(Shield, { className: "w-3 h-3 text-emerald-500" }), _jsx("span", { children: r.dep.name }), _jsxs("span", { className: "font-mono text-slate-600", children: ["v", r.dep.version] })] }, i))) })] }))] }))] }));
}
