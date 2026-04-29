import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Check, Loader2, Timer, CreditCard, Zap, Star, Building2,
  Shield, Rocket, Package, ArrowRight, ExternalLink, Crown,
  Webhook, Users, Plus, Trash2, Server, RefreshCw, WifiOff,
  Eye, EyeOff, Key, Lock, Moon, Sun,
  Bell, Mail, Inbox, Database,
} from 'lucide-react';
import { supabase, DEFAULT_SLA_CONFIG, SlaConfig } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { ApiRateLimitsPanel } from '../components/ApiRateLimitsPanel';
import { isHttpsAgentUrl, isMixedContentAgentUrl, probeAgentHealth } from '../lib/agentHealth';

const DEFAULT_AGENT_URL = 'http://95.67.75.146:9090/health';

// ─── Data retention ──────────────────────────────────────────────────────────
const RETENTION_PRESETS = [30, 60, 90, 180, 365] as const;

interface RetentionPolicy {
  scans: number;
  logs: number;
  reports: number;
  vulnerabilities: number;
}

const DEFAULT_RETENTION: RetentionPolicy = { scans: 90, logs: 30, reports: 365, vulnerabilities: 180 };

// ─── Notification preferences ─────────────────────────────────────────────────
type DigestFrequency = 'realtime' | 'daily' | 'weekly';
type MinSeverity = 'low' | 'medium' | 'high' | 'critical';

interface NotifPrefs {
  channels: { email: boolean; inApp: boolean; webhook: boolean };
  minSeverity: MinSeverity;
  digest: DigestFrequency;
}

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  channels: { email: true, inApp: true, webhook: false },
  minSeverity: 'medium',
  digest: 'realtime',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

type AgentHealthData = {
  status: 'starting' | 'ok' | 'error';
  uptime: number;
  jobsProcessed: number;
  jobsFailed: number;
  lastJobAt: string | null;
  lastError: string | null;
  timestamp: string;
};

function toAgentErrorMessage(url: string, err: unknown): string {
  if (isMixedContentAgentUrl(url)) {
    return 'Blocked by browser policy: HTTPS app cannot fetch HTTP agent URL. Configure HTTPS/reverse-proxy for the agent endpoint.';
  }

  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Request timeout while checking agent health.';
  }

  if (err instanceof Error && /Failed to fetch/i.test(err.message)) {
    if (isHttpsAgentUrl(url)) {
      return 'HTTPS endpoint check failed (TLS/CORS). This agent port may be HTTP-only; configure HTTPS reverse-proxy and valid TLS cert for the health URL.';
    }
    return 'Network/CORS error while checking agent health.';
  }

  return err instanceof Error ? err.message : 'Unreachable';
}

// ─── Plan definitions ─────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    label: 'Free',
    price: '$0',
    period: '/mo',
    description: 'For individuals getting started with security audits',
    icon: Shield,
    color: 'border-slate-700',
    activeColor: 'border-emerald-500/50 bg-emerald-500/5',
    badge: null,
    features: [
      '3 projects',
      '10 scans / month',
      'nmap + tfsec scanners',
      'PDF reports',
      'Community support',
    ],
    stripePriceId: null,
  },
  {
    id: 'basic',
    label: 'Basic',
    price: '$49',
    period: '/mo',
    description: 'For small teams with regular scanning needs',
    icon: Package,
    color: 'border-slate-700',
    activeColor: 'border-sky-500/50 bg-sky-500/5',
    badge: null,
    features: [
      '10 projects',
      '100 scans / month',
      'All scanners',
      'CVE enrichment (NVD)',
      'Slack & Teams alerts',
      'API access',
      'Email support',
    ],
    stripePriceId: import.meta.env.VITE_STRIPE_BASIC_PRICE_ID ?? null,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '$199',
    period: '/mo',
    description: 'For security teams that need full automation',
    icon: Rocket,
    color: 'border-violet-500/30',
    activeColor: 'border-violet-500/60 bg-violet-500/5',
    badge: 'Most Popular',
    features: [
      'Unlimited projects',
      'Unlimited scans',
      'All scanners + Cloud CSPM',
      'AI-powered remediation',
      'Dark web monitoring',
      'Attack surface map',
      'Compliance evidence export',
      'GitHub CI integration',
      'Priority support',
    ],
    stripePriceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID ?? null,
  },
  {
    id: 'enterprise',
    label: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large enterprises with custom requirements',
    icon: Building2,
    color: 'border-amber-500/30',
    activeColor: 'border-amber-500/60 bg-amber-500/5',
    badge: null,
    features: [
      'Everything in Pro',
      'SSO / SAML',
      'Custom scanners',
      'On-premise deployment',
      'SLA guarantees',
      'Dedicated support',
      'Custom compliance policies',
    ],
    stripePriceId: null,
  },
];

