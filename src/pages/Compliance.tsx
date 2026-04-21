import { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Activity,
  TrendingUp, Zap, BookOpen, AlertCircle, Download, FileText, Printer
} from 'lucide-react';
import { supabase, Vulnerability } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { computeCompliance, CisRow, MitreRow, NistRow, Soc2Row } from '../lib/compliance';
import { buildEvidencePackage, buildEvidenceMarkdown, printReportAsPDF } from '../lib/evidencePackage';
import { downloadFile } from '../lib/exporters';

export default function Compliance() {
  const { user, profile } = useAuth();
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

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

  const exportEvidence = async (format: 'json' | 'markdown' | 'pdf') => {
    setExporting(true);
    try {
      const org = profile?.company || profile?.email || 'My Organization';
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
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative group">
            <button
              disabled={exporting || vulns.length === 0}
              className="inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 disabled:opacity-40 text-slate-300 px-3 py-2 rounded-md text-sm transition"
            >
              <Download className="w-3.5 h-3.5" /> Export evidence
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-slate-700 bg-slate-900 shadow-xl z-10 hidden group-hover:block group-focus-within:block">
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

      {/* ── Top KPIs ─────────────────────────────────────────────────────── */}
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

      {/* ── SOC 2 Criteria breakdown ──────────────────────────────────────── */}
      <section>
        <SectionHeader icon={BookOpen} title="SOC 2 Trust Services Criteria" color="text-sky-400" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
          {result.soc2Rows.map(row => <Soc2Card key={row.id} row={row} />)}
        </div>
      </section>

      {/* ── NIST CSF ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={ShieldCheck} title="NIST Cybersecurity Framework (CSF)" color="text-emerald-400" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
          {result.nistRows.map(row => <NistCard key={row.id} row={row} />)}
        </div>
      </section>

      {/* ── CIS Controls ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={TrendingUp} title="CIS Controls v8" color="text-amber-400" />
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_120px] px-4 py-2 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            <span>Control</span>
            <span className="text-center">Findings</span>
            <span className="text-center">Critical</span>
            <span className="pr-2">Score</span>
          </div>
          <div className="divide-y divide-slate-800/50">
            {result.cisRows.map(row => <CisRowItem key={row.id} row={row} />)}
          </div>
        </div>
      </section>

      {/* ── MITRE ATT&CK Heatmap ─────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Zap} title="MITRE ATT&CK Tactics" color="text-red-400" />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {result.mitreRows.map(row => <MitreCard key={row.id} row={row} />)}
        </div>
      </section>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

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
          style={{ width: `${row.score}%` }}
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
            style={{ width: `${row.score}%` }}
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
              style={{ width: `${row.score}%` }}
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
