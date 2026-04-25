import { useState, useEffect, useCallback, useMemo } from 'react';
import { Eye, Search, AlertTriangle, CheckCircle2, Loader2, Info, FileText, RefreshCw, Download, Trash2 } from 'lucide-react';
import { getGlobalDarkWebMonitor, type LeakScanResult } from '../lib/darkWebMonitor';
import { getRateLimiter } from '../lib/rateLimiter';
import { downloadFile } from '../lib/exporters';

interface ScanHistory {
  query: string;
  result: LeakScanResult;
  error?: string;
}

export default function OsintAnalyzer() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanHistory[]>([]);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const visibleResults = useMemo(() => {
    if (sevFilter === 'all') return results;
    return results.filter(r =>
      !r.error && r.result.riskLevel === sevFilter
    );
  }, [results, sevFilter]);

  const exportCsv = useCallback(() => {
    const rows = ['Query,BreachCount,RiskScore,RiskLevel,ScannedAt'];
    for (const r of results) {
      if (r.error) continue;
      rows.push([
        `"${r.query}"`,
        r.result.breachCount ?? 0,
        r.result.riskScore ?? 0,
        r.result.riskLevel ?? 'none',
        r.result.scannedAt ?? '',
      ].join(','));
    }
    downloadFile(`osint-results-${new Date().toISOString().split('T')[0]}.csv`, rows.join('\n'), 'text/csv');
  }, [results]);

  useEffect(() => {
    // Initialize rate limiter for DarkWebMonitor (10 scans per minute per session)
    getRateLimiter('darkwebmonitor-ui', { maxRequests: 10, windowMs: 60 * 1000 });
  }, []);

  const analyze = async () => {
    if (!query.trim()) return;

    const limiter = getRateLimiter('darkwebmonitor-ui', { maxRequests: 10, windowMs: 60 * 1000 });
    const rateLimitCheck = limiter.check('session');

    if (!rateLimitCheck.allowed) {
      setRateLimitError(`Rate limit exceeded. Try again in ${Math.ceil(rateLimitCheck.retryAfterMs / 1000)}s.`);
      setTimeout(() => setRateLimitError(null), rateLimitCheck.retryAfterMs + 100);
      return;
    }

    setRateLimitError(null);
    setLoading(true);

    try {
      const client = getGlobalDarkWebMonitor();
      const result = await client.scan(query.trim());

      if (!result.ok) {
        setResults(prev => [
          { query: query.trim(), result: {} as LeakScanResult, error: result.error.message },
          ...prev
        ]);
      } else {
        setResults(prev => [{ query: query.trim(), result: result.data }, ...prev]);
      }

      setQuery('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during scan';
      setResults(prev => [{ query: query.trim(), result: {} as LeakScanResult, error: errorMsg }, ...prev]);
    } finally {
      setLoading(false);
    }
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

        {rateLimitError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              {rateLimitError}
            </div>
          </div>
        )}

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
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Analysis Results</h2>
            <div className="flex items-center gap-2">
              {/* Severity filter */}
              <div className="flex items-center gap-1">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSevFilter(s)}
                    className={`text-[10px] px-2 py-1 rounded border capitalize transition ${
                      sevFilter === s
                        ? 'border-red-500/40 bg-red-500/10 text-red-300'
                        : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                onClick={() => { setResults([]); setSevFilter('all'); }}
                aria-label="Clear history"
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-red-500/40 hover:text-red-300 px-2.5 py-1.5 rounded-md transition text-slate-400"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          </div>
          {visibleResults.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-8">No results match the selected filter.</div>
          )}
          {visibleResults.map((r, idx) => (
            <div
              key={idx}
              className={`rounded-xl border overflow-hidden ${
                r.error || r.result.breachCount === 0 ? 'border-emerald-500/20' : 'border-red-500/30'
              }`}
            >
              <div
                className={`flex items-center justify-between px-5 py-4 ${
                  r.error || r.result.breachCount === 0 ? 'bg-emerald-500/5' : 'bg-red-500/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  {r.error || r.result.breachCount === 0
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <AlertTriangle className="w-4 h-4 text-red-400" />}
                  <div>
                    <div className="text-sm font-medium text-white">{r.query}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {r.result.scannedAt ? new Date(r.result.scannedAt).toLocaleString() : 'Scan failed'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`text-sm font-bold ${
                      r.error
                        ? 'text-amber-400'
                        : r.result.breachCount > 0
                          ? 'text-red-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {r.error ? 'Error' : r.result.breachCount > 0 ? `${r.result.breachCount} Breach${r.result.breachCount !== 1 ? 'es' : ''} Found` : 'No Leaks Detected'}
                  </div>
                  <button
                    onClick={() => setResults(prev => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove result"
                    className="text-slate-600 hover:text-red-400 transition p-1 rounded"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {r.error && (
                <div className="px-5 py-3 text-sm text-amber-300">{r.error}</div>
              )}

              {!r.error && r.result.breaches && r.result.breaches.length > 0 && (
                <>
                  <div className="border-t border-slate-800 px-5 py-3 bg-slate-900/20">
                    <div className="text-xs text-slate-400 mb-2">Risk Score: {r.result.riskScore}/100</div>
                    <div
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border capitalize ${
                        r.result.riskLevel === 'critical'
                          ? 'text-red-400 border-red-500/30 bg-red-500/10'
                          : r.result.riskLevel === 'high'
                            ? 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                            : r.result.riskLevel === 'medium'
                              ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                              : 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                      }`}
                    >
                      {r.result.riskLevel} Risk
                    </div>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {r.result.breaches.map((breach, i) => (
                      <div key={i} className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-slate-900/30 transition">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 rounded bg-slate-800">
                            <FileText className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{breach.source}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {breach.dataClasses?.slice(0, 2).join(', ')} · Detected on {breach.breachDate}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border capitalize whitespace-nowrap ${
                            breach.severity === 'critical'
                              ? 'text-red-400 border-red-500/30 bg-red-500/10'
                              : breach.severity === 'high'
                                ? 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                                : breach.severity === 'medium'
                                  ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
                                  : 'text-blue-400 border-blue-500/30 bg-blue-500/10'
                          }`}
                        >
                          {breach.severity} Severity
                        </span>
                      </div>
                    ))}
                  </div>

                  {r.result.recommendedActions && r.result.recommendedActions.length > 0 && (
                    <div className="border-t border-slate-800 px-5 py-3 bg-slate-900/40">
                      <div className="text-xs font-semibold text-slate-300 mb-2">Recommended Actions:</div>
                      <ul className="text-xs text-slate-400 space-y-1">
                        {r.result.recommendedActions.slice(0, 3).map((action, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-emerald-400">•</span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
