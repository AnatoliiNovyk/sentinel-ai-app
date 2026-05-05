import { useState, useMemo } from 'react';
import {
  Check, Copy, Github, Gitlab,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────

type PlatformKey = 'github' | 'gitlab' | 'jenkins' | 'bitbucket';
type TemplateKey = 'jira' | 'trello' | 'servicenow';

// ─── CI/CD Tab Component ─────────────────────────────────────────────

export function CiCdTab() {
  const [copied, setCopied] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'all' | PlatformKey>('all');

  const copy = (text: string, id: string) => {
    /* c8 ignore next 4 */
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
          fail-on-critical: true`;

  const gitlabCi = `stages:
  - test

sentinel_ai_scan:
  stage: test
  image: sentinelai/cli:latest
  script:
    - sentinel-cli scan --target . --scanner checkov --project-id $CI_PROJECT_PATH
  variables:
    SENTINEL_API_KEY: $SENTINEL_API_KEY
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"`;

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
}`;

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
            -o scan-result.json
        variables:
          SENTINEL_API_KEY: $SENTINEL_API_KEY
    - step:
        name: Critical Security Gate
        image: stedolan/jq:latest
        script:
          - |
            CRITICAL=$(jq '.findings[] | select(.severity=="CRITICAL") | length' scan-result.json || echo 0)
            if [ "$CRITICAL" -gt 0 ]; then
              echo "❌ BLOCKED: $CRITICAL critical findings"
              exit 1
            fi
`;

  const jiraTemplate = `{
  "fields": {
    "project": { "key": "SEC" },
    "issuetype": { "name": "Security Vulnerability" },
    "summary": "Critical Security Finding from Sentinel AI",
    "description": "Automated security scan detected a critical vulnerability.",
    "customfield_10000": "critical",
    "customfield_10001": {
      "findings": [
        {
          "type": "IaC",
          "resource": "example.tf:line 42",
          "description": "Missing encryption at rest",
          "severity": "CRITICAL",
          "remediation": "Add encryption_key = aws_kms_key.example.id"
        }
      ],
      "scanner": "tfsec",
      "timestamp": "2026-04-29T10:00:00Z"
    },
    "labels": ["sentinel-ai", "security", "automated"],
    "priority": { "id": "1" }
  }
}
`;

  const trelloTemplate = `{
  "name": "🔴 CRITICAL: Sentinel AI Security Finding",
  "desc": "**Severity:** CRITICAL\n**Scanner:** tfsec\n**Type:** Infrastructure as Code\n\nFindings:\n- Missing encryption at rest\n- Unencrypted database configuration\n\nRemediation:\n1. Add KMS encryption key\n2. Enable encryption in database config\n3. Re-run security scan\n4. Update documentation",
  "pos": "top",
  "due": "2026-05-06T17:00:00.000Z",
  "labels": ["Security", "Critical", "Sentinel-AI"],
  "members": [],
  "customFields": {
    "scanner": "tfsec",
    "resources_affected": "3",
    "cve_references": ["CVE-2024-1234"]
  }
}
`;

  const serviceNowTemplate = `{
  "short_description": "Critical IaC Vulnerability - Sentinel AI Scan",
  "description": "Automated security scan identified critical infrastructure vulnerabilities. Immediate remediation required to prevent exploitation.",
  "assignment_group": "Security Team",
  "urgency": "1",
  "impact": "1",
  "priority": "1",
  "category": "security",
  "subcategory": "infrastructure",
  "u_findings": [
    {
      "resource": "terraform/main.tf:42",
      "rule_id": "AVD-AWS-0037",
      "rule_name": "Encryption at rest not enabled",
      "severity": "CRITICAL",
      "recommendation": "aws_s3_bucket_server_side_encryption_configuration"
    }
  ],
  "u_scanner": "tfsec",
  "u_scan_timestamp": "2026-04-29T10:00:00Z",
  "u_cis_benchmark": "CIS AWS Foundations",
  "u_auto_remediation": false,
  "attachment": {
    "file_name": "sentinel-ai-scan-report.json",
    "content_type": "application/json"
  }
}
`;

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

  const TEMPLATE_CARDS: Array<{
    id: TemplateKey;
    title: string;
    icon: React.ReactNode;
    description: string;
    filename: string;
    code: string;
  }> = [
    {
      id: 'jira',
      title: 'Jira Issue Template',
      icon: <span className="text-blue-400 font-bold text-sm">J</span>,
      description: 'Auto-create Jira tickets with security findings and SLA tracking.',
      filename: 'jira-issue.json',
      code: jiraTemplate,
    },
    {
      id: 'trello',
      title: 'Trello Card Template',
      icon: <span className="text-blue-500 font-bold text-sm">T</span>,
      description: 'Create Trello cards for vulnerability tracking and team collaboration.',
      filename: 'trello-card.json',
      code: trelloTemplate,
    },
    {
      id: 'servicenow',
      title: 'ServiceNow Incident Template',
      icon: <span className="text-slate-400 font-bold text-sm">S</span>,
      description: 'Integrate with ServiceNow for centralized incident and change management.',
      filename: 'servicenow-incident.json',
      code: serviceNowTemplate,
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
          Embed Sentinel AI scans into your pipeline. Copy the snippet below and drop it into your repo.
        </p>
      </div>

      {/* Platform filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all', label: 'All' },
          { key: 'github', label: 'GitHub' },
          { key: 'gitlab', label: 'GitLab' },
          { key: 'jenkins', label: 'Jenkins' },
          { key: 'bitbucket', label: 'Bitbucket' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPlatform(key)}
            className={`text-xs px-3 py-1.5 rounded-md border transition ${
              platform === key
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* CI/CD Cards */}
      <div className="space-y-6">
        {visibleCards.map((card) => (
          <div key={card.id} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="mt-0.5">{card.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-slate-100">{card.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">
                    {card.filename}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{card.description}</p>
              </div>
              <button
                onClick={() => copy(card.code, card.id)}
                title="Copy YAML"
                aria-label="Copy YAML"
                className="flex-shrink-0 inline-flex items-center gap-1.5 text-slate-500 hover:text-white transition p-1.5 rounded-md hover:bg-slate-800 text-xs"
              >
                {copied === card.id ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy YAML</span>
                  </>
                )}
              </button>
            </div>
            <div className="border-t border-slate-800 bg-slate-950/50">
              <pre className="p-4 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
                <code>{card.code}</code>
              </pre>
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-800" />

      {/* Template Cards */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Ticket Templates</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use these JSON templates to auto-create tickets in your issue tracker when vulnerabilities are found.
        </p>
      </div>

      <div className="space-y-6">
        {TEMPLATE_CARDS.map((card) => (
          <div key={card.id} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="mt-0.5">{card.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-slate-100">{card.title}</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">
                    {card.filename}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{card.description}</p>
              </div>
              <button
                onClick={() => copy(card.code, card.id)}
                title="Copy to clipboard"
                className="flex-shrink-0 text-slate-500 hover:text-white transition p-1.5 rounded-md hover:bg-slate-800"
              >
                {copied === card.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="border-t border-slate-800 bg-slate-950/50">
              <pre className="p-4 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
                <code>{card.code}</code>
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
