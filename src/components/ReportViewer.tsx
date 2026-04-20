import { useEffect, useRef, useState } from 'react';
import { X, Download, FileText, Copy, Check, Sparkles, BookOpen } from 'lucide-react';
import { marked } from 'marked';
import { Report } from '../lib/supabase';
import { downloadFile } from '../lib/exporters';

// Configure marked for safe, clean output
marked.setOptions({ breaks: true, gfm: true });

interface ReportViewerProps {
  report: Report;
  onClose: () => void;
}

export default function ReportViewer({ report, onClose }: ReportViewerProps) {
  const [copied, setCopied] = useState(false);
  const [renderMode, setRenderMode] = useState<'rendered' | 'raw'>('rendered');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on backdrop click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const slug = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadFile(`${slug}.md`, report.content, 'text/markdown');
  };

  const htmlContent = marked.parse(report.content) as string;

  const kindMeta = {
    executive: { label: 'Executive Summary', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', icon: BookOpen },
    technical: { label: 'Technical Deep Dive', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: FileText },
  }[report.kind] ?? { label: report.kind, color: 'text-slate-400 bg-slate-800 border-slate-700', icon: FileText };

  const KindIcon = kindMeta.icon;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl h-[90vh] rounded-xl border border-slate-800 bg-slate-950 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <KindIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-white truncate">{report.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${kindMeta.color}`}>
                  {kindMeta.label}
                </span>
                <span className="text-[10px] text-slate-500">
                  {new Date(report.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {/* Raw / Rendered toggle */}
            <div className="flex rounded-md border border-slate-800 overflow-hidden text-xs">
              <button
                onClick={() => setRenderMode('rendered')}
                className={`px-3 py-1.5 transition ${renderMode === 'rendered' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Preview
              </button>
              <button
                onClick={() => setRenderMode('raw')}
                className={`px-3 py-1.5 transition border-l border-slate-800 ${renderMode === 'raw' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Markdown
              </button>
            </div>
            <button
              onClick={handleCopy}
              title="Copy Markdown"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-800 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              title="Download .md"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-800 text-xs text-slate-400 hover:text-white hover:border-slate-600 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              onClick={onClose}
              className="ml-1 p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-8">
          {renderMode === 'rendered' ? (
            <div
              className="prose prose-invert prose-sm max-w-none
                prose-headings:font-bold prose-headings:tracking-tight
                prose-h1:text-2xl prose-h1:text-white prose-h1:border-b prose-h1:border-slate-800 prose-h1:pb-3 prose-h1:mb-6
                prose-h2:text-lg prose-h2:text-slate-100 prose-h2:mt-8 prose-h2:mb-3
                prose-h3:text-sm prose-h3:text-slate-200 prose-h3:uppercase prose-h3:tracking-wider prose-h3:mt-6
                prose-p:text-slate-300 prose-p:leading-relaxed
                prose-li:text-slate-300
                prose-strong:text-white
                prose-code:text-emerald-300 prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-lg
                prose-blockquote:border-slate-700 prose-blockquote:text-slate-400
                prose-hr:border-slate-800"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/50 rounded-lg border border-slate-800 p-6">
              {report.content}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-slate-600">
            <Sparkles className="w-3 h-3" />
            Generated by Sentinel AI Reporting Engine
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            {report.content.length.toLocaleString()} chars · {report.content.split('\n').length} lines
          </div>
        </div>
      </div>
    </div>
  );
}
