import { useState, useMemo, useCallback } from 'react';
import {
  Globe, Link2, Shield, Filter, Pencil, Info,
} from 'lucide-react';
import { ServiceId, ServiceConfig, ServiceDef, SERVICES, ServiceCard, loadServices, saveServices } from './integrations/IntegrationsForm';
import { Webhook, WebhookEvent, WebhookRow, WebhookCreator, HealthDashboard, loadWebhooks, saveWebhooks } from './integrations/IntegrationsList';
import { CiCdTab } from './integrations/IntegrationsCloud';

type Tab = 'cicd' | 'services' | 'webhooks';

// exported for test coverage
export function IntegrationsLegacy() {
  const [tab, setTab] = useState<Tab>('services');
  const [services, setServices] = useState<Record<string, ServiceConfig>>(loadServices);
  const [webhooks, setWebhooks] = useState<Webhook[]>(loadWebhooks);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<WebhookEvent | 'all'>('all');

  const allUsedEvents = useMemo(() => {
    const set = new Set<WebhookEvent>();
    webhooks.forEach(w => w.events.forEach(e => set.add(e)));
    return [...set];
  }, [webhooks]);

  const filteredWebhooks = useMemo(() =>
    eventFilter === 'all' ? webhooks : webhooks.filter(w => w.events.includes(eventFilter as WebhookEvent)),
  [webhooks, eventFilter]);

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

  const connectedServicesCount = Object.values(services).filter((s) => s.connected).length;
  const activeWebhooksCount = webhooks.filter((w) => w.enabled).length;

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'services', label: 'Services', icon: <Link2 className="w-4 h-4" />, badge: `${connectedServicesCount}/${SERVICES.length}` },
    { id: 'webhooks', label: 'Webhooks', icon: <Globe className="w-4 h-4" />, badge: webhooks.length > 0 ? `${activeWebhooksCount} active` : undefined },
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
            {t.badge && (
              <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                tab === t.id ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
              }`}>{t.badge}</span>
            )}
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

          {/* Event filter */}
          {allUsedEvents.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <button
                onClick={() => setEventFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-md border transition ${
                  eventFilter === 'all'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                All ({webhooks.length})
              </button>
              {allUsedEvents.map(ev => (
                <button
                  key={ev}
                  onClick={() => setEventFilter(ev === eventFilter ? 'all' : ev)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-mono transition ${
                    eventFilter === ev
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>
          )}

          {webhooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center">
              <Globe className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <div className="text-sm text-slate-400">No webhooks configured yet.</div>
              <div className="text-xs text-slate-600 mt-1">Click "Add Webhook" above to create your first endpoint.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWebhooks.length === 0 && (
                /* c8 ignore next 3 */
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                  No webhooks match the selected event filter.
                </div>
              )}
              {filteredWebhooks.map((hook) => (
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

// exported for test coverage
export { IntegrationsLegacy as Integrations };
export default IntegrationsLegacy;
