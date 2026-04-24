import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
export default function PublicReport({ token }) {
    const [report, setReport] = useState(null);
    const [status, setStatus] = useState('loading');
    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('reports')
                .select('*')
                .eq('share_token', token)
                .eq('is_public', true)
                .maybeSingle();
            if (!data) {
                setStatus('notfound');
                return;
            }
            setReport(data);
            setStatus('ok');
        })();
    }, [token]);
    const download = () => {
        if (!report)
            return;
        const blob = new Blob([report.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.title.replace(/\s+/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };
    if (status === 'loading') {
        return (_jsx("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center", children: _jsxs("div", { className: "flex items-center gap-3 text-slate-400", children: [_jsx(Shield, { className: "w-5 h-5 text-emerald-400 animate-pulse" }), "Loading shared report..."] }) }));
    }
    if (status === 'notfound' || !report) {
        return (_jsx("div", { className: "min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4", children: _jsxs("div", { className: "text-center max-w-md", children: [_jsx("div", { className: "mx-auto w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4", children: _jsx(AlertTriangle, { className: "w-5 h-5 text-amber-400" }) }), _jsx("h1", { className: "text-xl font-semibold", children: "Report not available" }), _jsx("p", { className: "mt-2 text-sm text-slate-500", children: "This link has been revoked or never existed. Ask the owner to re-share the report." })] }) }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-slate-950 text-slate-100", children: [_jsx("header", { className: "border-b border-slate-800 bg-slate-950/80 backdrop-blur", children: _jsxs("div", { className: "max-w-4xl mx-auto px-8 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-slate-400", children: [_jsx("div", { className: "w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center", children: _jsx(Shield, { className: "w-4 h-4 text-slate-950" }) }), _jsx("span", { className: "font-semibold text-white", children: "Sentinel AI" }), _jsx("span", { className: "text-slate-600", children: "\u00B7" }), _jsx("span", { children: "Shared report" })] }), _jsxs("button", { onClick: download, className: "inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md text-sm transition", children: [_jsx(Download, { className: "w-4 h-4" }), " Markdown"] })] }) }), _jsxs("main", { className: "max-w-4xl mx-auto px-8 py-10", children: [_jsxs("div", { className: "text-xs text-slate-500 uppercase tracking-wider", children: [report.kind, " report"] }), _jsx("h1", { className: "mt-1 text-3xl font-bold tracking-tight", children: report.title }), _jsxs("p", { className: "mt-1 text-sm text-slate-500", children: ["Generated ", new Date(report.created_at).toLocaleString()] }), _jsx("div", { className: "mt-8 rounded-xl border border-slate-800 bg-slate-900/30 p-8", children: _jsx("pre", { className: "whitespace-pre-wrap text-sm text-slate-200 font-sans leading-relaxed", children: report.content }) }), _jsx("footer", { className: "mt-8 text-center text-xs text-slate-600", children: "Delivered by Sentinel AI \u00B7 Read-only shared view" })] })] }));
}
