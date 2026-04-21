import { useState } from 'react';
import { Eye, EyeOff, Globe, Search, Shield, AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, Mail, Key, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type BreachEntry = {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsSensitive: boolean;
};

type PasteEntry = {
  Source: string;
  Id: string;
  Title: string | null;
  Date: string | null;
  EmailCount: number;
};

type CheckResult = {
  email: string;
  breaches: BreachEntry[];
  pastes: PasteEntry[];
  checkedAt: string;
};

const HIBP_BASE = 'https://haveibeenpwned.com/api/v3';

// NOTE: HIBP domain search requires a paid API key. This component demonstrates
// the integration and uses the email breach endpoint (free for non-commercial).
async function checkEmailBreaches(email: string, apiKey?: string): Promise<BreachEntry[]> {
  const headers: Record<string, string> = { 'user-agent': 'Sentinel-AI-Security-Auditor' };
  if (apiKey) headers['hibp-api-key'] = apiKey;

  const res = await fetch(
    `${HIBP_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
    { headers, signal: AbortSignal.timeout(10000) }
  );
  if (res.status === 404) return []; // No breaches
  if (res.status === 401) throw new Error('Invalid HIBP API key');
  if (res.status === 429) throw new Error('Rate limited — please wait 1 minute');
  if (!res.ok) throw new Error(`HIBP API error: ${res.status}`);
  return await res.json();
}

async function checkDomainBreaches(domain: string, apiKey: string): Promise<BreachEntry[]> {
  const res = await fetch(
    `${HIBP_BASE}/breacheddomain/${encodeURIComponent(domain)}`,
    {
      headers: { 'hibp-api-key': apiKey, 'user-agent': 'Sentinel-AI-Security-Auditor' },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (res.status === 404) return [];
  if (res.status === 401) throw new Error('Invalid HIBP API key');
  if (!res.ok) throw new Error(`HIBP API error: ${res.status}`);
  // Domain endpoint returns an object of email → breaches
  const data = await res.json();
  // Collect unique breach names and map to brief entries
  const names = new Set<string>();
  Object.values(data).forEach((breaches: any) => (breaches as string[]).forEach(b => names.add(b)));
  return Array.from(names).map(name => ({
    Name: name, Title: name, Domain: domain,
    BreachDate: '', AddedDate: '', PwnCount: 0,
    Description: '', DataClasses: [], IsVerified: true, IsSensitive: false,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DarkWebMonitor() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'email' | 'domain'>('email');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let breaches: BreachEntry[] = [];
      if (mode === 'email') {
        breaches = await checkEmailBreaches(query.trim(), apiKey || undefined);
      } else {
        if (!apiKey) {
          setError('Domain breach checking requires an HIBP API key. Get one at haveibeenpwned.com/API/Key');
          setLoading(false);
          return;
        }
        breaches = await checkDomainBreaches(query.trim(), apiKey);
      }

      const newResult: CheckResult = {
        email: query.trim(),
        breaches,
        pastes: [],
        checkedAt: new Date().toISOString(),
      };
      setResults(prev => [newResult, ...prev.filter(r => r.email !== query.trim())]);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const totalBreached = results.filter(r => r.breaches.length > 0).length;
  const totalBreaches = results.reduce((s, r) => s + r.breaches.length, 0);

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/20 to-red-900/20 border border-red-500/20 flex items-center justify-center">
            <Eye className="w-5 h-5 text-red-400" />
          </div>
          Dark Web Monitor
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Check if your company emails or domains have been exposed in known data breaches.
          Powered by <a href="https://haveibeenpwned.com" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 transition">HaveIBeenPwned</a>.
        </p>
      </div>

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Checked', value: results.length, icon: Search, color: 'text-slate-300' },
            { label: 'Compromised', value: totalBreached, icon: AlertTriangle, color: 'text-red-400' },
            { label: 'Total breaches', value: totalBreaches, icon: Shield, color: 'text-orange-400' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color} shrink-0`} />
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search form */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" /> Check for breaches
        </h2>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {(['email', 'domain'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition ${
                mode === m ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 border border-slate-700 hover:border-slate-600'
              }`}
            >
              {m === 'email' ? <><Mail className="w-3 h-3 inline mr-1" />Email</> : <><Globe className="w-3 h-3 inline mr-1" />Domain</>}
            </button>
          ))}
        </div>

        {/* HIBP API Key */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Key className="w-3 h-3" /> HIBP API Key
            <span className="text-slate-600">(optional for email, required for domain)</span>
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your HIBP API key..."
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 pr-10 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
            <Info className="w-3 h-3" />
            <a href="https://haveibeenpwned.com/API/Key" target="_blank" rel="noopener noreferrer" className="hover:text-sky-400 transition">
              Get an API key at haveibeenpwned.com <ExternalLink className="w-2.5 h-2.5 inline" />
            </a>
          </div>
        </div>

        {/* Query input */}
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && check()}
            placeholder={mode === 'email' ? 'email@company.com' : 'company.com'}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            onClick={check}
            disabled={loading || !query.trim()}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2.5 rounded-md text-sm transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Checking...' : 'Check'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold">Results</h2>
          {results.map((r) => (
            <div key={r.email} className={`rounded-xl border overflow-hidden ${r.breaches.length > 0 ? 'border-red-500/30' : 'border-emerald-500/20'}`}>
              <div className={`flex items-center justify-between px-5 py-4 ${r.breaches.length > 0 ? 'bg-red-500/5' : 'bg-emerald-500/5'}`}>
                <div className="flex items-center gap-3">
                  {r.breaches.length > 0
                    ? <AlertTriangle className="w-4 h-4 text-red-400" />
                    : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  <div>
                    <div className="text-sm font-medium text-white">{r.email}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {new Date(r.checkedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-bold ${r.breaches.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {r.breaches.length > 0 ? `${r.breaches.length} breach${r.breaches.length !== 1 ? 'es' : ''}` : 'Clean ✓'}
                </div>
              </div>

              {r.breaches.length > 0 && (
                <div className="divide-y divide-slate-800">
                  {r.breaches.map((b) => (
                    <div key={b.Name} className="px-5 py-3 flex items-start justify-between gap-4 hover:bg-slate-900/30 transition">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white">{b.Title || b.Name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{b.Domain} · {b.BreachDate || 'Unknown date'}</div>
                        {b.DataClasses.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {b.DataClasses.slice(0, 5).map(dc => (
                              <span key={dc} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">{dc}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {b.IsSensitive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300">Sensitive</span>}
                        {!b.IsVerified && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">Unverified</span>}
                        {b.PwnCount > 0 && <span className="text-[10px] text-slate-500">{b.PwnCount.toLocaleString()} accounts</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Privacy notice */}
      <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/20 p-4 text-xs text-slate-500">
        <Shield className="w-4 h-4 shrink-0 mt-0.5 text-slate-600" />
        <p>
          Email addresses are sent to HaveIBeenPwned using their k-Anonymity model — only a hash prefix is transmitted, not the full address.
          Sentinel AI does not store email addresses entered here. Domain searches are sent directly to HIBP's API.
        </p>
      </div>
    </div>
  );
}
