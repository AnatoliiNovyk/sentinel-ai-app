import { useState, useMemo, useCallback } from 'react';
import {
  Activity, AlertTriangle, Bell, Check, CheckCircle2, ChevronDown, ChevronRight,
  Copy, ExternalLink, Github, Gitlab, Globe, Info, Layers, Link2, Pencil,
  Plus, RefreshCw, Send, Settings2, Shield, Slack, Trash2, X, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'cicd' | 'services' | 'webhooks';

type ServiceId = 'jira' | 'slack' | 'github' | 'pagerduty' | 'teams' | 'splunk';

type ServiceConfig = {
  connected: boolean;
  lastTested?: string;
  testStatus?: 'ok' | 'error' | 'pending';
  fields: Record<string, string>;
};

type WebhookEvent =
  | 'scan.completed'
  | 'scan.failed'
  | 'vulnerability.critical'
  | 'vulnerability.high'
  | 'report.created'
  | 'sla.breached'
  | 'project.created';

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  enabled: boolean;
  created_at: string;
  last_triggered?: string;
  last_status?: 'ok' | 'error';
  delivery_count: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WEBHOOK_EVENTS: { id: WebhookEvent; label: string; description: string }[] = [
  { id: 'scan.completed', label: 'Scan completed', description: 'Fired when any scan finishes successfully' },
  { id: 'scan.failed', label: 'Scan failed', description: 'Fired when a scan errors out' },
  { id: 'vulnerability.critical', label: 'Critical vulnerability', description: 'Fired when a critical finding is detected' },
  { id: 'vulnerability.high', label: 'High vulnerability', description: 'Fired when a high severity finding is detected' },
  { id: 'report.created', label: 'Report created', description: 'Fired when a new report is generated' },
  { id: 'sla.breached', label: 'SLA breached', description: 'Fired when a vulnerability exceeds its SLA deadline' },
  { id: 'project.created', label: 'Project created', description: 'Fired when a new project is added' },
];

const STORAGE_KEY_SERVICES = 'sentinel_service_configs';
const STORAGE_KEY_WEBHOOKS = 'sentinel_webhooks';

function loadServices(): Record<ServiceId, ServiceConfig> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_SERVICES) ?? '{}');
  } catch { return {}; }
}

function saveServices(s: Record<string, ServiceConfig>) {
  localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(s));
}

function loadWebhooks(): Webhook[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_WEBHOOKS) ?? '[]');
  } catch { return []; }
}

function saveWebhooks(w: Webhook[]) {
  localStorage.setItem(STORAGE_KEY_WEBHOOKS, JSON.stringify(w));
}

// ─── Service definitions ──────────────────────────────────────────────────────

type ServiceDef = {
  id: ServiceId;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: string;
  fields: { key: string; label: string; type: 'text' | 'password' | 'url'; placeholder: string }[];
  docsUrl: string;
};

