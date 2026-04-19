import { useEffect, useState } from 'react';
import { Check, Loader2, Timer } from 'lucide-react';
import { supabase, DEFAULT_SLA_CONFIG, SlaConfig } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const PLANS = [
  { id: 'free', label: 'Free', price: '$0' },
  { id: 'basic', label: 'Basic', price: '$49' },
  { id: 'pro', label: 'Pro', price: '$199' },
  { id: 'enterprise', label: 'Enterprise', price: 'Custom' },
];

export default function Settings() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [plan, setPlan] = useState('free');
  const [sla, setSla] = useState<SlaConfig>(DEFAULT_SLA_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    await supabase
      .from('profiles')
      .update({ full_name: fullName, company, plan, sla_config: sla })
      .eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Settings</h1>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 mb-6">
        <h2 className="font-semibold mb-1">Profile</h2>
        <p className="text-sm text-slate-500 mb-5">Your account details.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Email</label>
            <input
              disabled
              value={profile?.email ?? ''}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Company</label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 mb-6">
        <h2 className="font-semibold mb-1">Subscription plan</h2>
        <p className="text-sm text-slate-500 mb-5">Choose the plan that fits your scanning volume.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLANS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlan(p.id)}
              className={`p-4 rounded-lg border text-left transition ${
                plan === p.id
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="text-xs text-slate-400">{p.label}</div>
              <div className="text-lg font-semibold mt-1">{p.price}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Timer className="w-4 h-4 text-emerald-400" />
          <h2 className="font-semibold">Remediation SLA</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Target resolution time in days per severity. Findings beyond the window trigger SLA breach alerts.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {([
            { key: 'critical', label: 'Critical', accent: 'text-red-400' },
            { key: 'high', label: 'High', accent: 'text-orange-400' },
            { key: 'medium', label: 'Medium', accent: 'text-yellow-400' },
            { key: 'low', label: 'Low', accent: 'text-sky-400' },
          ] as const).map((f) => (
            <div key={f.key}>
              <label className={`block text-xs font-medium mb-1.5 ${f.accent}`}>{f.label}</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={sla[f.key]}
                  onChange={(e) => setSlaField(f.key, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-md pl-3 pr-10 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">days</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-5 py-2.5 rounded-md text-sm transition"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
