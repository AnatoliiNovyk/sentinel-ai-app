import { useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Layers, Send, Trash2, X, RefreshCw,
} from 'lucide-react';
import { loadVersioned, saveVersioned } from '../lib/storage';

// ─── Types ────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'scan.completed'
  | 'scan.failed'
  | 'vulnerability.critical'
  | 'vulnerability.high'
  | 'report.created'
  | 'sla.breached'
  | 'project.created';

export type Webhook = {
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

// ─── Constants ────────────────────────────────────────────────────────────

export const WEBHOOK_EVENTS: { id: WebhookEvent; label: string; description: string }[] = [
  { id: 'scan.completed', label: 'Scan completed', description: 'Fired when any scan finishes successfully' },
  { id: 'scan.failed', label: 'Scan failed', description: 'Fired when a scan errors out' },
  { id: 'vulnerability.critical', label: 'Critical vulnerability', description: 'Fired when a critical finding is detected' },
  { id: 'vulnerability.high', label: 'High vulnerability', description: 'Fired when a high severity finding is detected' },
  { id: 'report.created', label: 'Report created', description: 'Fired when a new report is generated' },
  { id: 'sla.breached', label: 'SLA breached', description: 'Fired when a vulnerability exceeds its SLA deadline' },
  { id: 'project.created', label: 'Project created', description: 'Fired when a new project is added' },
];

const STORAGE_KEY_WEBHOOKS = 'sentinel_webhooks';
const STORAGE_V_WEBHOOKS = 'v1';

// ─── Storage helpers ────────────────────────────────────────────────────

export function loadWebhooks(): Webhook[] {
  return loadVersioned<Webhook[]>(STORAGE_KEY_WEBHOOKS, STORAGE_V_WEBHOOKS, []);
}

export function saveWebhooks(w: Webhook[]) {
  saveVersioned(STORAGE_KEY_WEBHOOKS, STORAGE_V_WEBHOOKS, w);
}

// ─── WebhookRow component ──────────────────────────────────────────────────

export function WebhookRow({
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
            <span title={new Date(hook.last_triggered).toLocaleString()} className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />{relativeTime(hook.last_triggered)}
            </span>
          )}
          {hook.last_status && (
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
              hook.last_status === 'ok'
                ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-300 bg-red-500/10 border-red-500/20'
            }`}>{hook.last_status === 'ok' ? '200 OK' : 'Error'}</span>
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

// ─── WebhookCreator component ────────────────────────────────────────────────

export function WebhookCreator({ onCreate }: { onCreate: (hook: Webhook) => void }) {
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
        <span className="w-4 h-4">+</span> Add Webhook
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
          <span className="w-4 h-4 text-emerald-400">+</span> New Webhook
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
          <span className="w-3.5 h-3.5">+</span> Create Webhook
        </button>
      </div>
    </div>
  );
}

// ─── HealthDashboard component ──────────────────────────────────────────────

export function HealthDashboard({
  services,
  webhooks,
}: {
  services: Record<string, { connected: boolean }>;
  webhooks: Webhook[];
}) {
  const connectedCount = Object.values(services).filter((s) => s.connected).length;
  const activeWebhooks = webhooks.filter((w) => w.enabled).length;
  const errorWebhooks = webhooks.filter((w) => w.last_status === 'error').length;
  const totalDeliveries = webhooks.reduce((sum, w) => sum + w.delivery_count, 0);
  const triggeredWebhooks = webhooks.filter(w => w.last_triggered);
  const successRate = triggeredWebhooks.length === 0 ? null
    : Math.round((triggeredWebhooks.filter(w => w.last_status === 'ok').length / triggeredWebhooks.length) * 100);

  const stats = [
    { label: 'Services Connected', value: `${connectedCount} / 6`, icon: <span className="w-4 h-4">🔗</span>, color: 'text-emerald-400' },
    { label: 'Active Webhooks', value: `${activeWebhooks} / ${webhooks.length}`, icon: <span className="w-4 h-4">🌐</span>, color: 'text-sky-400' },
    { label: 'Failed Webhooks', value: String(errorWebhooks), icon: <AlertTriangle className="w-4 h-4" />, color: errorWebhooks > 0 ? 'text-red-400' : 'text-slate-500' },
    { label: 'Total Deliveries', value: String(totalDeliveries), icon: <Send className="w-4 h-4" />, color: 'text-purple-400' },
    { label: 'Delivery Success', value: successRate === null ? '—' : `${successRate}%`, icon: <CheckCircle2 className="w-4 h-4" />, color: successRate === null ? 'text-slate-500' : successRate >= 80 ? 'text-emerald-400' : successRate >= 50 ? 'text-yellow-400' : 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3">
          <div className={`mb-2 ${s.color}`}>{s.icon}</div>
          <div className="text-xl font-bold text-white">{s.value}</div>
          <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Helper: relativeTime ────────────────────────────────────────────────

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  /* c8 ignore next 3 */
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}
