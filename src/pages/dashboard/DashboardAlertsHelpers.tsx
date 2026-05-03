import { Clock } from 'lucide-react';
import { Vulnerability } from '../../lib/supabase';

// ─── SlaGroup component ─────────────────────────────────────────────

export function SlaGroup({ label, tone, rows }: {
  label: string;
  tone: 'red' | 'amber' | 'slate';
  rows: { v: Vulnerability; ageDays: number; budget: number; overdue: boolean; remaining: number }[];
}) {
  const toneCls = {
    red:   'text-red-300 bg-red-500/5 border-red-500/20',
    amber: 'text-amber-300 bg-amber-500/5 border-amber-500/20',
    slate: 'text-slate-300 bg-slate-800/30 border-slate-700',
  }[tone];
  return (
    <div className={`rounded-md border ${toneCls} p-2.5`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-medium mb-2 opacity-80">
        <span>{label}</span><span>{rows.length}</span>
      </div>
      <div className="space-y-2">
        {rows.map(({ v, ageDays, budget, overdue, remaining }) => (
          <div key={v.id} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-slate-100" title={v.title}>{v.title}</span>
              <span className={`shrink-0 font-mono ${overdue ? 'text-red-400' : tone === 'amber' ? 'text-amber-300' : 'text-slate-400'}`}>
                {overdue ? `+${Math.floor(ageDays - budget)}d` : `${Math.max(0, Math.ceil(remaining))}d left`}
              </span>
            </div>
            <div className="mt-1 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${overdue ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                ref={(el) => { if (el) el.style.width = `${Math.min(100, (ageDays / budget) * 100)}%`; }}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" /><span className="uppercase">{v.severity}</span><span>·</span><span>SLA {budget}d</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── StatusBadge component ──────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued:    'bg-slate-700/50 text-slate-300',
    running:   'bg-sky-500/10 text-sky-300 border border-sky-500/20',
    completed: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    failed:    'bg-red-500/10 text-red-300 border border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-1 rounded-md ${map[status] ?? map.queued}`}>
      {status}
    </span>
  );
}
