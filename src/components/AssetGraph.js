import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Database, Server, Globe, Shield, Cloud, FileCode, Box } from 'lucide-react';
export default function AssetGraph({ projectName, vulns }) {
    const assets = useMemo(() => {
        const map = new Map();
        vulns.forEach(v => {
            const current = map.get(v.asset) || { severity: 'info', count: 0 };
            const weight = (s) => ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[s] || 0);
            if (weight(v.severity) > weight(current.severity)) {
                current.severity = v.severity;
            }
            current.count++;
            map.set(v.asset, current);
        });
        return Array.from(map.entries()).map(([asset, data]) => ({ asset, ...data }));
    }, [vulns]);
    const nodes = useMemo(() => {
        const center = { x: 300, y: 250 };
        const radius = 180;
        const assetNodes = assets.map((a, i) => {
            const angle = (i / assets.length) * 2 * Math.PI - Math.PI / 2;
            return {
                id: a.asset,
                label: a.asset,
                type: 'asset',
                severity: a.severity,
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
            };
        });
        return [
            { id: 'center', label: projectName, type: 'project', x: center.x, y: center.y },
            ...assetNodes
        ];
    }, [assets, projectName]);
    if (vulns.length === 0) {
        return (_jsxs("div", { className: "h-[400px] flex flex-col items-center justify-center border border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 italic text-sm", children: [_jsx("div", { className: "w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center mb-3", children: _jsx(Globe, { className: "w-6 h-6 opacity-20" }) }), "No assets mapped. Run a scan to discover topology."] }));
    }
    return (_jsxs("div", { className: "relative w-full h-[500px] border border-slate-800 rounded-xl bg-slate-950/50 overflow-hidden", children: [_jsxs("div", { className: "absolute top-4 left-4 flex flex-col gap-1 z-10", children: [_jsx("h3", { className: "text-sm font-semibold text-white", children: "Asset Topology" }), _jsx("p", { className: "text-[10px] text-slate-500 uppercase tracking-widest", children: "Interactive Network Map" })] }), _jsxs("svg", { viewBox: "0 0 600 500", className: "w-full h-full", children: [_jsxs("defs", { children: [_jsxs("filter", { id: "glow", children: [_jsx("feGaussianBlur", { stdDeviation: "3.5", result: "coloredBlur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "coloredBlur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] }), _jsxs("linearGradient", { id: "lineGrad", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [_jsx("stop", { offset: "0%", stopColor: "#10b981", stopOpacity: "0.2" }), _jsx("stop", { offset: "100%", stopColor: "#10b981", stopOpacity: "0" })] })] }), nodes.filter(n => n.type === 'asset').map(n => (_jsx("g", { children: _jsx("line", { x1: 300, y1: 250, x2: n.x, y2: n.y, stroke: "url(#lineGrad)", strokeWidth: "1.5", strokeDasharray: "4 4", className: "animate-[dash_20s_linear_infinite]" }) }, `line-${n.id}`))), nodes.map(n => (_jsxs("g", { className: "group transition-all duration-500 cursor-default", children: [n.type === 'asset' && n.severity === 'critical' && (_jsx("circle", { cx: n.x, cy: n.y, r: 24, className: "fill-red-500/20 animate-pulse", filter: "url(#glow)" })), _jsx("circle", { cx: n.x, cy: n.y, r: n.type === 'project' ? 28 : 20, className: `
                transition-colors duration-300
                ${n.type === 'project' ? 'fill-emerald-500/10 stroke-emerald-500' : 'fill-slate-900 stroke-slate-700'}
                ${n.severity === 'critical' ? 'stroke-red-500 fill-red-500/10' : ''}
                ${n.severity === 'high' ? 'stroke-orange-500 fill-orange-500/10' : ''}
                group-hover:stroke-white
              `, strokeWidth: "2" }), _jsx("foreignObject", { x: n.x - 10, y: n.y - 10, width: 20, height: 20, children: _jsx("div", { className: "flex items-center justify-center text-slate-400 group-hover:text-white transition-colors", children: n.type === 'project' ? _jsx(Shield, { className: "w-5 h-5 text-emerald-400" }) : _jsx(AssetIcon, { label: n.label }) }) }), _jsx("text", { x: n.x, y: n.y + (n.type === 'project' ? 45 : 35), textAnchor: "middle", className: "fill-slate-400 group-hover:fill-white text-[10px] font-medium font-sans transition-colors", children: n.label.split('.')[0].toUpperCase() })] }, n.id)))] }), _jsxs("div", { className: "absolute bottom-4 right-4 flex items-center gap-4 bg-slate-900/80 backdrop-blur-sm border border-slate-800 px-3 py-2 rounded-lg text-[10px]", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500" }), " Secure"] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-orange-500" }), " Risk"] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-red-500 animate-pulse" }), " Critical"] })] }), _jsx("style", { children: `
        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      ` })] }));
}
function AssetIcon({ label }) {
    const l = label.toLowerCase();
    if (l.includes('db') || l.includes('sql') || l.includes('redis'))
        return _jsx(Database, { className: "w-4 h-4" });
    if (l.includes('bucket') || l.includes('s3') || l.includes('storage'))
        return _jsx(Box, { className: "w-4 h-4" });
    if (l.includes('ec2') || l.includes('instance') || l.includes('node'))
        return _jsx(Server, { className: "w-4 h-4" });
    if (l.includes('api') || l.includes('gw') || l.includes('lb'))
        return _jsx(Globe, { className: "w-4 h-4" });
    if (l.includes('tf') || l.includes('infra') || l.includes('cloud'))
        return _jsx(Cloud, { className: "w-4 h-4" });
    if (l.includes('code') || l.includes('git') || l.includes('repo'))
        return _jsx(FileCode, { className: "w-4 h-4" });
    return _jsx(Box, { className: "w-4 h-4" });
}
