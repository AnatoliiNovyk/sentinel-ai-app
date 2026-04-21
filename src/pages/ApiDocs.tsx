import { useState } from 'react';
import { Terminal, Copy, Check, Info, Code, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ApiDocs() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const curlScan = `curl -X POST https://your-project.supabase.co/functions/v1/scan-dispatch \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scan_id": "auto-generated-uuid",
    "project_id": "your-project-uuid",
    "scanner": "nmap",
    "target": "example.com"
  }'`;

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

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">REST API & CLI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Programmatic access to Sentinel AI for your custom automation workflows.
        </p>
      </div>

      <div className="flex items-start gap-2 text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          To authenticate, you need to use your Personal Access Token (API Key) generated from the Settings page. Pass it in the <code>Authorization: Bearer</code> header.
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-slate-800 pb-2">
          <Code className="w-5 h-5 text-emerald-400" /> Start a Scan (REST API)
        </h2>
        <p className="text-sm text-slate-400">
          Trigger a new scan job asynchronously. The job will be picked up by your VPS Agent.
        </p>
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
            <span className="text-xs font-mono text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 rounded">POST /scan-dispatch</span>
            <button onClick={() => copy(curlScan, 'curl')} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition">
              {copied === 'curl' ? <><Check className="w-3.5 h-3.5 text-emerald-400"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy cURL</>}
            </button>
          </div>
          <div className="p-4 bg-[#0d1117] font-mono text-sm overflow-x-auto text-slate-300">
            <pre><code>{curlScan}</code></pre>
          </div>
        </div>
      </div>

      <div className="space-y-6 mt-12">
        <h2 className="text-xl font-semibold flex items-center gap-2 border-b border-slate-800 pb-2">
          <Terminal className="w-5 h-5 text-sky-400" /> Sentinel CLI (Bash Wrapper)
        </h2>
        <p className="text-sm text-slate-400">
          You can create a simple CLI wrapper to trigger scans directly from your terminal. Save this as <code>sentinel-cli</code> and <code>chmod +x sentinel-cli</code>.
        </p>
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
            <span className="text-xs font-mono text-sky-400 font-semibold px-2 py-1 bg-sky-500/10 rounded">sentinel-cli</span>
            <button onClick={() => copy(cliExample, 'cli')} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition">
              {copied === 'cli' ? <><Check className="w-3.5 h-3.5 text-emerald-400"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy Script</>}
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
