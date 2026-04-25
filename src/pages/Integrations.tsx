import { useState, useMemo } from 'react';
import { Github, Gitlab, Copy, Check, Info } from 'lucide-react';

export default function Integrations() {
  const [copied, setCopied] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'all' | 'github' | 'gitlab' | 'jenkins' | 'bitbucket'>('all');

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

  const jenkinsfile = `pipeline {
  agent any
  environment {
    SENTINEL_API_KEY = credentials('sentinel-api-key')
  }
  stages {
    stage('Security Scan') {
      steps {
        sh '''
          curl -X POST https://your-project.supabase.co/functions/v1/scan-dispatch \\
            -H "Authorization: Bearer $SENTINEL_API_KEY" \\
            -H "Content-Type: application/json" \\
            -d '{"scanner": "tfsec", "target": ".", "project_id": "YOUR_PROJECT_ID"}'
        '''
      }
    }
  }
}
`;

  const bitbucketPipeline = `pipelines:
  default:
    - step:
        name: Sentinel AI Security Scan
        image: curlimages/curl:latest
        script:
          - >
            curl -X POST https://your-project.supabase.co/functions/v1/scan-dispatch
            -H "Authorization: Bearer $SENTINEL_API_KEY"
            -H "Content-Type: application/json"
            -d '{"scanner": "tfsec", "target": ".", "project_id": "$BITBUCKET_REPO_SLUG"}'
        variables:
          SENTINEL_API_KEY: $SENTINEL_API_KEY
`;

  type PlatformKey = 'github' | 'gitlab' | 'jenkins' | 'bitbucket';

  const CARDS: Array<{
    id: PlatformKey;
    title: string;
    icon: React.ReactNode;
    description: string;
    filename: string;
    code: string;
  }> = [
    {
      id: 'github',
      title: 'GitHub Actions',
      icon: <Github className="w-5 h-5 text-slate-300" />,
      description: 'Add this workflow to .github/workflows/sentinel.yml to scan on every pull request.',
      filename: '.github/workflows/sentinel.yml',
      code: githubAction,
    },
    {
      id: 'gitlab',
      title: 'GitLab CI/CD',
      icon: <Gitlab className="w-5 h-5 text-orange-500" />,
      description: 'Add this job to your .gitlab-ci.yml to block merge requests with critical issues.',
      filename: '.gitlab-ci.yml',
      code: gitlabCi,
    },
    {
      id: 'jenkins',
      title: 'Jenkins Pipeline',
      icon: <span className="text-red-400 font-bold text-sm">J</span>,
      description: 'Add a declarative pipeline stage to your Jenkinsfile. Store the API key in Jenkins credentials.',
      filename: 'Jenkinsfile',
      code: jenkinsfile,
    },
    {
      id: 'bitbucket',
      title: 'Bitbucket Pipelines',
      icon: <span className="text-sky-400 font-bold text-sm">B</span>,
      description: 'Add this step to bitbucket-pipelines.yml. Set SENTINEL_API_KEY in your repository variables.',
      filename: 'bitbucket-pipelines.yml',
      code: bitbucketPipeline,
    },
  ];

  const visibleCards = useMemo(
    () => platform === 'all' ? CARDS : CARDS.filter(c => c.id === platform),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform]
  );

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

      {/* Platform filter tabs */}
      <div className="flex items-center gap-1.5 border border-slate-800 rounded-lg p-1 w-fit bg-slate-900/40">
        {(['all', 'github', 'gitlab', 'jenkins', 'bitbucket'] as const).map((p) => {
          const labels: Record<typeof p, string> = { all: 'All', github: 'GitHub', gitlab: 'GitLab', jenkins: 'Jenkins', bitbucket: 'Bitbucket' };
          return (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                platform === p
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {labels[p]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {visibleCards.map((card) => (
          <div key={card.id} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
              <h2 className="font-semibold flex items-center gap-2">
                {card.icon} {card.title}
              </h2>
              <button
                onClick={() => copy(card.code, card.id)}
                className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition bg-slate-800 px-2.5 py-1.5 rounded-md"
              >
                {copied === card.id
                  ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy YAML</>}
              </button>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <p className="text-sm text-slate-400 mb-1">{card.description}</p>
              <p className="text-xs text-slate-600 font-mono mb-4">{card.filename}</p>
              <div className="relative flex-1 bg-[#0d1117] rounded-lg p-4 font-mono text-sm overflow-x-auto border border-slate-800">
                <pre className="text-slate-300"><code>{card.code}</code></pre>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
