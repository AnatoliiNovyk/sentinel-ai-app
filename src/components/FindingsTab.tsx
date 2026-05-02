import { useMemo, useState, useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, CheckSquare, ChevronDown, ChevronRight, Download, Filter, Pencil, Save, Search, Server, ShieldOff, Sparkles, Square, Timer, X } from 'lucide-react';
import { supabase, Vulnerability, VULN_STATUSES, DEFAULT_SLA_CONFIG } from '../lib/supabase';
import { downloadFile, toCsvExport } from '../lib/exporters';
import { recomputeRiskScoreFromScanId } from '../lib/riskScore';
import { useAuth } from '../context/useAuth';
import { usePresence } from '../context/PresenceContext';
import { PresenceAvatars } from './PresenceAvatars';
import { CommentThread } from './CommentThread';
import { RemediationAssistant } from './RemediationAssistant';

type SlaFilter = 'all' | 'overdue' | 'at_risk';

function slaStateFor(
  v: Vulnerability,
  sla: Record<'critical' | 'high' | 'medium' | 'low', number>,
  now: number,
): 'overdue' | 'at_risk' | 'healthy' | 'na' {
  if (v.status !== 'open' && v.status !== 'in_progress') return 'na';
  if (v.severity === 'info') return 'na';
  /* c8 ignore next 2 */
  const budget = sla[v.severity as 'critical' | 'high' | 'medium' | 'low'] ?? 30;
  const ageDays = (now - new Date(v.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > budget) return 'overdue';
  if (ageDays / budget >= 0.75) return 'at_risk';
  return 'healthy';
}

type StatusValue = Vulnerability['status'];

const STATUS_META: Record<StatusValue, { label: string; tone: string; dot: string }> = {
  open: { label: 'Open', tone: 'text-red-300 border-red-500/30 bg-red-500/10', dot: 'bg-red-400' },
  in_progress: { label: 'In progress', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10', dot: 'bg-sky-400' },
  accepted: { label: 'Accepted risk', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10', dot: 'bg-amber-400' },
  resolved: { label: 'Resolved', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-400' },
  false_positive: { label: 'False positive', tone: 'text-slate-300 border-slate-700 bg-slate-800/60', dot: 'bg-slate-400' },
};

const SEVERITY_WEIGHT: Record<Vulnerability['severity'], number> = {
  critical: 5, high: 4, medium: 3, low: 2, info: 1,
};

function severityClass(s: Vulnerability['severity']): string {
  return {
    critical: 'text-red-400 border-red-500/30 bg-red-500/10',
    high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    info: 'text-slate-400 border-slate-700 bg-slate-800/40',
  }[s];
}

export default function FindingsTab({
  vulns,
  onUpdated,
}: {
  vulns: Vulnerability[];
  onUpdated: (next: Vulnerability) => void;
}) {
  const { profile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<'all' | StatusValue>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | Vulnerability['severity']>('all');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [assetPanelOpen, setAssetPanelOpen] = useState(false);

  const slaConfig = useMemo(
    () => ({ ...DEFAULT_SLA_CONFIG, ...(profile?.sla_config ?? {}) }),
    [profile?.sla_config],
  );
  const now = Date.now();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: vulns.length };
    for (const s of VULN_STATUSES) c[s] = 0;
    for (const v of vulns) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [vulns]);

  const slaCounts = useMemo(() => {
    let overdue = 0;
    let atRisk = 0;
    for (const v of vulns) {
      const s = slaStateFor(v, slaConfig, now);
      if (s === 'overdue') overdue++;
      else if (s === 'at_risk') atRisk++;
    }
    return { overdue, atRisk };
  }, [vulns, slaConfig, now]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...vulns]
      .filter((v) => (statusFilter === 'all' ? true : v.status === statusFilter))
      .filter((v) => (severityFilter === 'all' ? true : v.severity === severityFilter))
      .filter((v) => {
        if (slaFilter === 'all') return true;
        const s = slaStateFor(v, slaConfig, now);
        return slaFilter === 'overdue' ? s === 'overdue' : s === 'at_risk';
      })
      .filter((v) => !q ||
        v.title.toLowerCase().includes(q) ||
        (v.cve_id ?? '').toLowerCase().includes(q) ||
        (v.description ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (a.status !== b.status) {
          const aOpen = a.status === 'open' || a.status === 'in_progress' ? 0 : 1;
          const bOpen = b.status === 'open' || b.status === 'in_progress' ? 0 : 1;
          if (aOpen !== bOpen) return aOpen - bOpen;
        }
        return SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
      });
  }, [vulns, statusFilter, severityFilter, slaFilter, slaConfig, now, search]);

  const allFilteredIds = useMemo(() => filtered.map(v => v.id), [filtered]);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  }, [allSelected, allFilteredIds]);

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const assetBreakdown = useMemo(() => {
    const map = new Map<string, Record<Vulnerability['severity'], number> & { total: number }>();
    for (const v of filtered) {
      const key = v.asset || '(unknown)';
      if (!map.has(key)) map.set(key, { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 });
      const entry = map.get(key)!;
      entry[v.severity]++;
      entry.total++;
    }
    return [...map.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
  }, [filtered]);

  const bulkChangeStatus = useCallback(async (status: StatusValue) => {
    if (!someSelected) return;
    setBulkSaving(true);
    const ids = [...selected];
    const { data } = await supabase
      .from('vulnerabilities')
      .update({ status, status_updated_at: new Date().toISOString() })
      .in('id', ids)
      .select();
    if (data) {
      for (const v of data as Vulnerability[]) onUpdated(v);
      const scanIds = [...new Set((data as Vulnerability[]).map(v => v.scan_id))];
      scanIds.forEach(sid => recomputeRiskScoreFromScanId(sid).catch(() => {}));
    }
    setSelected(new Set());
    setBulkSaving(false);
  }, [selected, someSelected, onUpdated]);

  if (vulns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
        <div className="text-sm text-slate-400">No findings to triage. Run a scan to populate this view.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.all, color: 'text-slate-200', active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
          { label: 'Open', value: (counts.open ?? 0) + (counts.in_progress ?? 0), color: 'text-red-400', active: statusFilter === 'open', onClick: () => setStatusFilter('open') },
          { label: 'SLA Overdue', value: slaCounts.overdue, color: 'text-rose-400', active: slaFilter === 'overdue', onClick: () => setSlaFilter(slaFilter === 'overdue' ? 'all' : 'overdue') },
          { label: 'Resolved', value: counts.resolved ?? 0, color: 'text-emerald-400', active: statusFilter === 'resolved', onClick: () => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved') },
        ].map(c => (
          <button
            key={c.label}
            onClick={c.onClick}
            className={`rounded-xl border p-4 text-left w-full transition ${
              c.active ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
            }`}
          >
            <div className="text-xs text-slate-400 mb-1">{c.label}</div>
            <div className={`text-3xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search findings by title, CVE, or description…"
          className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-8 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 pr-2">
          <Filter className="w-3.5 h-3.5" /> Status
        </div>
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
          All <span className="ml-1 text-slate-500">({counts.all})</span>
        </FilterPill>
        {VULN_STATUSES.map((s) => (
          <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_META[s].dot}`} />
            {STATUS_META[s].label}
            <span className="ml-1 text-slate-500">({counts[s] ?? 0})</span>
          </FilterPill>
        ))}
        <div className="w-px h-5 bg-slate-800 mx-2" />
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 pr-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Severity
        </div>
        {(['all', 'critical', 'high', 'medium', 'low', 'info'] as const).map((s) => (
          <FilterPill key={s} active={severityFilter === s} onClick={() => setSeverityFilter(s)}>
            <span className="capitalize">{s}</span>
          </FilterPill>
        ))}
        <div className="w-px h-5 bg-slate-800 mx-2" />
        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 pr-2">
          <Timer className="w-3.5 h-3.5" /> SLA
        </div>
        <FilterPill active={slaFilter === 'all'} onClick={() => setSlaFilter('all')}>
          Any
        </FilterPill>
        <FilterPill active={slaFilter === 'overdue'} onClick={() => setSlaFilter('overdue')}>
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-red-400" />
          Overdue <span className="ml-1 text-slate-500">({slaCounts.overdue})</span>
        </FilterPill>
        <FilterPill active={slaFilter === 'at_risk'} onClick={() => setSlaFilter('at_risk')}>
          <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 bg-amber-400" />
          At risk <span className="ml-1 text-slate-500">({slaCounts.atRisk})</span>
        </FilterPill>
        <div className="ml-auto">
          <button
            onClick={() =>
              downloadFile(
                `findings_${statusFilter}_${severityFilter}_sla-${slaFilter}.csv`,
                toCsvExport(filtered),
                'text/csv'
              )
            }
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 disabled:opacity-50 px-2.5 py-1.5 rounded-md transition text-slate-300"
            title="Export filtered findings as CSV"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-2.5">
          <span className="text-xs text-sky-300 font-semibold mr-2">
            {selected.size} selected
          </span>
          {([
            { status: 'resolved' as StatusValue, label: 'Resolve', color: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
            { status: 'false_positive' as StatusValue, label: 'False positive', color: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
            { status: 'accepted' as StatusValue, label: 'Accept risk', color: 'bg-amber-700 hover:bg-amber-600 text-amber-100' },
            { status: 'in_progress' as StatusValue, label: 'In progress', color: 'bg-sky-700 hover:bg-sky-600 text-sky-100' },
          ]).map(({ status, label, color }) => (
            <button
              key={status}
              onClick={() => bulkChangeStatus(status)}
              disabled={bulkSaving}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition disabled:opacity-50 ${color}`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-slate-500 hover:text-white transition"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Asset Breakdown Panel */}
      {assetBreakdown.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
          <button
            onClick={() => setAssetPanelOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-800/30 transition"
            aria-expanded={assetPanelOpen}
            aria-label="Findings by asset"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Server className="w-3.5 h-3.5 text-teal-400" />
              Findings by asset
              <span className="text-slate-600 font-normal">
                (top {assetBreakdown.length})
              </span>
            </span>
            {assetPanelOpen
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            }
          </button>
          {assetPanelOpen && (
            <div className="border-t border-slate-800 divide-y divide-slate-800/60">
              {assetBreakdown.map(([asset, counts]) => {
                const maxTotal = assetBreakdown[0][1].total;
                const pct = Math.round((counts.total / maxTotal) * 100);
                return (
                  <div key={asset} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-slate-300 truncate max-w-[240px]" title={asset}>{asset}</span>
                        <span className="text-xs text-slate-500 tabular-nums shrink-0 ml-2">{counts.total}</span>
                      </div>
                      <div className="flex items-center gap-1.5 h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-slate-800 flex-1 overflow-hidden"
                          aria-label={`${asset} bar`}
                        >
                          <div
                            className="h-full rounded-full bg-teal-500/70 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['critical', 'high', 'medium', 'low'] as const).map(sev => counts[sev] > 0 && (
                        <span
                          key={sev}
                          className={`text-[10px] px-1.5 py-0.5 rounded border tabular-nums ${severityClass(sev)}`}
                          title={`${sev}: ${counts[sev]}`}
                        >
                          {counts[sev]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldOff className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <div className="text-sm text-slate-400">No findings match the current filters.</div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-2 bg-slate-900/50">
              <button
                onClick={toggleAll}
                className="text-slate-500 hover:text-emerald-400 transition shrink-0"
                aria-label={allSelected ? 'Deselect all' : 'Select all'}
              >
                {allSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
              </button>
              <span className="text-[11px] text-slate-600">
                {allSelected ? 'Deselect all' : `Select all (${filtered.length})`}
              </span>
            </div>
            {filtered.map((v) => (
              <FindingRow
                key={v.id}
                vuln={v}
                slaState={slaStateFor(v, slaConfig, now)}
                expanded={expanded === v.id}
                selected={selected.has(v.id)}
                onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
                onSelect={() => toggleOne(v.id)}
                onUpdated={onUpdated}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center text-xs px-2.5 py-1 rounded-md border transition ${
        active
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function FindingRow({
  vuln,
  slaState,
  expanded,
  selected,
  onToggle,
  onSelect,
  onUpdated,
}: {
  vuln: Vulnerability;
  slaState: 'overdue' | 'at_risk' | 'healthy' | 'na';
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onUpdated: (next: Vulnerability) => void;
}) {
  const { updatePresence } = usePresence();
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(vuln.note);
  const [saving, setSaving] = useState(false);

  // Track presence when expanded
  useEffect(() => {
    if (expanded) {
      updatePresence('finding', vuln.id);
    }
  }, [expanded, vuln.id, updatePresence]);

  const changeStatus = async (status: StatusValue) => {
    setSaving(true);
    const { data } = await supabase
      .from('vulnerabilities')
      .update({ status, status_updated_at: new Date().toISOString() })
      .eq('id', vuln.id)
      .select()
      .maybeSingle();
    if (data) {
      onUpdated(data as Vulnerability);
      recomputeRiskScoreFromScanId(vuln.scan_id).catch(() => {});
    }
    setSaving(false);
  };

  const saveNote = async () => {
    setSaving(true);
    const { data } = await supabase
      .from('vulnerabilities')
      .update({ note: noteDraft, status_updated_at: new Date().toISOString() })
      .eq('id', vuln.id)
      .select()
      .maybeSingle();
    if (data) onUpdated(data as Vulnerability);
    setSaving(false);
    setEditing(false);
  };

  const cancelEdit = () => {
    setNoteDraft(vuln.note);
    setEditing(false);
  };

  const statusMeta = STATUS_META[vuln.status];

  return (
    <div className={`px-5 py-3 transition-colors ${selected ? 'bg-sky-500/5' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onSelect}
          className="mt-1 text-slate-500 hover:text-emerald-400 transition shrink-0"
          aria-label="Select finding"
        >
          {selected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
        </button>
        <button
          onClick={onToggle}
          className="mt-1 text-slate-500 hover:text-white transition shrink-0"
          aria-label="Toggle details"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] px-2 py-0.5 rounded border capitalize shrink-0 ${severityClass(vuln.severity)}`}
            >
              {vuln.severity}
            </span>
            <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded border ${statusMeta.tone}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
            {slaState === 'overdue' && (
              <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded border border-red-500/40 bg-red-500/10 text-red-300">
                <Timer className="w-3 h-3 mr-1" /> SLA overdue
              </span>
            )}
            {slaState === 'at_risk' && (
              /* c8 ignore next 4 */
              <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
                <Timer className="w-3 h-3 mr-1" /> SLA at risk
              </span>
            )}
            <div className="text-sm font-medium text-white truncate">{vuln.title}</div>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono truncate">{vuln.asset}</div>
        </div>
        <select
          value={vuln.status}
          aria-label="Vulnerability status"
          disabled={saving}
          onChange={(e) => changeStatus(e.target.value as StatusValue)}
          className="shrink-0 bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
        >
          {VULN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>

      {expanded && (
        <div className="mt-3 ml-7 space-y-3">
          {vuln.description && (
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Description</div>
              <p className="text-sm text-slate-300 leading-relaxed">{vuln.description}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {vuln.cve_id && (
              <MetaCell label="CVE" value={vuln.cve_id} link={`https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`} />
            )}
            {vuln.mitre_tactic && (
              <MetaCell label="MITRE" value={vuln.mitre_tactic} />
            )}
            {vuln.cis_control && (
              <MetaCell label="CIS Control" value={vuln.cis_control} />
            )}
          </div>
          {vuln.remediation && (
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Remediation
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{vuln.remediation}</p>
            </div>
          )}

          {/* AI-powered Remediation Assistant */}
          <RemediationAssistant vuln={vuln} />

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] text-slate-500 uppercase tracking-wider">Analyst note</div>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
                >
                  <Pencil className="w-3 h-3" /> {vuln.note ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={3}
                  placeholder="Add context, owner, ticket ID, mitigation details..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 transition"
                  >
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button
                    onClick={saveNote}
                    disabled={saving}
                    className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-2.5 py-1.5 rounded-md text-xs transition"
                  >
                    <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save note'}
                  </button>
                </div>
              </div>
            ) : vuln.note ? (
              <p className="text-sm text-slate-300 whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
                {vuln.note}
              </p>
            ) : (
              <p className="text-xs text-slate-600 italic">No note yet.</p>
            )}
          </div>

          <div className="text-[11px] text-slate-600">
            Last updated {new Date(vuln.status_updated_at).toLocaleString()}
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <PresenceAvatars contextType="finding" contextId={vuln.id} />
            <CommentThread vulnerabilityId={vuln.id} vulnerabilityTitle={vuln.title} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCell({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-sky-400 hover:text-sky-300 font-mono mt-0.5 truncate block underline-offset-2 hover:underline transition"
        >
          {value}
        </a>
      ) : (
        <div className="text-xs text-slate-200 font-mono mt-0.5 truncate">{value}</div>
      )}
    </div>
  );
}
