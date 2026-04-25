import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Download, Filter, Pencil, Save, ShieldOff, Sparkles, Timer, X } from 'lucide-react';
import { supabase, Vulnerability, VULN_STATUSES, DEFAULT_SLA_CONFIG } from '../lib/supabase';
import { downloadFile, toCsvExport } from '../lib/exporters';
import { recomputeRiskScoreFromScanId } from '../lib/riskScore';
import { useAuth } from '../context/useAuth';

type SlaFilter = 'all' | 'overdue' | 'at_risk';

function slaStateFor(
  v: Vulnerability,
  sla: Record<'critical' | 'high' | 'medium' | 'low', number>,
  now: number,
): 'overdue' | 'at_risk' | 'healthy' | 'na' {
  if (v.status !== 'open' && v.status !== 'in_progress') return 'na';
  if (v.severity === 'info') return 'na';
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
    return [...vulns]
      .filter((v) => (statusFilter === 'all' ? true : v.status === statusFilter))
      .filter((v) => (severityFilter === 'all' ? true : v.severity === severityFilter))
      .filter((v) => {
        if (slaFilter === 'all') return true;
        const s = slaStateFor(v, slaConfig, now);
        return slaFilter === 'overdue' ? s === 'overdue' : s === 'at_risk';
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          const aOpen = a.status === 'open' || a.status === 'in_progress' ? 0 : 1;
          const bOpen = b.status === 'open' || b.status === 'in_progress' ? 0 : 1;
          if (aOpen !== bOpen) return aOpen - bOpen;
        }
        return SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
      });
  }, [vulns, statusFilter, severityFilter, slaFilter, slaConfig, now]);

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

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 divide-y divide-slate-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldOff className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <div className="text-sm text-slate-400">No findings match the current filters.</div>
          </div>
        ) : (
          filtered.map((v) => (
            <FindingRow
              key={v.id}
              vuln={v}
              slaState={slaStateFor(v, slaConfig, now)}
              expanded={expanded === v.id}
              onToggle={() => setExpanded(expanded === v.id ? null : v.id)}
              onUpdated={onUpdated}
            />
          ))
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
  onToggle,
  onUpdated,
}: {
  vuln: Vulnerability;
  slaState: 'overdue' | 'at_risk' | 'healthy' | 'na';
  expanded: boolean;
  onToggle: () => void;
  onUpdated: (next: Vulnerability) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState(vuln.note);
  const [saving, setSaving] = useState(false);

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
    <div className="px-5 py-3">
      <div className="flex items-start gap-3">
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
              <MetaCell label="CVE" value={vuln.cve_id} />
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
        </div>
      )}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xs text-slate-200 font-mono mt-0.5 truncate">{value}</div>
    </div>
  );
}
