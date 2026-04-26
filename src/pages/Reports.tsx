import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, X, Download, ArrowLeft, Sparkles, Printer, Link2, Copy, Check, Globe, Lock, Search, Trash2, ArrowUpDown, ChevronRight } from 'lucide-react';
import { supabase, Report, Project, Scan, Vulnerability } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { buildReport } from '../lib/reportBuilder';
import { downloadFile } from '../lib/exporters';
import { useSearchShortcut } from '../lib/useSearchShortcut';
import { useToast } from '../lib/toastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonCardGrid } from '../components/Skeleton';
import { useStickyHeader } from '../lib/useStickyHeader';

export default function Reports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'executive' | 'technical'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'title-asc' | 'title-desc'>('date-desc');
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchRef, () => setSearch(''));
  const toast = useToast();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const { sentinelRef, stuck } = useStickyHeader();

  const remove = useCallback(async (id: string) => {
    await supabase.from('reports').delete().eq('id', id);
    setReports(prev => prev.filter(r => r.id !== id));
    setConfirmId(null);
    toast.success('Report deleted.');
  }, [toast]);

  const exportReportsList = useCallback(() => {
    const date = new Date().toISOString().split('T')[0];
    const rows = ['Title,Project,Type,Created Date'];
    for (const r of visible) {
      const projectName = projects.find(p => p.id === r.project_id)?.name ?? 'Unknown';
      rows.push(`"${r.title}","${projectName}",${r.kind},"${new Date(r.created_at).toLocaleDateString()}"`);
    }
    downloadFile(`reports-list-${date}.csv`, rows.join('\n'), 'text/csv');
  }, [visible, projects]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = reports
      .filter(r => kindFilter === 'all' || r.kind === kindFilter)
      .filter(r => !q || r.title.toLowerCase().includes(q) || (projects.find(p => p.id === r.project_id)?.name ?? '').toLowerCase().includes(q));
    
    if (sortBy === 'date-desc') filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortBy === 'date-asc') filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    if (sortBy === 'title-asc') filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'title-desc') filtered.sort((a, b) => b.title.localeCompare(a.title));
    
    return filtered;
  }, [reports, kindFilter, search, projects, sortBy]);

  const load = useCallback(async () => {
    if (!user) return;
    const [rRes, pRes] = await Promise.all([
      supabase.from('reports').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', user.id),
    ]);
    setReports(rRes.data ?? []);
    setProjects(pRes.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (selected) return <ReportView report={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="max-w-7xl">
      <div className={`sticky top-0 z-30 px-8 transition-all duration-200 ${stuck ? 'py-3 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 shadow-lg shadow-slate-950/50' : 'pt-8 pb-4 bg-transparent'}`}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className={`font-bold tracking-tight text-white transition-all duration-200 ${stuck ? 'text-xl' : 'text-3xl'}`}>Reports</h1>
            {!stuck && <p className="mt-1 text-sm text-slate-500">AI-generated audit summaries and technical deep dives.</p>}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            disabled={projects.length === 0}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
          >
            <Sparkles className="w-4 h-4" /> Generate report
          </button>
        </div>
      </div>
      <div ref={sentinelRef} className="h-0" />
      <div className="px-8 pb-8">

      {!loading && reports.length > 0 && (
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search reports…"
                className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-8 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {(['all', 'executive', 'technical'] as const).map(k => (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                className={`text-xs px-3 py-2 rounded-md border transition capitalize ${
                  kindFilter === k
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {k === 'all' ? 'All types' : k}
              </button>
            ))}
            {(search || kindFilter !== 'all') && (
              <span className="text-xs text-slate-500">{visible.length} of {reports.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 border border-slate-800 rounded-lg p-1 bg-slate-900/40">
              {(['date-desc', 'date-asc', 'title-asc', 'title-desc'] as const).map(s => {
                const labels: Record<typeof s, string> = { 'date-desc': 'Newest', 'date-asc': 'Oldest', 'title-asc': 'A–Z', 'title-desc': 'Z–A' };
                return (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`text-xs px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                      sortBy === s
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" /> {labels[s]}
                  </button>
                );
              })}
            </div>
            {visible.length > 0 && (
              <button
                onClick={exportReportsList}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-slate-600 transition"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            )}
            {(search || kindFilter !== 'all' || sortBy !== 'date-desc') && (
              <button
                onClick={() => { setSearch(''); setKindFilter('all'); setSortBy('date-desc'); }}
                className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-amber-300 hover:border-amber-500/40 transition"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonCardGrid cols={2} count={4} height="h-36" />
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-900/20 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-500" />
          </div>
          <div className="text-slate-200 font-semibold text-lg">No reports yet</div>
          <div className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">Generate executive or technical audit reports from your completed scans.</div>
          <button
            onClick={() => setModalOpen(true)}
            disabled={projects.length === 0}
            className="mt-6 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold px-5 py-2.5 rounded-lg text-sm transition shadow-lg shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4" /> Generate first report
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.length === 0 ? (
            <div className="col-span-2 rounded-xl border border-dashed border-slate-700/50 bg-slate-900/20 p-12 text-center">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <div className="text-slate-300 font-medium">No reports match your filters</div>
              <div className="text-sm text-slate-500 mt-1">Try a different search term or report type.</div>
              <button onClick={() => { setSearch(''); setKindFilter('all'); }} className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 rounded-md px-3 py-1.5 transition">Clear filters</button>
            </div>
          ) : visible.map((r) => {
            const project = projects.find((p) => p.id === r.project_id);
            return (
              <div key={r.id} className="group relative">
                <button
                  onClick={() => setSelected(r)}
                  className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-emerald-500/50 hover:bg-slate-900/60 transition"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md border capitalize ${
                        r.kind === 'executive'
                          ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                          : 'text-sky-300 border-sky-500/30 bg-sky-500/10'
                      }`}
                    >
                      {r.kind}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-semibold text-white pr-8">{r.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{project?.name ?? 'Project'}</p>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmId(r.id); setConfirmTitle(r.title); }}
                  title="Delete report"
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <GenerateModal
          projects={projects}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete report"
        message={`Are you sure you want to delete "${confirmTitle}"? This action cannot be undone.`}
        confirmLabel="Delete report"
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
      </div>
    </div>
  );
}

function ReportView({ report: initial, onBack }: { report: Report; onBack: () => void }) {
  const [report, setReport] = useState<Report>(initial);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    report.share_token && report.is_public
      ? `${window.location.origin}${window.location.pathname}?share=${report.share_token}`
      : '';

  const enableSharing = async () => {
    setBusy(true);
    const token = report.share_token ?? crypto.randomUUID();
    const { data } = await supabase
      .from('reports')
      .update({ share_token: token, is_public: true })
      .eq('id', report.id)
      .select()
      .maybeSingle();
    if (data) setReport(data as Report);
    setBusy(false);
  };

  const disableSharing = async () => {
    setBusy(true);
    const { data } = await supabase
      .from('reports')
      .update({ is_public: false })
      .eq('id', report.id)
      .select()
      .maybeSingle();
    if (data) setReport(data as Report);
    setBusy(false);
  };

  const rotateToken = async () => {
    setBusy(true);
    const token = crypto.randomUUID();
    const { data } = await supabase
      .from('reports')
      .update({ share_token: token, is_public: true })
      .eq('id', report.id)
      .select()
      .maybeSingle();
    if (data) setReport(data as Report);
    setBusy(false);
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const download = () => {
    const blob = new Blob([report.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    const html = renderPrintableHtml(report);
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 250);
  };

  return (
    <div className="p-8 max-w-4xl">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-white transition"
        >
          <FileText className="w-3.5 h-3.5" />
          Reports
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        <span className="text-slate-300 truncate max-w-sm">{report.title}</span>
      </nav>
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">{report.kind} report</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{report.title}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShareOpen(true)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm transition border ${
              report.is_public
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                : 'border-slate-700 hover:border-slate-500'
            }`}
          >
            {report.is_public ? <Globe className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {report.is_public ? 'Shared' : 'Share'}
          </button>
          <button
            onClick={printPdf}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-3 py-2 rounded-md text-sm transition"
          >
            <Printer className="w-4 h-4" /> Print / PDF
          </button>
          <button
            onClick={download}
            className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md text-sm transition"
          >
            <Download className="w-4 h-4" /> Markdown
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-8">
        <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans leading-relaxed">{report.content}</pre>
      </div>

      {shareOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold">Share report</h2>
              <button onClick={() => setShareOpen(false)} aria-label="Close" className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                Anyone with the link below can view this report read-only. No Sentinel account required.
              </p>

              {report.is_public && shareUrl ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      aria-label="Share URL"
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-200"
                    />
                    <button
                      onClick={copy}
                      className="inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md text-xs transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={rotateToken}
                      disabled={busy}
                      className="text-xs text-slate-400 hover:text-white disabled:opacity-50 transition"
                    >
                      Rotate link
                    </button>
                    <button
                      onClick={disableSharing}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 disabled:opacity-50 transition"
                    >
                      <Lock className="w-3.5 h-3.5" /> Revoke access
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={enableSharing}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2.5 rounded-md text-sm transition"
                >
                  <Globe className="w-4 h-4" />
                  {busy ? 'Creating link...' : 'Create public link'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw;
    if (/^# /.test(line)) {
      flushList();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (/^## /.test(line)) {
      flushList();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (/^### /.test(line)) {
      flushList();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (/^- /.test(line) || /^\d+\. /.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      const content = line.replace(/^(- |\d+\. )/, '');
      out.push(`<li>${inlineMd(content)}</li>`);
    } else if (line.trim() === '') {
      flushList();
      out.push('');
    } else {
      flushList();
      out.push(`<p>${inlineMd(line)}</p>`);
    }
  }
  flushList();
  return out.join('\n');
}

function inlineMd(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderPrintableHtml(report: Report): string {
  const body = markdownToHtml(report.content);
  const date = new Date(report.created_at).toLocaleString();
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.title)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    background: #fff;
    margin: 0;
    padding: 48px 56px;
    line-height: 1.6;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #64748b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .brand .dot { width: 10px; height: 10px; border-radius: 3px; background: linear-gradient(135deg, #34d399, #0d9488); }
  h1 { font-size: 26px; margin: 8px 0 4px; color: #0f172a; }
  h2 { font-size: 18px; margin: 28px 0 8px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 20px 0 6px; color: #0f172a; }
  p { margin: 6px 0; font-size: 13px; color: #1e293b; }
  ul { padding-left: 22px; margin: 6px 0; }
  li { font-size: 13px; color: #1e293b; margin: 2px 0; }
  code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
  strong { color: #0f172a; }
  .meta { font-size: 11px; color: #94a3b8; margin-bottom: 24px; }
  .kind { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 999px; background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; letter-spacing: 0.05em; text-transform: uppercase; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
  <div class="brand"><span class="dot"></span> Sentinel AI</div>
  <span class="kind">${escapeHtml(report.kind)} report</span>
  <div class="meta">Generated ${escapeHtml(date)}</div>
  ${body}
</body>
</html>`;
}

function GenerateModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [kind, setKind] = useState<'executive' | 'technical'>('executive');
  const [useAi, setUseAi] = useState(true);
  const [generating, setGenerating] = useState(false);

  const generateViaEdgeFunction = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return false;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-generate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ project_id: projectId, kind, use_ai: useAi }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const generateLocally = async () => {
    if (!user) return;
    const { data: scans } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const project = projects.find((p) => p.id === projectId)!;
    const scanIds = (scans ?? []).map((s: Scan) => s.id);
    const { data: vulns } = scanIds.length
      ? await supabase.from('vulnerabilities').select('*').in('scan_id', scanIds)
      : { data: [] };

    const content = buildReport(kind, project, scans ?? [], (vulns ?? []) as Vulnerability[]);
    const title = `${kind === 'executive' ? 'Executive Summary' : 'Technical Deep Dive'} — ${project.name}`;

    const { data: report } = await supabase
      .from('reports')
      .insert({
        user_id: user.id,
        project_id: projectId,
        kind,
        title,
        content,
      })
      .select()
      .maybeSingle();

    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'report_ready',
      title: `${kind === 'executive' ? 'Executive' : 'Technical'} report ready`,
      body: `${title} has been generated and is available in the Reports tab.`,
      link: 'reports',
      severity: 'success',
      metadata: { report_id: report?.id, project_id: projectId, kind },
    });
  };

  const generate = async () => {
    if (!user || !projectId) return;
    setGenerating(true);
    const ok = await generateViaEdgeFunction();
    if (!ok) {
      await generateLocally();
    }
    setGenerating(false);
    toast.success('Report generated successfully.');
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold">Generate report</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Project</label>
            <select
              value={projectId}
              aria-label="Project"
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
            <label className="block text-sm text-slate-300 mb-1.5">Report type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['executive', 'technical'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`py-3 rounded-md text-sm font-medium border transition capitalize ${
                    kind === k
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
              />
              <span className="text-sm text-slate-300">
                Enhance narrative with AI
                <span className="block text-xs text-slate-500">Uses the AI gateway server-side to produce board-ready prose.</span>
              </span>
            </label>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              onClick={generate}
              disabled={generating || !projectId}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