const STRIPE_PORTAL_URL = import.meta.env.VITE_STRIPE_PORTAL_URL ?? null;
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? null;

function ApiKeyRow({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const masked = value ? value.slice(0, 8) + '•'.repeat(Math.max(0, value.length - 8)) : '(not set)';
  const copy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide mb-0.5">{label}</div>
        <div className="text-xs font-mono text-slate-300 truncate">{visible ? (value || '(not set)') : masked}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {value && (
          <>
            <button
              onClick={() => setVisible(v => !v)}
              aria-label={visible ? 'Hide key' : 'Show key'}
              className="text-slate-500 hover:text-slate-300 transition p-1 rounded"
            >
              {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={copy}
              aria-label="Copy key"
              className="text-slate-500 hover:text-slate-300 transition p-1 rounded"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Key className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [plan, setPlan] = useState('free');
  const [sla, setSla] = useState<SlaConfig>(DEFAULT_SLA_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // Security settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');

  // Data retention
  const [retention, setRetention] = useState<RetentionPolicy>(() =>
    loadFromStorage<RetentionPolicy>('sentinelRetention', DEFAULT_RETENTION)
  );

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(() => {
    try {
      const raw = localStorage.getItem('sentinelNotifPrefs');
      if (!raw) return DEFAULT_NOTIF_PREFS;
      const saved = JSON.parse(raw) as Partial<NotifPrefs>;
      return {
        ...DEFAULT_NOTIF_PREFS,
        ...saved,
        channels: { ...DEFAULT_NOTIF_PREFS.channels, ...(saved.channels ?? {}) },
      };
    } catch { return DEFAULT_NOTIF_PREFS; }
  });

  // Agent health
  const [agentUrl, setAgentUrl] = useState(() => localStorage.getItem('agentHealthUrl') ?? DEFAULT_AGENT_URL);
  const [agentHealth, setAgentHealth] = useState<AgentHealthData | null>(null);
  const [agentChecking, setAgentChecking] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

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
        setAgentError(toAgentErrorMessage(normalizedUrl, new Error(probe.error)));
      } else if (probe.statusCode !== null) {
        setAgentError(`HTTP ${probe.statusCode}`);
      } else {
        setAgentError(toAgentErrorMessage(normalizedUrl, null));
      }
    } catch (e) {
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


  const [webhookUrl, setWebhookUrl] = useState('');
  const [showWebhook, setShowWebhook] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [teamEmails, setTeamEmails] = useState<{email: string, role: string}[]>([
    { email: profile?.email || '', role: 'Owner' }
  ]);
  const [newInvite, setNewInvite] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setCompany(profile.company ?? '');
      setPlan(profile.plan ?? 'free');
      setSla({ ...DEFAULT_SLA_CONFIG, ...(profile.sla_config ?? {}) });
    }
  }, [profile]);

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
    localStorage.setItem('sentinelNotifPrefs', JSON.stringify(notifPrefs));
    await supabase.from('profiles').update({ full_name: fullName, company, sla_config: sla }).eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpgrade = async (selectedPlan: typeof PLANS[0]) => {
    if (selectedPlan.id === 'free') return;
    if (selectedPlan.id === 'enterprise') {
      window.open('mailto:sales@santinelai.online?subject=Enterprise%20Inquiry', '_blank');
      return;
    }

    if (!selectedPlan.stripePriceId || !STRIPE_PUBLISHABLE_KEY) {
      // No Stripe configured — open contact page
      window.open('mailto:sales@santinelai.online?subject=Upgrade%20to%20' + selectedPlan.label, '_blank');
      return;
    }

    setUpgrading(selectedPlan.id);
    try {
      // Call Supabase edge function to create Stripe Checkout session
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId: selectedPlan.stripePriceId, planId: selectedPlan.id }),
      });
      if (res.ok) {
        const { url } = await res.json();
        if (url) { window.location.href = url; return; }
      }
    } catch (err) {
      console.warn('[Settings] Stripe checkout error:', err);
    } finally {
      setUpgrading(null);
    }
    // Fallback
    window.open('mailto:sales@santinelai.online?subject=Upgrade%20to%20' + selectedPlan.label, '_blank');
  };

  const openBillingPortal = () => {
    if (STRIPE_PORTAL_URL) window.open(STRIPE_PORTAL_URL, '_blank');
    else window.open('mailto:billing@santinelai.online', '_blank');
  };

  // ── Unsaved changes tracking ─────────────────────────────────────────────
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    const origSla = { ...DEFAULT_SLA_CONFIG, ...(profile.sla_config ?? {}) };
    return fullName !== (profile.full_name ?? '') ||
      company !== (profile.company ?? '') ||
      JSON.stringify(sla) !== JSON.stringify(origSla);
  }, [profile, fullName, company, sla]);

  // ── Account overview stats ────────────────────────────────────────────────
  const slaRulesCount  = Object.keys(sla).length;
  const retentionCount = Object.keys(retention).length;
  const planLabel      = PLANS.find(p => p.id === plan)?.label ?? plan;

  const overviewCards = [
    {
      label: 'Current plan',
      value: planLabel,
      sub: plan === 'free' ? 'Free tier' : 'Paid subscription',
      color: plan === 'enterprise' ? 'text-amber-300' : plan === 'pro' ? 'text-violet-300' : plan === 'basic' ? 'text-sky-300' : 'text-slate-300',
      icon: CreditCard,
    },
    {
      label: 'SLA rules',
      value: String(slaRulesCount),
      sub: 'severity policies',
      color: 'text-emerald-400',
      icon: Timer,
    },
    {
      label: 'Team members',
      value: String(teamEmails.length),
      sub: 'in this org',
      color: 'text-sky-400',
      icon: Users,
    },
    {
      label: 'Retention policies',
      value: String(retentionCount),
      sub: 'data types tracked',
      color: 'text-violet-400',
      icon: Database,
    },
  ];

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account, subscription and SLA policies.</p>
      </div>

      {/* Account overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {overviewCards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{c.label}</span>
              </div>
              <div className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</div>
              <div className="text-[10px] text-slate-600">{c.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Profile */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <h2 className="font-semibold mb-1">Profile</h2>
        <p className="text-sm text-slate-500 mb-5">Your account details.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-sm text-slate-300 mb-1.5">Email</label>
            <input id="email" disabled value={profile?.email ?? ''} className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed" />
          </div>
          <div>
            <label htmlFor="fullName" className="block text-sm text-slate-300 mb-1.5">Full name</label>
            <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <div>
            <label htmlFor="company" className="block text-sm text-slate-300 mb-1.5">Company</label>
            <input id="company" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
        </div>
      </section>

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

      {/* Subscription Plans */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" /> Subscription</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Current plan: <span className="text-white font-medium capitalize">{plan}</span>
            </p>
          </div>
          {plan !== 'free' && (
            <button onClick={openBillingPortal} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition">
              <ExternalLink className="w-3 h-3" /> Manage billing
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const isActive = plan === p.id;
            const isUpgrading = upgrading === p.id;
            return (
              <div key={p.id} className={`relative rounded-xl border p-5 flex flex-col gap-4 transition ${isActive ? p.activeColor : `${p.color} hover:border-slate-600`}`}>
                {p.badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-violet-500 text-white">
                    <Star className="w-2.5 h-2.5" /> {p.badge}
                  </div>
                )}
                {isActive && (
                  <div className="absolute top-3 right-3">
                    <Crown className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-white">{p.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">{p.price}</span>
                    <span className="text-xs text-slate-500">{p.period}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                </div>
                <ul className="space-y-1.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isActive ? (
                  <div className="text-center text-xs text-emerald-400 font-semibold py-1.5">Current plan ✓</div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(p)}
                    disabled={!!upgrading}
                    className={`w-full py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 transition ${
                      p.id === 'enterprise'
                        ? 'border border-amber-500/30 text-amber-300 hover:bg-amber-500/10'
                        : p.id === 'pro'
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    } disabled:opacity-50`}
                  >
                    {isUpgrading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
                    ) : p.id === 'enterprise' ? (
                      <>Contact sales <ArrowRight className="w-3 h-3" /></>
                    ) : (
                      <><Zap className="w-3.5 h-3.5" /> Upgrade</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* API Rate Limits */}
      {user && profile && (
        <ApiRateLimitsPanel userId={user.id} planId={profile.plan ?? 'free'} />
      )}

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
                        : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
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

      {/* Notification Preferences */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Notification Preferences</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">Control how and when you receive security alerts.</p>
        <div className="space-y-6">

          {/* Channels */}
          <div>
            <div className="text-sm text-slate-300 font-medium mb-3">Alert Channels</div>
            <div className="space-y-2">
              {([
                { key: 'email',   label: 'Email notifications', sub: 'Send alerts to your account email',       Icon: Mail    },
                { key: 'inApp',   label: 'In-app notifications', sub: 'Show in the notification bell',          Icon: Inbox   },
                { key: 'webhook', label: 'Webhook delivery',     sub: 'POST events to configured webhook URL',  Icon: Webhook },
              ] as const).map(({ key, label, sub, Icon }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-slate-800 hover:border-slate-700 transition">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm text-white">{label}</div>
                      <div className="text-xs text-slate-500">{sub}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifPrefs(p => ({ ...p, channels: { ...p.channels, [key]: !p.channels[key] } }))}
                    title={notifPrefs.channels[key] ? `Disable ${label}` : `Enable ${label}`}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${notifPrefs.channels[key] ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${notifPrefs.channels[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Minimum severity */}
          <div>
            <div className="text-sm text-slate-300 font-medium mb-3">Minimum Alert Severity</div>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'low',      label: 'Low+',           active: 'bg-sky-500/20 border-sky-500/50 text-sky-300'       },
                { key: 'medium',   label: 'Medium+',        active: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' },
                { key: 'high',     label: 'High+',          active: 'bg-orange-500/20 border-orange-500/50 text-orange-300' },
                { key: 'critical', label: 'Critical only',  active: 'bg-red-500/20 border-red-500/50 text-red-300'        },
              ] as const).map(({ key, label, active }) => (
                <button
                  key={key}
                  onClick={() => setNotifPrefs(p => ({ ...p, minSeverity: key }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    notifPrefs.minSeverity === key ? active : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Digest frequency */}
          <div>
            <div className="text-sm text-slate-300 font-medium mb-3">Alert Digest</div>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'realtime', label: 'Real-time' },
                { key: 'daily',    label: 'Daily digest' },
                { key: 'weekly',   label: 'Weekly digest' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setNotifPrefs(p => ({ ...p, digest: key }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    notifPrefs.digest === key
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Webhooks */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Webhook className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Webhook Integrations</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">Receive real-time notifications in Slack, Microsoft Teams, or custom endpoints.</p>
        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Notification Webhook URL</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showWebhook ? 'text' : 'password'}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 pr-10 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {webhookUrl && (
                <button
                  type="button"
                  onClick={() => setShowWebhook(v => !v)}
                  aria-label={showWebhook ? 'Hide URL' : 'Show URL'}
                  title={showWebhook ? 'Hide URL' : 'Show URL'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showWebhook ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-sm font-medium transition">
              Test
            </button>
          </div>
        </div>
      </section>

      {/* Team Collaboration */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Team Members</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">Invite colleagues to access your projects and vulnerability reports.</p>
        
        <div className="space-y-3 mb-6">
          {teamEmails.map((member, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-lg">
              <div className="text-sm text-slate-200">{member.email}</div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 px-2 py-0.5 rounded border border-slate-700">{member.role}</span>
                {member.role !== 'Owner' && (
                  <button aria-label="Remove member" title="Remove member" onClick={() => setTeamEmails(teamEmails.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm text-slate-300 mb-1.5">Invite new member</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={newInvite}
              onChange={(e) => { setNewInvite(e.target.value); setInviteError(null); }}
              placeholder="colleague@company.com"
              className={`flex-1 bg-slate-900 border rounded-md px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 ${
                inviteError ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-800 focus:border-emerald-500 focus:ring-emerald-500/20'
              }`}
            />
            <button
              onClick={() => {
                if (!newInvite) return;
                const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newInvite);
                if (!valid) { setInviteError('Please enter a valid email address.'); return; }
                if (teamEmails.some(m => m.email === newInvite)) { setInviteError('This email is already in the team.'); return; }
                setTeamEmails([...teamEmails, { email: newInvite, role: 'Member' }]);
                setNewInvite('');
                setInviteError(null);
              }}
              disabled={!newInvite}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 rounded-md text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" /> Invite
            </button>
          </div>
          {inviteError && <p className="text-xs text-red-400 mt-1.5">{inviteError}</p>}
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
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">API Keys</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">Read-only view of your configured environment keys. Manage secrets in your deployment environment.</p>
        <div className="space-y-3">
          {([
            { label: 'Supabase URL', envKey: 'VITE_SUPABASE_URL' },
            { label: 'Supabase Anon Key', envKey: 'VITE_SUPABASE_ANON_KEY' },
            { label: 'AI Gateway URL', envKey: 'VITE_AI_GATEWAY_URL' },
          ] as const).map(({ label, envKey }) => (
            <ApiKeyRow key={envKey} label={label} value={(import.meta.env as Record<string, string | undefined>)[envKey] ?? ''} />
          ))}
        </div>
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
