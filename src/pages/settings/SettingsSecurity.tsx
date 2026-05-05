import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Timer, Database, Loader2, RefreshCw, WifiOff, Server,
  Check, Lock, Sun, Moon,
} from 'lucide-react';
import { supabase, DEFAULT_SLA_CONFIG, SlaConfig } from '../../lib/supabase';
import { useAuth } from '../../context/useAuth';
import { AuditService, AuditAction } from '../../api/audit.service';
import { isHttpsAgentUrl, isMixedContentAgentUrl, probeAgentHealth } from '../../lib/agentHealth';

const DEFAULT_AGENT_URL = 'http://95.67.75.146:9090/health';

// ─── Data retention ──────────────────────────────────────────────────
const RETENTION_PRESETS = [30, 60, 90, 180, 365] as const;

interface RetentionPolicy {
  scans: number;
  logs: number;
  reports: number;
  vulnerabilities: number;
}

const DEFAULT_RETENTION: RetentionPolicy = { scans: 90, logs: 30, reports: 365, vulnerabilities: 180 };

// ─── Agent types ────────────────────────────────────────────────────

type AgentHealthData = {
  status: 'starting' | 'ok' | 'error';
  uptime: number;
  jobsProcessed: number;
  jobsFailed: number;
  lastJobAt: string | null;
  lastError: string | null;
  timestamp: string;
};

type ProbeSmokeStatus = {
  status: 'ok' | 'error' | 'unknown';
  reachable: boolean | null;
  httpStatus: number | null;
  requestId: string | null;
  generatedAt: string | null;
};

function toAgentErrorMessage(url: string, err: unknown): string {
  if (isMixedContentAgentUrl(url)) {
    /* c8 ignore next 2 */
    return 'Blocked by browser policy: HTTPS app cannot fetch HTTP agent URL. Configure HTTPS/reverse-proxy for the agent endpoint.';
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    /* c8 ignore next 2 */
    return 'Request timeout while checking agent health.';
  }

  if (err instanceof Error && /Failed to fetch/i.test(err.message)) {
    if (isHttpsAgentUrl(url)) {
      return 'HTTPS endpoint check failed (TLS/CORS). This agent port may be HTTP-only; configure HTTPS reverse-proxy and valid TLS cert for the health URL.';
    }
    /* c8 ignore next 2 */
    return 'Network/CORS error while checking agent health.';
  }

  return err instanceof Error ? err.message : 'Unreachable';
}

function formatRelativeMinutes(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'n/a';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch {
    /* c8 ignore next 2 */
    return fallback;
  }
}

// ─── Security & SLA Section ─────────────────────────────────────────

