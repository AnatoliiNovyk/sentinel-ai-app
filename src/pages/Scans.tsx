import { useEffect, useRef, useState } from 'react';
import { Radar, Plus, X, ChevronRight, ArrowLeft, AlertTriangle, Shield, Upload, FileJson, Copy, Check, Sparkles, Wand2, ExternalLink, Database, Zap, Globe, Loader2 } from 'lucide-react';
import { supabase, Scan, Project, Vulnerability } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_SCANNERS } from '../lib/scanMock';
import { dispatchScan } from '../lib/scanDispatch';
import SchedulesPanel from '../components/SchedulesPanel';
import ExecutionConsole from '../components/ExecutionConsole';
import { fromSarif, summarize, ParsedSarif } from '../lib/exporters';
import { fetchCveDetail, cvssToSeverity, CveDetail } from '../lib/cveEnrichment';
import { fetchThreatIntel, ThreatIntelResult } from '../lib/threatIntel';
import { generateAiRemediation, AiRemediationResponse } from '../lib/aiCopilot';
import RemediationModal from '../components/RemediationModal';
import ScanDiff from '../components/ScanDiff';

type Tab = 'runs' | 'schedules';

export default function Scans() {
  const { user } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [tab, setTab] = useState<Tab>('runs');

  const load = async () => {
    if (!user) return;
    const [sRes, pRes] = await Promise.all([
      supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setScans(sRes.data ?? []);
    setProjects(pRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel('scans-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scans', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (selectedScan) {
    return <ScanDetails scan={selectedScan} project={projects.find((p) => p.id === selectedScan.project_id)} onBack={() => setSelectedScan(null)} />;
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scans</h1>
          <p className="mt-1 text-sm text-slate-500">Audit runs and recurring schedules.</p>
        </div>
        {tab === 'runs' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              disabled={projects.length === 0}
              className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 font-medium px-3.5 py-2 rounded-md text-sm transition"
            >
              <Upload className="w-4 h-4" /> Import SARIF
            </button>
            <button
              onClick={() => setModalOpen(true)}
              disabled={projects.length === 0}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              <Plus className="w-4 h-4" /> New scan
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-800">
        {(['runs', 'schedules'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition ${
              tab === t
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'schedules' ? (
        <SchedulesPanel projects={projects} />
      ) : loading ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : scans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
          <Radar className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-slate-300 font-medium">No scans yet</div>
          <div className="text-slate-500 text-sm mt-1">
            {projects.length === 0 ? 'Create a project first.' : 'Launch your first scan to see findings here.'}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
          <div className="divide-y divide-slate-800">
            {scans.map((s) => {
              const project = projects.find((p) => p.id === s.project_id);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedScan(s)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-900/60 transition text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-md bg-slate-800 flex items-center justify-center">
                      <Radar className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {s.scanner} <span className="text-slate-500 font-normal">on {project?.name ?? 'project'}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(s.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <SeverityPills summary={s.severity_summary} />
                    <StatusBadge status={s.status} />
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {modalOpen && (
        <NewScanModal
          projects={projects}
          onClose={() => setModalOpen(false)}
          onCreated={async (projectId, scanner) => {
            setModalOpen(false);
            if (!user) return;
            const proj = projects.find((p) => p.id === projectId);
            await dispatchScan(user.id, projectId, scanner, proj?.target ?? '');
            load();
          }}
        />
      )}

      {importOpen && (
        <ImportSarifModal
          projects={projects}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ImportSarifModal({
  projects,
  onClose,
  onImported,
}: {
  projects: Project[];
  onClose: () => void;
  onImported: () => void;
}) {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [parsed, setParsed] = useState<ParsedSarif | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError('');
    setFileName(file.name);
    try {
      const text = await file.text();
      const result = fromSarif(text);
      if (result.findings.length === 0) {
        setError('SARIF parsed but no results were found.');
      }
      setParsed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse SARIF');
      setParsed(null);
    }
  };

  const save = async () => {
    if (!user || !parsed || !projectId) return;
    setSaving(true);
    const summary = summarize(parsed.findings);
    const now = new Date().toISOString();
    const { data: scan } = await supabase
      .from('scans')
      .insert({
        user_id: user.id,
        project_id: projectId,
        scanner: parsed.scanner,
        status: 'completed',
        severity_summary: summary,
        started_at: now,
        completed_at: now,
      })
      .select()
      .maybeSingle();

    if (scan) {
      const rows = parsed.findings.map((f) => ({
        scan_id: scan.id,
        user_id: user.id,
        title: f.title,
        description: f.description,
        severity: f.severity,
        cve_id: f.cve_id,
        mitre_tactic: f.mitre_tactic,
        cis_control: f.cis_control,
        asset: f.asset,
        remediation: f.remediation,
      }));
      if (rows.length) await supabase.from('vulnerabilities').insert(rows);

      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'scan_imported',
        title: 'SARIF import complete',
        body: `${parsed.findings.length} findings imported from ${fileName}`,
        link: 'scans',
        severity: summary.critical > 0 ? 'critical' : summary.high > 0 ? 'warning' : 'success',
        metadata: { scan_id: scan.id, project_id: projectId },
      });
    }

    setSaving(false);
    onImported();
  };

  const summary = parsed ? summarize(parsed.findings) : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold">Import SARIF</h2>
          <button onClick={onClose} aria-label="Close modal" title="Close modal" className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Target project</label>
            <select
              aria-label="Target project"
              title="Target project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onClick={() => fileRef.current?.click()}
            className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition ${
              dragging
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
            }`}
          >
            <Upload className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <div className="text-sm text-slate-300">
              {fileName ? (
                <span className="inline-flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-emerald-400" /> {fileName}
                </span>
              ) : (
                'Drop a .sarif or .sarif.json file, or click to browse'
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">SARIF 2.1.0 supported</div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.sarif,application/json"
              className="hidden"
              aria-label="Upload SARIF file"
              title="Upload SARIF file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {parsed && summary && (
            <div className="rounded-md border border-slate-800 bg-slate-900/40 p-4">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                Preview · scanner: <span className="text-slate-300 normal-case">{parsed.scanner}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => (
                  <div key={sev} className="rounded-md bg-slate-900 border border-slate-800 p-2 text-center">
                    <div className="text-[10px] text-slate-500 capitalize">{sev}</div>
                    <div className="text-base font-bold mt-0.5 text-white">{summary[sev]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-400">
                {parsed.findings.length} findings ready to import
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!parsed || !projectId || saving}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              {saving ? 'Importing...' : 'Import findings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScanDetails({ scan, project, onBack }: { scan: Scan; project?: Project; onBack: () => void }) {
  const { user } = useAuth();
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<Vulnerability | null>(null);

  const fetchVulns = async () => {
    const { data } = await supabase
      .from('vulnerabilities')
      .select('*')
      .eq('scan_id', scan.id)
      .order('severity');
    setVulns(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchVulns();
  }, [scan.id]);

  const handleApplyFix = async (v: Vulnerability) => {
    if (!user) return;
    // The console handles the simulation. We update DB on complete.
    const { error } = await supabase
      .from('vulnerabilities')
      .update({ 
        status: 'resolved', 
        status_updated_at: new Date().toISOString(),
        note: `AI-Remediation applied via Sentinel AI Engine.`
      })
      .eq('id', v.id);

    if (!error) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'vulnerability_resolved',
        title: 'Vulnerability Resolved',
        body: `AI Agent successfully patched: ${v.title}`,
        link: 'findings',
        severity: 'success',
        metadata: { vulnerability_id: v.id, project_id: project?.id }
      });
      await fetchVulns();
    }
    setFixing(null);
  };

  const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
  const sorted = [...vulns].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> Back to scans
      </button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{scan.scanner} scan</h1>
          <p className="mt-1 text-sm text-slate-500">
            {project?.name} · {new Date(scan.created_at).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={scan.status} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(['critical', 'high', 'medium', 'low', 'info'] as const).map((sev) => {
          const colors: Record<string, string> = {
            critical: 'text-red-400 border-red-500/20 bg-red-500/10',
            high: 'text-orange-400 border-orange-500/20 bg-orange-500/10',
            medium: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10',
            low: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
            info: 'text-slate-400 border-slate-700 bg-slate-800/30',
          };
          return (
            <div key={sev} className={`rounded-lg border p-3 ${colors[sev]}`}>
              <div className="text-xs capitalize opacity-80">{sev}</div>
              <div className="text-2xl font-bold mt-1">{scan.severity_summary?.[sev] ?? 0}</div>
            </div>
          );
        })}
      </div>

      <h2 className="font-semibold mb-3">Findings</h2>
      {loading ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8 text-center">
          <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <div className="text-sm text-slate-300">No findings detected.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((v) => (
            <FindingCard key={v.id} v={v} onApplyFix={() => setFixing(v)} />
          ))}
        </div>
      )}

      {fixing && (
        <RemediationModal
          vuln={fixing}
          onClose={() => setFixing(null)}
        />
      )}
    </div>
  );
}

function FindingCard({ v, onApplyFix }: { v: Vulnerability; onApplyFix: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cveDetail, setCveDetail] = useState<CveDetail | null | 'loading'>(null);
  const [threatData, setThreatData] = useState<ThreatIntelResult | null | 'loading'>(null);
  const [aiData, setAiData] = useState<AiRemediationResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const sevColors: Record<string, string> = {
    critical: 'text-red-400 border-red-500/30 bg-red-500/10',
    high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    info: 'text-slate-400 border-slate-700 bg-slate-800/40',
  };

  // F-02 & F-16: Fetch CVE and Threat Intel when card opens
  useEffect(() => {
    if (!open) return;
    if (v.cve_id && cveDetail === null) {
      setCveDetail('loading');
      fetchCveDetail(v.cve_id).then(detail => setCveDetail(detail));
    }
    if (v.asset && threatData === null) {
      setThreatData('loading');
      fetchThreatIntel(v.asset).then(data => setThreatData(data));
    }
  }, [open, v.cve_id, v.asset]);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAiGeneration = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAiLoading(true);
    try {
      const res = await generateAiRemediation({
        title: v.title,
        description: v.description,
        severity: v.severity,
        asset: v.asset,
        cve_id: v.cve_id || '',
        remediation_type: v.remediation_type || '',
      });
      setAiData(res);
    } catch (err) {
      console.error('Failed to generate AI remediation', err);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-900/60 transition text-left">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded border capitalize ${sevColors[v.severity]}`}>
            {v.severity}
          </span>
          <AlertTriangle className="w-4 h-4 text-slate-500" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate">{v.title}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono truncate">{v.asset}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {v.remediation_code && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 uppercase tracking-tight">
              Fix Ready
            </div>
          )}
          <ChevronRight className={`w-4 h-4 text-slate-600 transition ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0 border-t border-slate-800 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3">Description</div>
            <p className="mt-1 text-sm text-slate-300">{v.description}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-slate-500 uppercase tracking-wider">MITRE ATT&CK</div>
              <div className="mt-1 text-slate-300">{v.mitre_tactic || '—'}</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase tracking-wider">CIS Control</div>
              <div className="mt-1 text-slate-300">{v.cis_control || '—'}</div>
            </div>
            <div>
              <div className="text-slate-500 uppercase tracking-wider">CVE ID</div>
              <div className="mt-1 text-slate-300 font-mono">{v.cve_id || '—'}</div>
            </div>
          </div>

          {/* F-02: NVD CVE Enrichment Panel */}
          {v.cve_id && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">NVD Intelligence</span>
                {cveDetail === 'loading' && <span className="text-[10px] text-slate-500 animate-pulse">Fetching from NVD...</span>}
              </div>
              {cveDetail === 'loading' && (
                <div className="h-8 bg-slate-800 rounded animate-pulse" />
              )}
              {cveDetail && cveDetail !== 'loading' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    {cveDetail.cvssV3Score !== null && (
                      <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border font-mono ${
                        {
                          critical: 'text-red-300 border-red-500/30 bg-red-500/10',
                          high: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
                          medium: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10',
                          low: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
                          info: 'text-slate-400 border-slate-700 bg-slate-800',
                          unknown: 'text-slate-400 border-slate-700 bg-slate-800',
                        }[cvssToSeverity(cveDetail.cvssV3Score)] ?? 'text-slate-400 border-slate-700'
                      }`}>
                        CVSS v3: {cveDetail.cvssV3Score} · {cveDetail.cvssV3Severity}
                      </div>
                    )}
                    {cveDetail.cweIds.length > 0 && (
                      <span className="text-xs text-slate-400 font-mono">{cveDetail.cweIds.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                  {cveDetail.description && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{cveDetail.description}</p>
                  )}
                  {cveDetail.references.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cveDetail.references.slice(0, 3).map((ref) => (
                        <a
                          key={ref}
                          href={ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 transition"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {new URL(ref).hostname}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {cveDetail === null && v.cve_id && (
                <p className="text-xs text-slate-500">No NVD data found for {v.cve_id}</p>
              )}
            </div>
          )}

          {/* F-16: Threat Intelligence Panel */}
          {threatData && threatData !== 'loading' && (
            <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">VirusTotal Intelligence</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border font-mono ${
                    threatData.positives > 0 ? 'text-red-300 border-red-500/30 bg-red-500/10' : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                  }`}>
                    {threatData.positives > 0 ? <AlertTriangle className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                    {threatData.positives}/{threatData.total} Malicious
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Owner: {threatData.owner} ({threatData.country})</span>
                </div>
                {threatData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {threatData.tags.slice(0, 5).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remediation</div>
              {!aiData && (
                <button
                  onClick={handleAiGeneration}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition border border-sky-500/30 hover:border-sky-500/60 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-1 rounded disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  {aiLoading ? 'Generating AI Fix...' : 'Generate AI Fix'}
                </button>
              )}
            </div>
            {aiData ? (
              <div className="mt-1 rounded-md border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-sky-100 leading-relaxed shadow-inner">
                <div className="flex items-center gap-2 mb-2 font-semibold text-sky-400">
                  <Zap className="w-4 h-4" /> AI Security Copilot
                </div>
                {aiData.explanation}
              </div>
            ) : (
              <div className="mt-1 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-100">
                {v.remediation}
              </div>
            )}
          </div>
          {(aiData?.code || v.remediation_code) && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remediation Code</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono uppercase border border-slate-700">
                    {aiData?.language || v.remediation_type}
                  </span>
                  {aiData && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
                      AI Generated
                    </span>
                  )}
                </div>
                <button
                  onClick={() => copy(aiData?.code || v.remediation_code || '')}
                  className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition"
                >
                  {copied ? (
                    <><Check className="w-3 h-3" /> Copied</>
                  ) : (
                    <><Copy className="w-3 h-3" /> Copy snippet</>
                  )}
                </button>
              </div>
              <div className="relative group">
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  <code>{aiData?.code || v.remediation_code}</code>
                </pre>
                <div className="absolute top-2 right-2 flex items-center gap-2">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       onApplyFix();
                     }}
                     className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-md text-[10px] flex items-center gap-1.5 shadow-lg animate-in zoom-in"
                   >
                     <Wand2 className="w-3 h-3" /> Apply Fix Now
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewScanModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: (projectId: string, scanner: string) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [scanner, setScanner] = useState(AVAILABLE_SCANNERS[0].id);
  const [launching, setLaunching] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold">New scan</h2>
          <button onClick={onClose} aria-label="Close modal" title="Close modal" className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Project</label>
            <select
              aria-label="Project"
              title="Project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Scanner</label>
            <div className="space-y-2">
              {AVAILABLE_SCANNERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScanner(s.id)}
                  className={`w-full text-left px-4 py-3 rounded-md border transition ${
                    scanner === s.id
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{s.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              onClick={() => {
                setLaunching(true);
                onCreated(projectId, scanner);
              }}
              disabled={!projectId || launching}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              {launching ? 'Launching...' : 'Launch scan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeverityPills({ summary }: { summary: Scan['severity_summary'] }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {summary.critical > 0 && <span className="text-red-400">{summary.critical}C</span>}
      {summary.high > 0 && <span className="text-orange-400">{summary.high}H</span>}
      {summary.medium > 0 && <span className="text-yellow-400">{summary.medium}M</span>}
      {summary.low > 0 && <span className="text-sky-400">{summary.low}L</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    queued: 'bg-slate-700/50 text-slate-300',
    running: 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
    completed: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    failed: 'bg-red-500/10 text-red-300 border border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-1 rounded-md ${map[status] ?? map.queued}`}>
      {status}
    </span>
  );
}
