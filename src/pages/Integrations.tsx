import { useState } from 'react';
import { Terminal, Github, Gitlab, Copy, Check, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Integrations() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const githubAction = `name: Sentinel AI Scanner
on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Sentinel AI IaC Scan
        uses: sentinel-ai/action@v1
        with:
          api-key: \${{ secrets.SENTINEL_API_KEY }}
          project-id: "\${{ github.repository }}"
          target: "."
          scanner: "tfsec"
          fail-on-critical: true
`;

  const gitlabCi = `sentinel_ai_scan:
  stage: test
  image: sentinelai/cli:latest
  script:
    - sentinel-cli scan --target . --scanner checkov --project-id $CI_PROJECT_PATH
  variables:
    SENTINEL_API_KEY: $SENTINEL_API_KEY
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
`;

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CI/CD Integrations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Embed Sentinel AI into your development pipelines for continuous security testing.
        </p>
      </div>

      <div className="flex items-start gap-2 text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Generate your personal API key from the <strong>Settings</strong> page to use these integrations. Do not hardcode your API key in your repository.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* GitHub Actions */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
            <h2 className="font-semibold flex items-center gap-2">
              <Github className="w-5 h-5 text-slate-300" /> GitHub Actions
            </h2>
            <button
              onClick={() => copy(githubAction, 'github')}
              className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition bg-slate-800 px-2.5 py-1.5 rounded-md"
            >
              {copied === 'github' ? <><Check className="w-3.5 h-3.5 text-emerald-400"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy YAML</>}
            </button>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            <p className="text-sm text-slate-400 mb-4">
              Add this workflow to <code>.github/workflows/sentinel.yml</code> to automatically scan your infrastructure as code on every pull request.
            </p>
            <div className="relative flex-1 bg-[#0d1117] rounded-lg p-4 font-mono text-sm overflow-x-auto border border-slate-800">
              <pre className="text-slate-300"><code>{githubAction}</code></pre>
            </div>
          </div>
        </div>

        {/* GitLab CI */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
            <h2 className="font-semibold flex items-center gap-2">
              <Gitlab className="w-5 h-5 text-orange-500" /> GitLab CI/CD
            </h2>
            <button
              onClick={() => copy(gitlabCi, 'gitlab')}
              className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition bg-slate-800 px-2.5 py-1.5 rounded-md"
            >
              {copied === 'gitlab' ? <><Check className="w-3.5 h-3.5 text-emerald-400"/> Copied</> : <><Copy className="w-3.5 h-3.5"/> Copy YAML</>}
            </button>
          </div>
          <div className="p-5 flex-1 flex flex-col">
            <p className="text-sm text-slate-400 mb-4">
              Add this job to your <code>.gitlab-ci.yml</code> file to block merge requests that introduce critical vulnerabilities.
            </p>
            <div className="relative flex-1 bg-[#0d1117] rounded-lg p-4 font-mono text-sm overflow-x-auto border border-slate-800">
              <pre className="text-slate-300"><code>{gitlabCi}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
