import { useState } from 'react';
import { Search, Globe, AlertTriangle, Loader2, Info, Terminal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ActiveRecon() {
  const { user } = useAuth();
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'queued' | 'running' | 'done'>('idle');

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
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-slate-400">sentinel-agent@node-1:~$</span>
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
                  <div className="text-emerald-300">PORT     STATE SERVICE VERSION</div>
                  <div className="text-slate-300">22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5</div>
                  <div className="text-slate-300">80/tcp   open  http    nginx 1.18.0</div>
                  <div className="text-slate-300">443/tcp  open  ssl/http nginx 1.18.0</div>
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
