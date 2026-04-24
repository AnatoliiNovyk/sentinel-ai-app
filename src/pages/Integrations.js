import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Github, Gitlab, Copy, Check, Info } from 'lucide-react';
export default function Integrations() {
    const [copied, setCopied] = useState(null);
    const copy = (text, id) => {
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
    return (_jsxs("div", { className: "p-8 max-w-5xl space-y-8", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold tracking-tight", children: "CI/CD Integrations" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Embed Sentinel AI into your development pipelines for continuous security testing." })] }), _jsxs("div", { className: "flex items-start gap-2 text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4", children: [_jsx(Info, { className: "w-4 h-4 shrink-0 mt-0.5" }), _jsxs("p", { children: ["Generate your personal API key from the ", _jsx("strong", { children: "Settings" }), " page to use these integrations. Do not hardcode your API key in your repository."] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: [_jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col", children: [_jsxs("div", { className: "px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30", children: [_jsxs("h2", { className: "font-semibold flex items-center gap-2", children: [_jsx(Github, { className: "w-5 h-5 text-slate-300" }), " GitHub Actions"] }), _jsx("button", { onClick: () => copy(githubAction, 'github'), className: "text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition bg-slate-800 px-2.5 py-1.5 rounded-md", children: copied === 'github' ? _jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), " Copy YAML"] }) })] }), _jsxs("div", { className: "p-5 flex-1 flex flex-col", children: [_jsxs("p", { className: "text-sm text-slate-400 mb-4", children: ["Add this workflow to ", _jsx("code", { children: ".github/workflows/sentinel.yml" }), " to automatically scan your infrastructure as code on every pull request."] }), _jsx("div", { className: "relative flex-1 bg-[#0d1117] rounded-lg p-4 font-mono text-sm overflow-x-auto border border-slate-800", children: _jsx("pre", { className: "text-slate-300", children: _jsx("code", { children: githubAction }) }) })] })] }), _jsxs("div", { className: "rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col", children: [_jsxs("div", { className: "px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30", children: [_jsxs("h2", { className: "font-semibold flex items-center gap-2", children: [_jsx(Gitlab, { className: "w-5 h-5 text-orange-500" }), " GitLab CI/CD"] }), _jsx("button", { onClick: () => copy(gitlabCi, 'gitlab'), className: "text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition bg-slate-800 px-2.5 py-1.5 rounded-md", children: copied === 'gitlab' ? _jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3.5 h-3.5 text-emerald-400" }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3.5 h-3.5" }), " Copy YAML"] }) })] }), _jsxs("div", { className: "p-5 flex-1 flex flex-col", children: [_jsxs("p", { className: "text-sm text-slate-400 mb-4", children: ["Add this job to your ", _jsx("code", { children: ".gitlab-ci.yml" }), " file to block merge requests that introduce critical vulnerabilities."] }), _jsx("div", { className: "relative flex-1 bg-[#0d1117] rounded-lg p-4 font-mono text-sm overflow-x-auto border border-slate-800", children: _jsx("pre", { className: "text-slate-300", children: _jsx("code", { children: gitlabCi }) }) })] })] })] })] }));
}
