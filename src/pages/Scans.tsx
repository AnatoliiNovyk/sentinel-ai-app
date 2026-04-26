import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Shield, Play, X, FileText, Lock, Loader2, AlertTriangle, Search, Download, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import type { Scan, Vulnerability, Project } from '../lib/supabase';
import { ScansService } from '../api/scans.service';
import { callAiGateway } from '../lib/aiGateway';
import { useToast } from '../lib/toastContext';
import { SkeletonSidebar, SkeletonBlock } from '../components/Skeleton';
import { supabase } from '../api/client';
import { ScanHeader } from '../components/scans/ScanHeader';
import { ScanStats } from '../components/scans/ScanStats';
import { VulnerabilityList } from '../components/scans/VulnerabilityList';

const SCAN_STATUS_META: Record<string, { label: string; dotClass: string; textClass: string; bgClass: string; borderClass: string; pulse: boolean }> = {
  running:   { label: 'Running',   dotClass: 'bg-emerald-400', textClass: 'text-emerald-300', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/30', pulse: true  },
  pending:   { label: 'Pending',   dotClass: 'bg-amber-400',   textClass: 'text-amber-300',   bgClass: 'bg-amber-500/10',   borderClass: 'border-amber-500/30',   pulse: true  },
  completed: { label: 'Done',      dotClass: 'bg-sky-400',     textClass: 'text-sky-300',     bgClass: 'bg-sky-500/10',     borderClass: 'border-sky-500/30',     pulse: false },
  failed:    { label: 'Failed',    dotClass: 'bg-red-500',     textClass: 'text-red-400',     bgClass: 'bg-red-500/10',     borderClass: 'border-red-500/30',     pulse: false },
};

function ScanStatusBadge({ status, active }: { status: string; active: boolean }) {
  const meta = SCAN_STATUS_META[status] ?? { label: status, dotClass: 'bg-slate-500', textClass: 'text-slate-400', bgClass: 'bg-slate-800', borderClass: 'border-slate-700', pulse: false };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide transition-colors ${
      active ? 'bg-white/10 border-white/20 text-white' : `${meta.bgClass} ${meta.borderClass} ${meta.textClass}`
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : meta.dotClass} ${meta.pulse ? 'animate-pulse' : ''}`} />
      {meta.label}
    </span>
  );
}

function RunningProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(12);
  useEffect(() => {
    const id = setInterval(() => {
      progressRef.current = progressRef.current >= 95 ? progressRef.current : progressRef.current + Math.random() * 3;
      if (barRef.current) barRef.current.style.width = `${progressRef.current}%`;
    }, 800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="mt-1.5 h-0.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div ref={barRef} className="h-full rounded-full bg-emerald-400 transition-all duration-700" />
    </div>
  );
}

const Scans = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const toast = useToast();
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [aiGenError, setAiGenError] = useState<string | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  
  // New Scan Modal state
  const [showNewScanModal, setShowNewScanModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [showMockWarning, setShowMockWarning] = useState(false);
  const [scanSearch, setScanSearch] = useState('');
  const [scannerFilter, setScannerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [newScanConfig, setNewScanConfig] = useState({
    scanner: 'Nmap:Intense',
    target: ''
  });

  const currentScanMode = (() => {
    const scan = scans.find((s) => s.id === selectedScanId) ?? scans[0];
    if (!scan) return 'UNKNOWN';
    if (scan.detected_mode) return scan.detected_mode;
    if (scan.is_mock) return 'MOCK';
    return 'REAL';
  })();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!selectedProjectId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadScans(selectedProjectId);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedProjectId, isRefreshing]);  const uniqueStatuses = useMemo(() => ['all', ...Array.from(new Set(scans.map(s => s.status)))], [scans]);

  const filteredScans = useMemo(() => {
    const q = scanSearch.toLowerCase();
    return scans.filter(s => {
      const matchSearch = !q || s.scanner.toLowerCase().includes(q) || s.status.toLowerCase().includes(q);
      const matchScanner = scannerFilter === 'all' || s.scanner === scannerFilter;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchScanner && matchStatus;
    });
  }, [scans, scanSearch, scannerFilter, statusFilter]);

  // Show mock warning whenever the active scan is in MOCK mode
  useEffect(() => {
    if (currentScanMode === 'MOCK') {
      setShowMockWarning(true);
    }
  }, [currentScanMode]);

  // Load initial data
  useEffect(() => {
    (async () => {
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
    })();
  }, [selectedProjectId]);

  // Load scans when project changes
  useEffect(() => {
    if (selectedProjectId) {
      (async () => {
        try {
          const data = await ScansService.getProjectScans(selectedProjectId);
          setScans(data);
          if (data.length > 0 && !selectedScanId) {
            setSelectedScanId(data[0].id);
          }
        } catch (err) {
          console.error('Failed to load scans:', err);
        }
      })();
    } else {
      setScans([]);
      setSelectedScanId(null);
    }
  }, [selectedProjectId, selectedScanId]);

  // Load vulnerabilities when scan changes
  useEffect(() => {
    if (selectedScanId) {
      (async () => {
        try {
          const data = await ScansService.getScanVulnerabilities(selectedScanId);
          setVulnerabilities(data);
        } catch (err) {
          console.error('Failed to load vulnerabilities:', err);
        }
      })();
    } else {
      setVulnerabilities([]);
    }
  }, [selectedScanId]);

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
      toast.success('Scan started successfully.');
      // Reload scans for the project
      await loadScans(project.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to start scan: ' + message);
      setAiGenError('Failed to start scan: ' + message);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleAiGeneration = async (v: Vulnerability) => {
    if (!selectedProjectId) return;

    setGeneratingId(v.id);
    setAiGenError(null);

    try {
      const prompt = `You are a security engineer. Analyze this vulnerability and provide a remediation plan.

Vulnerability: ${v.title}
Severity: ${v.severity}
Asset: ${v.asset}
CVE: ${v.cve_id || 'N/A'}
Description: ${v.description}

Respond ONLY with valid JSON in this exact format:
{"explanation":"...","remediation":"...","code":"..."}`; 

      const gatewayResult = await callAiGateway([{ role: 'user', content: prompt }]);

      // Parse JSON from response; fall back to using raw content as explanation
      let explanation = gatewayResult.content;
      let remediation = '';
      let code = '';
      try {
        const jsonMatch = gatewayResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
          explanation = typeof parsed.explanation === 'string' ? parsed.explanation : explanation;
          remediation = typeof parsed.remediation === 'string' ? parsed.remediation : '';
          code       = typeof parsed.code === 'string' ? parsed.code : '';
        }
      } catch {
        // non-JSON response — use raw content as explanation
      }

      const { error: updateError } = await supabase
        .from('vulnerabilities')
        .update({
          description: explanation || v.description,
          remediation: remediation || v.remediation,
          remediation_code: code || v.remediation_code,
        })
        .eq('id', v.id);
      if (updateError) throw new Error(updateError.message);

      await loadVulnerabilities(v.scan_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAiGenError(`AI Generation failed: ${message}`);
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

  const scanSummary = useMemo(() => ({
    total: scans.length,
    running: scans.filter(s => s.status === 'running').length,
    completed: scans.filter(s => s.status === 'completed').length,
    failed: scans.filter(s => s.status === 'failed').length,
  }), [scans]);

  const exportVulnsCsv = useCallback(() => {
    if (!vulnerabilities.length) return;
    const headers = ['Title', 'Severity', 'Asset', 'CVE', 'Status', 'Description', 'Detected'];
    const rows = vulnerabilities.map(v => [
      v.title, v.severity, v.asset, v.cve_id ?? '', v.status,
      (v.description ?? '').replace(/\n/g, ' '),
      new Date(v.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `vulnerabilities-${selectedScanId?.slice(0, 8) ?? 'scan'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [vulnerabilities, selectedScanId]);

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-64 flex-shrink-0 space-y-2">
            <SkeletonBlock className="h-4 w-28 mb-3" />
            <SkeletonBlock className="h-8 w-full rounded-lg mb-2" />
            <SkeletonSidebar count={6} />
          </div>
          <div className="flex-1 space-y-4">
            <SkeletonBlock className="h-32 w-full rounded-xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <SkeletonBlock key={i} className="h-24 rounded-xl" />)}
            </div>
            <SkeletonBlock className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Mock Mode Warning Toast */}
      {showMockWarning && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">
            <strong>Demo Mode:</strong> The real scanner agent is unavailable. Results shown are simulated and do not reflect your actual infrastructure.
          </span>
          <button
            onClick={() => setShowMockWarning(false)}
            aria-label="Dismiss mock warning"
            className="ml-2 text-amber-400 hover:text-amber-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* AI Generation Error Toast */}
      {aiGenError && (
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{aiGenError}</span>
          <button
            onClick={() => setAiGenError(null)}
            aria-label="Dismiss error"
            className="ml-2 text-red-400 hover:text-red-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <ScanHeader 
        projects={projects}
        selectedProjectId={selectedProjectId}
        currentMode={currentScanMode}
        onSelectProject={setSelectedProjectId}
        onNewScan={() => setShowNewScanModal(true)}
      />

      <ScanStats 
        stats={getStats()}
        totalVulnerabilities={vulnerabilities.length}
      />

      {/* Project scan summary strip */}
      {scans.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 flex items-center gap-3">
            <Shield className="w-5 h-5 text-slate-500" />
            <div>
              <div className="text-lg font-bold text-white">{scanSummary.total}</div>
              <div className="text-xs text-slate-500">Total scans</div>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500/70" />
            <div>
              <div className="text-lg font-bold text-emerald-300">{scanSummary.completed}</div>
              <div className="text-xs text-emerald-400/60">Completed</div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500/70" />
            <div>
              <div className="text-lg font-bold text-amber-300">{scanSummary.running}</div>
              <div className="text-xs text-amber-400/60">Running</div>
            </div>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-500/70" />
            <div>
              <div className="text-lg font-bold text-red-300">{scanSummary.failed}</div>
              <div className="text-xs text-red-400/60">Failed</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Scans Sidebar */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Scans</h2>
              {filteredScans.length !== scans.length && (
                <span className="text-[10px] text-slate-500">{filteredScans.length}/{scans.length}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {vulnerabilities.length > 0 && (
                <button
                  onClick={exportVulnsCsv}
                  title="Export vulnerabilities CSV"
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-2 py-1 rounded-md transition"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || !selectedProjectId}
                title="Refresh scans"
                aria-label="Refresh scans"
                className="p-1.5 rounded-md border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition disabled:opacity-40"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={scanSearch}
              onChange={(e) => setScanSearch(e.target.value)}
              placeholder="Search scans…"
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Scanner filter */}
          {uniqueScanners.length > 2 && (
            <select
              value={scannerFilter}
              onChange={(e) => setScannerFilter(e.target.value)}
              aria-label="Filter by scanner"
              className="w-full mb-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            >
              {uniqueScanners.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All scanners' : s}</option>
              ))}
            </select>
          )}

          {/* Status filter */}
          {uniqueStatuses.length > 2 && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="w-full mb-3 bg-slate-800/60 border border-slate-700/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            >
              {uniqueStatuses.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
              ))}
            </select>
          )}

          <div className="space-y-2">
            {filteredScans.length === 0 && (
              <div className="py-8 text-center">
                <Search className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                <div className="text-xs font-medium text-slate-400">No scans match filters</div>
                <div className="text-xs text-slate-600 mt-0.5">Adjust scanner or status filter.</div>
              </div>
            )}
            {filteredScans.map(scan => (
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
                  <span className="text-[10px] opacity-60">{relativeTime(scan.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <ScanStatusBadge status={scan.status} active={selectedScanId === scan.id} />
                  {scan.is_mock && (
                    <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wide">DEMO</span>
                  )}
                </div>
                {scan.status === 'running' && <RunningProgressBar />}
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
              <button
                onClick={() => setShowNewScanModal(false)}
                aria-label="Close new scan modal"
                title="Close"
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Scanner Type</label>
                <select 
                  aria-label="Select scanner type"
                  title="Select scanner type"
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
                aria-label="Launch scan"
                title="Launch scan"
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
                aria-label="Close vulnerability details"
                title="Close details"
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
