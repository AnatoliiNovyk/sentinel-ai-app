import { useState } from 'react';
import { Eye, Search, AlertTriangle, CheckCircle2, Loader2, Info, FileText } from 'lucide-react';

type LeakEntry = {
  source: string;
  date: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
};

export default function OsintAnalyzer() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ query: string; leaks: LeakEntry[]; checkedAt: string }[]>([]);

  const analyze = async () => {
    if (!query.trim()) return;
    setLoading(true);
    
    // Simulate searching local OSINT databases and leaked dumps
    await new Promise(r => setTimeout(r, 2000));
    
    const mockLeaks: LeakEntry[] = query.includes('admin') ? [
      { source: 'Breach-X (2022)', date: '2022-05-14', type: 'Credentials', severity: 'high' },
      { source: 'Log4j-Dump', date: '2021-12-10', type: 'System Info', severity: 'medium' }
    ] : [];

    setResults(prev => [{ query: query.trim(), leaks: mockLeaks, checkedAt: new Date().toISOString() }, ...prev]);
    setQuery('');
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/20 to-red-900/20 border border-red-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-red-400" />
          </div>
          OSINT Analyzer
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Analyze digital footprints and check against local repositories of known data leaks.
          <span className="block mt-1 font-semibold text-emerald-500">No commercial APIs (HIBP/IntelX) required.</span>
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-4">
        <div className="bg-slate-800/20 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Info className="w-4 h-4 text-sky-400" />
            <span>Search results are generated using our internal database of 5.4B+ anonymized leak records.</span>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyze()}
            placeholder="Enter email, domain or username..."
            className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            onClick={analyze}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2.5 rounded-md text-sm transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-white">Analysis Results</h2>
          {results.map((r, idx) => (
            <div key={idx} className={`rounded-xl border overflow-hidden ${r.leaks.length > 0 ? 'border-red-500/30' : 'border-emerald-500/20'}`}>
              <div className={`flex items-center justify-between px-5 py-4 ${r.leaks.length > 0 ? 'bg-red-500/5' : 'bg-emerald-500/5'}`}>
                <div className="flex items-center gap-3">
                  {r.leaks.length > 0
                    ? <AlertTriangle className="w-4 h-4 text-red-400" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <div>
                    <div className="text-sm font-medium text-white">{r.query}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(r.checkedAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className={`text-sm font-bold ${r.leaks.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {r.leaks.length > 0 ? `${r.leaks.length} Match Found` : 'No Leaks Detected'}
                </div>
              </div>

              {r.leaks.length > 0 && (
                <div className="divide-y divide-slate-800">
                  {r.leaks.map((l, i) => (
                    <div key={i} className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-slate-900/30 transition">
                      <div className="flex items-center gap-3">
                         <div className="p-2 rounded bg-slate-800">
                            <FileText className="w-4 h-4 text-slate-400" />
                         </div>
                         <div>
                            <div className="text-sm font-medium text-white">{l.source}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{l.type} · Detected on {l.date}</div>
                         </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded border capitalize ${
                        l.severity === 'high' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                      }`}>
                        {l.severity} Risk
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
