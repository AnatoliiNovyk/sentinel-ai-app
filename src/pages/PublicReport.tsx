import { useEffect, useState, useRef } from 'react';
import { Shield, AlertTriangle, Download, Moon, Sun, Copy, Check, Printer, BookOpen, FileText, Hash } from 'lucide-react';
import { supabase, Report } from '../lib/supabase';

export default function PublicReport({ token }: { token: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<'loading' | 'notfound' | 'ok'>('loading');
  const [darkMode, setDarkMode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const pct = el.scrollHeight <= el.clientHeight ? 0 : Math.min(100, (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100);
      setScrollPct(pct);
      if (progressRef.current) progressRef.current.style.width = `${pct}%`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
      setReport(data as Report);
      setStatus('ok');
    })();
  }, [token]);

  const download = () => {
    if (!report) return;
    const blob = new Blob([report.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => window.print();

  const reportMeta = report ? (() => {
    const words      = report.content.trim().split(/\s+/).filter(Boolean).length;
    const readMins   = Math.max(1, Math.round(words / 200));
    const sections   = (report.content.match(/^#+\s/gm) ?? []).length;
    const chars      = report.content.length;
    return { words, readMins, sections, chars };
  })() : null;

  const copyContent = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <Shield className="w-5 h-5 text-emerald-400 animate-pulse" />
          Loading shared report...
        </div>
      </div>
    );
  }

  if (status === 'notfound' || !report) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <h1 className="text-xl font-semibold">Report not available</h1>
          <p className="mt-2 text-sm text-slate-500">
            This link has been revoked or never existed. Ask the owner to re-share the report.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}>
      {/* Scroll progress bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-transparent z-50">
        <div ref={progressRef} className="h-full bg-emerald-400 transition-none" />
      </div>
      <header className={`border-b ${darkMode ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-white/80'} backdrop-blur`}>
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className={`flex items-center gap-2 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-slate-950" />
            </div>
            <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Sentinel AI</span>
            <span className={darkMode ? 'text-slate-600' : 'text-slate-300'}>·</span>
            <span>Shared report</span>
          </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyContent}
                className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-md text-sm transition ${
                  darkMode
                    ? 'border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
                    : 'border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-900'
                }`}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={printReport}
                className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-md text-sm transition ${
                  darkMode
                    ? 'border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
                    : 'border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-md text-sm transition ${
                  darkMode
                    ? 'border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
                    : 'border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-900'
                }`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={download}
                className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-md text-sm transition ${
                  darkMode
                    ? 'border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white'
                    : 'border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-900'
                }`}
              >
                <Download className="w-4 h-4" /> Markdown
              </button>
            </div>
        </div>
      </header>

      <main className={`max-w-4xl mx-auto px-8 py-10`}>
        <div className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>{report.kind} report</div>
        <h1 className={`mt-1 text-3xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>{report.title}</h1>
        <div className={`mt-3 flex flex-wrap items-center gap-4 text-sm ${darkMode ? 'text-slate-500' : 'text-slate-600'}`}>
          <div>Generated {(() => {
            const diff = Date.now() - new Date(report.created_at).getTime();
            if (diff < 60_000) return 'just now';
            if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
            if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
            if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
            return new Date(report.created_at).toLocaleString();
          })()}</div>
          <span className={darkMode ? 'text-slate-700' : 'text-slate-300'}>·</span>
          <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
            darkMode
              ? 'bg-emerald-500/10 text-emerald-300'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            Public Share
          </div>
        </div>

        {/* Report metadata stats */}
        {reportMeta && (
          <div className={`mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3`}>
            {[
              { icon: <BookOpen className="w-4 h-4" />, label: 'Read time', value: `~${reportMeta.readMins} min` },
              { icon: <FileText className="w-4 h-4" />, label: 'Words',     value: reportMeta.words.toLocaleString() },
              { icon: <Hash className="w-4 h-4" />,      label: 'Sections',  value: reportMeta.sections || '—' },
              { icon: <FileText className="w-4 h-4" />, label: 'Characters', value: reportMeta.chars.toLocaleString() },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${
                darkMode ? 'border-slate-800 bg-slate-900/30 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}>
                <div className={darkMode ? 'text-emerald-400' : 'text-emerald-600'}>{s.icon}</div>
                <div>
                  <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>{s.label}</div>
                  <div className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={`mt-8 rounded-xl border p-8 ${
          darkMode
            ? 'border-slate-800 bg-slate-900/30'
            : 'border-slate-200 bg-slate-50'
        }`}>
          <pre className={`whitespace-pre-wrap text-sm font-sans leading-relaxed ${
            darkMode ? 'text-slate-200' : 'text-slate-700'
          }`}>{report.content}</pre>
        </div>

        <footer className={`mt-8 text-center text-xs ${darkMode ? 'text-slate-600' : 'text-slate-500'}`}>
          Delivered by Sentinel AI · Read-only shared view
        </footer>
      </main>
    </div>
  );
}
