import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { TrendingDown, TrendingUp, Minus, GitCompare } from 'lucide-react';
const SEV_WEIGHT = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const SEV_CLASS = {
    critical: 'text-red-400 border-red-500/30 bg-red-500/10',
    high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    info: 'text-slate-400 border-slate-700 bg-slate-800/40',
};
function fingerprint(v) {
    return `${v.title}|${v.asset}`.toLowerCase().trim();
}
/**
 * F-07: Scan Diff Component — Continuous Monitoring
 * Compares two consecutive scans and shows NEW / FIXED / PERSISTED findings.
 */
export default function ScanDiff({ scans, vulns, }) {
    const completed = scans.filter(s => s.status === 'completed');
    const latest = completed[0] ?? null;
    const previous = completed[1] ?? null;
    const latestScanId = latest?.id;
    const previousScanId = previous?.id;
    const latestVulns = useMemo(() => (latestScanId ? vulns.filter((v) => v.scan_id === latestScanId) : []), [latestScanId, vulns]);
    const previousVulns = useMemo(() => (previousScanId ? vulns.filter((v) => v.scan_id === previousScanId) : []), [previousScanId, vulns]);
    const diff = useMemo(() => {
        const prevMap = new Map(previousVulns.map(v => [fingerprint(v), v]));
        const latMap = new Map(latestVulns.map(v => [fingerprint(v), v]));
        const entries = [];
        // NEW: in latest but not in previous
        for (const v of latestVulns) {
            if (!prevMap.has(fingerprint(v))) {
                entries.push({ title: v.title, severity: v.severity, asset: v.asset, status: 'new' });
            }
        }
        // FIXED: in previous but not in latest
        for (const v of previousVulns) {
            if (!latMap.has(fingerprint(v))) {
                entries.push({ title: v.title, severity: v.severity, asset: v.asset, status: 'fixed' });
            }
        }
        // PERSISTED: in both
        for (const v of latestVulns) {
            if (prevMap.has(fingerprint(v))) {
                entries.push({ title: v.title, severity: v.severity, asset: v.asset, status: 'persisted' });
            }
        }
        return entries.sort((a, b) => {
            const statusRank = { new: 0, persisted: 1, fixed: 2 };
            if (statusRank[a.status] !== statusRank[b.status])
                return statusRank[a.status] - statusRank[b.status];
            return (SEV_WEIGHT[b.severity] ?? 0) - (SEV_WEIGHT[a.severity] ?? 0);
        });
    }, [latestVulns, previousVulns]);
    if (!latest || !previous) {
        return (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-10 text-center", children: [_jsx(GitCompare, { className: "w-8 h-8 text-slate-700 mx-auto mb-3" }), _jsx("div", { className: "text-sm font-medium text-slate-300", children: "No diff available yet" }), _jsx("div", { className: "text-xs text-slate-500 mt-1", children: "Run at least 2 scans to enable continuous monitoring diff." })] }));
    }
    const newCount = diff.filter(d => d.status === 'new').length;
    const fixedCount = diff.filter(d => d.status === 'fixed').length;
    const persistedCount = diff.filter(d => d.status === 'persisted').length;
    const trend = newCount - fixedCount;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(GitCompare, { className: "w-4 h-4 text-emerald-400" }), _jsx("span", { className: "text-sm font-semibold text-slate-200", children: "Scan Diff" }), _jsxs("span", { className: "text-xs text-slate-500", children: [new Date(previous.created_at).toLocaleDateString(), " \u2192 ", new Date(latest.created_at).toLocaleDateString()] })] }), _jsxs("div", { className: `flex items-center gap-1.5 text-sm font-semibold ${trend > 0 ? 'text-red-400' : trend < 0 ? 'text-emerald-400' : 'text-slate-400'}`, children: [trend > 0 ? _jsx(TrendingUp, { className: "w-4 h-4" }) : trend < 0 ? _jsx(TrendingDown, { className: "w-4 h-4" }) : _jsx(Minus, { className: "w-4 h-4" }), trend > 0 ? `+${trend} new risks` : trend < 0 ? `${Math.abs(trend)} fewer risks` : 'No change'] })] }), _jsxs("div", { className: "flex gap-2 text-xs", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-red-400" }), " ", newCount, " New"] }), _jsxs("span", { className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-400" }), " ", fixedCount, " Fixed"] }), _jsxs("span", { className: "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-600 bg-slate-800/40 text-slate-400", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-slate-500" }), " ", persistedCount, " Persisted"] })] }), _jsxs("div", { className: "divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden max-h-80 overflow-y-auto", children: [diff.map((d, i) => (_jsxs("div", { className: `flex items-center gap-3 px-4 py-2.5 text-sm transition ${d.status === 'new' ? 'bg-red-500/5'
                            : d.status === 'fixed' ? 'bg-emerald-500/5'
                                : 'bg-transparent'}`, children: [_jsx("span", { className: `shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded w-16 text-center ${d.status === 'new' ? 'bg-red-500/20 text-red-300'
                                    : d.status === 'fixed' ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-slate-800 text-slate-500'}`, children: d.status }), _jsx("span", { className: `shrink-0 text-[10px] px-1.5 py-0.5 rounded border capitalize ${SEV_CLASS[d.severity] ?? ''}`, children: d.severity }), _jsx("span", { className: "text-slate-200 truncate flex-1", children: d.title }), _jsx("span", { className: "text-slate-500 font-mono text-xs truncate max-w-[120px]", children: d.asset })] }, i))), diff.length === 0 && (_jsx("div", { className: "px-4 py-8 text-center text-sm text-slate-500", children: "No findings to diff." }))] })] }));
}
