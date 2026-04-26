import React from 'react';
import { Layout, Plus, AlertTriangle, CheckCircle2, HelpCircle, FolderKanban } from 'lucide-react';
import type { Project } from '../../lib/supabase';

interface ScanHeaderProps {
  projects: Project[];
  selectedProjectId: string | null;
  currentMode?: 'REAL' | 'MOCK' | 'UNKNOWN';
  onSelectProject: (id: string) => void;
  onNewScan: () => void;
}

export const ScanHeader: React.FC<ScanHeaderProps> = ({ 
  projects, 
  selectedProjectId, 
  currentMode = 'UNKNOWN',
  onSelectProject,
  onNewScan 
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Vulnerability Scans</h1>
        <p className="text-slate-400">
          {selectedProjectId
            ? (() => {
                const p = projects.find(pr => pr.id === selectedProjectId);
                return p ? (
                  <span className="flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-emerald-400" />
                    Showing scans for <span className="text-emerald-300 font-medium">{p.name}</span>
                  </span>
                ) : 'Manage and monitor security assessments across your infrastructure.';
              })()
            : 'Manage and monitor security assessments across your infrastructure.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            currentMode === 'REAL'
              ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
              : currentMode === 'MOCK'
              ? 'text-amber-300 border-amber-500/40 bg-amber-500/15'
              : 'text-slate-300 border-slate-600/50 bg-slate-800/50'
          }`}
        >
          {currentMode === 'REAL' && <CheckCircle2 className="w-3 h-3" />}
          {currentMode === 'MOCK' && <AlertTriangle className="w-3 h-3" />}
          {currentMode === 'UNKNOWN' && <HelpCircle className="w-3 h-3" />}
          {currentMode === 'MOCK' ? '⚠ DEMO MODE' : `Mode: ${currentMode}`}
        </div>
        <div className="relative">
          <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            aria-label="Select project"
            title="Select project"
            value={selectedProjectId || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none min-w-[200px]"
          >
            <option value="">All projects ({projects.length})</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={onNewScan}
          aria-label="Start a new scan"
          title="Start a new scan"
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Scan</span>
        </button>
      </div>
    </div>
  );
};
