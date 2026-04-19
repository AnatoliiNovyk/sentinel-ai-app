import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Download } from 'lucide-react';
import { supabase, Report } from '../lib/supabase';

export default function PublicReport({ token }: { token: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<'loading' | 'notfound' | 'ok'>('loading');

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-slate-950" />
            </div>
            <span className="font-semibold text-white">Sentinel AI</span>
            <span className="text-slate-600">·</span>
            <span>Shared report</span>
          </div>
          <button
            onClick={download}
            className="inline-flex items-center gap-2 border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md text-sm transition"
          >
            <Download className="w-4 h-4" /> Markdown
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-10">
        <div className="text-xs text-slate-500 uppercase tracking-wider">{report.kind} report</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{report.title}</h1>
        <p className="mt-1 text-sm text-slate-500">Generated {new Date(report.created_at).toLocaleString()}</p>

        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/30 p-8">
          <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans leading-relaxed">{report.content}</pre>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-600">
          Delivered by Sentinel AI · Read-only shared view
        </footer>
      </main>
    </div>
  );
}
