import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { FileText, X, Download, ArrowLeft, Sparkles, Printer, Link2, Copy, Check, Globe, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { buildReport } from '../lib/reportBuilder';
export default function Reports() {
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const load = useCallback(async () => {
        if (!user)
            return;
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
    if (selected)
        return _jsx(ReportView, { report: selected, onBack: () => setSelected(null) });
    return (_jsxs("div", { className: "p-8 max-w-7xl", children: [_jsxs("div", { className: "flex items-end justify-between mb-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "Reports" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "AI-generated audit summaries and technical deep dives." })] }), _jsxs("button", { onClick: () => setModalOpen(true), disabled: projects.length === 0, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: [_jsx(Sparkles, { className: "w-4 h-4" }), " Generate report"] })] }), loading ? (_jsx("div", { className: "text-slate-500 text-sm", children: "Loading..." })) : reports.length === 0 ? (_jsxs("div", { className: "rounded-xl border border-dashed border-slate-800 p-16 text-center", children: [_jsx(FileText, { className: "w-10 h-10 text-slate-600 mx-auto mb-3" }), _jsx("div", { className: "text-slate-300 font-medium", children: "No reports yet" }), _jsx("div", { className: "text-slate-500 text-sm mt-1", children: "Generate your first report from a completed scan." })] })) : (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: reports.map((r) => {
                    const project = projects.find((p) => p.id === r.project_id);
                    return (_jsxs("button", { onClick: () => setSelected(r), className: "text-left rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-emerald-500/50 hover:bg-slate-900/60 transition", children: [_jsxs("div", { className: "flex items-center gap-2 mb-3", children: [_jsx("span", { className: `inline-flex items-center text-xs px-2 py-0.5 rounded-md border capitalize ${r.kind === 'executive'
                                            ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                                            : 'text-sky-300 border-sky-500/30 bg-sky-500/10'}`, children: r.kind }), _jsx("span", { className: "text-xs text-slate-500", children: new Date(r.created_at).toLocaleDateString() })] }), _jsx("h3", { className: "font-semibold text-white", children: r.title }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: project?.name ?? 'Project' })] }, r.id));
                }) })), modalOpen && (_jsx(GenerateModal, { projects: projects, onClose: () => setModalOpen(false), onCreated: () => {
                    setModalOpen(false);
                    load();
                } }))] }));
}
function ReportView({ report: initial, onBack }) {
    const [report, setReport] = useState(initial);
    const [shareOpen, setShareOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const shareUrl = report.share_token && report.is_public
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
        if (data)
            setReport(data);
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
        if (data)
            setReport(data);
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
        if (data)
            setReport(data);
        setBusy(false);
    };
    const copy = async () => {
        if (!shareUrl)
            return;
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
        if (!w)
            return;
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => {
            w.print();
        }, 250);
    };
    return (_jsxs("div", { className: "p-8 max-w-4xl", children: [_jsxs("button", { onClick: onBack, className: "inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), " Back to reports"] }), _jsxs("div", { className: "flex items-start justify-between mb-8 gap-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "text-xs text-slate-500 uppercase tracking-wider", children: [report.kind, " report"] }), _jsx("h1", { className: "mt-1 text-3xl font-bold tracking-tight", children: report.title })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsxs("button", { onClick: () => setShareOpen(true), className: `inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm transition border ${report.is_public
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15'
                                    : 'border-slate-700 hover:border-slate-500'}`, children: [report.is_public ? _jsx(Globe, { className: "w-4 h-4" }) : _jsx(Link2, { className: "w-4 h-4" }), report.is_public ? 'Shared' : 'Share'] }), _jsxs("button", { onClick: printPdf, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-3 py-2 rounded-md text-sm transition", children: [_jsx(Printer, { className: "w-4 h-4" }), " Print / PDF"] }), _jsxs("button", { onClick: download, className: "inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md text-sm transition", children: [_jsx(Download, { className: "w-4 h-4" }), " Markdown"] })] })] }), _jsx("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 p-8", children: _jsx("pre", { className: "whitespace-pre-wrap text-sm text-slate-200 font-sans leading-relaxed", children: report.content }) }), shareOpen && (_jsx("div", { className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-800", children: [_jsx("h2", { className: "font-semibold", children: "Share report" }), _jsx("button", { onClick: () => setShareOpen(false), className: "text-slate-500 hover:text-white", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "p-6 space-y-4", children: [_jsx("p", { className: "text-sm text-slate-400", children: "Anyone with the link below can view this report read-only. No Sentinel account required." }), report.is_public && shareUrl ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { readOnly: true, value: shareUrl, onFocus: (e) => e.currentTarget.select(), className: "flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-200" }), _jsxs("button", { onClick: copy, className: "inline-flex items-center gap-1.5 border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-md text-xs transition", children: [copied ? _jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" }) : _jsx(Copy, { className: "w-3.5 h-3.5" }), copied ? 'Copied' : 'Copy'] })] }), _jsxs("div", { className: "flex items-center justify-between gap-2 pt-2 border-t border-slate-800", children: [_jsx("button", { onClick: rotateToken, disabled: busy, className: "text-xs text-slate-400 hover:text-white disabled:opacity-50 transition", children: "Rotate link" }), _jsxs("button", { onClick: disableSharing, disabled: busy, className: "inline-flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 disabled:opacity-50 transition", children: [_jsx(Lock, { className: "w-3.5 h-3.5" }), " Revoke access"] })] })] })) : (_jsxs("button", { onClick: enableSharing, disabled: busy, className: "w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2.5 rounded-md text-sm transition", children: [_jsx(Globe, { className: "w-4 h-4" }), busy ? 'Creating link...' : 'Create public link'] }))] })] }) }))] }));
}
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function markdownToHtml(md) {
    const lines = md.split('\n');
    const out = [];
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
        }
        else if (/^## /.test(line)) {
            flushList();
            out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
        }
        else if (/^### /.test(line)) {
            flushList();
            out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
        }
        else if (/^- /.test(line) || /^\d+\. /.test(line)) {
            if (!inList) {
                out.push('<ul>');
                inList = true;
            }
            const content = line.replace(/^(- |\d+\. )/, '');
            out.push(`<li>${inlineMd(content)}</li>`);
        }
        else if (line.trim() === '') {
            flushList();
            out.push('');
        }
        else {
            flushList();
            out.push(`<p>${inlineMd(line)}</p>`);
        }
    }
    flushList();
    return out.join('\n');
}
function inlineMd(s) {
    return escapeHtml(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function renderPrintableHtml(report) {
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
function GenerateModal({ projects, onClose, onCreated, }) {
    const { user } = useAuth();
    const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
    const [kind, setKind] = useState('executive');
    const [useAi, setUseAi] = useState(true);
    const [generating, setGenerating] = useState(false);
    const generateViaEdgeFunction = async () => {
        if (!user)
            return false;
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token)
                return false;
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
        }
        catch {
            return false;
        }
    };
    const generateLocally = async () => {
        if (!user)
            return;
        const { data: scans } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', user.id)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        const project = projects.find((p) => p.id === projectId);
        const scanIds = (scans ?? []).map((s) => s.id);
        const { data: vulns } = scanIds.length
            ? await supabase.from('vulnerabilities').select('*').in('scan_id', scanIds)
            : { data: [] };
        const content = buildReport(kind, project, scans ?? [], (vulns ?? []));
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
        if (!user || !projectId)
            return;
        setGenerating(true);
        const ok = await generateViaEdgeFunction();
        if (!ok) {
            await generateLocally();
        }
        setGenerating(false);
        onCreated();
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50", children: _jsxs("div", { className: "w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-800", children: [_jsx("h2", { className: "font-semibold", children: "Generate report" }), _jsx("button", { onClick: onClose, className: "text-slate-500 hover:text-white", children: _jsx(X, { className: "w-4 h-4" }) })] }), _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Project" }), _jsx("select", { value: projectId, onChange: (e) => setProjectId(e.target.value), className: "w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none", children: projects.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id))) })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-slate-300 mb-1.5", children: "Report type" }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: ['executive', 'technical'].map((k) => (_jsx("button", { onClick: () => setKind(k), className: `py-3 rounded-md text-sm font-medium border transition capitalize ${kind === k
                                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                                            : 'border-slate-800 text-slate-400 hover:border-slate-700'}`, children: k }, k))) })] }), _jsx("div", { children: _jsxs("label", { className: "flex items-center gap-3 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: useAi, onChange: (e) => setUseAi(e.target.checked), className: "w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30" }), _jsxs("span", { className: "text-sm text-slate-300", children: ["Enhance narrative with AI", _jsx("span", { className: "block text-xs text-slate-500", children: "Uses the AI gateway server-side to produce board-ready prose." })] })] }) }), _jsxs("div", { className: "pt-2 flex justify-end gap-2", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm text-slate-300 hover:text-white", children: "Cancel" }), _jsxs("button", { onClick: generate, disabled: generating || !projectId, className: "inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition", children: [_jsx(Sparkles, { className: "w-4 h-4" }), generating ? 'Generating...' : 'Generate'] })] })] })] }) }));
}
