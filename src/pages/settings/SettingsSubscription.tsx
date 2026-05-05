import { useState, useEffect } from 'react';
import {
  Check, Loader2, Timer, CreditCard, Zap, Star, Building2,
  Shield, Rocket, Package, ArrowRight, ExternalLink, Crown, Users, Database,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { SlaConfig, DEFAULT_SLA_CONFIG } from '../../lib/supabase';
import { httpPost } from '../../lib/httpClient';
import { ApiRateLimitsPanel } from '../../components/ApiRateLimitsPanel';

// ─── Plan definitions ─────────────────────────────────────────────────
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

// ─── Account overview stats ────────────────────────────────────────────

interface RetentionPolicy {
  scans: number;
  logs: number;
  reports: number;
  vulnerabilities: number;
}

const DEFAULT_RETENTION: RetentionPolicy = { scans: 90, logs: 30, reports: 365, vulnerabilities: 180 };

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

// ─── Subscription Section ───────────────────────────────────────────

export function SettingsSubscription() {
  const { user, profile } = useAuth();
  const [plan, setPlan] = useState('free');
  const [sla, setSla] = useState<SlaConfig>(DEFAULT_SLA_CONFIG);
  const [retention, _setRetention] = useState<RetentionPolicy>(() =>
    loadFromStorage<RetentionPolicy>('sentinelRetention', DEFAULT_RETENTION)
  );
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const [teamEmails, _setTeamEmails] = useState<{ email: string; role: string }[]>([
    { email: profile?.email || '', role: 'Owner' }
  ]);

  useEffect(() => {
    if (profile) {
      setPlan(profile.plan ?? 'free');
      setSla({ ...DEFAULT_SLA_CONFIG, ...(profile.sla_config ?? {}) });
    }
  }, [profile]);

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

  const handleUpgrade = async (selectedPlan: typeof PLANS[0]) => {
    if (selectedPlan.id === 'free') return;
    if (selectedPlan.id === 'enterprise') {
      window.open('mailto:sales@sentinelai.online?subject=Enterprise%20Inquiry', '_blank');
      return;
    }

    if (!selectedPlan.stripePriceId || !STRIPE_PUBLISHABLE_KEY) {
      /* c8 ignore next 3 */
      // No Stripe configured — open contact page
      window.open('mailto:sales@sentinelai.online?subject=Upgrade%20to%20' + selectedPlan.label, '_blank');
      return;
    }

    /* c8 ignore start */
    setUpgrading(selectedPlan.id);
    try {
      // Call Supabase edge function to create Stripe Checkout session
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const result = await httpPost<{ url?: string }>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        { priceId: selectedPlan.stripePriceId, planId: selectedPlan.id },
        { token, timeoutMs: 15_000 },
      );
      /* c8 ignore next 2 */
      if (result.url) { window.location.href = result.url; return; }
    } catch (err) {
      /* c8 ignore next */
      console.warn('[Settings] Stripe checkout error:', err);
    } finally {
      /* c8 ignore next */
      setUpgrading(null);
    }
    // Fallback
    window.open('mailto:sales@sentinelai.online?subject=Upgrade%20to%20' + selectedPlan.label, '_blank');
    /* c8 ignore stop */
  };

  const openBillingPortal = () => {
    if (STRIPE_PORTAL_URL) window.open(STRIPE_PORTAL_URL, '_blank');
    else window.open('mailto:billing@sentinelai.online', '_blank');
  };

  return (
    <div className="space-y-8">
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
                      /* c8 ignore next */
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
    </div>
  );
}
