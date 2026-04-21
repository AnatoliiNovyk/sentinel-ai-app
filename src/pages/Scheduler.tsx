import { useEffect, useState } from 'react';
import {
  Clock, Plus, Trash2, Power, PowerOff, Calendar,
  Loader2, ChevronDown, Radar, Check,
} from 'lucide-react';
import { supabase, ScanSchedule, Project } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AVAILABLE_SCANNERS } from '../lib/scanMock';

const CADENCES = [
  { hours: 6,   label: 'Every 6 h' },
  { hours: 12,  label: 'Every 12 h' },
  { hours: 24,  label: 'Daily' },
  { hours: 48,  label: 'Every 2 days' },
  { hours: 168, label: 'Weekly' },
  { hours: 720, label: 'Monthly' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nextRunColor(iso: string | null) {
  if (!iso) return 'text-slate-500';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'text-red-400';
  if (diff < 3_600_000) return 'text-amber-400';
  return 'text-slate-400';
}

export default function SchedulerPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // New schedule form state
  const [formProject, setFormProject] = useState('');
  const [formScanner, setFormScanner] = useState(AVAILABLE_SCANNERS[0].id);
  const [formCadence, setFormCadence] = useState(24);

  const load = async () => {
    if (!user) return;
    const [schRes, prjRes] = await Promise.all([
      supabase.from('scan_schedules').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('projects').select('*').eq('user_id', user.id).order('name'),
    ]);
    setSchedules((schRes.data ?? []) as ScanSchedule[]);
    setProjects((prjRes.data ?? []) as Project[]);
    if ((prjRes.data ?? []).length && !formProject) setFormProject((prjRes.data as Project[])[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (s: ScanSchedule) => {
    await supabase.from('scan_schedules').update({ enabled: !s.enabled }).eq('id', s.id);
    setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, enabled: !x.enabled } : x));
  };

  const remove = async (id: string) => {
    await supabase.from('scan_schedules').delete().eq('id', id);
    setSchedules(prev => prev.filter(x => x.id !== id));
  };

  const create = async () => {
    if (!user || !formProject || saving) return;
    setSaving(true);
    const next = new Date(Date.now() + formCadence * 3600 * 1000).toISOString();
    const { data } = await supabase
      .from('scan_schedules')
      .insert({
        user_id: user.id,
        project_id: formProject,
        scanner: formScanner,
        cadence_hours: formCadence,
        enabled: true,
        next_run_at: next,
      })
      .select()
      .maybeSingle();
    if (data) setSchedules(prev => [data as ScanSchedule, ...prev]);
    setShowForm(false);
    setSaving(false);
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id.slice(0, 8);
  const scannerLabel = (id: string) => AVAILABLE_SCANNERS.find(s => s.id === id)?.label ?? id;

  const active  = schedules.filter(s => s.enabled).length;
  const overdue = schedules.filter(s => s.enabled && s.next_run_at && new Date(s.next_run_at) < new Date()).length;

  return (
    <div className="p-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scan Scheduler</h1>
          <p className="mt-1 text-sm text-slate-500">
            Automate recurring security scans across your projects.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
        >
          <Plus className="w-4 h-4" />
          New schedule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total schedules" value={schedules.length} icon={Calendar} color="text-slate-400 bg-slate-800 border-slate-700" />
        <Stat label="Active" value={active} icon={Power} color="text-emerald-400 bg-emerald-500/10 border-emerald-500/20" />
        <Stat label="Overdue" value={overdue} icon={Clock} color={overdue > 0 ? 'text-red-400 bg-red-500/10 border-red-500/20' : 'text-slate-500 bg-slate-900 border-slate-800'} />
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-5 animate-in slide-in-from-top-2 duration-200">
          <h2 className="font-semibold text-emerald-300">New scheduled scan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Project */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Project</label>
              {projects.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No projects — create one first.</p>
              ) : (
                <div className="relative">
                  <select
                    value={formProject}
                    onChange={e => setFormProject(e.target.value)}
                    className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-md pl-3 pr-8 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              )}
            </div>
            {/* Scanner */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Scanner</label>
              <div className="relative">
                <select
                  value={formScanner}
                  onChange={e => setFormScanner(e.target.value)}
                  className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-md pl-3 pr-8 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  {AVAILABLE_SCANNERS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>
            {/* Cadence */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Frequency</label>
              <div className="flex flex-wrap gap-1.5">
                {CADENCES.map(c => (
                  <button
                    key={c.hours}
                    onClick={() => setFormCadence(c.hours)}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition ${
                      formCadence === c.hours
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-white transition px-3 py-2">
              Cancel
            </button>
            <button
              onClick={create}
              disabled={saving || !formProject}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Create schedule
            </button>
          </div>
        </div>
      )}

      {/* Schedules list */}
      {loading ? (
        <div className="flex items-center gap-3 text-slate-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading schedules...
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
          <Radar className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <div className="text-sm font-medium text-slate-300">No schedules yet</div>
          <div className="text-xs text-slate-600 mt-1">Create your first scheduled scan above.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-5 py-3 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            <span>Project</span>
            <span>Scanner</span>
            <span>Frequency</span>
            <span>Last run</span>
            <span>Next run</span>
            <span />
          </div>
          <div className="divide-y divide-slate-800/50">
            {schedules.map(s => {
              const cadenceLabel = CADENCES.find(c => c.hours === s.cadence_hours)?.label ?? `${s.cadence_hours}h`;
              return (
                <div key={s.id} className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] px-5 py-4 items-center hover:bg-slate-900/50 transition group ${!s.enabled ? 'opacity-50' : ''}`}>
                  {/* Project */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${s.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">{projectName(s.project_id)}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{s.project_id.slice(0, 8).toUpperCase()}</div>
                    </div>
                  </div>
                  {/* Scanner */}
                  <div className="text-xs text-slate-300 font-mono">{scannerLabel(s.scanner)}</div>
                  {/* Cadence */}
                  <div className="text-xs text-slate-400">{cadenceLabel}</div>
                  {/* Last run */}
                  <div className="text-xs text-slate-500">{fmtDate(s.last_run_at)}</div>
                  {/* Next run */}
                  <div className={`text-xs font-mono ${nextRunColor(s.next_run_at)}`}>
                    {fmtDate(s.next_run_at)}
                    {s.next_run_at && new Date(s.next_run_at) < new Date() && (
                      <span className="ml-1 text-[10px] text-red-400 font-sans">(overdue)</span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => toggle(s)}
                      title={s.enabled ? 'Disable' : 'Enable'}
                      className={`p-1.5 rounded transition ${s.enabled ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                    >
                      {s.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      title="Delete"
                      className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-600">
        Schedules are checked every 5 minutes while you have Sentinel AI open.
        Close the app to pause execution.
      </p>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Clock; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-slate-700 transition">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <div className={`w-8 h-8 rounded-md border flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
