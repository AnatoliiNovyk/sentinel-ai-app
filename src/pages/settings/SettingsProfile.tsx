import { useState, useEffect, useMemo } from 'react';
import {
  Check, Eye, EyeOff, Key, Mail, Inbox, Webhook, Users, Plus, Trash2, ExternalLink, Bell,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { SlaConfig, DEFAULT_SLA_CONFIG } from '../../lib/supabase';
import { AuditService, AuditAction } from '../../api/audit.service';

// ─── Notification preferences ────────────────────────────────────────────────

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
    /* c8 ignore next 2 */
    return fallback;
  }
}

// ─── ApiKeyRow component ─────────────────────────────────────────────────────

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
  /* c8 ignore start */
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
  /* c8 ignore stop */
}

// ─── Profile Section ─────────────────────────────────────────────────────────

export function SettingsProfile() {
  const { user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');

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

  // Team Collaboration
  const [teamEmails, setTeamEmails] = useState<{ email: string; role: string }[]>([
    { email: profile?.email || '', role: 'Owner' }
  ]);
  const [newInvite, setNewInvite] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setCompany(profile.company ?? '');
    }
  }, [profile]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    localStorage.setItem('sentinelNotifPrefs', JSON.stringify(notifPrefs));
    await supabase.from('profiles').update({ full_name: fullName, company }).eq('id', user.id);
    AuditService.logSecurityEvent(
      (user as { app_metadata?: { org_id?: string } }).app_metadata?.org_id ?? user.id,
      user.id,
      AuditAction.PROJECT_UPDATED,
      'profile',
      user.id,
      { fields: ['full_name', 'company'] },
    );
    setSaving(false);
    setSaved(true);
    /* c8 ignore next */
    setTimeout(() => setSaved(false), 2000);
  };

  // Unsaved changes tracking
  const hasChanges = useMemo(() => {
    if (!profile) return false;
    return fullName !== (profile.full_name ?? '') ||
      company !== (profile.company ?? '');
  }, [profile, fullName, company]);

  return (
    <div className="space-y-8">
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
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div>
            <label htmlFor="company" className="block text-sm text-slate-300 mb-1.5">Company</label>
            <input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
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
                { key: 'email', label: 'Email notifications', sub: 'Send alerts to your account email', Icon: Mail },
                { key: 'inApp', label: 'In-app notifications', sub: 'Show in the notification bell', Icon: Inbox },
                { key: 'webhook', label: 'Webhook delivery', sub: 'POST events to configured webhook URL', Icon: Webhook },
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
                { key: 'low', label: 'Low+', active: 'bg-sky-500/20 border-sky-500/50 text-sky-300' },
                { key: 'medium', label: 'Medium+', active: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' },
                { key: 'high', label: 'High+', active: 'bg-orange-500/20 border-orange-500/50 text-orange-300' },
                { key: 'critical', label: 'Critical only', active: 'bg-red-500/20 border-red-500/50 text-red-300' },
              ] as const).map(({ key, label, active }) => (
                <button
                  key={key}
                  onClick={() => setNotifPrefs(p => ({ ...p, minSeverity: key }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    notifPrefs.minSeverity === key
                      ? active
                      : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
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
                { key: 'daily', label: 'Daily digest' },
                { key: 'weekly', label: 'Weekly digest' },
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

      {/* API Keys */}
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
