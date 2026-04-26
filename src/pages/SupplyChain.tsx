import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { PackageSearch, Upload, AlertTriangle, CheckCircle2, Shield, RefreshCw, FileJson, Download, Filter, Search, ArrowUpDown, X } from 'lucide-react';
import { getGlobalScaAnalyzer, type DependencyRisk } from '../lib/supplyChain';
import { getCircuitBreaker } from '../lib/rateLimiter';
import { downloadFile } from '../lib/exporters';
import { useSearchShortcut } from '../lib/useSearchShortcut';
import { useToast } from '../lib/toastContext';

interface ScanResultUI {
  dep: { name: string; version: string; type: 'prod' | 'dev' };
  vulns: Array<{
    id: string;
    summary: string;
    details: string;
    severity: string;
    fixed_in?: string;
  }>;
}

export default function SupplyChain() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResultUI[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'prod' | 'dev'>('all');
  const [pkgSearch, setPkgSearch] = useState('');
  const [pkgSort, setPkgSort] = useState<'risk_desc' | 'risk_asc' | 'name' | 'vulns_desc'>('risk_desc');
  const pkgSearchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(pkgSearchRef, useCallback(() => setPkgSearch(''), []));
  const toast = useToast();

  useEffect(() => {
    // Initialize circuit breaker for OSV API (3 failures → 30s timeout)
    getCircuitBreaker('osv-api', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30 * 1000,
      volumeThreshold: 1
    });
  }, []);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('package.json') && !file.name.endsWith('package-lock.json')) {
      setError('Only package.json and package-lock.json files are supported currently.');
      return;
    }
    setError(null);
    setFileName(file.name);
    setScanning(true);
    setResults(null);

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      const analyzer = getGlobalScaAnalyzer();
      const scanResult = await analyzer.scan(json);

      if (!scanResult.ok) {
        setError(scanResult.error.message);
        setScanning(false);
        return;
      }

      const sbomScanResult = scanResult.data;
      
      // Transform SbomScanResult.risks to UI format
      const uiResults: ScanResultUI[] = sbomScanResult.risks.map((risk: DependencyRisk) => ({
        dep: {
          name: risk.dependency.name,
          version: risk.dependency.version,
          type: risk.dependency.type as 'prod' | 'dev'
        },
        vulns: risk.vulnerabilities.map(v => ({
          id: v.id,
          summary: v.summary,
          details: v.details,
          severity: v.severity,
          fixed_in: v.fixedIn
        }))
      }));

      setResults(uiResults);
      const vulnCount = uiResults.filter(r => r.vulns.length > 0).length;
      if (vulnCount > 0) {
        toast.warning(`Scan complete — ${vulnCount} vulnerable package${vulnCount !== 1 ? 's' : ''} found.`);
      } else {
        toast.success('Scan complete — no vulnerabilities found.');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to parse package.json. Ensure it is valid JSON.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setScanning(false);
    }
  };

  const SEV_COLORS: Record<string, string> = {
    critical: 'text-red-400 border-red-500/30 bg-red-500/10',
    high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
    medium: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    low: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  };

  const vulnerableDeps = results?.filter(r => r.vulns.length > 0) || [];
  const safeDeps = results?.filter(r => r.vulns.length === 0) || [];

  // Severity breakdown across all vulns
  const sevBreakdown = useMemo(() => {
    const allVulns = (results ?? []).flatMap(r => r.vulns);
    const count = (sev: string) => allVulns.filter(v => v.severity === sev).length;
    const fixable = allVulns.filter(v => v.fixed_in).length;
    return { total: allVulns.length, critical: count('critical'), high: count('high'), medium: count('medium'), low: count('low'), fixable };
  }, [results]);

  const SEV_WEIGHT: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  const filteredVulnDeps = sevFilter === 'all'
    ? vulnerableDeps
    : vulnerableDeps.filter(r => r.vulns.some(v => v.severity === sevFilter));

  const filteredByType = typeFilter === 'all'
    ? filteredVulnDeps
    : filteredVulnDeps.filter(r => r.dep.type === typeFilter);

  const displayedDeps = useMemo(() => {
    const q = pkgSearch.trim().toLowerCase();
    const searched = q ? filteredByType.filter(r => r.dep.name.toLowerCase().includes(q)) : filteredByType;
    return [...searched].sort((a, b) => {
      const maxSev = (r: typeof a) => Math.max(...r.vulns.map(v => SEV_WEIGHT[v.severity] ?? 0));
      if (pkgSort === 'risk_desc') return maxSev(b) - maxSev(a);
      if (pkgSort === 'risk_asc') return maxSev(a) - maxSev(b);
      if (pkgSort === 'name') return a.dep.name.localeCompare(b.dep.name);
      if (pkgSort === 'vulns_desc') return b.vulns.length - a.vulns.length;
      return 0;
    });
  }, [filteredByType, pkgSearch, pkgSort]);

  const exportCsv = () => {
    if (!results) return;
    const rows = ['Package,Version,Type,VulnId,Severity,Summary,FixedIn'];
    for (const r of vulnerableDeps) {
      for (const v of r.vulns) {
        rows.push([
          r.dep.name,
          r.dep.version,
          r.dep.type,
          v.id,
          v.severity,
          `"${v.summary.replace(/"/g, '""')}"`,
          v.fixed_in ?? '',
        ].join(','));
      }
    }
    downloadFile(`supply-chain-${fileName ?? 'results'}.csv`, rows.join('\n'), 'text/csv');
  };

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Supply Chain Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload your manifest files to instantly detect vulnerabilities in third-party dependencies via OSV.dev.
        </p>
      </div>

      {!results && !scanning && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => fileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 ${
            dragging
              ? 'border-emerald-500/60 bg-emerald-500/5 scale-[1.02]'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-xl">
            <PackageSearch className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Upload package.json</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Drop your npm package.json here or click to browse. We will instantly analyze your dependency tree.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="Upload package.json"
            title="Upload package.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {scanning && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center flex flex-col items-center">
          <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
          <h3 className="text-lg font-semibold text-white">Analyzing Dependencies...</h3>
          <p className="text-sm text-slate-400 mt-1">Querying Open Source Vulnerability Database</p>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileJson className="w-5 h-5 text-emerald-400" /> {fileName}
            </h2>
            <div className="flex items-center gap-2">
              {vulnerableDeps.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
              )}
              <button onClick={() => { setResults(null); setFileName(null); setSevFilter('all'); setTypeFilter('all'); }} className="text-sm text-slate-400 hover:text-white flex items-center gap-2">
                <Upload className="w-4 h-4" /> Scan another file
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="text-xs text-slate-500 mb-1">Total Packages</div>
              <div className="text-2xl font-bold text-white">{results.length}</div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="text-xs text-red-400 mb-1">Vulnerable</div>
              <div className="text-2xl font-bold text-red-400">{vulnerableDeps.length}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-xs text-emerald-400 mb-1">Safe</div>
              <div className="text-2xl font-bold text-emerald-400">{safeDeps.length}</div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="text-xs text-red-400 mb-1">Critical CVEs</div>
              <div className="text-2xl font-bold text-red-400">{sevBreakdown.critical}</div>
            </div>
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
              <div className="text-xs text-orange-400 mb-1">High CVEs</div>
              <div className="text-2xl font-bold text-orange-400">{sevBreakdown.high}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="text-xs text-emerald-400 mb-1">Fix Available</div>
              <div className="text-2xl font-bold text-emerald-400">{sevBreakdown.fixable}</div>
            </div>
          </div>

          {/* Risk score bar */}
          {results.length > 0 && (() => {
            const riskPct = Math.round((vulnerableDeps.length / results.length) * 100);
            const riskColor = riskPct >= 50 ? 'bg-red-500' : riskPct >= 25 ? 'bg-orange-500' : riskPct > 0 ? 'bg-yellow-500' : 'bg-emerald-500';
            const riskLabel = riskPct >= 50 ? 'High Risk' : riskPct >= 25 ? 'Medium Risk' : riskPct > 0 ? 'Low Risk' : 'Clean';
            return (
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dependency Risk Score</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      riskPct >= 50 ? 'bg-red-500/10 text-red-400' :
                      riskPct >= 25 ? 'bg-orange-500/10 text-orange-400' :
                      riskPct > 0 ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>{riskLabel}</span>
                    <span className="text-sm font-bold text-white">{riskPct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${riskColor}`}
                    ref={(el) => { if (el) el.style.width = `${riskPct}%`; }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>{vulnerableDeps.length} vulnerable of {results.length} packages</span>
                  {sevBreakdown.fixable > 0 && (
                    <span className="text-emerald-600">{sevBreakdown.fixable} fixable</span>
                  )}
                </div>
              </div>
            );
          })()}

          {vulnerableDeps.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h3 className="font-semibold text-lg text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" /> Vulnerable Dependencies
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium">Severity:</span>
                  {(['all', 'critical', 'high', 'medium', 'low'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setSevFilter(s)}
                      className={`text-xs px-2.5 py-1 rounded-md border capitalize transition ${
                        sevFilter === s
                          ? 'border-red-500/40 bg-red-500/10 text-red-300'
                          : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      {s === 'all' ? 'All' : s}
                    </button>
                  ))}
                  <span className="text-xs text-slate-500 font-medium ml-2">Type:</span>
                  {(['all', 'prod', 'dev'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`text-xs px-2.5 py-1 rounded-md border capitalize transition ${
                        typeFilter === t
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      {t === 'all' ? 'All' : t === 'prod' ? 'Production' : 'Development'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Package search + sort */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-48 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                  <input
                    ref={pkgSearchRef}
                    value={pkgSearch}
                    onChange={e => setPkgSearch(e.target.value)}
                    placeholder="Search package name…"
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  {([['risk_desc', 'Risk ↓'], ['risk_asc', 'Risk ↑'], ['name', 'A→Z'], ['vulns_desc', 'Vulns ↓']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setPkgSort(val)}
                      className={`text-xs px-2.5 py-1.5 rounded-md border transition ${
                        pkgSort === val
                          ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                          : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {pkgSearch && (
                  <span className="text-xs text-slate-500">{displayedDeps.length} result{displayedDeps.length !== 1 ? 's' : ''}</span>
                )}
                {(sevFilter !== 'all' || typeFilter !== 'all' || pkgSearch || pkgSort !== 'risk_desc') && (
                  <button
                    onClick={() => { setSevFilter('all'); setTypeFilter('all'); setPkgSearch(''); setPkgSort('risk_desc'); }}
                    className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-amber-500/40 hover:text-amber-300 px-2.5 py-1.5 rounded-md transition text-slate-400"
                  >
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {displayedDeps.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">
                    No packages match the current filters.
                  </div>
                ) : displayedDeps.map((r, i) => (
                  <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-bold text-white">{r.dep.name}</h4>
                          <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">v{r.dep.version}</span>
                          <span className="text-xs text-slate-400 border border-slate-700 px-2 py-0.5 rounded uppercase">{r.dep.type}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-red-400">{r.vulns.length} vulnerabilities</span>
                    </div>

                    <div className="space-y-3">
                      {r.vulns.map(v => (
                        <div key={v.id} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${SEV_COLORS[v.severity] || SEV_COLORS.medium}`}>
                                  {v.severity}
                                </span>
                                <a href={`https://osv.dev/vulnerability/${v.id}`} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline">
                                  {v.id}
                                </a>
                              </div>
                              <p className="text-sm text-slate-200 mt-2 font-medium">{v.summary}</p>
                            </div>
                            {v.fixed_in && (
                              <div className="shrink-0 text-right">
                                <div className="text-[10px] text-slate-500 uppercase font-bold mb-0.5">Fixed in</div>
                                <div className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded border border-emerald-400/20">
                                  {v.fixed_in}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {safeDeps.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold text-lg text-emerald-400 flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5" /> Verified Safe
              </h3>
              <div className="flex flex-wrap gap-2">
                {safeDeps.map((r, i) => (
                  <div key={i} className="inline-flex items-center gap-1.5 text-xs bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-slate-400">
                    <Shield className="w-3 h-3 text-emerald-500" />
                    <span>{r.dep.name}</span>
                    <span className="font-mono text-slate-600">v{r.dep.version}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