const SERVICES: ServiceDef[] = [
  {
    id: 'jira',
    name: 'Jira',
    description: 'Automatically create Jira issues for critical and high findings with full vulnerability context.',
    icon: <span className="text-blue-400 font-black text-sm">J</span>,
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
    icon: <Slack className="w-4 h-4 text-emerald-400" />,
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
    icon: <Github className="w-4 h-4 text-slate-300" />,
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
    icon: <Bell className="w-4 h-4 text-green-400" />,
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
    icon: <span className="text-indigo-400 font-black text-sm">T</span>,
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
    icon: <span className="text-orange-400 font-black text-sm">S</span>,
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

// ─── ServiceCard ──────────────────────────────────────────────────────────────

function ServiceCard({
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
    // Simulate: connected if all required fields are filled
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
      {/* Header */}
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

      {/* Config panel */}
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

// ─── WebhookRow ───────────────────────────────────────────────────────────────

function WebhookRow({
  hook,
  onToggle,
  onDelete,
  onTest,
  testing,
}: {
  hook: Webhook;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  testing: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          !hook.enabled ? 'bg-slate-600' :
          hook.last_status === 'error' ? 'bg-red-400' :
          'bg-emerald-400'
        }`} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{hook.name}</span>
            {!hook.enabled && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500">Disabled</span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-mono truncate mt-0.5">{hook.url}</div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
          <span title="Events subscribed" className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> {hook.events.length} events
          </span>
          <span title="Total deliveries" className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> {hook.delivery_count} sent
          </span>
          {hook.last_triggered && (
            <span title="Last triggered">
              {new Date(hook.last_triggered).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onTest(hook.id)}
            disabled={testing === hook.id}
            title="Send test payload"
            className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2 py-1 rounded-md transition disabled:opacity-50 flex items-center gap-1"
          >
            {testing === hook.id
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <Send className="w-3 h-3" />}
            Test
          </button>
          <button
            onClick={() => onToggle(hook.id)}
            title={hook.enabled ? 'Disable webhook' : 'Enable webhook'}
            className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${hook.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hook.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            title="View details"
            className="text-slate-500 hover:text-white transition p-1 rounded-md"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(hook.id)}
            title="Delete webhook"
            className="text-slate-500 hover:text-red-400 transition p-1 rounded-md"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Subscribed Events</div>
              <div className="flex flex-wrap gap-1.5">
                {hook.events.map((ev) => (
                  <span key={ev} className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 font-mono">
                    {ev}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1.5">Webhook Secret</div>
              <code className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 block truncate">
                {hook.secret ? '••••••••' + hook.secret.slice(-4) : 'Not set'}
              </code>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">
            Created {new Date(hook.created_at).toLocaleString()}
            {hook.last_triggered && ` · Last triggered ${new Date(hook.last_triggered).toLocaleString()}`}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WebhookCreator ────────────────────────────────────────────────────────────

function WebhookCreator({ onCreate }: { onCreate: (hook: Webhook) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<Set<WebhookEvent>>(new Set(['scan.completed', 'vulnerability.critical']));
  const [error, setError] = useState('');

  const toggleEvent = (ev: WebhookEvent) =>
    setEvents((prev) => { const n = new Set(prev); if (n.has(ev)) n.delete(ev); else n.add(ev); return n; });

  const handleCreate = () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!url.trim() || !url.startsWith('http')) { setError('Valid URL is required'); return; }
    if (events.size === 0) { setError('Select at least one event'); return; }
    setError('');
    const hook: Webhook = {
      id: crypto.randomUUID(),
      name: name.trim(),
      url: url.trim(),
      secret: secret.trim(),
      events: [...events],
      enabled: true,
      created_at: new Date().toISOString(),
      delivery_count: 0,
    };
    onCreate(hook);
    setName(''); setUrl(''); setSecret(''); setEvents(new Set(['scan.completed', 'vulnerability.critical']));
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg transition"
      >
        <Plus className="w-4 h-4" /> Add Webhook
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" /> New Webhook
        </h3>
        <button onClick={() => setOpen(false)} title="Cancel" className="text-slate-500 hover:text-white transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Slack Security Alerts"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-400 mb-1">Endpoint URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-server.com/webhook"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] text-slate-400 mb-1">Signing Secret (optional)</label>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Used to verify webhook payloads via HMAC-SHA256"
            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
          />
        </div>
      </div>

      <div>
        <div className="text-[11px] text-slate-400 mb-2 uppercase tracking-wider">Events to subscribe</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev.id} className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={events.has(ev.id)}
                onChange={() => toggleEvent(ev.id)}
                className="mt-0.5 accent-emerald-500 flex-shrink-0"
              />
              <div>
                <div className="text-xs font-mono text-slate-300 group-hover:text-white transition">{ev.id}</div>
                <div className="text-[10px] text-slate-500">{ev.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-300 border border-red-500/20 bg-red-500/5 rounded-md px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-white px-3 py-1.5 transition">Cancel</button>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs px-4 py-1.5 rounded-md transition"
        >
          <Plus className="w-3.5 h-3.5" /> Create Webhook
        </button>
      </div>
    </div>
  );
}

// ─── Health Dashboard ─────────────────────────────────────────────────────────

function HealthDashboard({
  services,
  webhooks,
}: {
  services: Record<string, ServiceConfig>;
  webhooks: Webhook[];
}) {
  const connectedCount = Object.values(services).filter((s) => s.connected).length;
  const activeWebhooks = webhooks.filter((w) => w.enabled).length;
  const errorWebhooks = webhooks.filter((w) => w.last_status === 'error').length;
  const totalDeliveries = webhooks.reduce((sum, w) => sum + w.delivery_count, 0);

  const stats = [
    { label: 'Services Connected', value: connectedCount, total: SERVICES.length, icon: <Link2 className="w-4 h-4" />, color: 'text-emerald-400' },
    { label: 'Active Webhooks', value: activeWebhooks, total: webhooks.length, icon: <Globe className="w-4 h-4" />, color: 'text-sky-400' },
    { label: 'Failed Webhooks', value: errorWebhooks, total: webhooks.length, icon: <AlertTriangle className="w-4 h-4" />, color: errorWebhooks > 0 ? 'text-red-400' : 'text-slate-500' },
    { label: 'Total Deliveries', value: totalDeliveries, icon: <Send className="w-4 h-4" />, color: 'text-purple-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3">
          <div className={`mb-2 ${s.color}`}>{s.icon}</div>
          <div className="text-xl font-bold text-white">
            {s.value}
            {s.total !== undefined && <span className="text-sm font-normal text-slate-500"> / {s.total}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── CI/CD tab (extracted from original) ─────────────────────────────────────

function CiCdTab() {
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
          fail-on-critical: true`;

  const gitlabCi = `sentinel_ai_scan:
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
        variables:
          SENTINEL_API_KEY: $SENTINEL_API_KEY`;

  type PlatformKey = 'github' | 'gitlab' | 'jenkins' | 'bitbucket';
  const CARDS: Array<{ id: PlatformKey; title: string; icon: React.ReactNode; description: string; filename: string; code: string }> = [
    { id: 'github', title: 'GitHub Actions', icon: <Github className="w-5 h-5 text-slate-300" />, description: 'Add this workflow to .github/workflows/sentinel.yml to scan on every pull request.', filename: '.github/workflows/sentinel.yml', code: githubAction },
    { id: 'gitlab', title: 'GitLab CI/CD', icon: <Gitlab className="w-5 h-5 text-orange-500" />, description: 'Add this job to your .gitlab-ci.yml to block merge requests with critical issues.', filename: '.gitlab-ci.yml', code: gitlabCi },
    { id: 'jenkins', title: 'Jenkins Pipeline', icon: <span className="text-red-400 font-bold text-sm">J</span>, description: 'Add a declarative pipeline stage to your Jenkinsfile. Store the API key in Jenkins credentials.', filename: 'Jenkinsfile', code: jenkinsfile },
    { id: 'bitbucket', title: 'Bitbucket Pipelines', icon: <span className="text-sky-400 font-bold text-sm">B</span>, description: 'Add this step to bitbucket-pipelines.yml. Set SENTINEL_API_KEY in your repository variables.', filename: 'bitbucket-pipelines.yml', code: bitbucketPipeline },
  ];

  const visibleCards = useMemo(
    () => platform === 'all' ? CARDS : CARDS.filter(c => c.id === platform),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platform],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 text-sm text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-lg p-4">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Generate your personal API key from the <strong>Settings</strong> page. Do not hardcode it in your repository — use secrets/environment variables.</p>
      </div>
      <div className="flex items-center gap-1.5 border border-slate-800 rounded-lg p-1 w-fit bg-slate-900/40">
        {(['all', 'github', 'gitlab', 'jenkins', 'bitbucket'] as const).map((p) => {
          const labels: Record<typeof p, string> = { all: 'All', github: 'GitHub', gitlab: 'GitLab', jenkins: 'Jenkins', bitbucket: 'Bitbucket' };
          return (
            <button key={p} onClick={() => setPlatform(p)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${platform === p ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>
              {labels[p]}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleCards.map((card) => (
          <div key={card.id} className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/30">
              <h2 className="font-semibold flex items-center gap-2">{card.icon} {card.title}</h2>
              <button onClick={() => copy(card.code, card.id)} className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-white transition bg-slate-800 px-2.5 py-1.5 rounded-md">
                {copied === card.id ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy YAML</>}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Integrations() {
  const [tab, setTab] = useState<Tab>('services');
  const [services, setServices] = useState<Record<string, ServiceConfig>>(loadServices);
  const [webhooks, setWebhooks] = useState<Webhook[]>(loadWebhooks);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const handleSaveService = useCallback((id: ServiceId, fields: Record<string, string>, connected: boolean) => {
    setServices((prev) => {
      const next = {
        ...prev,
        [id]: {
          connected,
          fields,
          testStatus: connected ? 'ok' : undefined,
          lastTested: connected ? new Date().toISOString() : undefined,
        } as ServiceConfig,
      };
      saveServices(next);
      return next;
    });
  }, []);

  const handleToggleWebhook = useCallback((id: string) => {
    setWebhooks((prev) => {
      const next = prev.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w);
      saveWebhooks(next);
      return next;
    });
  }, []);

  const handleDeleteWebhook = useCallback((id: string) => {
    setWebhooks((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveWebhooks(next);
      return next;
    });
  }, []);

  const handleTestWebhook = useCallback(async (id: string) => {
    setTestingWebhook(id);
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 500));
    const ok = Math.random() > 0.2; // 80% success rate for demo
    setWebhooks((prev) => {
      const next = prev.map((w) => w.id === id
        ? { ...w, last_triggered: new Date().toISOString(), last_status: ok ? 'ok' : 'error', delivery_count: w.delivery_count + (ok ? 1 : 0) } as Webhook
        : w);
      saveWebhooks(next);
      return next;
    });
    setTestingWebhook(null);
  }, []);

  const handleCreateWebhook = useCallback((hook: Webhook) => {
    setWebhooks((prev) => {
      const next = [hook, ...prev];
      saveWebhooks(next);
      return next;
    });
  }, []);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'services', label: 'Services', icon: <Link2 className="w-4 h-4" /> },
    { id: 'webhooks', label: 'Webhooks', icon: <Globe className="w-4 h-4" /> },
    { id: 'cicd', label: 'CI/CD', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect Sentinel AI to your tools, send real-time alerts, and embed security into your pipelines.
        </p>
      </div>

      {/* Health dashboard */}
      <HealthDashboard services={services} webhooks={webhooks} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t.id
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Connect Sentinel AI to third-party services for issue tracking, notifications, and SIEM.
            </p>
            <span className="text-xs text-slate-500">
              {Object.values(services).filter((s) => s.connected).length} / {SERVICES.length} connected
            </span>
          </div>
          {SERVICES.map((def) => (
            <ServiceCard
              key={def.id}
              def={def}
              config={services[def.id]}
              onSave={handleSaveService}
            />
          ))}
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                Send HTTP POST payloads to your endpoints when Sentinel AI events occur.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Verify payloads using the <code className="text-slate-500">X-Sentinel-Signature</code> header (HMAC-SHA256 of the body).
              </p>
            </div>
            <div className="flex-shrink-0">
              <WebhookCreator onCreate={handleCreateWebhook} />
            </div>
          </div>

          {webhooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center">
              <Globe className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <div className="text-sm text-slate-400">No webhooks configured yet.</div>
              <div className="text-xs text-slate-600 mt-1">Click "Add Webhook" above to create your first endpoint.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((hook) => (
                <WebhookRow
                  key={hook.id}
                  hook={hook}
                  onToggle={handleToggleWebhook}
                  onDelete={handleDeleteWebhook}
                  onTest={handleTestWebhook}
                  testing={testingWebhook}
                />
              ))}
            </div>
          )}

          {/* Payload sample */}
          <details className="rounded-xl border border-slate-800 bg-slate-900/20 overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer text-sm text-slate-400 hover:text-slate-200 transition flex items-center gap-2 select-none">
              <Pencil className="w-3.5 h-3.5" /> Example webhook payload
            </summary>
            <pre className="px-5 py-4 text-xs font-mono text-emerald-300 border-t border-slate-800 overflow-x-auto bg-slate-950">{`{
  "event": "vulnerability.critical",
  "timestamp": "2026-04-26T10:15:30Z",
  "sentinel_version": "1.0",
  "data": {
    "vulnerability_id": "vuln_abc123",
    "title": "SQL Injection in /api/users",
    "severity": "critical",
    "asset": "api.company.com",
    "cve_id": "CVE-2024-1234",
    "project_id": "proj_xyz789",
    "scan_id": "scan_def456"
  }
}`}</pre>
          </details>
        </div>
      )}

      {tab === 'cicd' && <CiCdTab />}
    </div>
  );
}


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