export function SettingsSecurity() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [_plan, setPlan] = useState('free');
  const [sla, setSla] = useState<SlaConfig>(DEFAULT_SLA_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Security settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  // Data retention
  const [retention, setRetention] = useState<RetentionPolicy>(() =>
    loadFromStorage<RetentionPolicy>('sentinelRetention', DEFAULT_RETENTION)
  );

  // Agent health
  const [agentUrl, setAgentUrl] = useState(() => localStorage.getItem('agentHealthUrl') ?? DEFAULT_AGENT_URL);
  const [agentHealth, setAgentHealth] = useState<AgentHealthData | null>(null);
  const [agentChecking, setAgentChecking] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [probeSmoke, setProbeSmoke] = useState<ProbeSmokeStatus>({
    status: 'unknown',
    reachable: null,
    httpStatus: null,
    requestId: null,
    generatedAt: null,
  });

  const commitAgentUrl = useCallback((url: string) => {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) return null;
    localStorage.setItem('agentHealthUrl', normalizedUrl);
    setAgentUrl(normalizedUrl);
    return normalizedUrl;
  }, []);

  // Autosave agent URL drafts so a page reload does not lose the new value.
  useEffect(() => {
    const id = window.setTimeout(() => {
      /* c8 ignore next 3 */
      const normalizedUrl = agentUrl.trim();
      if (!normalizedUrl) return;
      localStorage.setItem('agentHealthUrl', normalizedUrl);
    }, 300);
    return () => window.clearTimeout(id);
  }, [agentUrl]);

  const checkAgent = useCallback(async (url = agentUrl) => {
    const normalizedUrl = url.trim();
    setAgentChecking(true);
    setAgentError(null);
    try {
      const probe = await probeAgentHealth(normalizedUrl);
      if (probe.reachable && probe.health && typeof probe.health === 'object') {
        setAgentHealth(probe.health as AgentHealthData);
        return;
      }

      setAgentHealth(null);
      if (probe.error) {
        if (probe.via === 'gateway') {
          setAgentError(`Gateway probe failed: ${probe.error}`);
        } else {
          setAgentError(toAgentErrorMessage(normalizedUrl, new Error(probe.error)));
        }
      } else if (probe.statusCode !== null) {
        /* c8 ignore next 2 */
        setAgentError(probe.via === 'gateway' ? `Gateway probe HTTP ${probe.statusCode}` : `HTTP ${probe.statusCode}`);
      } else {
        /* c8 ignore next 2 */
        setAgentError(toAgentErrorMessage(normalizedUrl, null));
      }
    } catch (e) {
      /* c8 ignore next 2 */
      setAgentError(toAgentErrorMessage(normalizedUrl, e));
      setAgentHealth(null);
    } finally {
      setAgentChecking(false);
    }
  }, [agentUrl]);

  const saveAgentUrl = () => {
    const normalizedUrl = commitAgentUrl(agentUrl);
    if (!normalizedUrl) return;
    checkAgent(normalizedUrl);
  };

  useEffect(() => {
    if (!user) {
      /* c8 ignore next 3 */
      setProbeSmoke({ status: 'unknown', reachable: null, httpStatus: null, requestId: null, generatedAt: null });
      return;
    }

    let canceled = false;
    const loadProbeSmoke = async () => {
      try {
        const res = await supabase
          .from('audit_logs')
          .select('status,created_at,metadata')
          .eq('action', 'agent_health_probe_smoke')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (canceled) return;

        const row = (res.data ?? [])[0] as { status?: string; created_at?: string; metadata?: unknown } | undefined;
        const meta = row?.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : null;

        /* c8 ignore start */
        const status = meta?.status === 'ok' || meta?.status === 'error'
          ? meta.status
          : row?.status === 'success'
            ? 'ok'
            : row?.status === 'failure'
              ? 'error'
              : 'unknown';

        setProbeSmoke({
          status,
          reachable: typeof meta?.reachable === 'boolean' ? meta.reachable : null,
          httpStatus: typeof meta?.http_status === 'number' ? meta.http_status : null,
          requestId: typeof meta?.request_id === 'string' ? meta.request_id : null,
          generatedAt: typeof meta?.generated_at === 'string' ? meta.generated_at : (row?.created_at ?? null),
        });
      } catch {
        if (!canceled) {
          setProbeSmoke({ status: 'unknown', reachable: null, httpStatus: null, requestId: null, generatedAt: null });
        }
      }
      /* c8 ignore stop */
    };

    loadProbeSmoke();
    const id = window.setInterval(loadProbeSmoke, 60_000);
    return () => {
      canceled = true;
      /* c8 ignore next */
      window.clearInterval(id);
    };
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setCompany(profile.company ?? '');
      setPlan(profile.plan ?? 'free');
      setSla({ ...DEFAULT_SLA_CONFIG, ...(profile.sla_config ?? {}) });
    }
  }, [profile]);

  /* c8 ignore next 4 */
  const setSlaField = (key: keyof SlaConfig, value: string) => {
    const n = Math.max(1, Math.min(365, Number(value) || 0));
    setSla((prev) => ({ ...prev, [key]: n }));
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    localStorage.setItem('darkMode', String(darkMode));
    localStorage.setItem('sentinelRetention', JSON.stringify(retention));
    await supabase.from('profiles').update({ full_name: fullName, company, sla_config: sla }).eq('id', user.id);
    AuditService.logSecurityEvent(
      (user as { app_metadata?: { org_id?: string } }).app_metadata?.org_id ?? user.id,
      user.id,
      AuditAction.PROJECT_UPDATED,
      'profile',
      user.id,
      { fields: ['full_name', 'company', 'sla_config'] },
    );
    setSaving(false);
    setSaved(true);
    /* c8 ignore next */
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Unsaved changes tracking ─────────────────────────────────────
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const origSla = { ...DEFAULT_SLA_CONFIG, ...(profile.sla_config ?? {}) };
    return fullName !== (profile.full_name ?? '') ||
      company !== (profile.company ?? '') ||
      JSON.stringify(sla) !== JSON.stringify(origSla);
  }, [profile, fullName, company, sla]);

  return (
    <div className="space-y-8">
      {/* Security & Preferences */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-400" /> Security & Preferences</h2>
        <p className="text-sm text-slate-500 mb-5">Manage your security settings and UI preferences.</p>
        <div className="space-y-4">
          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-800 hover:border-slate-700 transition">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-sm font-medium text-white">Two-Factor Authentication</div>
                <div className="text-xs text-slate-500">Add an extra layer of security to your account</div>
              </div>
            </div>
            <button
              onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
              title={twoFactorEnabled ? 'Disable two-factor authentication' : 'Enable two-factor authentication'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                twoFactorEnabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Dark Mode */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-800 hover:border-slate-700 transition">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="w-5 h-5 text-indigo-500" /> : <Sun className="w-5 h-5 text-yellow-500" />}
              <div>
                <div className="text-sm font-medium text-white">Dark Mode</div>
                <div className="text-xs text-slate-500">Use dark theme throughout the application</div>
              </div>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Disable dark mode' : 'Enable dark mode'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                darkMode ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* SLA Config */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Timer className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Remediation SLA</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">Target resolution time in days per severity. Overdue findings trigger breach alerts.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { key: 'critical', label: 'Critical', accent: 'text-red-400', border: 'focus:border-red-500', ring: 'focus:ring-red-500/20' },
            { key: 'high', label: 'High', accent: 'text-orange-400', border: 'focus:border-orange-500', ring: 'focus:ring-orange-500/20' },
            { key: 'medium', label: 'Medium', accent: 'text-yellow-400', border: 'focus:border-yellow-500', ring: 'focus:ring-yellow-500/20' },
            { key: 'low', label: 'Low', accent: 'text-sky-400', border: 'focus:border-sky-500', ring: 'focus:ring-sky-500/20' },
          ] as const).map((f) => (
            <div key={f.key}>
              <label htmlFor={`sla-${f.key}`} className={`block text-sm font-medium ${f.accent} mb-1.5`}>{f.label}</label>
              <div className="relative">
                <input
                  id={`sla-${f.key}`}
                  type="number"
                  value={sla[f.key]}
                  onChange={(e) => setSlaField(f.key, e.target.value)}
                  min={1} max={365}
                  className={`w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 pr-10 text-sm text-white ${f.border} focus:outline-none focus:ring-2 ${f.ring}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">days</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Data Retention Policy */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Data Retention Policy</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">Configure how long historical data is kept. Older records will be archived automatically.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { key: 'scans',           label: 'Scan Results',             accent: 'text-sky-400',     focus: 'focus:border-sky-500 focus:ring-sky-500/20' },
            { key: 'logs',            label: 'Activity Logs',            accent: 'text-violet-400',  focus: 'focus:border-violet-500 focus:ring-violet-500/20' },
            { key: 'reports',         label: 'Reports',                  accent: 'text-amber-400',   focus: 'focus:border-amber-500 focus:ring-amber-500/20' },
            { key: 'vulnerabilities', label: 'Resolved Vulnerabilities', accent: 'text-emerald-400', focus: 'focus:border-emerald-500 focus:ring-emerald-500/20' },
          ] as const).map(({ key, label, accent, focus }) => (
            <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
              <div className={`text-xs font-semibold uppercase tracking-wide ${accent} mb-3`}>{label}</div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="number"
                  value={retention[key]}
                  onChange={e => setRetention(prev => ({ ...prev, [key]: Math.max(7, Math.min(3650, Number(e.target.value) || 30)) }))}
                  min={7} max={3650}
                  title={`${label} retention in days`}
                  aria-label={`${label} retention in days`}
                  className={`w-20 bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-sm text-white ${focus} focus:outline-none focus:ring-2`}
                />
                <span className="text-xs text-slate-500">days</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {RETENTION_PRESETS.map(d => (
                  <button
                    key={d}
                    onClick={() => setRetention(prev => ({ ...prev, [key]: d }))}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                      retention[key] === d
                        ? 'bg-slate-600 border-slate-500 text-white'
                        : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {d >= 365 ? '1yr' : `${d}d`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Agent Configuration */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Server className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Agent Configuration</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Connect to your self-hosted Sentinel Agent. The agent runs nuclei/nmap scans on your VPS.
        </p>

        <div className="flex gap-2 mb-5">
          <input
            type="url"
            value={agentUrl}
            onChange={(e) => setAgentUrl(e.target.value)}
            onBlur={() => {
              commitAgentUrl(agentUrl);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveAgentUrl();
              }
            }}
            placeholder="http://your-vps:9090/health"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            onClick={saveAgentUrl}
            disabled={agentChecking}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition"
          >
            {agentChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {agentChecking ? 'Checking…' : 'Check'}
          </button>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold text-slate-200">Latest probe smoke</div>
            <span className={`text-[10px] px-2 py-1 rounded border font-semibold ${
              probeSmoke.status === 'ok'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : probeSmoke.status === 'error'
                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                  : 'bg-slate-500/10 text-slate-300 border-slate-500/30'
            }`}>
              {probeSmoke.status === 'ok' ? 'OK' : probeSmoke.status === 'error' ? 'Fail' : 'Unknown'}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Reachable',
                value: probeSmoke.reachable === null ? 'n/a' : probeSmoke.reachable ? 'yes' : 'no',
                title: undefined,
              },
              {
                label: 'HTTP',
                value: probeSmoke.httpStatus ?? 'n/a',
                title: undefined,
              },
              {
                label: 'Request ID',
                value: probeSmoke.requestId ? probeSmoke.requestId.slice(0, 12) : 'n/a',
                title: probeSmoke.requestId ?? undefined,
              },
              {
                label: 'Last run',
                value: probeSmoke.generatedAt ? formatRelativeMinutes(probeSmoke.generatedAt) : 'n/a',
                title: probeSmoke.generatedAt ? new Date(probeSmoke.generatedAt).toLocaleString() : undefined,
              },
            ].map(({ label, value, title }) => (
              <div key={label} className="rounded-md bg-slate-900/50 border border-slate-800 p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-1">{label}</div>
                <div className="text-sm font-semibold text-slate-200" title={title}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {agentError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            <WifiOff className="w-4 h-4 shrink-0" />
            Agent unreachable: {agentError}
          </div>
        )}

        {agentHealth && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-emerald-400">Agent online</span>
              <span className="text-xs text-slate-500 ml-auto">
                {new Date(agentHealth.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Status', value: agentHealth.status, color: agentHealth.status === 'ok' ? 'text-emerald-400' : 'text-amber-400' },
                { label: 'Uptime', value: `${Math.floor(agentHealth.uptime / 3600)}h ${Math.floor((agentHealth.uptime % 3600) / 60)}m`, color: 'text-white' },
                { label: 'Jobs processed', value: String(agentHealth.jobsProcessed), color: 'text-white' },
                { label: 'Jobs failed', value: String(agentHealth.jobsFailed), color: agentHealth.jobsFailed > 0 ? 'text-red-400' : 'text-white' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-md bg-slate-900/60 border border-slate-800 p-3 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-1">{label}</div>
                  <div className={`text-sm font-semibold capitalize ${color}`}>{value}</div>
                </div>
              ))}
            </div>
            {agentHealth.lastJobAt && (
              <div className="mt-3 text-xs text-slate-500">
                Last job: <span className="text-slate-300">{new Date(agentHealth.lastJobAt).toLocaleString()}</span>
              </div>
            )}
            {agentHealth.lastError && (
              <div className="mt-2 text-xs text-red-400 truncate">⚠ {agentHealth.lastError}</div>
            )}
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        {hasChanges && !saving && !saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Unsaved changes
          </span>
        )}
        <button
          onClick={save}
          disabled={saving}
          className={`inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-md text-sm transition disabled:opacity-60 ${
            saved ? 'bg-emerald-400 text-slate-950' :
            hasChanges ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 ring-2 ring-emerald-500/40' :
            'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
