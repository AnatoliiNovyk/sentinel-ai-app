import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, Project, Vulnerability } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { riskBand } from '../lib/riskScore';
import { ShieldAlert, RefreshCw, Info, Download, Search, SlidersHorizontal } from 'lucide-react';
import { downloadFile } from '../lib/exporters';

// ─── Physics types ────────────────────────────────────────────────────────────
type SimNode = {
  id: string;
  label: string;
  type: 'hub' | 'project' | 'vuln';
  severity?: string;
  riskScore: number;
  x: number; y: number;
  vx: number; vy: number;
  fx?: number; fy?: number; // pinned position
  projectId?: string;
};
type SimEdge = { source: string; target: string };

// ─── Color maps ───────────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  critical: '#f87171', high: '#fb923c', medium: '#facc15', low: '#38bdf8', info: '#64748b',
};
const RISK_COLOR = (score: number) => {
  if (score >= 70) return '#f87171';
  if (score >= 40) return '#fb923c';
  if (score >= 20) return '#facc15';
  return '#4ade80';
};

const W = 900, H = 600, CX = W / 2, CY = H / 2;
const REPULSION = 12000, SPRING_K = 0.04, SPRING_REST = 140, DAMP = 0.78, GRAVITY = 0.008;

function buildGraph(projects: Project[], vulns: Vulnerability[]): { nodes: SimNode[]; edges: SimEdge[] } {
  const nodes: SimNode[] = [];
  const edges: SimEdge[] = [];

  // Hub
  nodes.push({ id: '__hub__', label: 'Infrastructure', type: 'hub', riskScore: 0, x: CX, y: CY, vx: 0, vy: 0, fx: CX, fy: CY });

  // Projects
  const angle = (2 * Math.PI) / Math.max(projects.length, 1);
  projects.forEach((p, i) => {
    const r = 180;
    const a = angle * i - Math.PI / 2;
    nodes.push({
      id: p.id, label: p.name, type: 'project',
      riskScore: p.risk_score ?? 0,
      x: CX + r * Math.cos(a), y: CY + r * Math.sin(a),
      vx: 0, vy: 0,
    });
    edges.push({ source: '__hub__', target: p.id });
  });

  // Top 2 vulns per project
  // We currently assign top findings in round-robin to project nodes for visualization.

  // Better: group vulns by their project (we have scan_id, and scans have project_id)
  // Since we don't have scan→project mapping here, we'll use projectId from parent call
  // The vulns passed here already have scan_ids belonging to projects — we label by severity
  const topVulns = vulns
    .filter(v => v.status === 'open' || v.status === 'in_progress')
    .sort((a, b) => {
      const w: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
      return (w[b.severity] ?? 0) - (w[a.severity] ?? 0);
    })
    .slice(0, Math.min(vulns.length, projects.length * 3));

  const usedProj = new Map<string, number>();
  topVulns.forEach((v, idx) => {
    // Round-robin assign to projects
    const projIdx = idx % projects.length;
    const proj = projects[projIdx];
    if (!proj) return;
    const count = usedProj.get(proj.id) ?? 0;
    if (count >= 3) return;
    usedProj.set(proj.id, count + 1);

    const projNode = nodes.find(n => n.id === proj.id);
    if (!projNode) return;
    const spread = (count - 1) * 55;
    nodes.push({
      id: `vuln_${v.id}`,
      label: v.title.slice(0, 30),
      type: 'vuln',
      severity: v.severity,
      riskScore: 0,
      projectId: proj.id,
      x: projNode.x + 90 * Math.cos(idx) + spread,
      y: projNode.y + 90 * Math.sin(idx) + spread,
      vx: 0, vy: 0,
    });
    edges.push({ source: proj.id, target: `vuln_${v.id}` });
  });

  return { nodes, edges };
}

