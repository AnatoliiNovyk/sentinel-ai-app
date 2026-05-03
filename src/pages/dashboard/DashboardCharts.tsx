import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Vulnerability, Project } from '../../lib/supabase';

// ─── Build functions ───────────────────────────────────────────────────────

export function buildTrend(vulns: Vulnerability[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: { day: string; label: string; opened: number; closed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      day: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      opened: 0,
      closed: 0,
    });
  }
  const idx = (iso: string) => buckets.findIndex(b => b.day === iso.slice(0, 10));
  for (const v of vulns) {
    const oi = idx(v.created_at);
    if (oi >= 0) buckets[oi].opened++;
    if ((v.status === 'resolved' || v.status === 'false_positive') && v.status_updated_at) {
      const ci = idx(v.status_updated_at);
      if (ci >= 0) buckets[ci].closed++;
    }
  }
  return buckets;
}

export function buildSeveritySparklines(vulns: Vulnerability[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const critical = Array(days).fill(0);
  const resolved = Array(days).fill(0);
  const projects = Array(days).fill(0).map((_, i) => i + 1);
  const scansArr = Array(days).fill(0);

  for (const v of vulns) {
    const ageDays = Math.floor((today.getTime() - new Date(v.created_at).setHours(0, 0, 0, 0)) / 86_400_000);
    const dayIdx = days - 1 - ageDays;
    if (dayIdx >= 0 && dayIdx < days) {
      if (v.severity === 'critical') critical[dayIdx]++;
      if (v.status === 'resolved') resolved[dayIdx]++;
    }
  }

  return { critical, resolved, projects, scans: scansArr };
}

export function buildScanVelocity(scans: any[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: { day: string; label: string; completed: number; failed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      day: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      completed: 0,
      failed: 0,
    });
  }
  for (const s of scans) {
    const idx = buckets.findIndex(b => b.day === s.created_at.slice(0, 10));
    if (idx < 0) continue;
    if (s.status === 'completed') buckets[idx].completed++;
    else if (s.status === 'failed') buckets[idx].failed++;
  }
  return buckets;
}

