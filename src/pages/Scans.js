import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Shield, Play, X, FileText, Lock, Loader2 } from 'lucide-react';
import { ScansService } from '../api/scans.service';
import { AiService } from '../api/ai.service';
import { errorToUserMessage } from '../lib/errors';
import { ScanHeader } from '../components/scans/ScanHeader';
import { ScanStats } from '../components/scans/ScanStats';
import { VulnerabilityList } from '../components/scans/VulnerabilityList';
import { useAuth } from '../context/useAuth';
const Scans = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [scans, setScans] = useState([]);
    const [selectedScanId, setSelectedScanId] = useState(null);
    const [vulnerabilities, setVulnerabilities] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [generatingId, setGeneratingId] = useState(null);
    const [selectedVuln, setSelectedVuln] = useState(null);
    // New Scan Modal state
    const [showNewScanModal, setShowNewScanModal] = useState(false);
    const [isDispatching, setIsDispatching] = useState(false);
    const [newScanConfig, setNewScanConfig] = useState({
        scanner: 'Nmap:Intense',
        target: ''
    });
    const currentScanMode = (() => {
        const scan = scans.find((s) => s.id === selectedScanId) ?? scans[0];
        if (!scan)
            return 'UNKNOWN';
        if (scan.detected_mode)
            return scan.detected_mode;
        if (scan.is_mock)
            return 'MOCK';
        return 'REAL';
    })();
    // Load initial data
    useEffect(() => {
        (async () => {
            try {
                const data = await ScansService.getProjects();
                setProjects(data);
                if (data.length > 0 && !selectedProjectId) {
                    setSelectedProjectId(data[0].id);
                }
            }
            catch (err) {
                console.error('Failed to load projects:', err);
            }
            finally {
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
                }
                catch (err) {
                    console.error('Failed to load scans:', err);
                }
            })();
        }
        else {
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
                }
                catch (err) {
                    console.error('Failed to load vulnerabilities:', err);
                }
            })();
        }
        else {
            setVulnerabilities([]);
        }
    }, [selectedScanId]);
    const loadScans = async (projectId) => {
        try {
            const data = await ScansService.getProjectScans(projectId);
            setScans(data);
            if (data.length > 0 && !selectedScanId) {
                setSelectedScanId(data[0].id);
            }
        }
        catch (err) {
            console.error('Failed to load scans:', err);
        }
    };
    const loadVulnerabilities = async (scanId) => {
        try {
            const data = await ScansService.getScanVulnerabilities(scanId);
            setVulnerabilities(data);
        }
        catch (err) {
            console.error('Failed to load vulnerabilities:', err);
        }
    };
    const handleStartScan = async () => {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project)
            return;
        setIsDispatching(true);
        try {
            await ScansService.dispatchScan(project.id, newScanConfig.scanner, newScanConfig.target || project.target, project.org_id);
            setShowNewScanModal(false);
            // Reload scans for the project
            await loadScans(project.id);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            alert('Failed to start scan: ' + message);
        }
        finally {
            setIsDispatching(false);
        }
    };
    const handleAiGeneration = async (v) => {
        if (!selectedProjectId) {
            alert('Error: No project selected.');
            return;
        }
        setGeneratingId(v.id);
        const startTime = Date.now();
        try {
            const dispatchResult = await AiService.generateFix({
                title: v.title,
                description: v.description,
                severity: v.severity,
                asset: v.asset,
                cve_id: v.cve_id,
                project_id: selectedProjectId,
                scan_id: v.scan_id,
                user_id: user?.id || ''
            });
            if (!dispatchResult.ok) {
                throw new Error(errorToUserMessage(dispatchResult.error));
            }
            const pollResult = await AiService.pollForResult(v.scan_id, startTime);
            if (!pollResult.ok) {
                throw new Error(errorToUserMessage(pollResult.error));
            }
            await loadVulnerabilities(v.scan_id);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            alert('AI Generation failed: ' + message);
        }
        finally {
            setGeneratingId(null);
        }
    };
    const getStats = () => {
        const stats = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        vulnerabilities.forEach(v => {
            if (v.severity in stats) {
                stats[v.severity]++;
            }
        });
        return stats;
    };
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-96", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" }) }));
    }
    return (_jsxs("div", { className: "max-w-7xl mx-auto px-4 py-8", children: [_jsx(ScanHeader, { projects: projects, selectedProjectId: selectedProjectId, currentMode: currentScanMode, onSelectProject: setSelectedProjectId, onNewScan: () => setShowNewScanModal(true) }), _jsx(ScanStats, { stats: getStats(), totalVulnerabilities: vulnerabilities.length }), _jsxs("div", { className: "flex flex-col lg:flex-row gap-8", children: [_jsxs("div", { className: "lg:w-64 flex-shrink-0", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4", children: "Recent Scans" }), _jsx("div", { className: "space-y-2", children: scans.map(scan => (_jsxs("button", { onClick: () => setSelectedScanId(scan.id), className: `w-full text-left p-3 rounded-xl border transition-all ${selectedScanId === scan.id
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: "font-medium text-sm capitalize", children: scan.scanner }), _jsx("span", { className: "text-[10px] opacity-60", children: new Date(scan.created_at).toLocaleDateString() })] }), _jsx("div", { className: "text-[10px] uppercase font-bold opacity-80", children: scan.status })] }, scan.id))) })] }), _jsx("div", { className: "flex-1 min-w-0", children: _jsx(VulnerabilityList, { vulnerabilities: vulnerabilities, onViewDetails: setSelectedVuln, onGenerateAiFix: handleAiGeneration, generatingId: generatingId }) })] }), showNewScanModal && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm", children: _jsxs("div", { className: "bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden", children: [_jsxs("div", { className: "p-6 border-b border-slate-800 flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-white", children: "Start New Scan" }), _jsx("button", { onClick: () => setShowNewScanModal(false), "aria-label": "Close new scan modal", title: "Close", className: "p-1 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-500 uppercase mb-2", children: "Scanner Type" }), _jsxs("select", { "aria-label": "Select scanner type", title: "Select scanner type", value: newScanConfig.scanner, onChange: (e) => setNewScanConfig({ ...newScanConfig, scanner: e.target.value }), className: "w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50", children: [_jsx("option", { value: "Nmap:Intense", children: "Nmap (Intense Scan)" }), _jsx("option", { value: "Nmap:Vuln", children: "Nmap (Vulnerability Audit)" }), _jsx("option", { value: "Tfsec", children: "Tfsec (IaC Audit)" }), _jsx("option", { value: "Amass", children: "Amass (Subdomain Recon)" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-bold text-slate-500 uppercase mb-2", children: "Target Address" }), _jsx("input", { type: "text", placeholder: "e.g. 192.168.1.1 or scanme.nmap.org", value: newScanConfig.target, onChange: (e) => setNewScanConfig({ ...newScanConfig, target: e.target.value }), className: "w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" })] }), _jsxs("button", { onClick: handleStartScan, disabled: isDispatching, "aria-label": "Launch scan", title: "Launch scan", className: "w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2", children: [isDispatching ? _jsx(Loader2, { className: "w-5 h-5 animate-spin" }) : _jsx(Play, { className: "w-5 h-5" }), isDispatching ? 'Dispatching...' : 'Launch Scan'] })] })] }) })), selectedVuln && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm", children: _jsxs("div", { className: "bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl", children: [_jsxs("div", { className: "sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between z-10", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Shield, { className: "w-6 h-6 text-blue-500" }), _jsx("h2", { className: "text-xl font-bold text-white", children: selectedVuln.title })] }), _jsx("button", { onClick: () => setSelectedVuln(null), "aria-label": "Close vulnerability details", title: "Close details", className: "p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors", children: _jsx(X, { className: "w-6 h-6" }) })] }), _jsxs("div", { className: "p-8", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-8 mb-8", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1", children: "Severity" }), _jsx("span", { className: `px-3 py-1 rounded-full text-xs font-bold ${selectedVuln.severity === 'critical' ? 'bg-red-500/20 text-red-500' :
                                                                selectedVuln.severity === 'high' ? 'bg-orange-500/20 text-orange-500' :
                                                                    selectedVuln.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-500' :
                                                                        'bg-blue-500/20 text-blue-500'}`, children: selectedVuln.severity.toUpperCase() })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1", children: "Status" }), _jsx("span", { className: "text-white capitalize", children: selectedVuln.status.replace('_', ' ') })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1", children: "Asset" }), _jsx("span", { className: "text-white font-mono text-sm", children: selectedVuln.asset })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1", children: "CVE ID" }), _jsx("span", { className: "text-white font-mono text-sm", children: selectedVuln.cve_id || 'N/A' })] })] }), _jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx("label", { className: "text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1", children: "Detection Date" }), _jsx("span", { className: "text-white", children: new Date(selectedVuln.created_at).toLocaleString() })] }) })] }), _jsxs("div", { className: "space-y-8", children: [_jsxs("section", { children: [_jsxs("h3", { className: "text-lg font-semibold text-white mb-3 flex items-center gap-2", children: [_jsx(FileText, { className: "w-5 h-5 text-blue-400" }), "Description"] }), _jsx("div", { className: "bg-slate-800/50 rounded-2xl p-6 text-slate-300 leading-relaxed border border-slate-700/50", children: selectedVuln.description })] }), _jsxs("section", { children: [_jsxs("h3", { className: "text-lg font-semibold text-white mb-3 flex items-center gap-2", children: [_jsx(Lock, { className: "w-5 h-5 text-green-400" }), "Remediation Plan"] }), _jsxs("div", { className: "bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-6", children: [_jsx("p", { className: "text-emerald-400 font-medium mb-4", children: selectedVuln.remediation || 'No remediation plan available yet.' }), selectedVuln.remediation_code && (_jsx("pre", { className: "bg-slate-950 p-4 rounded-xl text-emerald-400 font-mono text-sm overflow-x-auto border border-emerald-500/10", children: _jsx("code", { children: selectedVuln.remediation_code }) }))] })] })] })] })] }) }))] }));
};
export default Scans;
