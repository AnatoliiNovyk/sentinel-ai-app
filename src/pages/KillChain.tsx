import { useEffect, useState, useCallback } from 'react';
import { Target, Zap, ShieldAlert, ArrowDown, Activity, Bug, Copy, Check, Download, FileText } from 'lucide-react';
import { supabase, Project, Vulnerability } from '../lib/supabase';
import { generateKillChain } from '../lib/aiRedTeam';
import { downloadFile } from '../lib/exporters';

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

  const projectName = projects.find(p => p.id === projectId)?.name ?? 'Unknown';

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
    if (!chain) return;
    const payload = { project: projectName, generatedAt: new Date().toISOString(), steps: chain };
    downloadFile(`killchain-${projectName.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }, [chain, projectName]);

  const exportMarkdown = useCallback(() => {
    if (!chain) return;
    downloadFile(`killchain-${projectName.replace(/\s+/g, '-').toLowerCase()}.md`, buildMarkdown(chain, projectName), 'text/markdown');
  }, [chain, projectName, buildMarkdown]);

  const copyToClipboard = useCallback(async () => {
    if (!chain) return;
    await navigator.clipboard.writeText(buildMarkdown(chain, projectName));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [chain, projectName, buildMarkdown]);

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
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-red-400" /> Attack Vector Generated
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400 mr-2">Based on {vulns.length} open vulnerabilities</span>
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
                onClick={exportJson}
                title="Download JSON"
                className="inline-flex items-center gap-1.5 text-xs border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 rounded-md transition text-slate-300"
              >
                <Download className="w-3.5 h-3.5" /> JSON
              </button>
            </div>
          </div>

          <div className="relative pl-6 md:pl-8 space-y-8 before:absolute before:inset-0 before:ml-[1.4rem] md:before:ml-[1.9rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-800 before:via-red-500/50 before:to-slate-800">
            {chain.map((step, idx) => (
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
