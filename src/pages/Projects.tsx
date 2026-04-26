import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, FolderKanban, Cloud, Globe, Server, FileCode, Trash2, X, ChevronRight, ShieldAlert, Search, SlidersHorizontal } from 'lucide-react';
import { supabase, Project } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import ProjectDetail from './ProjectDetail';
import { useToast } from '../lib/toastContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { SkeletonCardGrid } from '../components/Skeleton';
import { riskBand } from '../lib/riskScore';

const ENV_META: Record<string, { label: string; icon: typeof Cloud; color: string }> = {
  external: { label: 'External', icon: Globe, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  cloud: { label: 'Cloud', icon: Cloud, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  internal: { label: 'Internal', icon: Server, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  iac: { label: 'IaC', icon: FileCode, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState<'all' | 'external' | 'cloud' | 'internal' | 'iac'>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'risk_desc' | 'risk_asc' | 'name'>('newest');

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    if (selected?.id === id) setSelected(null);
    toast.success('Project deleted.');
    setConfirmId(null);
    load();
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...projects]
      .filter(p => envFilter === 'all' || p.environment === envFilter)
      .filter(p => {
        if (riskFilter === 'all') return true;
        const band = riskBand(p.risk_score ?? 0);
        return band === riskFilter;
      })
      .filter(p => !q || p.name.toLowerCase().includes(q) || (p.target ?? '').toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sort === 'risk_desc') return (b.risk_score ?? 0) - (a.risk_score ?? 0);
        if (sort === 'risk_asc') return (a.risk_score ?? 0) - (b.risk_score ?? 0);
        if (sort === 'name') return a.name.localeCompare(b.name);
        return 0;
      });
  }, [projects, search, envFilter, riskFilter, sort]);

  if (selected) {
    const fresh = projects.find((p) => p.id === selected.id) ?? selected;
    return <ProjectDetail project={fresh} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Organize your audit targets by environment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        </div>
      </div>

      {/* Search + filter bar */}
      {!loading && projects.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-8 py-2 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none transition"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            {(['all', 'external', 'cloud', 'internal', 'iac'] as const).map(env => (
              <button
                key={env}
                onClick={() => setEnvFilter(env)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition capitalize ${
                  envFilter === env
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {env === 'all' ? 'All' : ENV_META[env]?.label ?? env}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(risk => (
              <button
                key={risk}
                onClick={() => setRiskFilter(risk)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition capitalize ${
                  riskFilter === risk
                    ? risk === 'critical' ? 'border-red-500/50 bg-red-500/10 text-red-300' :
                      risk === 'high' ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' :
                      risk === 'medium' ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300' :
                      'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                }`}
              >
                {risk === 'all' ? 'All Risks' : risk}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="risk_desc">Risk ↓ high→low</option>
            <option value="risk_asc">Risk ↑ low→high</option>
            <option value="name">Name A–Z</option>
          </select>
          {(search || envFilter !== 'all') && (
            <span className="text-xs text-slate-500">{visible.length} of {projects.length}</span>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonCardGrid cols={3} count={6} height="h-40" />
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700/50 bg-slate-900/20 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-8 h-8 text-slate-500" />
          </div>
          <div className="text-slate-200 font-semibold text-lg">No projects yet</div>
          <div className="text-slate-500 text-sm mt-2 max-w-xs mx-auto">Create your first project to start tracking assets and running security scans.</div>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg text-sm transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Create first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.length === 0 ? (
            <div className="col-span-3 rounded-xl border border-dashed border-slate-700/50 bg-slate-900/20 p-12 text-center">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <div className="text-slate-300 font-medium">No projects match your filters</div>
              <div className="text-sm text-slate-500 mt-1">Try adjusting the search query or environment filter.</div>
              <button onClick={() => { setSearch(''); setEnvFilter('all'); }} className="mt-4 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 rounded-md px-3 py-1.5 transition">Clear filters</button>
            </div>
          ) : (
            visible.map((p) => {
            const meta = ENV_META[p.environment] ?? ENV_META.external;
            const Icon = meta.icon;
            const band = riskBand(p.risk_score ?? 0);
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="group text-left rounded-xl border border-slate-800 bg-slate-900/30 p-5 hover:border-emerald-500/40 hover:bg-slate-900/60 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${meta.color}`}>
                      <Icon className="w-3 h-3" /> {meta.label}
                    </div>
                    <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${band.color}`}>
                      <ShieldAlert className="w-3 h-3" /> {band.label} · {p.risk_score ?? 0}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      role="button"
                      aria-label="Delete project"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(p.id);
                        setConfirmName(p.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition" />
                  </div>
                </div>
                <h3 className="font-semibold text-white truncate">{p.name}</h3>
                <p className="mt-1 text-sm text-slate-400 line-clamp-2">{p.description || 'No description'}</p>
                <div className="mt-4 text-xs text-slate-500 font-mono truncate">{p.target}</div>
              </button>
            );})}
          )}
        </div>
      )}

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} onCreated={load} />}
      <ConfirmDialog
        open={confirmId !== null}
        title="Delete project"
        message={`Are you sure you want to delete "${confirmName}"? This will permanently remove the project and all associated data.`}
        confirmLabel="Delete project"
        onConfirm={() => confirmId && remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

function ProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user, organizations } = useAuth();
  const [name, setName] = useState('');
  const [description] = useState('');
  const [target, setTarget] = useState('');
  const [environment, setEnvironment] = useState<'external' | 'cloud' | 'internal' | 'iac'>('external');
  const [tagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || organizations.length === 0) {
      toast.warning('You must be a member of an organization to create a project.');
      return;
    }
    setSaving(true);
    
    const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const { error } = await supabase.from('projects').insert({
      user_id: user.id,
      org_id: organizations[0].id,
      name,
      description,
      target,
      environment,
      tags,
    });

    if (error) {
      toast.error(`Error creating project: ${error.message}`);
    } else {
      toast.success(`Project "${name}" created.`);
      onCreated();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">New project</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Organization</label>
            <div className="text-xs text-emerald-400 bg-emerald-400/5 border border-emerald-400/10 px-3 py-2 rounded-md">
              {organizations[0]?.name || 'Loading organization...'}
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              placeholder="Production AWS"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Target (Domain or IP)</label>
            <input
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
              placeholder="example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Environment</label>
            <div className="grid grid-cols-4 gap-2">
              {(['external', 'cloud', 'internal', 'iac'] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`py-2 rounded-md text-xs font-medium border transition capitalize ${
                    environment === env
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              {saving ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
