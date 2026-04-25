import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Target, Zap, ShieldAlert, ArrowDown, Activity, Bug, Copy, Check, Download, FileText, Filter, Search, ArrowUpDown, X } from 'lucide-react';
import { supabase, Project, Vulnerability } from '../lib/supabase';
import { generateKillChain } from '../lib/aiRedTeam';
import { downloadFile } from '../lib/exporters';
import { useSearchShortcut } from '../lib/useSearchShortcut';
import { useToast } from '../lib/toastContext';

type KillChainStep = {
  phase: string;
  tactic: string;
  description: string;
  exploited_vuln: string;
  asset: string;
};

export default function KillChain() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [chain, setChain] = useState<KillChainStep[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [stepSearch, setStepSearch] = useState('');
  const [stepSort, setStepSort] = useState<'original' | 'phase' | 'asset'>('original');
  const stepSearchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(stepSearchRef, () => setStepSearch(''));
  const toast = useToast();

  const projectName = projects.find(p => p.id === projectId)?.name ?? 'Unknown';

  const PHASES = ['Recon', 'Weaponize', 'Delivery', 'Exploitation', 'Installation', 'Command & Control', 'Exfiltration'];

  const filteredChain = useMemo(() => {
    if (!chain) return null;
    const q = stepSearch.trim().toLowerCase();
    let result = phaseFilter === 'all' ? chain : chain.filter(step => step.phase.toLowerCase().includes(phaseFilter.toLowerCase()));
    if (q) result = result.filter(s =>
      s.tactic.toLowerCase().includes(q) ||
      s.asset.toLowerCase().includes(q) ||
      s.exploited_vuln.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
    if (stepSort === 'phase') {
      const order = PHASES.map(p => p.toLowerCase());
      result = [...result].sort((a, b) => {
        const ai = order.findIndex(p => a.phase.toLowerCase().includes(p));
        const bi = order.findIndex(p => b.phase.toLowerCase().includes(p));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    } else if (stepSort === 'asset') {
      result = [...result].sort((a, b) => a.asset.localeCompare(b.asset));
    }
    return result;
  }, [chain, phaseFilter, stepSearch, stepSort]);

  const buildMarkdown = useCallback((steps: KillChainStep[], name: string) => {
    const lines = [
      `# AI Red Team Kill Chain — ${name}`,
      `> Generated: ${new Date().toLocaleString()}`,
      '',
    ];
    steps.forEach((s, i) => {
      lines.push(`## Step ${i + 1}: ${s.phase}`);
      lines.push(`**MITRE Tactic:** ${s.tactic}  `);
      lines.push(`**Asset:** ${s.asset}  `);
      lines.push(`**Exploited:** ${s.exploited_vuln}`);
      lines.push('');
      lines.push(s.description);
      lines.push('');
    });
    return lines.join('\n');
  }, []);

  const exportJson = useCallback(() => {
    if (!filteredChain) return;
    const payload = { project: projectName, phase_filter: phaseFilter, generatedAt: new Date().toISOString(), steps: filteredChain };
    downloadFile(`killchain-${projectName.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }, [filteredChain, projectName, phaseFilter]);

  const exportMarkdown = useCallback(() => {
    if (!filteredChain) return;
    downloadFile(`killchain-${projectName.replace(/\s+/g, '-').toLowerCase()}.md`, buildMarkdown(filteredChain, projectName), 'text/markdown');
  }, [filteredChain, projectName, buildMarkdown]);

  const exportCsv = useCallback(() => {
    if (!filteredChain) return;
    const headers = ['Step', 'Phase', 'MITRE Tactic', 'Asset', 'Exploited Vulnerability'];
    const rows = filteredChain.map((s, i) => [i + 1, s.phase, s.tactic, s.asset, s.exploited_vuln]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    downloadFile(`killchain-${projectName.replace(/\s+/g, '-').toLowerCase()}.csv`, csv, 'text/csv');
  }, [filteredChain, projectName]);

  const copyToClipboard = useCallback(async () => {
    if (!filteredChain) return;
    await navigator.clipboard.writeText(buildMarkdown(filteredChain, projectName));
    setCopied(true);
    toast.success('Kill chain copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  }, [filteredChain, projectName, buildMarkdown]);

  useEffect(() => {
    supabase.from('projects').select('*').order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setProjects(data);
        setProjectId(data[0].id);
      }
    });
  }, []);

  const runSimulation = async () => {
    if (!projectId) return;
    setLoading(true);
    setChain(null);
    
    // Get scans for selected project, then pull open vulnerabilities for those scans.
    const { data: scans } = await supabase.from('scans').select('id').eq('project_id', projectId);
    const scanIds = scans?.map(s => s.id) || [];
    
    const { data: projVulns } = await supabase
      .from('vulnerabilities')
      .select('*')
      .in('scan_id', scanIds)
      .eq('status', 'open');

    const finalVulns = projVulns || [];
    setVulns(finalVulns);

    const project = projects.find(p => p.id === projectId);
    const result = await generateKillChain(project?.name || 'Unknown', finalVulns);

    setChain(result as KillChainStep[]);
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Red Team Simulation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Simulate an advanced persistent threat (APT) attack path based on your current vulnerabilities.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 w-full">
          <label htmlFor="project" className="block text-sm text-slate-300 mb-1.5">Target Project</label>
          <select
            id="project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={runSimulation}
          disabled={loading || !projectId}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold px-6 py-2.5 rounded-md flex items-center gap-2 transition w-full md:w-auto justify-center"
        >
          {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
          {loading ? 'Simulating Attack...' : 'Generate Kill Chain'}
        </button>
      </div>

      {chain && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400" /> Attack Vector Generated
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-400">Based on {vulns.length} open vulnerabilities</span>
              <button
                onClick={copyToClipboard}
                title="Copy as Markdown"
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={exportMarkdown}
                title="Download Markdown"
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                <FileText className="w-3.5 h-3.5" /> .md
              </button>
              <button
                onClick={exportCsv}
                title="Download CSV"
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={exportJson}
                title="Download JSON"
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
            </div>
          </div>

          {/* Phase filter */}
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-slate-800 bg-slate-900/50">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-400 font-medium">Filter by phase:</span>
            <button
              onClick={() => setPhaseFilter('all')}
              className={`text-xs px-2.5 py-1 rounded-md transition ${
                phaseFilter === 'all'
                  ? 'bg-emerald-500 text-slate-950 font-semibold'
                  : 'border border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              All ({chain.length})
            </button>
            {PHASES.map((phase) => {
              const count = chain.filter(s => s.phase.toLowerCase().includes(phase.toLowerCase())).length;
              return (
                <button
                  key={phase}
                  onClick={() => setPhaseFilter(phase)}
                  className={`text-xs px-2.5 py-1 rounded-md transition ${
                    phaseFilter === phase
                      ? 'bg-red-500 text-white font-semibold'
                      : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {phase} ({count})
                </button>
              );
            })}
          </div>

          {/* Step search + sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              <input
                ref={stepSearchRef}
                value={stepSearch}
                onChange={e => setStepSearch(e.target.value)}
                placeholder="Search tactic, asset, CVE…"
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              {([['original', 'Original'], ['phase', 'Phase order'], ['asset', 'Asset A→Z']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setStepSort(val)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border transition ${
                    stepSort === val
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {stepSearch && (
              <span className="text-xs text-slate-500">{filteredChain?.length ?? 0} result{filteredChain?.length !== 1 ? 's' : ''}</span>
            )}
            {(phaseFilter !== 'all' || stepSearch || stepSort !== 'original') && (
              <button
                onClick={() => { setPhaseFilter('all'); setStepSearch(''); setStepSort('original'); }}
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-amber-500/40 hover:text-amber-300 px-2.5 py-1.5 rounded-md transition text-slate-400"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>

          <div className="relative pl-6 md:pl-8 space-y-8 before:absolute before:inset-0 before:ml-[1.4rem] md:before:ml-[1.9rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-800 before:via-red-500/50 before:to-slate-800">
            {filteredChain && filteredChain.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">
                No steps match the current filters.
              </div>
            )}
            {filteredChain && filteredChain.map((step, idx) => (
              <div key={idx} className="relative">
                <div className="md:flex items-center justify-between md:space-x-8">
                  
                  {/* Left side (Desktop) */}
                  <div className="md:w-5/12 mb-3 md:mb-0 hidden md:block text-right">
                    <div className="text-sm font-bold text-red-400 uppercase tracking-wider">{step.phase}</div>
                    <div className="text-xs text-slate-500 font-mono mt-1">MITRE TACTIC: {step.tactic}</div>
                  </div>

                  {/* Icon */}
                  <div className="absolute left-0 md:left-1/2 -ml-[19px] md:-ml-4 flex h-8 w-8 items-center justify-center rounded-full border-4 border-slate-950 bg-slate-900 shadow text-red-400">
                    <Bug className="h-3.5 w-3.5" />
                  </div>

                  {/* Right side */}
                  <div className="md:w-5/12 ml-6 md:ml-0 rounded-xl border border-red-500/20 bg-red-500/5 p-5 shadow-lg">
                    <div className="md:hidden mb-2">
                      <div className="text-sm font-bold text-red-400 uppercase tracking-wider">{step.phase}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">MITRE TACTIC: {step.tactic}</div>
                    </div>
                    
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {step.description}
                    </p>
                    
                    <div className="mt-4 pt-4 border-t border-red-500/10">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-slate-200">Exploited Asset: {step.asset}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{step.exploited_vuln}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {idx < chain.length - 1 && (
                  <div className="hidden md:flex justify-center my-4">
                    <ArrowDown className="w-5 h-5 text-red-500/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