export function buildRiskTrend(vulns: Vulnerability[], projects: Project[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: { day: string; label: string; score: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({
      day: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: 0,
    });
  }
  for (const b of buckets) {
    const dayVulns = vulns.filter(v => v.created_at.slice(0, 10) <= b.day && (v.status === 'open' || v.status === 'in_progress'));
    const dayProjects = projects.filter(p => p.created_at.slice(0, 10) <= b.day);
    const totalRisk = dayProjects.reduce((sum, p) => sum + (p.risk_score || 0), 0);
    b.score = Math.round(totalRisk / Math.max(1, dayProjects.length));
  }
  return buckets;
}

// ─── Chart components ──────────────────────────────────────────────────────

export function AreaTrendChart({ trend, max }: { trend: { day: string; label: string; opened: number; closed: number }[]; max: number }) {
  const W = 600, H = 160, pad = 32;
  const w = (W - pad * 2) / Math.max(1, trend.length - 1);
  const h = H - pad * 2;

  const openedPath = trend.map((d, i) => {
    const x = pad + i * w;
    const y = pad + h * (1 - Math.min(1, d.opened / Math.max(1, max)));
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const closedPath = trend.map((d, i) => {
    const x = pad + i * w;
    const y = pad + h * (1 - Math.min(1, d.closed / Math.max(1, max)));
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const openedArea = `${openedPath} L${pad + (trend.length - 1) * w},${pad + h} L${pad},${pad + h} Z`;
  const closedArea = `${closedPath} L${pad + (trend.length - 1) * w},${pad + h} L${pad},${pad + h} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-opened" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="grad-closed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={openedArea} fill="url(#grad-opened)" />
      <path d={openedPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      <path d={closedArea} fill="url(#grad-closed)" />
      <path d={closedPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ScanVelocityChart({ data }: { data: { day: string; label: string; completed: number; failed: number }[] }) {
  const W = 600, H = 160, pad = 32;
  const w = (W - pad * 2) / Math.max(1, data.length - 1);
  const maxVal = Math.max(1, ...data.map(d => d.completed + d.failed));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = pad + i * w;
        const barW = Math.max(2, w * 0.6);
        const completedH = (d.completed / maxVal) * (H - pad * 2);
        const failedH = (d.failed / maxVal) * (H - pad * 2);
        return (
          <g key={d.day}>
            <rect x={x} y={H - pad - completedH} width={barW} height={completedH} fill="#10b981" rx={2} />
            <rect x={x + barW + 1} y={H - pad - failedH} width={barW} height={failedH} fill="#ef4444" rx={2} />
          </g>
        );
      })}
    </svg>
  );
}

export function RiskTrendChart({ data }: { data: { day: string; label: string; score: number }[] }) {
  const W = 600, H = 160, pad = 32;
  const w = (W - pad * 2) / Math.max(1, data.length - 1);
  const h = H - pad * 2;
  const maxScore = Math.max(1, ...data.map(d => d.score));

  const line = data.map((d, i) => {
    const x = pad + i * w;
    const y = pad + h * (1 - d.score / maxScore);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const area = `${line} L${pad + (data.length - 1) * w},${pad + h} L${pad},${pad + h} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-risk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <line key={f} x1={pad} x2={W - pad} y1={pad + h * (1 - f)} y2={pad + h * (1 - f)} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      <path d={area} fill="url(#grad-risk)" />
      <path d={line} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && (
        <circle cx={pad + (data.length - 1) * w} cy={pad + h * (1 - data[data.length - 1].score / maxScore)} r="3" fill="#8b5cf6" />
      )}
    </svg>
  );
}

export function SlaDonut({ pct }: { pct: number }) {
  const R = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * R;
  const dash = (circ * pct) / 100;
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg viewBox="0 0 128 128" className="w-36 h-36">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e293b" strokeWidth="12" />
      <circle
        cx={cx} cy={cy} r={R} fill="none"
        stroke={color} strokeWidth="12"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        className="[transition:stroke-dasharray_0.8s_ease]"
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="monospace">
        {pct}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize="9">
        compliance
      </text>
    </svg>
  );
}

// ─── SparkKpi component ────────────────────────────────────────────────────

export function SparkKpi({ label, value, icon: Icon, accent, sparkData, sparkColor, subLabel, trend }: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: 'emerald' | 'red' | 'sky';
  sparkData: number[];
  sparkColor: string;
  subLabel?: string;
  trend?: number;
}) {
  const accentCls = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    red: 'border-red-500/20 bg-red-500/5 text-red-400',
    sky: 'border-sky-500/20 bg-sky-500/5 text-sky-400',
  }[accent];

  const max = Math.max(1, ...sparkData);
  const W = 100, H = 32, pad = 4;
  const w = (W - pad * 2) / Math.max(1, sparkData.length - 1);

  const line = sparkData.map((v, i) => {
    const x = pad + i * w;
    const y = pad + (H - pad * 2) * (1 - v / max);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  return (
    <div className={`rounded-xl border p-4 ${accentCls}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-red-400' : trend < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3 inline" /> : trend < 0 ? <TrendingDown className="w-3 h-3 inline" /> : <Minus className="w-3 h-3 inline" />}
            {' '}{trend > 0 ? '+' : ''}{trend}
          </span>
        )}
      </div>
      {subLabel && <div className="text-[10px] opacity-70 mt-0.5">{subLabel}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8 mt-2" preserveAspectRatio="none">
        <path d={line} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ─── SummaryPill component ────────────────────────────────────────────────

export function SummaryPill({ label, value, color, suffix, signed }: {
  label: string;
  value: number | string;
  color: string;
  suffix?: string;
  signed?: boolean;
}) {
  const display = signed && typeof value === 'number' && value > 0 ? `+${value}` : value;
  return (
    <div className="text-center">
      <div className={`text-lg font-bold tabular-nums ${color}`}>{display}{suffix && <span className="text-xs ml-0.5">{suffix}</span>}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}
