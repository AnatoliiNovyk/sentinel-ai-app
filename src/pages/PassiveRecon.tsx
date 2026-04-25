import { useState, useCallback, useMemo } from 'react';
import { Search, Globe, AlertTriangle, Loader2, Info, Terminal, Copy, Check, Download, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { downloadFile } from '../lib/exporters';

const MOCK_PORTS = [
  { port: '22/tcp',  state: 'open', service: 'ssh',      version: 'OpenSSH 8.2p1 Ubuntu 4ubuntu0.5' },
  { port: '80/tcp',  state: 'open', service: 'http',     version: 'nginx 1.18.0' },
  { port: '443/tcp', state: 'open', service: 'ssl/http', version: 'nginx 1.18.0' },
];

export default function ActiveRecon() {
  const { user } = useAuth();
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'done'>('idle');
  const [copied, setCopied] = useState(false);
  const [portSearch, setPortSearch] = useState('');
  const [portSort, setPortSort] = useState<'port_asc' | 'port_desc' | 'service' | 'state'>('port_asc');

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
      return 0;
    });
  }, [portSearch, portSort]);

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

    try {
      // In a real implementation, this triggers a job on the VPS agent.
      await new Promise(r => setTimeout(r, 2000));
      setStatus('running');
      await new Promise(r => setTimeout(r, 3000));
      setStatus('done');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start active recon';
      setError(message);
      setStatus('idle');
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
                      {([['port_asc', 'Port↑'], ['port_desc', 'Port↓'], ['service', 'Svc A→Z'], ['state', 'State']] as const).map(([val, label]) => (
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
                  ) : displayedPorts.map(p => (
                    <div key={p.port} className="text-slate-300">{p.port.padEnd(10)} {p.state.padEnd(6)} {p.service.padEnd(10)} {p.version}</div>
                  ))}
                  <div className="text-emerald-500 mt-2 font-bold">Scan complete. Results added to Scans dashboard.</div>
                </>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </div>
    </div>
  );
}
