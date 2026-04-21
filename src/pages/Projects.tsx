import { useEffect, useState } from 'react';
import { Plus, FolderKanban, Cloud, Globe, Server, FileCode, Trash2, X, ChevronRight, ShieldAlert, Tag } from 'lucide-react';
import { supabase, Project } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { shodanDnsLookup } from '../lib/passiveRecon';
import ProjectDetail from './ProjectDetail';
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
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setProjects(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const remove = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  if (selected) {
    const fresh = projects.find((p) => p.id === selected.id) ?? selected;
    return <ProjectDetail project={fresh} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Organize your audit targets by environment.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDiscoverOpen(true)}
            className="inline-flex items-center gap-2 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-semibold px-4 py-2 rounded-md text-sm transition"
          >
            <Globe className="w-4 h-4" /> Auto-discover
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-sm">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-16 text-center">
          <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <div className="text-slate-300 font-medium">No projects yet</div>
          <div className="text-slate-500 text-sm mt-1">Create your first project to start auditing.</div>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
          >
            <Plus className="w-4 h-4" /> New project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
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
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(p.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          remove(p.id);
                        }
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
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.slice(0, 4).map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-300 border border-slate-700">
                        <Tag className="w-2.5 h-2.5" /> {t}
                      </span>
                    ))}
                    {p.tags.length > 4 && (
                      <span className="text-[10px] text-slate-500">+{p.tags.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {modalOpen && <ProjectModal onClose={() => setModalOpen(false)} onCreated={load} />}
      {discoverOpen && <DiscoveryModal onClose={() => setDiscoverOpen(false)} onCreated={load} />}
    </div>
  );
}

function ProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [environment, setEnvironment] = useState<'external' | 'cloud' | 'internal' | 'iac'>('external');
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 10);
    await supabase.from('projects').insert({
      user_id: user.id,
      name,
      description,
      target,
      environment,
      tags,
    });
    setSaving(false);
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold">New project</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Production AWS"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
              placeholder="Primary production cloud environment"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Target</label>
            <input
              required
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="example.com or arn:aws:iam::..."
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
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Tags</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="prod, pci, eu-west"
            />
            <p className="mt-1 text-xs text-slate-500">Comma-separated, up to 10 tags.</p>
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              {saving ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DiscoveryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [rootDomain, setRootDomain] = useState('');
  const [shodanKey, setShodanKey] = useState(import.meta.env.VITE_SHODAN_API_KEY || '');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const discover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rootDomain || !shodanKey) return;
    setRunning(true);
    setError(null);
    try {
      const data = await shodanDnsLookup(rootDomain, shodanKey);
      if (data.hostnames.length === 0) {
        throw new Error('No subdomains found for this root domain.');
      }

      const projectsToCreate = data.hostnames.map(hostname => ({
        user_id: user.id,
        name: hostname,
        description: `Auto-discovered subdomain of ${rootDomain}`,
        target: hostname,
        environment: 'external',
        tags: ['auto-discovered'],
      }));

      const { error: insErr } = await supabase.from('projects').insert(projectsToCreate);
      if (insErr) throw insErr;
      
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Auto-discovery failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4 text-emerald-400" /> Asset Auto-Discovery</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={discover} className="p-6 space-y-4">
          <p className="text-sm text-slate-400">
            Automatically discover subdomains and create projects for them using Shodan passive DNS intelligence.
          </p>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Root Domain</label>
            <input
              required
              value={rootDomain}
              onChange={(e) => setRootDomain(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              placeholder="example.com"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Shodan API Key</label>
            <input
              type="password"
              required
              value={shodanKey}
              onChange={(e) => setShodanKey(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              placeholder="Required for Shodan DNS lookup"
            />
          </div>
          {error && <div className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-md">{error}</div>}
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
              Cancel
            </button>
            <button
              type="submit"
              disabled={running || !rootDomain || !shodanKey}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-4 py-2 rounded-md text-sm transition"
            >
              {running ? 'Discovering...' : 'Start Discovery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

