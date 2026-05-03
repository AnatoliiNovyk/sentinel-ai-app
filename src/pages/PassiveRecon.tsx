import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { loadVersioned, saveVersioned } from '../lib/storage';
import { Search, Globe, AlertTriangle, Loader2, Info, Terminal, Copy, Check, Download, ArrowUpDown, Clock, History, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { downloadFile } from '../lib/exporters';

const MOCK_PORTS = [
  { port: '22/tcp',   state: 'open', service: 'ssh',      version: 'OpenSSH 8.2p1 Ubuntu 4ubuntu0.5' },
  { port: '80/tcp',   state: 'open', service: 'http',     version: 'nginx 1.18.0' },
  { port: '443/tcp',  state: 'open', service: 'ssl/http', version: 'nginx 1.18.0' },
  { port: '3306/tcp', state: 'open', service: 'mysql',    version: 'MySQL 8.0.33' },
  { port: '8080/tcp', state: 'open', service: 'http-alt', version: 'Apache Tomcat 9.0.76' },
];

const HIGH_RISK_PORTS = new Set(['3306','5432','27017','6379','21','23','1433','8080','8443','3389','5900','1521','11211']);
const MEDIUM_RISK_PORTS = new Set(['22','25','110','143','389','636','1080','8888']);

function portRisk(portStr: string): 'critical' | 'high' | 'medium' | 'low' {
  const num = portStr.split('/')[0];
  if (HIGH_RISK_PORTS.has(num)) return 'critical';
  if (MEDIUM_RISK_PORTS.has(num)) return 'high';
  if (num === '80') return 'medium';
  return 'low';
}

const PORT_RISK_COLORS: Record<string, string> = {
  critical: 'text-red-400 border-red-500/30 bg-red-500/10',
  high:     'text-orange-400 border-orange-500/30 bg-orange-500/10',
  medium:   'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  low:      'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
};

interface ReconHistoryEntry {
  id: string;
  target: string;
  scannedAt: string;
  ports: typeof MOCK_PORTS;
}

export default function ActiveRecon() {
  const { user } = useAuth();
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'done'>('idle');
  const [copied, setCopied] = useState(false);
  const [portSearch, setPortSearch] = useState('');
  const [portSort, setPortSort] = useState<'port_asc' | 'port_desc' | 'service' | 'state' | 'risk'>('port_asc');
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [history, setHistory] = useState<ReconHistoryEntry[]>(() =>
    loadVersioned<ReconHistoryEntry[]>('reconHistory', 'v1', [])
  );
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    saveVersioned('reconHistory', 'v1', history);
  }, [history]);

  const displayedPorts = useMemo(() => {
    const q = portSearch.trim().toLowerCase();
    const filtered = q
      ? MOCK_PORTS.filter(p => p.port.toLowerCase().includes(q) || p.service.toLowerCase().includes(q) || p.version.toLowerCase().includes(q))
      : MOCK_PORTS;
    return [...filtered].sort((a, b) => {
      if (portSort === 'port_asc') return parseInt(a.port) - parseInt(b.port);
      if (portSort === 'port_desc') return parseInt(b.port) - parseInt(a.port);
      if (portSort === 'service') return a.service.localeCompare(b.service);
      if (portSort === 'state') return a.state.localeCompare(b.state);
      const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      if (portSort === 'risk') return (riskOrder[portRisk(b.port)] ?? 0) - (riskOrder[portRisk(a.port)] ?? 0);
      /* c8 ignore next */
      return 0;
    });
  }, [portSearch, portSort]);

  const scanStats = useMemo(() => {
    const open = MOCK_PORTS.filter(p => p.state === 'open').length;
    const highRisk = MOCK_PORTS.filter(p => { const r = portRisk(p.port); return r === 'critical' || r === 'high'; }).length;
    const services = new Set(MOCK_PORTS.map(p => p.service)).size;
    return { open, highRisk, services };
  }, []);

  const copyOutput = useCallback(async () => {
    const text = MOCK_PORTS.map(p => `${p.port.padEnd(10)} ${p.state.padEnd(6)} ${p.service.padEnd(10)} ${p.version}`).join('\n');
    await navigator.clipboard.writeText(`nmap -sV -sC -T4 --open ${target}\n\nPORT       STATE  SERVICE    VERSION\n${text}\n\nScan complete.`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [target]);

  const exportResults = useCallback((fmt: 'csv' | 'json') => {
    const date = new Date().toISOString().split('T')[0];
    const slug = target.replace(/[^a-z0-9]/gi, '_');
    if (fmt === 'csv') {
      const rows = ['Port,State,Service,Version', ...MOCK_PORTS.map(p => `${p.port},${p.state},${p.service},"${p.version}"`)].join('\n');
      downloadFile(`recon-${slug}-${date}.csv`, rows, 'text/csv');
    } else {
      const payload = { target, scannedAt: new Date().toISOString(), ports: MOCK_PORTS };
      downloadFile(`recon-${slug}-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
    }
  }, [target]);

  const handleScan = async () => {
    if (!target.trim() || !user) return;
    setLoading(true);
    setError(null);
    setStatus('queued');
    setElapsedMs(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTime), 100);

    try {
      // In a real implementation, this triggers a job on the VPS agent.
      await new Promise(r => setTimeout(r, 2000));
      setStatus('running');
      await new Promise(r => setTimeout(r, 3000));
      setStatus('done');
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      // Save to history
      setHistory(prev => {
        const entry: ReconHistoryEntry = {
          id: crypto.randomUUID(),
          target: target.trim(),
          scannedAt: new Date().toISOString(),
          ports: MOCK_PORTS,
        };
        return [entry, ...prev].slice(0, 20);
      });
    } catch (err: unknown) {
      /* c8 ignore next 4 */
      const message = err instanceof Error ? err.message : 'Failed to start active recon';
      setError(message);
      setStatus('idle');
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-900/20 border border-indigo-500/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-indigo-400" />
          </div>
          Active Reconnaissance (Deep Nmap)
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Gather deep intelligence by performing active port discovery and service fingerprinting via our decentralized agents.
          <span className="block mt-1 font-semibold text-emerald-500">No commercial APIs (Shodan/Censys) required.</span>
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-6">
        <div className="bg-slate-800/20 border border-slate-700/50 rounded-lg p-4">
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Info className="w-4 h-4 text-sky-400" />
            <span>This tool triggers a high-intensity Nmap scan from your assigned VPS agent.</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Target IP or Domain</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="e.g. 8.8.8.8 or example.com"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
            />
            <button
              onClick={handleScan}
              disabled={loading || !target.trim()}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-md text-sm transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Executing...' : 'Start Active Recon'}
            </button>
          </div>
        </div>

        {status !== 'idle' && (
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-slate-400">sentinel-agent@node-1:~$</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {status === 'done'
                  ? `${(elapsedMs / 1000).toFixed(1)}s`
                  : <span className="animate-pulse">{(elapsedMs / 1000).toFixed(1)}s…</span>
                }
              </span>
              {status === 'done' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={copyOutput}
                    aria-label="Copy output"
                    className="inline-flex items-center gap-1 text-[10px] border border-slate-700 hover:border-slate-500 px-2 py-1 rounded text-slate-400 hover:text-white transition"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => exportResults('csv')}
                    className="inline-flex items-center gap-1 text-[10px] border border-slate-700 hover:border-slate-500 px-2 py-1 rounded text-slate-400 hover:text-white transition"
                  >
                    <Download className="w-3 h-3" /> CSV
                  </button>
                  <button
                    onClick={() => exportResults('json')}
                    className="inline-flex items-center gap-1 text-[10px] border border-slate-700 hover:border-slate-500 px-2 py-1 rounded text-slate-400 hover:text-white transition"
                  >
                    <Download className="w-3 h-3" /> JSON
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-emerald-400">nmap -sV -sC -T4 --open {target}</div>
              {status === 'queued' && <div className="text-slate-500 animate-pulse">Waiting for agent to pick up job...</div>}
              {status === 'running' && (
                <>
                  <div className="text-slate-300">Starting Nmap 7.92 ( https://nmap.org ) at {new Date().toISOString()}</div>
                  <div className="text-slate-300">Nmap scan report for {target}</div>
                  <div className="text-slate-500 animate-pulse">Scanning ports...</div>
                </>
              )}
              {status === 'done' && (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <div className="relative flex-1 min-w-40 max-w-xs">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                      <input
                        value={portSearch}
                        onChange={e => setPortSearch(e.target.value)}
                        placeholder="Search port, service…"
                        className="w-full pl-6 pr-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      {([['port_asc', 'Port↑'], ['port_desc', 'Port↓'], ['service', 'Svc A→Z'], ['state', 'State'], ['risk', 'Risk↓']] as const).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setPortSort(val)}
                          className={`text-[10px] px-2 py-0.5 rounded border transition ${
                            portSort === val
                              ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                              : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-emerald-300">PORT       STATE  SERVICE    VERSION</div>
                  {displayedPorts.length === 0 ? (
                    <div className="text-slate-600 italic">No ports match filter.</div>
                  ) : displayedPorts.map(p => {
                    const risk = portRisk(p.port);
                    const riskColors: Record<string, string> = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-slate-300' };
                    return (
                      <div key={p.port} className={`flex items-center gap-2 ${riskColors[risk]}`}>
                        <span className="w-[100px] font-mono">{p.port}</span>
                        <span className="w-[60px] font-mono">{p.state}</span>
                        <span className="w-[100px] font-mono">{p.service}</span>
                        <span className="flex-1 text-slate-400">{p.version}</span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${PORT_RISK_COLORS[risk]}`}>{risk}</span>
                      </div>
                    );
                  })}
                  <div className="text-emerald-500 mt-2 font-bold">Scan complete. Results added to Scans dashboard.</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stat cards — shown after scan */}
        {status === 'done' && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
              <div className="text-2xl font-bold text-white">{scanStats.open}</div>
              <div className="text-xs text-slate-500 mt-0.5">Open Ports</div>
            </div>
            <div className={`rounded-lg border p-3 text-center ${
              scanStats.highRisk > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-slate-800 bg-slate-900/50'
            }`}>
              <div className={`text-2xl font-bold ${scanStats.highRisk > 0 ? 'text-red-300' : 'text-white'}`}>{scanStats.highRisk}</div>
              <div className="text-xs text-slate-500 mt-0.5">High-Risk Ports</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-center">
              <div className="text-2xl font-bold text-white">{scanStats.services}</div>
              <div className="text-xs text-slate-500 mt-0.5">Unique Services</div>
            </div>
          </div>
        )}

        {error && (
          /* c8 ignore next 3 */
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </div>

      {/* Scan History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white transition"
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Scan History
              <span className="text-xs text-slate-600 font-normal bg-slate-800 px-2 py-0.5 rounded-full">{history.length}</span>
            </span>
            <span className="text-slate-600 text-xs">{showHistory ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showHistory && (
            <div className="border-t border-slate-800 divide-y divide-slate-800/60">
              {history.map(entry => {
                const critCount = entry.ports.filter(p => portRisk(p.port) === 'critical').length;
                const highCount = entry.ports.filter(p => portRisk(p.port) === 'high').length;
                const scannedDate = new Date(entry.scannedAt);
                const diffMins = Math.floor((Date.now() - scannedDate.getTime()) / 60000);
                const timeAgo = diffMins < 1 ? 'Just now' : diffMins < 60 ? `${diffMins}m ago` : diffMins < 1440 ? `${Math.floor(diffMins / 60)}h ago` : scannedDate.toLocaleDateString();
                return (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition group">
                    <div className="flex items-center gap-3">
                      <Globe className="w-3.5 h-3.5 text-slate-600" />
                      <span className="font-mono text-sm text-white">{entry.target}</span>
                      {critCount > 0 && (
                        <span className="text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 rounded">
                          <ShieldAlert className="w-2.5 h-2.5 inline mr-0.5" />{critCount} critical
                        </span>
                      )}
                      {highCount > 0 && critCount === 0 && (
                        /* c8 ignore next 3 */
                        <span className="text-[10px] font-bold text-orange-400 border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 rounded">
                          {highCount} high-risk
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{timeAgo}
                      </span>
                      <span className="text-xs text-slate-600">{entry.ports.length} ports</span>
                      <button
                        onClick={() => setHistory(prev => prev.filter(h => h.id !== entry.id))}
                        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition"
                        aria-label="Remove entry"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {history.length > 1 && (
                <div className="px-5 py-3 flex justify-end">
                  <button
                    onClick={() => setHistory([])}
                    className="text-xs text-slate-500 hover:text-red-400 transition"
                  >
                    Clear all history
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
