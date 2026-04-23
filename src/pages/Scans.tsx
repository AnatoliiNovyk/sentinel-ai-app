import React, { useState, useEffect } from 'react';
import { Shield, Search, AlertCircle, CheckCircle2, ChevronRight, Filter, Play, Plus, Layout, Trash2, Cpu, ExternalLink, X, FileText, Lock, MessageSquare, Loader2 } from 'lucide-react';
import type { Scan, Vulnerability, Project } from '../lib/supabase';
import { ScansService } from '../api/scans.service';
import { AiService } from '../api/ai.service';
import { ScanHeader } from '../components/scans/ScanHeader';
import { ScanStats } from '../components/scans/ScanStats';
import { VulnerabilityList } from '../components/scans/VulnerabilityList';

const Scans = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  
  // New Scan Modal state
  const [showNewScanModal, setShowNewScanModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [newScanConfig, setNewScanConfig] = useState({
    scanner: 'Nmap:Intense',
    target: ''
  });

  // Load initial data
  useEffect(() => {
    loadProjects();
  }, []);

  // Load scans when project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadScans(selectedProjectId);
    } else {
      setScans([]);
      setSelectedScanId(null);
    }
  }, [selectedProjectId]);

  // Load vulnerabilities when scan changes
  useEffect(() => {
    if (selectedScanId) {
      loadVulnerabilities(selectedScanId);
    } else {
      setVulnerabilities([]);
    }
  }, [selectedScanId]);

  const loadProjects = async () => {
    try {
      const data = await ScansService.getProjects();
      setProjects(data);
      if (data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadScans = async (projectId: string) => {
    try {
      const data = await ScansService.getProjectScans(projectId);
      setScans(data);
      if (data.length > 0 && !selectedScanId) {
        setSelectedScanId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load scans:', err);
    }
  };

  const loadVulnerabilities = async (scanId: string) => {
    try {
      const data = await ScansService.getScanVulnerabilities(scanId);
      setVulnerabilities(data);
    } catch (err) {
      console.error('Failed to load vulnerabilities:', err);
    }
  };

  const handleStartScan = async () => {
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    setIsDispatching(true);
    try {
      await ScansService.dispatchScan(
        project.id,
        newScanConfig.scanner,
        newScanConfig.target || project.target,
        project.org_id
      );
      setShowNewScanModal(false);
      // Reload scans for the project
      await loadScans(project.id);
    } catch (err: any) {
      alert('Failed to start scan: ' + err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleAiGeneration = async (v: Vulnerability) => {
    if (!selectedProjectId) {
      alert('Error: No project selected.');
      return;
    }
    
    setGeneratingId(v.id);
    const startTime = Date.now();
    
    try {
      await AiService.generateFix({
        title: v.title,
        description: v.description,
        severity: v.severity,
        asset: v.asset,
        cve_id: v.cve_id,
        project_id: selectedProjectId,
        scan_id: v.scan_id
      });

      await AiService.pollForResult(v.scan_id, startTime);
      await loadVulnerabilities(v.scan_id);
    } catch (err: any) {
      alert('AI Generation failed: ' + err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const getStats = () => {
    const stats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    vulnerabilities.forEach(v => {
      if (v.severity in stats) {
        stats[v.severity as keyof typeof stats]++;
      }
    });
    return stats;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ScanHeader 
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onNewScan={() => setShowNewScanModal(true)}
      />

      <ScanStats 
        stats={getStats()}
        totalVulnerabilities={vulnerabilities.length}
      />

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Scans Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Recent Scans</h2>
          <div className="space-y-2">
            {scans.map(scan => (
              <button
                key={scan.id}
                onClick={() => setSelectedScanId(scan.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  selectedScanId === scan.id
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm capitalize">{scan.scanner}</span>
                  <span className="text-[10px] opacity-60">{new Date(scan.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-[10px] uppercase font-bold opacity-80">{scan.status}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <VulnerabilityList 
            vulnerabilities={vulnerabilities}
            onViewDetails={setSelectedVuln}
            onGenerateAiFix={handleAiGeneration}
            generatingId={generatingId}
          />
        </div>
      </div>

      {/* New Scan Modal */}
      {showNewScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Start New Scan</h2>
              <button onClick={() => setShowNewScanModal(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Scanner Type</label>
                <select 
                  value={newScanConfig.scanner}
                  onChange={(e) => setNewScanConfig({...newScanConfig, scanner: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="Nmap:Intense">Nmap (Intense Scan)</option>
                  <option value="Nmap:Vuln">Nmap (Vulnerability Audit)</option>
                  <option value="Tfsec">Tfsec (IaC Audit)</option>
                  <option value="Amass">Amass (Subdomain Recon)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Address</label>
                <input 
                  type="text"
                  placeholder="e.g. 192.168.1.1 or scanme.nmap.org"
                  value={newScanConfig.target}
                  onChange={(e) => setNewScanConfig({...newScanConfig, target: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <button
                onClick={handleStartScan}
                disabled={isDispatching}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {isDispatching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                {isDispatching ? 'Dispatching...' : 'Launch Scan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedVuln && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-500" />
                <h2 className="text-xl font-bold text-white">{selectedVuln.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedVuln(null)}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Severity</label>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedVuln.severity === 'critical' ? 'bg-red-500/20 text-red-500' :
                      selectedVuln.severity === 'high' ? 'bg-orange-500/20 text-orange-500' :
                      selectedVuln.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      {selectedVuln.severity.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Status</label>
                    <span className="text-white capitalize">{selectedVuln.status.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Asset</label>
                    <span className="text-white font-mono text-sm">{selectedVuln.asset}</span>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">CVE ID</label>
                    <span className="text-white font-mono text-sm">{selectedVuln.cve_id || 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Detection Date</label>
                    <span className="text-white">{new Date(selectedVuln.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <section>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Description
                  </h3>
                  <div className="bg-slate-800/50 rounded-2xl p-6 text-slate-300 leading-relaxed border border-slate-700/50">
                    {selectedVuln.description}
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-green-400" />
                    Remediation Plan
                  </h3>
                  <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-6">
                    <p className="text-emerald-400 font-medium mb-4">{selectedVuln.remediation || 'No remediation plan available yet.'}</p>
                    {selectedVuln.remediation_code && (
                      <pre className="bg-slate-950 p-4 rounded-xl text-emerald-400 font-mono text-sm overflow-x-auto border border-emerald-500/10">
                        <code>{selectedVuln.remediation_code}</code>
                      </pre>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Scans;
