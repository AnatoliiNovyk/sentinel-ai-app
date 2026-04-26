import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Activity,
  TrendingUp, Zap, BookOpen, AlertCircle, Download, FileText, Printer, Search, X, Trophy
} from 'lucide-react';
import { supabase, Vulnerability } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { computeCompliance, CisRow, MitreRow, NistRow, Soc2Row } from '../lib/compliance';
import { buildEvidencePackage, buildEvidenceMarkdown, printReportAsPDF } from '../lib/evidencePackage';
import { downloadFile } from '../lib/exporters';

export default function Compliance() {
  const { user, profile } = useAuth();
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [framework, setFramework] = useState<'all' | 'soc2' | 'nist' | 'cis' | 'mitre'>('all');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('vulnerabilities')
        .select('*')
        .eq('user_id', user.id);
      setVulns((data ?? []) as Vulnerability[]);
      setLoading(false);
    })();
  }, [user]);

  const result = useMemo(() => computeCompliance(vulns), [vulns]);
  const [cisSort, setCisSort] = useState<'score_desc' | 'score_asc' | 'name'>('score_desc');
  const [cisStatus, setCisStatus] = useState<'all' | 'passing' | 'failing'>('all');
  const [nistStatus, setNistStatus] = useState<'all' | 'passing' | 'failing'>('all');
  const [mitreStatus, setMitreStatus] = useState<'all' | 'active' | 'quiet'>('all');
  const [controlSearch, setControlSearch] = useState('');

  const sortedCisRows = useMemo(() => {
    const q = controlSearch.trim().toLowerCase();
    return [...result.cisRows]
      .filter(r => cisStatus === 'all' ? true : cisStatus === 'passing' ? r.score >= 60 : r.score < 60)
      .filter(r => !q || r.id.toLowerCase().includes(q) || r.label.toLowerCase().includes(q))
      .sort((a, b) =>
        cisSort === 'score_desc' ? b.score - a.score :
        cisSort === 'score_asc' ? a.score - b.score :
        a.label.localeCompare(b.label)
      );
  }, [result.cisRows, cisSort, cisStatus, controlSearch]);

  const filteredNistRows = useMemo(() => {
    const q = controlSearch.trim().toLowerCase();
    return result.nistRows.filter(r =>
      (nistStatus === 'all' ? true : nistStatus === 'passing' ? r.score >= 60 : r.score < 60) &&
      (!q || r.id.toLowerCase().includes(q) || r.label.toLowerCase().includes(q))
    );
  }, [result.nistRows, nistStatus, controlSearch]);

  const filteredMitreRows = useMemo(() => {
    const q = controlSearch.trim().toLowerCase();
    return result.mitreRows.filter(r =>
      (mitreStatus === 'all' ? true : mitreStatus === 'active' ? r.openCount > 0 : r.openCount === 0) &&
      (!q || r.id.toLowerCase().includes(q) || r.label.toLowerCase().includes(q))
    );
  }, [result.mitreRows, mitreStatus, controlSearch]);

  const filteredSoc2Rows = useMemo(() => {
    const q = controlSearch.trim().toLowerCase();
    return !q ? result.soc2Rows : result.soc2Rows.filter(r => r.id.toLowerCase().includes(q) || r.label.toLowerCase().includes(q));
  }, [result.soc2Rows, controlSearch]);

  const worstControls = useMemo(() => {
    const all: { id: string; label: string; score: number; framework: string; openCount: number }[] = [];
    result.soc2Rows.forEach(r => all.push({ id: r.id, label: r.label, score: r.score, framework: 'SOC 2', openCount: r.openCount }));
    result.nistRows.forEach(r => all.push({ id: r.id, label: r.label, score: r.score, framework: 'NIST', openCount: r.openCount }));
    result.cisRows.forEach(r => all.push({ id: r.id, label: r.label, score: r.score, framework: 'CIS', openCount: r.openCount }));
    result.mitreRows.forEach(r => all.push({ id: r.id, label: r.label, score: r.score, framework: 'MITRE', openCount: r.openCount }));
    return all.filter(c => c.score < 80).sort((a, b) => a.score - b.score).slice(0, 5);
  }, [result]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="flex items-center gap-3 text-slate-500">
          <ShieldCheck className="w-5 h-5 animate-pulse text-emerald-400" />
          Computing compliance posture...
        </div>
      </div>
    );
  }

  const soc2Color =
    result.soc2Overall >= 80 ? 'text-emerald-400' :
    result.soc2Overall >= 60 ? 'text-yellow-400' :
    result.soc2Overall >= 40 ? 'text-orange-400' : 'text-red-400';

  const soc2BgColor =
    result.soc2Overall >= 80 ? 'from-emerald-500/20 to-emerald-500/0' :
    result.soc2Overall >= 60 ? 'from-yellow-500/20 to-yellow-500/0' :
    result.soc2Overall >= 40 ? 'from-orange-500/20 to-orange-500/0' : 'from-red-500/20 to-red-500/0';

  const soc2Ring =
    result.soc2Overall >= 80 ? 'stroke-emerald-500' :
    result.soc2Overall >= 60 ? 'stroke-yellow-400' :
    result.soc2Overall >= 40 ? 'stroke-orange-400' : 'stroke-red-500';

  const circumference = 2 * Math.PI * 52;
  const dash = (result.soc2Overall / 100) * circumference;

  const exportEvidence = async (format: 'json' | 'markdown' | 'pdf' | 'csv') => {
    setExporting(true);
    try {
      const org = profile?.company || profile?.email || 'My Organization';
      if (format === 'csv') {
        const rows = ['Framework,Control,Score,OpenFindings,CriticalFindings'];
        for (const r of result.soc2Rows) rows.push(`SOC2,"${r.id} — ${r.label}",${r.score},${r.openCount},${r.criticalCount}`);
        for (const r of result.nistRows) rows.push(`NIST,"${r.id} — ${r.label}",${r.score},${r.openCount},0`);
        for (const r of result.cisRows) rows.push(`CIS,"${r.id} — ${r.label}",${r.score},${r.openCount},${r.criticalCount}`);
        for (const r of result.mitreRows) rows.push(`MITRE,"${r.id} — ${r.label}",${r.score},${r.openCount},0`);
        downloadFile(`compliance-${new Date().toISOString().split('T')[0]}.csv`, rows.join('\n'), 'text/csv');
        return;
      }
      const pkg = buildEvidencePackage(vulns, org);
      if (format === 'json') {
        downloadFile(`sentinel-evidence-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(pkg, null, 2), 'application/json');
      } else if (format === 'markdown') {
        const md = buildEvidenceMarkdown(pkg);
        downloadFile(`sentinel-evidence-${new Date().toISOString().split('T')[0]}.md`, md, 'text/markdown');
      } else {
        const md = buildEvidenceMarkdown(pkg);
        printReportAsPDF(`${org} — Compliance Evidence Report`, md);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance</h1>
          <p className="mt-1 text-sm text-slate-500">
            Automated mapping of your findings to SOC 2, CIS Controls v8, MITRE ATT&CK and NIST CSF.
          </p>
        </div>
        {/* F-15 + F-23: Evidence export & PDF */}
      {/* ── Export menu ── */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative group">
            <button
              disabled={exporting || vulns.length === 0}
              className="inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 disabled:opacity-40 text-slate-300 px-3 py-2 rounded-md text-sm transition"
            >
              <Download className="w-3.5 h-3.5" /> Export evidence
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-10 hidden group-hover:block group-focus-within:block">
              <button onClick={() => exportEvidence('csv')} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 rounded-t-xl transition">
                <FileText className="w-3.5 h-3.5 text-amber-400" /> CSV report
              </button>
              <button onClick={() => exportEvidence('json')} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                <FileText className="w-3.5 h-3.5 text-sky-400" /> JSON package
              </button>
              <button onClick={() => exportEvidence('markdown')} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition">
                <FileText className="w-3.5 h-3.5 text-emerald-400" /> Markdown report
              </button>
              <button onClick={() => exportEvidence('pdf')} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 rounded-b-xl transition">
                <Printer className="w-3.5 h-3.5 text-violet-400" /> Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* SOC2 Gauge */}
        <div className={`md:col-span-1 rounded-xl border border-slate-800 bg-gradient-to-b ${soc2BgColor} bg-slate-900/30 p-6 flex flex-col items-center justify-center gap-3`}>
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-slate-800" />
              <circle
                cx="60" cy="60" r="52" fill="none" strokeWidth="8"
                className={`${soc2Ring} transition-all duration-1000`}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${soc2Color}`}>{result.soc2Overall}%</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">SOC 2</span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-white">SOC 2 Readiness</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {result.soc2Overall >= 80 ? 'On track for audit' :
               result.soc2Overall >= 60 ? 'Needs improvement' : 'Action required'}
            </div>
          </div>
        </div>

        {/* Stats */}
        <StatCard label="Open findings" value={result.openVulns} icon={AlertTriangle} accent="red" />
        <StatCard label="Resolved" value={result.resolvedVulns} icon={CheckCircle2} accent="emerald" />
        <StatCard label="Total assessed" value={result.totalVulns} icon={Activity} accent="sky" />
      </div>

      {/* ── Framework compliance bars ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Framework Compliance Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <FrameworkBar label="SOC 2" score={result.soc2Overall} icon={BookOpen} />
          <FrameworkBar label="ISO 27001" score={result.iso27001Overall} icon={ShieldCheck} />
          <FrameworkBar label="NIST CSF" score={result.nistOverall} icon={ShieldCheck} />
          <FrameworkBar label="CIS Controls" score={result.cisOverall} icon={TrendingUp} />
          <FrameworkBar label="PCI DSS" score={result.pciDssOverall} icon={Zap} />
          <FrameworkBar label="HIPAA" score={result.hipaaOverall} icon={FileText} />
          <FrameworkBar label="MITRE ATT&CK" score={result.mitreOverall} icon={Zap} />
        </div>
      </section>

      {/* ── Framework filter tabs ── */}
      <div className="flex items-center gap-1.5 border border-slate-800 rounded-lg p-1 w-fit bg-slate-900/40">
        {(['all', 'soc2', 'nist', 'cis', 'mitre'] as const).map((f) => {
          const labels: Record<typeof f, string> = { all: 'All', soc2: 'SOC 2', nist: 'NIST CSF', cis: 'CIS Controls', mitre: 'MITRE ATT\u0026CK' };
          const counts: Record<typeof f, number> = {
            all: filteredSoc2Rows.length + filteredNistRows.length + sortedCisRows.length + filteredMitreRows.length,
            soc2: filteredSoc2Rows.length,
            nist: filteredNistRows.length,
            cis: sortedCisRows.length,
            mitre: filteredMitreRows.length,
          };
          return (
            <button
              key={f}
              onClick={() => setFramework(f)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                framework === f
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {labels[f]}
              <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${framework === f ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-500'}`}>{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Global control search ── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={controlSearch}
            onChange={e => setControlSearch(e.target.value)}
            placeholder="Search controls by ID or name…"
            className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none transition"
          />
          {controlSearch && (
            <button onClick={() => setControlSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {filteredSoc2Rows.length + filteredNistRows.length + sortedCisRows.length + filteredMitreRows.length} controls{controlSearch ? ' match' : ' total'}
        </span>
      </div>

      {/* ── Worst controls quick-action panel ── */}
      {!controlSearch && worstControls.length > 0 && (
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-amber-300 text-sm">Priority Action Items</h3>
            <span className="text-xs text-amber-400/60 ml-1">— lowest-scoring controls across all frameworks</span>
          </div>
          <div className="space-y-2">
            {worstControls.map((c, i) => (
              <div key={`${c.framework}-${c.id}`} className="flex items-center gap-3 rounded-lg bg-slate-900/50 border border-slate-800 px-4 py-2.5">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-800 text-slate-400 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{c.framework}</span>
                    <span className="text-[10px] font-mono text-slate-600">{c.id}</span>
                  </div>
                  <div className="text-sm text-slate-200 truncate">{c.label}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {c.openCount > 0 && (
                    <span className="text-xs text-red-400 font-mono">{c.openCount} open</span>
                  )}
                  <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ c.score >= 60 ? 'bg-yellow-400' : c.score >= 40 ? 'bg-orange-400' : 'bg-red-500' }`}
                      ref={(el) => { if (el) el.style.width = `${c.score}%`; }}
                    />
                  </div>
                  <span className={`text-sm font-bold w-10 text-right ${ c.score >= 60 ? 'text-yellow-400' : c.score >= 40 ? 'text-orange-400' : 'text-red-400' }`}>{c.score}%</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SOC 2 Criteria breakdown ── */}
      {(framework === 'all' || framework === 'soc2') && (
      <section>
        <SectionHeader icon={BookOpen} title="SOC 2 Trust Services Criteria" color="text-sky-400" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
          {filteredSoc2Rows.map(row => <Soc2Card key={row.id} row={row} />)}
          {filteredSoc2Rows.length === 0 && <div className="col-span-4 text-center text-sm text-slate-500 py-6">No controls match search.</div>}
        </div>
      </section>
      )}

      {/* ── NIST CSF ── */}
      {(framework === 'all' || framework === 'nist') && (
      <section>
        <div className="flex items-center justify-between">
          <SectionHeader icon={ShieldCheck} title="NIST Cybersecurity Framework (CSF)" color="text-emerald-400" />
          <div className="flex items-center gap-2">
            {(['all', 'passing', 'failing'] as const).map(s => (
              <button
                key={s}
                onClick={() => setNistStatus(s)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition capitalize ${
                  nistStatus === s
                    ? s === 'passing' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : s === 'failing' ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : 'border-slate-600 bg-slate-800 text-white'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : s === 'passing' ? '≥60% Passing' : '<60% Failing'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          {filteredNistRows.map(row => <NistCard key={row.id} row={row} />)}
          {filteredNistRows.length === 0 && <div className="col-span-5 text-center text-sm text-slate-500 py-6">No controls match search.</div>}
        </div>
      </section>
      )}

      {/* ── CIS Controls ── */}
      {(framework === 'all' || framework === 'cis') && (
      <section>
        <div className="flex items-center justify-between">
          <SectionHeader icon={TrendingUp} title="CIS Controls v8" color="text-amber-400" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {(['all', 'passing', 'failing'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setCisStatus(s)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition capitalize ${
                    cisStatus === s
                      ? s === 'passing' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : s === 'failing' ? 'border-red-500/50 bg-red-500/10 text-red-300'
                        : 'border-slate-600 bg-slate-800 text-white'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {s === 'all' ? 'All' : s === 'passing' ? '≥60% Passing' : '<60% Failing'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {([['score_desc', 'Score ↓'], ['score_asc', 'Score ↑'], ['name', 'A→Z']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setCisSort(val)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition ${
                    cisSort === val
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_120px] px-4 py-2 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            <span>Control</span>
            <span className="text-center">Findings</span>
            <span className="text-center">Critical</span>
            <span className="pr-2">Score</span>
          </div>
          <div className="divide-y divide-slate-800/50">
            {sortedCisRows.map(row => <CisRowItem key={row.id} row={row} />)}
            {sortedCisRows.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-500">No controls match search.</div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ── MITRE ATT&CK Heatmap ── */}
      {(framework === 'all' || framework === 'mitre') && (
      <section>
        <div className="flex items-center justify-between">
          <SectionHeader icon={Zap} title="MITRE ATT&CK Tactics" color="text-red-400" />
          <div className="flex items-center gap-2">
            {(['all', 'active', 'quiet'] as const).map(s => (
              <button
                key={s}
                onClick={() => setMitreStatus(s)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition capitalize ${
                  mitreStatus === s
                    ? s === 'active' ? 'border-red-500/50 bg-red-500/10 text-red-300'
                      : s === 'quiet' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-600 bg-slate-800 text-white'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {s === 'all' ? 'All' : s === 'active' ? 'Active threats' : 'Mitigated'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredMitreRows.map(row => <MitreCard key={row.id} row={row} />)}
          {filteredMitreRows.length === 0 && <div className="col-span-6 text-center text-sm text-slate-500 py-6">No tactics match search.</div>}
        </div>
      </section>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function FrameworkBar({ label, score, icon: Icon }: { label: string; score: number; icon: typeof ShieldCheck }) {
  const scoreColor =
    score >= 80 ? 'text-emerald-400' :
    score >= 60 ? 'text-yellow-400' :
    score >= 40 ? 'text-orange-400' : 'text-red-400';
  const barColor =
    score >= 80 ? 'bg-emerald-500' :
    score >= 60 ? 'bg-yellow-400' :
    score >= 40 ? 'bg-orange-400' : 'bg-red-500';
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-300">{label}</span>
        </div>
        <span className={`text-sm font-bold ${scoreColor}`}>{score}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-700 rounded-full`}
          ref={(el) => { if (el) el.style.width = `${score}%`; }}
        />
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: typeof ShieldCheck; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 ${color}`} />
      <h2 className="font-semibold text-white">{title}</h2>
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string; value: number; icon: typeof Activity; accent: 'red' | 'emerald' | 'sky';
}) {
  const cls = {
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  }[accent];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 transition">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <div className={`w-8 h-8 rounded-md border flex items-center justify-center ${cls}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}

function Soc2Card({ row }: { row: Soc2Row }) {
  const color =
    row.score >= 80 ? { bar: 'bg-emerald-500', text: 'text-emerald-400' } :
    row.score >= 60 ? { bar: 'bg-yellow-400',  text: 'text-yellow-400' } :
    row.score >= 40 ? { bar: 'bg-orange-400',  text: 'text-orange-400' } :
                     { bar: 'bg-red-500',      text: 'text-red-400' };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 hover:border-slate-700 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{row.id}</span>
        <span className={`text-sm font-bold ${color.text}`}>{row.score}%</span>
      </div>
      <div className="text-xs text-white font-medium leading-snug mb-3">{row.label}</div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full ${color.bar} transition-all duration-700 rounded-full`}
          ref={(el) => { if (el) el.style.width = `${row.score}%`; }}
        />
      </div>
    </div>
  );
}

function NistCard({ row }: { row: NistRow }) {
  const scoreColor =
    row.score >= 80 ? 'text-emerald-400' :
    row.score >= 60 ? 'text-yellow-400' :
    row.score >= 40 ? 'text-orange-400' : 'text-red-400';
  const barColor =
    row.score >= 80 ? 'bg-emerald-500' :
    row.score >= 60 ? 'bg-yellow-400' :
    row.score >= 40 ? 'bg-orange-400' : 'bg-red-500';
  return (
    <div className={`rounded-xl border ${row.bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-widest ${row.color}`}>{row.id}</span>
        {row.openCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono">
            {row.openCount}
          </span>
        )}
      </div>
      <div className="text-sm font-semibold text-white">{row.label}</div>
      <div className="mt-auto">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
          <span>Score</span>
          <span className={`font-bold ${scoreColor}`}>{row.score}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-700 rounded-full`}
            ref={(el) => { if (el) el.style.width = `${row.score}%`; }}
          />
        </div>
      </div>
    </div>
  );
}

function CisRowItem({ row }: { row: CisRow }) {
  const scoreColor =
    row.score >= 80 ? 'text-emerald-400' :
    row.score >= 60 ? 'text-yellow-400' :
    row.score >= 40 ? 'text-orange-400' : 'text-red-400';
  const barColor =
    row.score >= 80 ? 'bg-emerald-500' :
    row.score >= 60 ? 'bg-yellow-400' :
    row.score >= 40 ? 'bg-orange-500' : 'bg-red-500';
  const statusIcon =
    row.openCount === 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> :
    row.criticalCount > 0 ? <AlertCircle className="w-3.5 h-3.5 text-red-400" /> :
    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;

  return (
    <div className="grid grid-cols-[1fr_80px_80px_120px] px-4 py-3 hover:bg-slate-900/50 transition items-center group">
      <div className="flex items-center gap-2 min-w-0">
        {statusIcon}
        <div className="min-w-0">
          <span className="text-[10px] font-mono text-slate-500">{row.id}</span>
          <div className="text-sm text-slate-200 truncate">{row.label}</div>
        </div>
      </div>
      <div className="text-center text-sm font-mono text-slate-300">{row.openCount}</div>
      <div className="text-center text-sm font-mono">
        {row.criticalCount > 0 ? (
          <span className="text-red-400 font-bold">{row.criticalCount}</span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </div>
      <div className="pr-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-700 rounded-full`}
              ref={(el) => { if (el) el.style.width = `${row.score}%`; }}
            />
          </div>
          <span className={`text-xs font-bold ${scoreColor} w-9 text-right`}>{row.score}%</span>
        </div>
      </div>
    </div>
  );
}

function MitreCard({ row }: { row: MitreRow }) {
  const intensity =
    row.openCount === 0 ? 'opacity-20' :
    row.criticalCount > 0 ? 'opacity-100' :
    row.openCount >= 3 ? 'opacity-80' : 'opacity-50';

  const textColor =
    row.openCount === 0 ? 'text-slate-600' :
    row.criticalCount > 0 ? 'text-white' : 'text-slate-300';

  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900/30 p-4 hover:border-slate-600 transition group`}>
      <div className={`w-2 h-2 rounded-full ${row.color} ${intensity} mb-3 transition-all duration-300`} />
      <div className={`text-xs font-semibold leading-snug ${textColor} mb-2`}>{row.label}</div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-600 font-mono">{row.id}</span>
        {row.openCount > 0 ? (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            row.criticalCount > 0
              ? 'text-red-300 bg-red-500/10 border border-red-500/20'
              : 'text-orange-300 bg-orange-500/10 border border-orange-500/20'
          }`}>
            {row.openCount}
          </span>
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/50" />
        )}
      </div>
    </div>
  );
}