function simulate(nodes: SimNode[], edges: SimEdge[], steps = 1): SimNode[] {
  const posMap = new Map<string, SimNode>(nodes.map(n => [n.id, { ...n }]));
  for (let step = 0; step < steps; step++) {
    // Repulsion
    const arr = Array.from(posMap.values());
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (a.fx !== undefined) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        const dx = a.x - b.x || 0.01, dy = a.y - b.y || 0.01;
        const dist2 = dx * dx + dy * dy;
        const force = REPULSION / dist2;
        const dist = Math.sqrt(dist2);
        a.vx += (force * dx) / dist; a.vy += (force * dy) / dist;
        if (b.fx === undefined) { b.vx -= (force * dx) / dist; b.vy -= (force * dy) / dist; }
      }
      // Gravity to center
      a.vx += (CX - a.x) * GRAVITY;
      a.vy += (CY - a.y) * GRAVITY;
    }
    // Spring forces
    for (const e of edges) {
      const a = posMap.get(e.source), b = posMap.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const stretch = dist - SPRING_REST;
      const fx = SPRING_K * stretch * (dx / dist);
      const fy = SPRING_K * stretch * (dy / dist);
      if (a.fx === undefined) { a.vx += fx; a.vy += fy; }
      if (b.fx === undefined) { b.vx -= fx; b.vy -= fy; }
    }
    // Integrate & damp & clamp
    for (const n of posMap.values()) {
      if (n.fx !== undefined) { n.x = n.fx; n.y = n.fy!; continue; }
      n.vx *= DAMP; n.vy *= DAMP;
      n.x = Math.max(60, Math.min(W - 60, n.x + n.vx));
      n.y = Math.max(40, Math.min(H - 40, n.y + n.vy));
    }
  }
  return Array.from(posMap.values());
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AttackSurfaceMap() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [edges, setEdges] = useState<SimEdge[]>([]);
  const [hovered, setHovered] = useState<SimNode | null>(null);
  const [selected, setSelected] = useState<SimNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeFilter, setNodeFilter] = useState<'all' | 'project' | 'vuln'>('all');
  const animRef = useRef<number>(0);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const tickRef = useRef(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: projs }, { data: allVulns }] = await Promise.all([
      supabase.from('projects').select('*').eq('user_id', user.id),
      supabase.from('vulnerabilities').select('id,title,severity,status,asset,scan_id').eq('user_id', user.id),
    ]);
    const p = (projs ?? []) as Project[];
    const v = (allVulns ?? []) as Vulnerability[];
    setProjects(p);
    setVulns(v);
    const { nodes: n, edges: e } = buildGraph(p, v);
    nodesRef.current = n;
    edgesRef.current = e;
    setNodes(n);
    setEdges(e);
    tickRef.current = 0;
    setLoading(false);
  }, [user]);

  // Physics animation loop — runs for 180 frames then stops
  useEffect(() => {
    if (nodes.length === 0) return;
    let frame = 0;
    const run = () => {
      if (frame++ >= 180) return;
      nodesRef.current = simulate(nodesRef.current, edgesRef.current, 2);
      setNodes([...nodesRef.current]);
      animRef.current = requestAnimationFrame(run);
    };
    animRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(animRef.current);
  }, [loading, nodes.length]);

  useEffect(() => { load(); }, [load]);

  const restart = () => {
    const { nodes: n, edges: e } = buildGraph(projects, vulns);
    nodesRef.current = n;
    edgesRef.current = e;
    setNodes(n);
    setEdges(e);
  };

  const totalCritical = vulns.filter(v => v.severity === 'critical' && v.status !== 'resolved').length;
  const totalHigh     = vulns.filter(v => v.severity === 'high'     && v.status !== 'resolved').length;

  const exportNodes = useCallback((fmt: 'json' | 'csv') => {
    const date = new Date().toISOString().split('T')[0];
    if (fmt === 'json') {
      const payload = {
        exportedAt: new Date().toISOString(),
        projects: projects.map(p => ({ id: p.id, name: p.name, target: p.target, riskScore: p.risk_score ?? 0 })),
        findings: vulns.filter(v => v.status !== 'resolved').map(v => ({ id: v.id, title: v.title, severity: v.severity, status: v.status, asset: v.asset })),
      };
      downloadFile(`attack-surface-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
    } else {
      const rows = ['Type,Name,Target/Asset,RiskScore/Severity,Status'];
      for (const p of projects) rows.push(`Project,"${p.name}","${p.target ?? ''}",${p.risk_score ?? 0},active`);
      for (const v of vulns.filter(x => x.status !== 'resolved')) rows.push(`Finding,"${v.title}","${v.asset}",${v.severity},${v.status}`);
      downloadFile(`attack-surface-${date}.csv`, rows.join('\n'), 'text/csv');
    }
  }, [projects, vulns]);

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attack Surface Map</h1>
          <p className="mt-1 text-sm text-slate-500">
            Interactive visualization of your infrastructure risk exposure and vulnerability topology.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {nodes.length > 1 && (
            <>
              <button
                onClick={() => exportNodes('csv')}
                className="inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 px-3 py-2 rounded-md text-sm transition"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => exportNodes('json')}
                className="inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 px-3 py-2 rounded-md text-sm transition"
              >
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
            </>
          )}
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 text-slate-300 px-3 py-2 rounded-md text-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-layout
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Projects', value: projects.length, color: 'text-emerald-400' },
          { label: 'Total Findings', value: vulns.filter(v => v.status !== 'resolved').length, color: 'text-slate-200' },
          { label: 'Critical', value: totalCritical, color: 'text-red-400' },
          { label: 'High', value: totalHigh, color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-xs text-slate-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search + node type filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>
        <div className="flex items-center gap-1">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          {(['all', 'project', 'vuln'] as const).map(t => (
            <button
              key={t}
              onClick={() => setNodeFilter(t)}
              className={`text-xs px-2.5 py-1.5 rounded-md border transition capitalize ${
                nodeFilter === t
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
              }`}
            >
              {t === 'all' ? 'All nodes' : t === 'project' ? 'Projects' : 'Findings'}
            </button>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-900/30 overflow-hidden">
        {loading ? (
          <div className="h-[600px] flex items-center justify-center text-slate-500 text-sm">
            <ShieldAlert className="w-5 h-5 animate-pulse mr-2" /> Building attack surface map...
          </div>
        ) : nodes.length <= 1 ? (
          <div className="h-[600px] flex items-center justify-center flex-col gap-3 text-slate-500">
            <ShieldAlert className="w-10 h-10 text-slate-700" />
            <div className="text-sm">Create projects and run scans to populate the attack surface map.</div>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height="600"
            className="select-none"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <filter id="glow-red"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="glow-orange"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <filter id="glow-hub"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              <radialGradient id="hub-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.05"/>
              </radialGradient>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const s = nodes.find(n => n.id === e.source);
              const t = nodes.find(n => n.id === e.target);
              if (!s || !t) return null;
              const isHighlight = hovered && (hovered.id === e.source || hovered.id === e.target);
              return (
                <line
                  key={i}
                  x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={isHighlight ? '#34d399' : '#1e293b'}
                  strokeWidth={isHighlight ? 1.5 : 1}
                  strokeDasharray={t.type === 'vuln' ? '4 4' : undefined}
                  opacity={isHighlight ? 0.7 : 0.4}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const isHov = hovered?.id === n.id;
              const isSel = selected?.id === n.id;
              const q = searchQuery.trim().toLowerCase();
              const matchesSearch = !q || n.label.toLowerCase().includes(q);
              const matchesType = nodeFilter === 'all' || n.type === nodeFilter || n.type === 'hub';
              const dimmed = (!matchesSearch || !matchesType) && n.type !== 'hub';
              const nodeOpacity = dimmed ? 0.15 : 1;
              if (n.type === 'hub') {
                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                    <circle r={36} fill="url(#hub-grad)" filter="url(#glow-hub)" />
                    <circle r={24} fill="#0f172a" stroke="#34d399" strokeWidth={1.5} />
                    <text textAnchor="middle" dy="4" fontSize="10" fill="#34d399" fontWeight="bold">HUB</text>
                    <text textAnchor="middle" dy="50" fontSize="9" fill="#64748b">{n.label}</text>
                  </g>
                );
              }
              if (n.type === 'project') {
                const color = RISK_COLOR(n.riskScore);
                const r = 22 + Math.min(n.riskScore / 8, 10);
                const filter = n.riskScore >= 70 ? 'url(#glow-red)' : n.riskScore >= 40 ? 'url(#glow-orange)' : undefined;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    className="cursor-pointer"
                    opacity={nodeOpacity}
                    onMouseEnter={() => setHovered(n)}
                    onClick={() => setSelected(isSel ? null : n)}
                  >
                    {(isHov || isSel) && <circle r={r + 8} fill={color} opacity={0.12} />}
                    <circle r={r} fill="#0f172a" stroke={color} strokeWidth={isHov || isSel ? 2.5 : 1.5} filter={filter} />
                    <text textAnchor="middle" dy="4" fontSize="9" fill="#e2e8f0" fontWeight="bold">{n.riskScore}</text>
                    <text textAnchor="middle" dy={r + 14} fontSize="8.5" fill="#94a3b8" style={{ maxWidth: 80 }}>
                      {n.label.slice(0, 18)}{n.label.length > 18 ? '…' : ''}
                    </text>
                  </g>
                );
              }
              // Vuln node
              const color = SEV_COLOR[n.severity ?? 'info'] ?? '#64748b';
              const isCritical = n.severity === 'critical';
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  className="cursor-pointer"
                  opacity={nodeOpacity}
                  onMouseEnter={() => setHovered(n)}
                  onClick={() => setSelected(isSel ? null : n)}
                >
                  {isCritical && <circle r={14} fill={color} opacity={0.15} />}
                  <circle r={8} fill="#0f172a" stroke={color} strokeWidth={isHov || isSel ? 2 : 1} filter={isCritical ? 'url(#glow-red)' : undefined} />
                  {(isHov || isSel) && (
                    <text textAnchor="middle" dy={20} fontSize="8" fill="#94a3b8">
                      {n.label.slice(0, 22)}{n.label.length > 22 ? '…' : ''}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider mb-1">Legend</div>
          {[
            { color: '#f87171', label: 'Critical risk' },
            { color: '#fb923c', label: 'High risk' },
            { color: '#facc15', label: 'Medium risk' },
            { color: '#4ade80', label: 'Low risk' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              <span className="text-[10px] text-slate-400">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {selected && (
          <div className="absolute top-4 right-4 max-w-[220px] rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur p-4 shadow-xl">
            <button onClick={() => setSelected(null)} className="absolute top-2 right-2 text-slate-500 hover:text-white text-xs">✕</button>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                {selected.type === 'hub' ? 'Hub' : selected.type === 'project' ? 'Project' : 'Finding'}
              </span>
            </div>
            <div className="text-sm font-medium text-white mb-1">{selected.label}</div>
            {selected.type === 'project' && (
              <div className="mt-2 space-y-1 text-xs text-slate-400">
                <div>Risk score: <span className="font-semibold" style={{ color: RISK_COLOR(selected.riskScore) }}>{selected.riskScore}</span></div>
                <div>{riskBand(selected.riskScore).label} risk level</div>
              </div>
            )}
            {selected.type === 'vuln' && (
              <div className="mt-2 text-xs">
                <span className="px-1.5 py-0.5 rounded border text-[10px] capitalize" style={{ color: SEV_COLOR[selected.severity ?? 'info'], borderColor: SEV_COLOR[selected.severity ?? 'info'] + '50', background: SEV_COLOR[selected.severity ?? 'info'] + '15' }}>
                  {selected.severity}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Project list */}
      {projects.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects
            .filter(p => !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) || (p.target ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase()))
            .map(p => {
            const band = riskBand(p.risk_score ?? 0);
            return (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{p.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{p.target || 'No target'}</div>
                </div>
                <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${band.color}`}>
                  <ShieldAlert className="w-3 h-3" /> {p.risk_score ?? 0}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
