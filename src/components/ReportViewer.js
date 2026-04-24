import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { X, Download, FileText, Copy, Check, Sparkles, BookOpen, Link, Loader2 } from 'lucide-react';
import { marked } from 'marked';
import { supabase } from '../lib/supabase';
import { downloadFile } from '../lib/exporters';
// Configure marked for safe, clean output
marked.setOptions({ breaks: true, gfm: true });
export default function ReportViewer({ report, onClose }) {
    const [copied, setCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [shareToken, setShareToken] = useState(report.share_token);
    const [renderMode, setRenderMode] = useState('rendered');
    const overlayRef = useRef(null);
    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);
    // Close on backdrop click
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current)
            onClose();
    };
    const handleCopy = () => {
        navigator.clipboard.writeText(report.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const handleShare = async () => {
        if (sharing)
            return;
        if (shareToken) {
            // Already shared — copy link
            const url = `${window.location.origin}/?share=${shareToken}`;
            navigator.clipboard.writeText(url);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2500);
            return;
        }
        setSharing(true);
        const token = crypto.randomUUID();
        await supabase
            .from('reports')
            .update({ is_public: true, share_token: token })
            .eq('id', report.id);
        setShareToken(token);
        const url = `${window.location.origin}/?share=${token}`;
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setSharing(false);
        setTimeout(() => setLinkCopied(false), 2500);
    };
    const handleDownload = () => {
        const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        downloadFile(`${slug}.md`, report.content, 'text/markdown');
    };
    const htmlContent = marked.parse(report.content);
    const kindMeta = {
        executive: { label: 'Executive Summary', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', icon: BookOpen },
        technical: { label: 'Technical Deep Dive', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: FileText },
    }[report.kind] ?? { label: report.kind, color: 'text-slate-400 bg-slate-800 border-slate-700', icon: FileText };
    const KindIcon = kindMeta.icon;
    return (_jsx("div", { ref: overlayRef, onClick: handleOverlayClick, className: "fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-4xl h-[90vh] rounded-xl border border-slate-800 bg-slate-950 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: "w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0", children: _jsx(KindIcon, { className: "w-4 h-4 text-emerald-400" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "font-semibold text-white truncate", children: report.title }), _jsxs("div", { className: "flex items-center gap-2 mt-0.5", children: [_jsx("span", { className: `text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${kindMeta.color}`, children: kindMeta.label }), _jsx("span", { className: "text-[10px] text-slate-500", children: new Date(report.created_at).toLocaleString() })] })] })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0 ml-4", children: [_jsxs("div", { className: "flex rounded-md border border-slate-800 overflow-hidden text-xs", children: [_jsx("button", { onClick: () => setRenderMode('rendered'), className: `px-3 py-1.5 transition ${renderMode === 'rendered' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`, children: "Preview" }), _jsx("button", { onClick: () => setRenderMode('raw'), className: `px-3 py-1.5 transition border-l border-slate-800 ${renderMode === 'raw' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`, children: "Markdown" })] }), _jsxs("button", { onClick: handleShare, disabled: sharing, title: shareToken ? 'Copy share link' : 'Generate public link', className: `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs transition ${linkCopied
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                        : shareToken
                                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:border-sky-400'
                                            : 'border-slate-800 text-slate-400 hover:text-white hover:border-slate-600'}`, children: [sharing ? _jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin" }) : linkCopied ? _jsx(Check, { className: "w-3.5 h-3.5" }) : _jsx(Link, { className: "w-3.5 h-3.5" }), linkCopied ? 'Link copied!' : shareToken ? 'Share link' : 'Share'] }), _jsxs("button", { onClick: handleCopy, title: "Copy Markdown", className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-800 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition", children: [copied ? _jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" }) : _jsx(Copy, { className: "w-3.5 h-3.5" }), copied ? 'Copied!' : 'Copy'] }), _jsxs("button", { onClick: handleDownload, title: "Download .md", className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-800 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition", children: [_jsx(Download, { className: "w-3.5 h-3.5" }), "Download"] }), _jsx("button", { onClick: onClose, className: "ml-1 p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition", children: _jsx(X, { className: "w-4 h-4" }) })] })] }), _jsx("div", { className: "flex-1 overflow-auto p-8", children: renderMode === 'rendered' ? (_jsx("div", { className: "prose prose-invert prose-sm max-w-none\n                prose-headings:font-bold prose-headings:tracking-tight\n                prose-h1:text-2xl prose-h1:text-white prose-h1:border-b prose-h1:border-slate-800 prose-h1:pb-3 prose-h1:mb-6\n                prose-h2:text-lg prose-h2:text-slate-100 prose-h2:mt-8 prose-h2:mb-3\n                prose-h3:text-sm prose-h3:text-slate-200 prose-h3:uppercase prose-h3:tracking-wider prose-h3:mt-6\n                prose-p:text-slate-300 prose-p:leading-relaxed\n                prose-li:text-slate-300\n                prose-strong:text-white\n                prose-code:text-emerald-300 prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono\n                prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-lg\n                prose-blockquote:border-slate-700 prose-blockquote:text-slate-400\n                prose-hr:border-slate-800", dangerouslySetInnerHTML: { __html: htmlContent } })) : (_jsx("pre", { className: "font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/50 rounded-lg border border-slate-800 p-6", children: report.content })) }), _jsxs("div", { className: "px-6 py-3 border-t border-slate-800 shrink-0 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-[10px] text-slate-600", children: [_jsx(Sparkles, { className: "w-3 h-3" }), "Generated by Sentinel AI Reporting Engine"] }), _jsxs("div", { className: "text-[10px] text-slate-600 font-mono", children: [report.content.length.toLocaleString(), " chars \u00B7 ", report.content.split('\n').length, " lines"] })] })] }) }));
}
