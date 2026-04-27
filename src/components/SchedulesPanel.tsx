import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Plus, X, Power, Trash2 } from 'lucide-react';
import { supabase, ScanSchedule, Project } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { AVAILABLE_SCANNERS } from '../lib/scanMock';

const CADENCES: { hours: number; label: string }[] = [
  { hours: 1, label: 'Every hour' },
  { hours: 6, label: 'Every 6 hours' },
  { hours: 24, label: 'Daily' },
  { hours: 24 * 7, label: 'Weekly' },
  { hours: 24 * 30, label: 'Monthly' },
];

function cadenceLabel(hours: number): string {
  const m = CADENCES.find((c) => c.hours === hours);
  if (m) return m.label;
  if (hours < 24) return `Every ${hours}h`;
  if (hours % 24 === 0) return `Every ${hours / 24}d`;
  return `${hours}h`;
}

export default function SchedulesPanel({ projects }: { projects: Project[] }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const activeCount  = schedules.filter(s => s.enabled).length;
  const pausedCount  = schedules.filter(s => !s.enabled).length;

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('scan_schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSchedules((data ?? []) as ScanSchedule[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (s: ScanSchedule) => {
    const next = !s.enabled;
    setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: next } : x)));
    await supabase.from('scan_schedules').update({ enabled: next }).eq('id', s.id);
  };

  const remove = async (id: string) => {
    setSchedules((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('scan_schedules').delete().eq('id', id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-slate-400">
          Automated scans that run on a recurring schedule. Due jobs are dispatched while the app is open.
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={projects.length === 0}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-semibold px-3 py-1.5 rounded-md text-xs transition"
        >
          <Plus className="w-3.5 h-3.5" /> New schedule
        </button>
      </div>

      {/* Stat cards */}
      {!loading && schedules.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3">
            <div className="text-xl font-bold text-white">{schedules.length}</div>
            <div className="text-[10px] text-slate-500">Total</div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="text-xl font-bold text-emerald-400">{activeCount}</div>
            <div className="text-[10px] text-slate-500">Active</div>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3">
            <div className="text-xl font-bold text-slate-400">{pausedCount}</div>
            <div className="text-[10px] text-slate-500">Paused</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center">
          <CalendarClock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <div className="text-slate-300 font-medium">No schedules configured</div>
          <div className="text-slate-500 text-sm mt-1">Create one to run scans automatically.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden divide-y divide-slate-800">
          {schedules.map((s) => {
            const project = projects.find((p) => p.id === s.project_id);
            return (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center ${
                      s.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {s.scanner} <span className="text-slate-500 font-normal">on {project?.name ?? 'project'}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {cadenceLabel(s.cadence_hours)} · next {new Date(s.next_run_at).toLocaleString()}
                      {s.enabled && new Date(s.next_run_at) < new Date() && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">overdue</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-md border ${
                      s.enabled
                        ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                        : 'text-slate-400 border-slate-700 bg-slate-800/50'
                    }`}
                  >
                    {s.enabled ? 'Active' : 'Paused'}
                  </span>
                  <button
                    onClick={() => toggle(s)}
                    className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-900 transition"
                    title={s.enabled ? 'Pause' : 'Resume'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(s.id)}
                    className="p-2 rounded-md text-slate-400 hover:text-rose-300 hover:bg-slate-900 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <NewScheduleModal
          projects={projects}
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewScheduleModal({
  projects,
  onClose,
  onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [scanner, setScanner] = useState(AVAILABLE_SCANNERS[0].id);
  const [cadence, setCadence] = useState(24);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user || !projectId) return;
    setSaving(true);
    const next = new Date(Date.now() + cadence * 3600 * 1000).toISOString();
    await supabase.from('scan_schedules').insert({
      user_id: user.id,
      project_id: projectId,
      scanner,
      cadence_hours: cadence,
      enabled: true,
      next_run_at: next,
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold">New schedule</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Project</label>
            <select
              value={projectId}
              aria-label="Project"
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Scanner</label>
            <select
              value={scanner}
              aria-label="Scanner"
              onChange={(e) => setScanner(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            >
              {AVAILABLE_SCANNERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.description}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Cadence</label>
            <div className="grid grid-cols-3 gap-2">
              {CADENCES.map((c) => (
                <button
                  key={c.hours}
                  onClick={() => setCadence(c.hours)}
                  className={`py-2 rounded-md text-xs font-medium border transition ${
                    cadence === c.hours
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !projectId}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              {saving ? 'Saving...' : 'Create schedule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
