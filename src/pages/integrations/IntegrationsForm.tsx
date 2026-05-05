/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import {
  Check, CheckCircle2, ChevronDown, ChevronRight, ExternalLink,
  Settings2, X, Zap, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { loadVersioned, saveVersioned } from '../../lib/storage';

// ─── Types ────────────────────────────────────────────────────────────

export type ServiceId = 'jira' | 'slack' | 'github' | 'pagerduty' | 'teams' | 'splunk';

export type ServiceConfig = {
  connected: boolean;
  lastTested?: string;
  testStatus?: 'ok' | 'error' | 'pending';
  fields: Record<string, string>;
};

export type ServiceDef = {
  id: ServiceId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: string;
  fields: { key: string; label: string; type: 'text' | 'password' | 'url'; placeholder: string }[];
  docsUrl: string;
};

// ─── Constants ────────────────────────────────────────────────────────────

const STORAGE_KEY_SERVICES = 'sentinel_service_configs';
const STORAGE_V_SERVICES = 'v1';

export function loadServices(): Record<ServiceId, ServiceConfig> {
  return loadVersioned<Record<ServiceId, ServiceConfig>>(STORAGE_KEY_SERVICES, STORAGE_V_SERVICES, {} as Record<ServiceId, ServiceConfig>);
}

export function saveServices(s: Record<string, ServiceConfig>) {
  saveVersioned(STORAGE_KEY_SERVICES, STORAGE_V_SERVICES, s);
}

export const SERVICES: ServiceDef[] = [
  {
    id: 'jira',
    name: 'Jira',
    description: 'Automatically create Jira issues for critical and high findings with full vulnerability context.',
    icon: <span className="text-blue-400 font-bold text-sm">J</span>,
    color: 'border-blue-500/30 bg-blue-500/5',
    category: 'Issue Tracking',
    docsUrl: 'https://support.atlassian.com/jira-software-cloud/docs/use-the-jira-rest-api/',
    fields: [
      { key: 'base_url', label: 'Jira Base URL', type: 'url', placeholder: 'https://yourcompany.atlassian.net' },
      { key: 'email', label: 'Account Email', type: 'text', placeholder: 'security@company.com' },
      { key: 'api_token', label: 'API Token', type: 'password', placeholder: 'Your Atlassian API token' },
      { key: 'project_key', label: 'Project Key', type: 'text', placeholder: 'SEC' },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send real-time alerts to Slack channels when scans complete or critical vulnerabilities are found.',
    icon: <span className="text-emerald-400 font-bold text-sm">S</span>,
    color: 'border-emerald-500/30 bg-emerald-500/5',
    category: 'Notifications',
    docsUrl: 'https://api.slack.com/messaging/webhooks',
    fields: [
      { key: 'webhook_url', label: 'Slack Webhook URL', type: 'url', placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'channel', label: 'Default Channel', type: 'text', placeholder: '#security-alerts' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync scan results to GitHub Security Advisories and create issues in repositories.',
    icon: <span className="text-slate-300 font-bold text-sm">G</span>,
    color: 'border-slate-500/30 bg-slate-500/5',
    category: 'Source Control',
    docsUrl: 'https://docs.github.com/en/rest/security-advisories',
    fields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxx' },
      { key: 'org', label: 'Organization / Username', type: 'text', placeholder: 'my-org' },
      { key: 'default_repo', label: 'Default Repository', type: 'text', placeholder: 'security-findings' },
    ],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    description: 'Trigger PagerDuty incidents for critical vulnerabilities requiring immediate on-call response.',
    icon: <span className="text-green-400 font-bold text-sm">P</span>,
    color: 'border-green-500/30 bg-green-500/5',
    category: 'Incident Management',
    docsUrl: 'https://developer.pagerduty.com/docs/events-api-v2/overview/',
    fields: [
      { key: 'integration_key', label: 'Integration Key', type: 'password', placeholder: 'Your PagerDuty routing key' },
      { key: 'service_id', label: 'Service ID', type: 'text', placeholder: 'P1234AB' },
    ],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Post security alerts and scan summaries to Teams channels via incoming webhooks.',
    icon: <span className="text-indigo-400 font-bold text-sm">T</span>,
    color: 'border-indigo-500/30 bg-indigo-500/5',
    category: 'Notifications',
    docsUrl: 'https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook',
    fields: [
      { key: 'webhook_url', label: 'Incoming Webhook URL', type: 'url', placeholder: 'https://company.webhook.office.com/...' },
    ],
  },
  {
    id: 'splunk',
    name: 'Splunk',
    description: 'Forward vulnerability and scan events to Splunk SIEM for centralized security monitoring.',
    icon: <span className="text-orange-400 font-bold text-sm">S</span>,
    color: 'border-orange-500/30 bg-orange-500/5',
    category: 'SIEM',
    docsUrl: 'https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector',
    fields: [
      { key: 'hec_url', label: 'HEC URL', type: 'url', placeholder: 'https://splunk:8088/services/collector' },
      { key: 'hec_token', label: 'HEC Token', type: 'password', placeholder: 'Your Splunk HEC token' },
      { key: 'index', label: 'Index', type: 'text', placeholder: 'security' },
    ],
  },
];

// ─── ServiceCard component ──────────────────────────────────────────────────

export function ServiceCard({
  def,
  config,
  onSave,
}: {
  def: ServiceDef;
  config?: ServiceConfig;
  onSave: (id: ServiceId, fields: Record<string, string>, connected: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(config?.fields ?? {});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(
    config?.testStatus === 'ok' || config?.testStatus === 'error' ? config.testStatus : null,
  );
  const connected = config?.connected ?? false;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
    const allFilled = def.fields.every((f) => !!fields[f.key]?.trim());
    const result: 'ok' | 'error' = allFilled ? 'ok' : 'error';
    setTestResult(result);
    setTesting(false);
    if (result === 'ok') {
      onSave(def.id, fields, true);
    }
  };

  const handleSave = () => {
    const allFilled = def.fields.every((f) => !!fields[f.key]?.trim());
    onSave(def.id, fields, allFilled);
    setExpanded(false);
  };

  const handleDisconnect = () => {
    setFields({});
    setTestResult(null);
    onSave(def.id, {}, false);
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${connected ? def.color : 'border-slate-800 bg-slate-900/30'}`}>
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center flex-shrink-0">
          {def.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-100">{def.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">
              {def.category}
            </span>
            {connected && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{def.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={def.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="View documentation"
            className="text-slate-500 hover:text-sky-400 transition p-1.5 rounded-md hover:bg-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {connected && (
            <button
              onClick={handleDisconnect}
              title="Disconnect integration"
              className="text-slate-500 hover:text-red-400 transition p-1.5 rounded-md hover:bg-slate-800 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Collapse settings' : 'Configure integration'}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white transition"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {connected ? 'Settings' : 'Connect'}
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-2 border-t border-slate-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {def.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] text-slate-400 mb-1">{f.label}</label>
                <input
                  type={f.type === 'password' ? 'password' : 'text'}
                  value={fields[f.key] ?? ''}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>
            ))}
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 border ${
              testResult === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}>
              {testResult === 'ok'
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> Connection successful</>
                : <><AlertTriangle className="w-3.5 h-3.5" /> Connection failed — check credentials and URL</>}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={handleTest}
              disabled={testing}
              title="Test connection"
              className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              {testing
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Testing…</>
                : <><Zap className="w-3.5 h-3.5" /> Test Connection</>}
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(false)}
                className="text-xs text-slate-500 hover:text-white px-2.5 py-1.5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-3 py-1.5 rounded-md transition"
              >
                <Check className="w-3.5 h-3.5" /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
