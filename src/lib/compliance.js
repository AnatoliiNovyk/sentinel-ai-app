// ── CIS Controls v8 Categories ───────────────────────────────────────────────
export const CIS_CONTROLS = [
    { id: 'CIS-1', label: 'Inventory & Control of Enterprise Assets' },
    { id: 'CIS-2', label: 'Inventory & Control of Software Assets' },
    { id: 'CIS-3', label: 'Data Protection' },
    { id: 'CIS-4', label: 'Secure Configuration of Assets' },
    { id: 'CIS-5', label: 'Account Management' },
    { id: 'CIS-6', label: 'Access Control Management' },
    { id: 'CIS-7', label: 'Continuous Vulnerability Management' },
    { id: 'CIS-8', label: 'Audit Log Management' },
    { id: 'CIS-9', label: 'Email & Web Browser Protections' },
    { id: 'CIS-10', label: 'Malware Defenses' },
    { id: 'CIS-11', label: 'Data Recovery' },
    { id: 'CIS-12', label: 'Network Infrastructure Management' },
    { id: 'CIS-13', label: 'Network Monitoring & Defense' },
    { id: 'CIS-14', label: 'Security Awareness & Skills Training' },
    { id: 'CIS-15', label: 'Service Provider Management' },
    { id: 'CIS-16', label: 'Application Software Security' },
    { id: 'CIS-17', label: 'Incident Response Management' },
    { id: 'CIS-18', label: 'Penetration Testing' },
];
// ── MITRE ATT&CK Tactics ─────────────────────────────────────────────────────
export const MITRE_TACTICS = [
    { id: 'TA0001', label: 'Initial Access', color: 'bg-red-500' },
    { id: 'TA0002', label: 'Execution', color: 'bg-orange-500' },
    { id: 'TA0003', label: 'Persistence', color: 'bg-amber-500' },
    { id: 'TA0004', label: 'Privilege Escalation', color: 'bg-yellow-500' },
    { id: 'TA0005', label: 'Defense Evasion', color: 'bg-lime-500' },
    { id: 'TA0006', label: 'Credential Access', color: 'bg-green-500' },
    { id: 'TA0007', label: 'Discovery', color: 'bg-teal-500' },
    { id: 'TA0008', label: 'Lateral Movement', color: 'bg-sky-500' },
    { id: 'TA0009', label: 'Collection', color: 'bg-blue-500' },
    { id: 'TA0010', label: 'Exfiltration', color: 'bg-violet-500' },
    { id: 'TA0011', label: 'Command & Control', color: 'bg-purple-500' },
    { id: 'TA0040', label: 'Impact', color: 'bg-pink-500' },
];
// ── NIST CSF Functions ───────────────────────────────────────────────────────
export const NIST_FUNCTIONS = [
    { id: 'ID', label: 'Identify', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', keywords: ['inventory', 'asset', 'risk', 'governance'] },
    { id: 'PR', label: 'Protect', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', keywords: ['access', 'configuration', 'secure', 'harden', 'encryption', 'patch'] },
    { id: 'DE', label: 'Detect', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', keywords: ['monitor', 'log', 'detect', 'anomal', 'alert', 'scan'] },
    { id: 'RS', label: 'Respond', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', keywords: ['incident', 'response', 'remediat', 'patch', 'fix'] },
    { id: 'RC', label: 'Recover', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', keywords: ['recover', 'backup', 'restore', 'resilience'] },
];
// ── SOC 2 Trust Criteria ─────────────────────────────────────────────────────
export const SOC2_CRITERIA = [
    { id: 'CC1', label: 'Control Environment', weight: 0.15 },
    { id: 'CC2', label: 'Communication & Information', weight: 0.10 },
    { id: 'CC3', label: 'Risk Assessment', weight: 0.15 },
    { id: 'CC4', label: 'Monitoring Activities', weight: 0.10 },
    { id: 'CC5', label: 'Control Activities', weight: 0.15 },
    { id: 'CC6', label: 'Logical Access Controls', weight: 0.20 },
    { id: 'CC7', label: 'System Operations', weight: 0.15 },
];
// ── Severity points (lower = better) ─────────────────────────────────────────
const SEV_PENALTY = { critical: 25, high: 10, medium: 4, low: 1, info: 0 };
const MAX_SCORE = 100;
/** Normalise strings for matching (strip spaces, lowercase) */
const norm = (s) => (s ?? '').toLowerCase();
export function computeCompliance(vulns) {
    const open = vulns.filter(v => v.status !== 'resolved' && v.status !== 'false_positive');
    const resolved = vulns.filter(v => v.status === 'resolved').length;
    // ── CIS Controls ──────────────────────────────────────────────────────────
    const cisRows = CIS_CONTROLS.map(c => {
        const matched = open.filter(v => norm(v.cis_control).includes(c.id.toLowerCase()));
        const critCount = matched.filter(v => v.severity === 'critical' || v.severity === 'high').length;
        const penalty = matched.reduce((acc, v) => acc + (SEV_PENALTY[v.severity] ?? 0), 0);
        return {
            id: c.id,
            label: c.label,
            openCount: matched.length,
            criticalCount: critCount,
            totalCount: open.filter(v => norm(v.cis_control).includes(c.id.toLowerCase()) || norm(v.cis_control) === '').length,
            score: Math.max(0, MAX_SCORE - Math.min(penalty, MAX_SCORE)),
        };
    });
    // ── MITRE ATT&CK ──────────────────────────────────────────────────────────
    const mitreRows = MITRE_TACTICS.map(t => {
        const matched = open.filter(v => norm(v.mitre_tactic).includes(t.label.toLowerCase()) ||
            norm(v.mitre_tactic).includes(t.id.toLowerCase()));
        return {
            id: t.id,
            label: t.label,
            color: t.color,
            openCount: matched.length,
            criticalCount: matched.filter(v => v.severity === 'critical').length,
        };
    });
    // ── NIST CSF ──────────────────────────────────────────────────────────────
    const nistRows = NIST_FUNCTIONS.map(f => {
        const matched = open.filter(v => f.keywords.some(kw => norm(v.title).includes(kw) ||
            norm(v.description).includes(kw) ||
            norm(v.remediation).includes(kw)));
        const penalty = matched.reduce((acc, v) => acc + (SEV_PENALTY[v.severity] ?? 0), 0);
        return {
            id: f.id,
            label: f.label,
            color: f.color,
            bg: f.bg,
            openCount: matched.length,
            score: Math.max(0, MAX_SCORE - Math.min(penalty, MAX_SCORE)),
        };
    });
    // ── SOC2 ─────────────────────────────────────────────────────────────────
    const critCount = open.filter(v => v.severity === 'critical').length;
    const highCount = open.filter(v => v.severity === 'high').length;
    const medCount = open.filter(v => v.severity === 'medium').length;
    const basePenalty = critCount * 20 + highCount * 8 + medCount * 3;
    const soc2Rows = SOC2_CRITERIA.map(c => ({
        id: c.id,
        label: c.label,
        weight: c.weight,
        score: Math.max(0, MAX_SCORE - Math.round(basePenalty * c.weight * 2)),
        openCount: open.length,
        criticalCount: critCount,
    }));
    const soc2Overall = Math.round(soc2Rows.reduce((acc, r) => acc + r.score * r.weight, 0) /
        soc2Rows.reduce((acc, r) => acc + r.weight, 0));
    return {
        soc2Overall,
        cisRows,
        mitreRows,
        nistRows,
        soc2Rows,
        openVulns: open.length,
        resolvedVulns: resolved,
        totalVulns: vulns.length,
    };
}
