import { useState, useMemo } from 'react';
import { Terminal, Copy, Check, Info, Code, Search, Zap, Clock, ShieldCheck, AlertCircle } from 'lucide-react';

type Method = 'GET' | 'POST';

interface Endpoint {
  id: string;
  method: Method;
  path: string;
  label: string;
  description: string;
  curl: string;
  response: string;
}

export default function ApiDocs() {
  const [copied, setCopied] = useState<string | null>(null);
  const [methodFilter, setMethodFilter] = useState<'all' | Method>('all');
  const [search, setSearch] = useState('');

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const ENDPOINTS: Endpoint[] = [
    {
      id: 'scan-dispatch',
      method: 'POST',
      path: '/functions/v1/scan-dispatch',
      label: 'Start a Scan',
      description: 'Trigger a new scan job asynchronously. Picked up by your VPS Agent.',
      curl: `curl -X POST https://your-project.supabase.co/functions/v1/scan-dispatch \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scan_id": "auto-generated-uuid",
    "project_id": "your-project-uuid",
    "scanner": "nmap",
    "target": "example.com"
  }'`,
      response: `{ "status": "queued", "scan_id": "auto-generated-uuid" }`,
    },
    {
      id: 'scan-result',
      method: 'GET',
      path: '/functions/v1/scan-result?scan_id=<id>',
      label: 'Get Scan Result',
      description: 'Fetch the status and findings of a specific scan by its ID.',
      curl: `curl -X GET "https://your-project.supabase.co/functions/v1/scan-result?scan_id=YOUR_SCAN_ID" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      response: `{
  "id": "...",
  "status": "completed",
  "scanner": "nmap",
  "target": "example.com",
  "findings_count": 3,
  "completed_at": "2026-04-25T12:00:00Z"
}`,
    },
    {
      id: 'report-generate',
      method: 'POST',
      path: '/functions/v1/report-generate',
      label: 'Generate Report',
      description: 'Generate a PDF/Markdown report for a project and receive a shareable URL.',
      curl: `curl -X POST https://your-project.supabase.co/functions/v1/report-generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "your-project-uuid",
    "format": "pdf"
  }'`,
      response: `{ "report_id": "...", "public_url": "https://app.sentinel-ai.com/report/..." }`,
    },
    {
      id: 'ai-gateway',
      method: 'POST',
      path: '/functions/v1/ai-gateway',
      label: 'AI Gateway Chat',
      description: 'Send a message to the AI assistant. Supports threat analysis, remediation suggestions.',
      curl: `curl -X POST https://your-project.supabase.co/functions/v1/ai-gateway \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "conversation_id": "optional-uuid",
    "message": "What does CVE-2024-1234 affect?"
  }'`,
      response: `{ "reply": "CVE-2024-1234 affects ...", "conversation_id": "..." }`,
    },
  ];

  const cliExample = `#!/bin/bash
# sentinel-cli - Simple wrapper for Sentinel AI REST API

API_KEY="YOUR_API_KEY"
ENDPOINT="https://your-project.supabase.co/functions/v1/scan-dispatch"

if [ "$1" == "scan" ]; then
  curl -s -X POST $ENDPOINT \\
    -H "Authorization: Bearer $API_KEY" \\
    -H "Content-Type: application/json" \\
    -d "{\\"scan_id\\": \\"$(uuidgen)\\", \\"project_id\\": \\"$2\\", \\"scanner\\": \\"$3\\", \\"target\\": \\"$4\\"}"
  echo "\\nScan queued successfully."
else
  echo "Usage: ./sentinel-cli scan <project_id> <scanner> <target>"
fi`;

  const METHOD_COLOR: Record<Method, string> = {
    POST: 'text-emerald-400 bg-emerald-500/10',
    GET:  'text-sky-400 bg-sky-500/10',
  };

  const visibleEndpoints = useMemo(() => {
    const q = search.toLowerCase();
    return ENDPOINTS.filter(e => {
      const matchMethod = methodFilter === 'all' || e.method === methodFilter;
      const matchSearch = !q || e.label.toLowerCase().includes(q) || e.path.toLowerCase().includes(q);
      return matchMethod && matchSearch;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodFilter, search]);

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">REST API & CLI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Programmatic access to Sentinel AI for your custom automation workflows.
        </p>
      </div>
      {/* API overview stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Code className="w-4 h-4" />,        label: 'Total Endpoints', value: ENDPOINTS.length,                                     color: 'text-emerald-400' },
          { icon: <Zap className="w-4 h-4" />,         label: 'POST Endpoints',  value: ENDPOINTS.filter(e => e.method === 'POST').length,    color: 'text-orange-400' },
          { icon: <ShieldCheck className="w-4 h-4" />, label: 'GET Endpoints',   value: ENDPOINTS.filter(e => e.method === 'GET').length,     color: 'text-sky-400'    },
          { icon: <Clock className="w-4 h-4" />,       label: 'Rate Limit',      value: '100/min',                                            color: 'text-amber-400'  },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center gap-3">
            <div className={s.color}>{s.icon}</div>
            <div>
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>
      {/* Rate limits & auth info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex items-start gap-3 text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Authenticate with your Personal Access Token from the <strong>Settings</strong> page via the <code>Authorization: Bearer</code> header.
          </p>
        </div>
        <div className="flex items-start gap-3 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            <strong>Rate limits:</strong> 100 requests/minute per API key. Scan endpoints are additionally limited to 10 concurrent jobs. Exceeds return <code>429 Too Many Requests</code>.
          </p>
        </div>
      </div>

      {/* Endpoint list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Code className="w-5 h-5 text-emerald-400" /> Endpoints
            <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{visibleEndpoints.length} of {ENDPOINTS.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            {/* Method filter */}
            <div className="flex items-center gap-1 border border-slate-800 rounded-lg p-1 bg-slate-900/40">
              {(['all', 'GET', 'POST'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    methodFilter === m ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {m === 'all' ? 'All' : m}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search endpoints…"
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-800/60 border border-slate-700 rounded-lg text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-500 w-44"
              />
            </div>
          </div>
        </div>

        {visibleEndpoints.length === 0 && (
          <p className="text-sm text-slate-500 py-4">No endpoints match your filter.</p>
        )}

        {visibleEndpoints.map(ep => (
          <div key={ep.id} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${METHOD_COLOR[ep.method]}`}>{ep.method}</span>
                <span className="text-xs font-mono text-slate-300">{ep.path}</span>
                <span className="text-xs text-slate-500">{ep.label}</span>
              </div>
              <button
                onClick={() => copy(ep.curl, ep.id)}
                className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition"
              >
                {copied === ep.id
                  ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy cURL</>}
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-400">{ep.description}</p>
              <div className="bg-[#0d1117] rounded-lg p-3 font-mono text-xs overflow-x-auto text-slate-300 border border-slate-800">
                <pre><code>{ep.curl}</code></pre>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-1">Example response:</p>
                <div className="bg-[#0d1117] rounded-lg p-3 font-mono text-xs overflow-x-auto text-slate-400 border border-slate-800/50">
                  <pre><code>{ep.response}</code></pre>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CLI section */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Terminal className="w-5 h-5 text-sky-400" /> Sentinel CLI (Bash Wrapper)
        </h2>
        <p className="text-sm text-slate-400">
          Save as <code>sentinel-cli</code> and run <code>chmod +x sentinel-cli</code> to trigger scans from your terminal.
        </p>
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
            <span className="text-xs font-mono text-sky-400 font-semibold px-2 py-1 bg-sky-500/10 rounded">sentinel-cli</span>
            <button onClick={() => copy(cliExample, 'cli')} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition">
              {copied === 'cli' ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy Script</>}
            </button>
          </div>
          <div className="p-4 bg-[#0d1117] font-mono text-sm overflow-x-auto text-slate-300">
            <pre><code>{cliExample}</code></pre>
          </div>
        </div>
      </div>
    </div>
  );
}
