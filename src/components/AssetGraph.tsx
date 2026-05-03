import { useMemo } from 'react';
import { Database, Server, Globe, Shield, Cloud, FileCode, Box } from 'lucide-react';
import { Vulnerability } from '../lib/supabase';

interface Node {
  id: string;
  label: string;
  type: string;
  severity?: string;
  x: number;
  y: number;
}

interface AssetGraphProps {
  projectName: string;
  vulns: Vulnerability[];
}

export default function AssetGraph({ projectName, vulns }: AssetGraphProps) {
  const assets = useMemo(() => {
    const map = new Map<string, { severity: string; count: number }>();
    vulns.forEach(v => {
      const current = map.get(v.asset) || { severity: 'info', count: 0 };
      const weight = (s: string) => ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 }[s] || 0);
      
      if (weight(v.severity) > weight(current.severity)) {
        current.severity = v.severity;
      }
      current.count++;
      map.set(v.asset, current);
    });
    return Array.from(map.entries()).map(([asset, data]) => ({ asset, ...data }));
  }, [vulns]);

  const criticalCount = assets.filter(a => a.severity === 'critical').length;
  const highCount     = assets.filter(a => a.severity === 'high').length;
  const safeCount     = assets.filter(a => a.severity === 'low' || a.severity === 'info').length;

  const nodes = useMemo(() => {
    const center = { x: 300, y: 250 };
    const radius = 180;
    
    const assetNodes: Node[] = assets.map((a, i) => {
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
    return (
      <div className="h-[400px] flex flex-col items-center justify-center border border-slate-800 rounded-xl bg-slate-950/20 text-slate-500 italic text-sm">
        <div className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center mb-3">
          <Globe className="w-6 h-6 opacity-20" />
        </div>
        No assets mapped. Run a scan to discover topology.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <div className="text-lg font-bold text-white">{assets.length}</div>
          <div className="text-[10px] text-slate-500">Assets</div>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <div className="text-lg font-bold text-red-400">{criticalCount}</div>
          <div className="text-[10px] text-slate-500">Critical</div>
        </div>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
          <div className="text-lg font-bold text-orange-400">{highCount}</div>
          <div className="text-[10px] text-slate-500">High risk</div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <div className="text-lg font-bold text-emerald-400">{safeCount}</div>
          <div className="text-[10px] text-slate-500">Low/Safe</div>
        </div>
      </div>
    <div className="relative w-full h-[500px] border border-slate-800 rounded-xl bg-slate-950/50 overflow-hidden">
      <div className="absolute top-4 left-4 flex flex-col gap-1 z-10">
        <h3 className="text-sm font-semibold text-white">Asset Topology</h3>
        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Interactive Network Map</p>
      </div>

      <svg viewBox="0 0 600 500" className="w-full h-full">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Lines */}
        {nodes.filter(n => n.type === 'asset').map(n => (
          <g key={`line-${n.id}`}>
             <line
                x1={300} y1={250}
                x2={n.x} y2={n.y}
                stroke="url(#lineGrad)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                className="animate-[dash_20s_linear_infinite]"
              />
          </g>
        ))}

        {/* Assets */}
        {nodes.map(n => (
          <g key={n.id} className="group transition-all duration-500 cursor-default">
            <title>{n.type === 'project' ? `Project: ${n.label}` : `${n.label} · ${assets.find(a => a.asset === n.id)?.count ?? 0} finding(s) · ${n.severity ?? 'safe'}`}</title>
            {n.type === 'asset' && n.severity === 'critical' && (
              <circle
                cx={n.x} cy={n.y} r={24}
                className="fill-red-500/20 animate-pulse"
                filter="url(#glow)"
              />
            )}
            
            <circle
              cx={n.x} cy={n.y} r={n.type === 'project' ? 28 : 20}
              className={`
                transition-colors duration-300
                ${n.type === 'project' ? 'fill-emerald-500/10 stroke-emerald-500' : 'fill-slate-900 stroke-slate-700'}
                ${n.severity === 'critical' ? 'stroke-red-500 fill-red-500/10' : ''}
                ${n.severity === 'high' ? 'stroke-orange-500 fill-orange-500/10' : ''}
                group-hover:stroke-white
              `}
              strokeWidth="2"
            />

            <foreignObject x={n.x - 10} y={n.y - 10} width={20} height={20}>
              <div className="flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                {n.type === 'project' ? <Shield className="w-5 h-5 text-emerald-400" /> : <AssetIcon label={n.label} />}
              </div>
            </foreignObject>

            <text
              x={n.x}
              y={n.y + (n.type === 'project' ? 45 : 35)}
              textAnchor="middle"
              className="fill-slate-400 group-hover:fill-white text-[10px] font-medium font-sans transition-colors"
            >
              {n.label.split('.')[0].toUpperCase()}
            </text>
          </g>
        ))}
      </svg>

      <div className="absolute bottom-4 right-4 flex items-center gap-4 bg-slate-900/80 backdrop-blur-sm border border-slate-800 px-3 py-2 rounded-lg text-[10px]">
         <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Secure</div>
         <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500" /> Risk</div>
         <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Critical</div>
      </div>

      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -1000; }
        }
      `}</style>
    </div>
    </div>
  );
}

function AssetIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  if (l.includes('db') || l.includes('sql') || l.includes('redis')) return <Database className="w-4 h-4" />;
  if (l.includes('bucket') || l.includes('s3') || l.includes('storage')) return <Box className="w-4 h-4" />;
  if (l.includes('ec2') || l.includes('instance') || l.includes('node')) return <Server className="w-4 h-4" />;
  if (l.includes('api') || l.includes('gw') || l.includes('lb')) return <Globe className="w-4 h-4" />;
  /* c8 ignore next */
  if (l.includes('tf') || l.includes('infra') || l.includes('cloud')) return <Cloud className="w-4 h-4" />;
  /* c8 ignore next */
  if (l.includes('code') || l.includes('git') || l.includes('repo')) return <FileCode className="w-4 h-4" />;
  /* c8 ignore next */
  return <Box className="w-4 h-4" />;
}
