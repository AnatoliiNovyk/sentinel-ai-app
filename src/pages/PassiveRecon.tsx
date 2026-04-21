import { useState } from 'react';
import { Search, Server, Globe, AlertTriangle, Loader2, Shield, Info, ExternalLink, Key, EyeOff, Eye } from 'lucide-react';
import { shodanLookupHost, censysLookupHost, ShodanHostInfo, CensysHostInfo } from '../lib/passiveRecon';
import { useAuth } from '../context/AuthContext';

export default function PassiveRecon() {
  const { user } = useAuth();
  const [targetIp, setTargetIp] = useState('');
  const [shodanKey, setShodanKey] = useState(import.meta.env.VITE_SHODAN_API_KEY || '');
  const [censysId, setCensysId] = useState(import.meta.env.VITE_CENSYS_API_ID || '');
  const [censysSecret, setCensysSecret] = useState(import.meta.env.VITE_CENSYS_API_SECRET || '');
  const [showKeys, setShowKeys] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shodanData, setShodanData] = useState<ShodanHostInfo | null>(null);
  const [censysData, setCensysData] = useState<CensysHostInfo | null>(null);

  const handleScan = async () => {
    if (!targetIp.trim()) return;
    setLoading(true);
    setError(null);
    setShodanData(null);
    setCensysData(null);

    try {
      if (!shodanKey && !censysId) {
        throw new Error('Please provide at least one API key (Shodan or Censys).');
      }

      const promises: Promise<void>[] = [];

      if (shodanKey) {
        promises.push(
          shodanLookupHost(targetIp.trim(), shodanKey)
            .then(setShodanData)
            .catch(e => { console.warn('Shodan error:', e); if (!censysId) throw e; })
        );
      }

      if (censysId && censysSecret) {
        promises.push(
          censysLookupHost(targetIp.trim(), censysId, censysSecret)
            .then(setCensysData)
            .catch(e => { console.warn('Censys error:', e); if (!shodanKey) throw e; })
        );
      }

      await Promise.all(promises);
      
      if (!shodanData && !censysData && shodanKey && censysId) {
          setError('No data found from both providers.');
      }

    } catch (err: any) {
      setError(err.message || 'Failed to fetch recon data');
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
          Passive Reconnaissance
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Gather intelligence on IP addresses without sending direct traffic. Uses Shodan and Censys search APIs.
        </p>
      </div>

      {/* Configuration & Input */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" /> API Credentials
            </h2>
            <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition">
              {showKeys ? <><EyeOff className="w-3 h-3" /> Hide keys</> : <><Eye className="w-3 h-3" /> Show keys</>}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Shodan API Key</label>
              <input
                type={showKeys ? 'text' : 'password'}
                value={shodanKey}
                onChange={(e) => setShodanKey(e.target.value)}
                placeholder="Required for Shodan"
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Censys API ID</label>
              <input
                type={showKeys ? 'text' : 'password'}
                value={censysId}
                onChange={(e) => setCensysId(e.target.value)}
                placeholder="Required for Censys"
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Censys API Secret</label>
              <input
                type={showKeys ? 'text' : 'password'}
                value={censysSecret}
                onChange={(e) => setCensysSecret(e.target.value)}
                placeholder="Required for Censys"
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <label className="block text-sm font-medium text-slate-300 mb-2">Target IP Address</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={targetIp}
              onChange={(e) => setTargetIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
              placeholder="e.g. 8.8.8.8"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-4 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
            />
            <button
              onClick={handleScan}
              disabled={loading || !targetIp.trim()}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-md text-sm transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? 'Scanning...' : 'Analyze'}
            </button>
          </div>
        </div>
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {(shodanData || censysData) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Shodan Results */}
          {shodanData && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" /> Shodan Intelligence
                </h3>
                <span className="text-xs text-slate-500">Updated: {new Date(shodanData.last_update).toLocaleDateString()}</span>
              </div>
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-500 block text-xs">Organization</span><span className="text-slate-200">{shodanData.org}</span></div>
                  <div><span className="text-slate-500 block text-xs">ISP</span><span className="text-slate-200">{shodanData.isp}</span></div>
                  <div><span className="text-slate-500 block text-xs">Location</span><span className="text-slate-200">{shodanData.city}, {shodanData.country_name}</span></div>
                  <div><span className="text-slate-500 block text-xs">ASN</span><span className="text-slate-200 font-mono">{shodanData.asn}</span></div>
                </div>

                {shodanData.hostnames.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Hostnames</h4>
                    <div className="flex flex-wrap gap-2">
                      {shodanData.hostnames.map(h => (
                        <span key={h} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">{h}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Open Ports & Services ({shodanData.ports.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {shodanData.services.map(s => (
                      <div key={s.port} className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2.5 py-1.5 rounded flex items-center gap-1.5">
                        <span className="font-mono font-bold">{s.port}</span>
                        <span className="opacity-60">/</span>
                        <span>{s.product || s.proto} {s.version}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {shodanData.vulns.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Vulnerabilities ({shodanData.vulns.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {shodanData.vulns.map(v => (
                        <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noopener noreferrer" className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded transition">
                          {v}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Censys Results */}
          {censysData && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/20 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" /> Censys Intelligence
                </h3>
              </div>
              <div className="p-5 space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-slate-500 block text-xs">Network</span><span className="text-slate-200">{censysData.autonomous_system.name}</span></div>
                  <div><span className="text-slate-500 block text-xs">Prefix</span><span className="text-slate-200 font-mono">{censysData.autonomous_system.bgp_prefix}</span></div>
                  <div><span className="text-slate-500 block text-xs">Location</span><span className="text-slate-200">{censysData.location.city}, {censysData.location.country}</span></div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Services ({censysData.services.length})</h4>
                  <div className="space-y-2">
                    {censysData.services.map(s => (
                      <div key={`${s.port}-${s.transport_protocol}`} className="text-xs border border-slate-800 bg-slate-900 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sky-400 font-bold">{s.port}/{s.transport_protocol}</span>
                          <span className="text-slate-400 capitalize">{s.service_name}</span>
                        </div>
                        {s.certificate && (
                          <div className="mt-2 pt-2 border-t border-slate-800/50">
                            <div className="text-[10px] text-slate-500 mb-0.5">TLS Certificate Subject</div>
                            <div className="text-slate-300 font-mono text-[10px] truncate">{s.certificate.subject_dn}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
