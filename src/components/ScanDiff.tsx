import { useMemo } from 'react';
import { TrendingDown, TrendingUp, Minus, GitCompare } from 'lucide-react';
import { Scan, Vulnerability } from '../lib/supabase';

type DiffEntry = {
  title: string;
  severity: string;
  asset: string;
  status: 'new' | 'fixed' | 'persisted';
};

const SEV_WEIGHT: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

const SEV_CLASS: Record<string, string> = {
  critical: 'text-red-400 border-red-500/30 bg-red-500/10',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  info: 'text-slate-400 border-slate-700 bg-slate-800/40',
};

function fingerprint(v: Vulnerability): string {
  return `${v.title}|${v.asset}`.toLowerCase().trim();
}

/**
 * F-07: Scan Diff Component — Continuous Monitoring
 * Compares two consecutive scans and shows NEW / FIXED / PERSISTED findings.
 */
export default function ScanDiff({
  scans,
  vulns,
}: {
  scans: Scan[];
  vulns: Vulnerability[];
}) {
  const completed = scans.filter(s => s.status === 'completed');
  const latest = completed[0] ?? null;
  const previous = completed[1] ?? null;
  const latestScanId = latest?.id;
  const previousScanId = previous?.id;
  const latestVulns = useMemo(
    () => (latestScanId ? vulns.filter((v) => v.scan_id === latestScanId) : []),
    [latestScanId, vulns],
  );
  const previousVulns = useMemo(
    () => (previousScanId ? vulns.filter((v) => v.scan_id === previousScanId) : []),
    [previousScanId, vulns],
  );

  const diff: DiffEntry[] = useMemo(() => {
    const prevMap = new Map(previousVulns.map(v => [fingerprint(v), v]));
    const latMap  = new Map(latestVulns.map(v => [fingerprint(v), v]));
    const entries: DiffEntry[] = [];

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
      if (statusRank[a.status] !== statusRank[b.status]) return statusRank[a.status] - statusRank[b.status];
      return (SEV_WEIGHT[b.severity] ?? 0) - (SEV_WEIGHT[a.severity] ?? 0);
    });
  }, [latestVulns, previousVulns]);

  if (!latest || !previous) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center">
        <GitCompare className="w-8 h-8 text-slate-700 mx-auto mb-3" />
        <div className="text-sm font-medium text-slate-300">No diff available yet</div>
        <div className="text-xs text-slate-500 mt-1">
          Run at least 2 scans to enable continuous monitoring diff.
        </div>
      </div>
    );
  }

  const newCount       = diff.filter(d => d.status === 'new').length;
  const fixedCount     = diff.filter(d => d.status === 'fixed').length;
  const persistedCount = diff.filter(d => d.status === 'persisted').length;
  const trend          = newCount - fixedCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">Scan Diff</span>
          <span className="text-xs text-slate-500">
            {new Date(previous.created_at).toLocaleDateString()} → {new Date(latest.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${
          trend > 0 ? 'text-red-400' : trend < 0 ? 'text-emerald-400' : 'text-slate-400'
        }`}>
          {trend > 0 ? <TrendingUp className="w-4 h-4" /> : trend < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          {trend > 0 ? `+${trend} new risks` : trend < 0 ? `${Math.abs(trend)} fewer risks` : 'No change'}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> {newCount} New
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {fixedCount} Fixed
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-600 bg-slate-800/40 text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> {persistedCount} Persisted
        </span>
      </div>

      {/* Diff list */}
      <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden max-h-80 overflow-y-auto">
        {diff.map((d, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
              d.status === 'new'       ? 'bg-red-500/5'
              : d.status === 'fixed'  ? 'bg-emerald-500/5'
              : 'bg-transparent'
            }`}
          >
            <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded w-16 text-center ${
              d.status === 'new'       ? 'bg-red-500/20 text-red-300'
              : d.status === 'fixed'  ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-slate-800 text-slate-500'
            }`}>
              {d.status}
            </span>
            <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border capitalize ${SEV_CLASS[d.severity] ?? ''}`}>
              {d.severity}
            </span>
            <span className="text-slate-200 truncate flex-1">{d.title}</span>
            <span className="text-slate-500 font-mono text-xs truncate max-w-[120px]">{d.asset}</span>
          </div>
        ))}
        {diff.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No findings to diff.</div>
        )}
      </div>
    </div>
  );
}
