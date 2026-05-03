import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadVersioned, saveVersioned } from '../lib/storage';
import { Eye, Search, AlertTriangle, CheckCircle2, Loader2, Info, FileText, RefreshCw, Download, Trash2, X, BarChart2, ShieldOff, ShieldCheck, Clock, Copy, Check } from 'lucide-react';
import { getGlobalDarkWebMonitor, type LeakScanResult } from '../lib/darkWebMonitor';
import { getRateLimiter } from '../lib/rateLimiter';
import { downloadFile } from '../lib/exporters';
import { useToast } from '../lib/toastContext';
import { AuditService, AuditAction } from '../api/audit.service';
import { useAuth } from '../context/useAuth';

interface ScanHistory {
  query: string;
  result: LeakScanResult;
  error?: string;
}

const RISK_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

export default function OsintAnalyzer() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanHistory[]>([]);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showRiskChart, setShowRiskChart] = useState(false);
  const [showPhishingDrill, setShowPhishingDrill] = useState(false);
  const [sevFilter, setSevFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'risk_desc' | 'risk_asc' | 'query'>('newest');
  const [copiedDrill, setCopiedDrill] = useState<string | null>(null);
  const toast = useToast();
  const { user } = useAuth();

  const visibleResults = useMemo(() => {
    const filtered = sevFilter === 'all'
      ? results
      : results.filter(r => !r.error && r.result.riskLevel === sevFilter);
    return [...filtered].sort((a, b) => {
      if (sortBy === 'newest') return 0; // already newest-first (prepend on scan)
      if (sortBy === 'risk_desc') return (RISK_ORDER[b.result.riskLevel ?? 'none'] ?? 0) - (RISK_ORDER[a.result.riskLevel ?? 'none'] ?? 0);
      if (sortBy === 'risk_asc') return (RISK_ORDER[a.result.riskLevel ?? 'none'] ?? 0) - (RISK_ORDER[b.result.riskLevel ?? 'none'] ?? 0);
      if (sortBy === 'query') return a.query.localeCompare(b.query);
      /* c8 ignore next */
      return 0;
    });
  }, [results, sevFilter, sortBy]);

  // Session persistence
  useEffect(() => {
    const saved = loadVersioned<ScanHistory[]>('osintScanHistory', 'v1', []);
    if (saved.length) setResults(saved);
  }, []);

  useEffect(() => {
    saveVersioned('osintScanHistory', 'v1', results.slice(0, 50));
  }, [results]);

  // Summary stats
  const stats = useMemo(() => ({
    total:    results.length,
    errors:   results.filter(r => r.error).length,
    clean:    results.filter(r => !r.error && (r.result.breachCount ?? 0) === 0).length,
    critical: results.filter(r => !r.error && r.result.riskLevel === 'critical').length,
    high:     results.filter(r => !r.error && r.result.riskLevel === 'high').length,
    medium:   results.filter(r => !r.error && r.result.riskLevel === 'medium').length,
    low:      results.filter(r => !r.error && r.result.riskLevel === 'low').length,
    totalBreaches: results.reduce((acc, r) => acc + (!r.error ? (r.result.breachCount ?? 0) : 0), 0),
  }), [results]);

  // Phishing drill scenarios
  const phishingScenarios = useMemo(() => [
    {
      id: 'credential-harvest',
      name: 'Credential Harvest',
      cadence: 'Weekly',
      scenario: `Participants receive emails impersonating company IT department requesting password verification. Realistic formatting mimics actual internal communications with domain spoofing. Links redirect to near-identical login pages capturing credentials. Track click rates, submission rates, and time-to-report.`,
      objective: 'Assess user susceptibility to urgent credential requests and verification phishing tactics.',
    },
    {
      id: 'bec-pretexting',
      name: 'Business Email Compromise',
      cadence: 'Bi-weekly',
      scenario: `CEO/CFO impersonation requesting urgent wire transfers or sensitive data. Uses urgency tactics ("ASAP - Do not forward") and references real projects/clients from LinkedIn. Includes spoofed executive signatures and legitimate-looking payment request templates.`,
      objective: 'Evaluate organizational resilience to high-impact CEO fraud and BEC attack patterns.',
    },
    {
      id: 'typosquatting',
      name: 'Domain Typosquatting',
      cadence: 'Monthly',
      scenario: `Emails from look-alike domains (vendor.co vs vendor.com, microosft vs microsoft) requesting quote updates or system access. Includes realistic invoices, meeting confirmations, or software license renewals. Tests attention to domain details and email verification practices.`,
      objective: 'Measure detection of homograph attacks and domain verification awareness.',
    },
    {
      id: 'watering-hole',
      name: 'Watering Hole',
      cadence: 'Monthly',
      scenario: `Compromised industry news site or industry tool portal distributing malicious browser plugins promising enhanced security. Appears in industry forums and shared with peers. Attempts to gather browser history, corporate credentials, or MFA tokens.`,
      objective: 'Test awareness of software supply chain risks and suspicious plugin installation.',
    },
    {
      id: 'smishing-vishing',
      name: 'Smishing & Vishing Campaign',
      cadence: 'Bi-weekly',
      scenario: `SMS/voice calls claiming urgent account action needed or package delivery failed. Vishing calls from "company IT" with social engineering to bypass MFA. Smishing links redirect to credential capture or malware distribution points.`,
      objective: 'Assess response to non-email channel attacks and voice-based social engineering.',
    },
  ], []);

  // Determine if risky results exist for phishing drill display
  const latestRiskyResult = useMemo(() => {
    const risky = results.find(r => 
      !r.error && (
        (r.result.breachCount ?? 0) > 0 || 
        ['critical', 'high'].includes(r.result.riskLevel ?? '')
      )
    );
    return risky;
  }, [results]);

  const copyDrill = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDrill(id);
    setTimeout(() => setCopiedDrill(null), 2000);
  }, []);

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

  const exportJson = useCallback(() => {
    const payload = results.filter(r => !r.error).map(r => ({
      query: r.query,
      riskLevel: r.result.riskLevel,
      riskScore: r.result.riskScore,
      breachCount: r.result.breachCount,
      scannedAt: r.result.scannedAt,
      breaches: r.result.breaches ?? [],
    }));
    downloadFile(`osint-results-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }, [results]);

  useEffect(() => {
    // Initialize rate limiter for DarkWebMonitor (10 scans per minute per session)
    getRateLimiter('darkwebmonitor-ui', { maxRequests: 10, windowMs: 60 * 1000 });
  }, []);

  const analyze = async () => {
    const trimmed = query.trim();
    setValidationError(null);

    if (!trimmed) {
      setValidationError('Please enter an email, domain, IP address, or username.');
      return;
    }
    if (trimmed.length > 253) {
      setValidationError('Query is too long (max 253 characters).');
      return;
    }
    // Reject obviously invalid patterns (script tags, SQL keywords, path traversal)
    if (/[<>'"`;]|(\.\.)|(\/\/)|(select\s+\*|drop\s+table|insert\s+into)/i.test(trimmed)) {
      setValidationError('Query contains invalid characters.');
      return;
    }

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
      const result = await client.scan(trimmed);

      if (!result.ok) {
        setResults(prev => [
          { query: trimmed, result: {} as LeakScanResult, error: result.error.message },
          ...prev
        ]);
        toast.error(`Scan failed: ${result.error.message}`);
      } else {
        setResults(prev => [{ query: trimmed, result: result.data }, ...prev]);
        const leakCount = Object.keys(result.data).filter(k => result.data[k as keyof LeakScanResult]).length;
        toast.info(`Scan complete for "${trimmed}"${leakCount ? ` — ${leakCount} source${leakCount !== 1 ? 's' : ''} with findings` : ' — no leaks found'}.`);
        if (user) {
          AuditService.logSecurityEvent(
            (user as { app_metadata?: { org_id?: string } }).app_metadata?.org_id ?? user.id,
            user.id,
            AuditAction.DARK_WEB_SCAN,
            'dark_web_query',
            trimmed,
            { riskLevel: result.data.riskLevel, breachCount: result.data.breachCount },
          );
        }
      }

      setQuery('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error during scan';
      setResults(prev => [{ query: trimmed, result: {} as LeakScanResult, error: errorMsg }, ...prev]);
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

        {validationError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4" />
              {validationError}
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
          {/* Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total scanned', value: stats.total,         icon: Search,      color: 'text-sky-400',     dot: 'bg-sky-400'     },
              { label: 'Total breaches', value: stats.totalBreaches, icon: ShieldOff,   color: 'text-red-400',     dot: 'bg-red-400'     },
              { label: 'Clean',          value: stats.clean,         icon: ShieldCheck, color: 'text-emerald-400', dot: 'bg-emerald-400' },
              { label: 'Critical',       value: stats.critical,      icon: AlertTriangle, color: 'text-red-400',  dot: 'bg-red-500'     },
              { label: 'High risk',      value: stats.high,          icon: AlertTriangle, color: 'text-orange-400', dot: 'bg-orange-400' },
              { label: 'Errors',         value: stats.errors,        icon: Clock,       color: 'text-amber-400',  dot: 'bg-amber-400'   },
            ].map(({ label, value, icon: Icon, color, dot }) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-slate-500" />
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Risk distribution chart */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
            <button
              onClick={() => setShowRiskChart(p => !p)}
              className="flex items-center gap-2 w-full text-left"
            >
              <BarChart2 className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-slate-200">Risk Distribution</span>
              <span className="ml-auto text-xs text-slate-500">{showRiskChart ? '▲ collapse' : '▼ expand'}</span>
            </button>
            {showRiskChart && (
              <div className="mt-4 space-y-2">
                {([
                  { key: 'critical', label: 'Critical', bar: 'bg-red-500',    text: 'text-red-400'    },
                  { key: 'high',     label: 'High',     bar: 'bg-orange-500', text: 'text-orange-400' },
                  { key: 'medium',   label: 'Medium',   bar: 'bg-amber-500',  text: 'text-amber-400'  },
                  { key: 'low',      label: 'Low',      bar: 'bg-sky-500',    text: 'text-sky-400'    },
                  { key: 'clean',    label: 'Clean',    bar: 'bg-emerald-500',text: 'text-emerald-400'},
                ] as const).map(({ key, label, bar, text }) => {
                  const val = stats[key];
                  const pct = stats.total > 0 ? (val / stats.total) * 100 : 0;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className={`w-16 text-xs font-medium ${text} text-right shrink-0`}>{label}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${bar}`}
                          ref={(el) => { if (el) el.style.width = `${pct}%`; }}
                        />
                      </div>
                      <span className="w-8 text-xs text-slate-400 text-right shrink-0">{val}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phishing Drill Plan */}
          {latestRiskyResult && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <button
                onClick={() => setShowPhishingDrill(p => !p)}
                className="flex items-center gap-2 w-full text-left"
              >
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-semibold text-slate-200">Phishing Drill Plan</span>
                <span className="text-xs text-slate-500 ml-auto">{showPhishingDrill ? '▲ collapse' : '▼ expand'}</span>
              </button>
              {showPhishingDrill && (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-slate-400 mb-4">
                    Based on detected threat exposure (<strong>{latestRiskyResult.result.riskLevel?.toUpperCase()}</strong> risk, {latestRiskyResult.result.breachCount ?? 0} breach(es)), 
                    consider running controlled phishing simulations to raise awareness:
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {phishingScenarios.map((scenario) => (
                      <div key={scenario.id} className="border border-slate-700 rounded-lg bg-slate-800/20 p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-100">{scenario.name}</h4>
                            <p className="text-xs text-slate-500">Cadence: {scenario.cadence}</p>
                          </div>
                          <button
                            onClick={() => copyDrill(scenario.scenario, `drill-${scenario.id}`)}
                            className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition bg-slate-700/50 px-2 py-1.5 rounded"
                          >
                            {copiedDrill === `drill-${scenario.id}`
                              ? <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                              : <><Copy className="w-3 h-3" /> Copy</>}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{scenario.scenario}</p>
                        <p className="text-xs text-slate-600 mt-2 italic">Objective: {scenario.objective}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
              </div>              {/* Sort */}
              <div className="flex items-center gap-1">
                {([['newest', 'Newest'], ['risk_desc', 'Risk ↓'], ['risk_asc', 'Risk ↑'], ['query', 'A→Z']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={`text-[10px] px-2 py-1 rounded border transition ${
                      sortBy === val
                        ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                        : 'border-slate-800 text-slate-500 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={exportJson}
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
              {(sevFilter !== 'all' || sortBy !== 'newest') && (
                <button
                  onClick={() => { setSevFilter('all'); setSortBy('newest'); }}
                  className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-amber-500/40 hover:text-amber-300 px-2.5 py-1.5 rounded-md transition text-slate-400"
                >
                  <X className="w-3.5 h-3.5" /> Clear filters
                </button>
              )}
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
                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border capitalize ${
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
                      <span className="text-xs font-mono font-bold text-slate-300">{r.result.riskScore}<span className="text-slate-600 font-normal">/100</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          r.result.riskLevel === 'critical' ? 'bg-red-500' :
                          r.result.riskLevel === 'high'     ? 'bg-orange-500' :
                          r.result.riskLevel === 'medium'   ? 'bg-yellow-500' :
                                                              'bg-sky-500'
                        }`}
                        ref={(el) => { if (el) el.style.width = `${r.result.riskScore ?? 0}%`; }}
                      />
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
