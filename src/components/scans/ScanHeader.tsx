import React from 'react';
import { Layout, Plus, Search } from 'lucide-react';
import type { Project } from '../../lib/supabase';

interface ScanHeaderProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewScan: () => void;
}

export const ScanHeader: React.FC<ScanHeaderProps> = ({ 
  projects, 
  selectedProjectId, 
  onSelectProject,
  onNewScan 
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Vulnerability Scans</h1>
        <p className="text-slate-400">Manage and monitor security assessments across your infrastructure.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Layout className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={selectedProjectId || ''}
            onChange={(e) => onSelectProject(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none min-w-[200px]"
          >
            <option value="">Select Project...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={onNewScan}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Scan</span>
        </button>
      </div>
    </div>
  );
};
