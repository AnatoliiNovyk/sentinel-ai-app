import { useEffect, useState } from 'react';
import {
  Check, Loader2, Timer, CreditCard, Zap, Star, Building2,
  Shield, Rocket, Package, ArrowRight, ExternalLink, Crown,
  Webhook, Users, Plus, Trash2
} from 'lucide-react';
import { supabase, DEFAULT_SLA_CONFIG, SlaConfig } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

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

export default function Settings() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [plan, setPlan] = useState('free');
  const [sla, setSla] = useState<SlaConfig>(DEFAULT_SLA_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  // F-11 & F-10
  const [webhookUrl, setWebhookUrl] = useState('');
  const [teamEmails, setTeamEmails] = useState<{email: string, role: string}[]>([
    { email: profile?.email || '', role: 'Owner' }
  ]);
  const [newInvite, setNewInvite] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setCompany(profile.company);
      setPlan(profile.plan);
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

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account, subscription and SLA policies.</p>
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
            const canUpgrade = !isActive && p.id !== 'free';
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
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
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
              onChange={(e) => setNewInvite(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              onClick={() => {
                if (newInvite) {
                  setTeamEmails([...teamEmails, { email: newInvite, role: 'Member' }]);
                  setNewInvite('');
                }
              }}
              disabled={!newInvite}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-50 rounded-md text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" /> Invite
            </button>
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-5 py-2.5 rounded-md text-sm transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
