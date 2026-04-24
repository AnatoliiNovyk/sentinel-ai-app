export function buildReport(kind, project, scans, vulns) {
    const active = vulns.filter((v) => v.status !== 'resolved' && v.status !== 'false_positive');
    const resolved = vulns.filter((v) => v.status === 'resolved');
    const accepted = vulns.filter((v) => v.status === 'accepted');
    const falsePositives = vulns.filter((v) => v.status === 'false_positive');
    const totals = active.reduce((acc, v) => {
        acc[v.severity] = (acc[v.severity] ?? 0) + 1;
        return acc;
    }, {});
    const totalFindings = active.length;
    const coverage = scans.length;
    if (kind === 'executive') {
        return `# Executive Summary — ${project.name}

Generated: ${new Date().toLocaleString()}

## Overview
An AI-orchestrated audit was performed against "${project.name}" (${project.environment}) across ${coverage} scan(s). ${totalFindings} active findings remain after triage (${resolved.length} resolved, ${accepted.length} accepted risks, ${falsePositives.length} false positives) and are mapped to industry frameworks (MITRE ATT&CK, CIS Controls).

## Active risk profile
- Critical: ${totals.critical ?? 0}
- High: ${totals.high ?? 0}
- Medium: ${totals.medium ?? 0}
- Low: ${totals.low ?? 0}

## Triage status
- Resolved: ${resolved.length}
- Accepted risks: ${accepted.length}
- False positives: ${falsePositives.length}

## Business impact
${(totals.critical ?? 0) > 0 ? 'Immediate attention required: critical issues could allow data exfiltration or full compromise of production resources.' : 'No critical exposures detected at this time. Maintain continuous monitoring to catch drift.'}

## Recommended next steps
1. Apply the AI-generated remediation patches for all critical and high findings within the next change window.
2. Schedule a follow-up scan after remediation to validate closure.
3. Enable continuous posture monitoring to detect configuration drift.

## Compliance alignment
Findings were correlated with SOC2, CIS Controls v8 and MITRE ATT&CK. Detailed evidence is available in the companion Technical Deep Dive report.
`;
    }
    const lines = [
        `# Technical Deep Dive — ${project.name}`,
        `Generated: ${new Date().toLocaleString()}`,
        ``,
        `Target: ${project.target}`,
        `Environment: ${project.environment}`,
        `Total scans: ${coverage}`,
        `Active findings: ${totalFindings}`,
        `Resolved: ${resolved.length} · Accepted: ${accepted.length} · False positives: ${falsePositives.length}`,
        ``,
        `## Findings`,
    ];
    const statusLabel = {
        open: 'Open',
        in_progress: 'In progress',
        accepted: 'Accepted risk',
        resolved: 'Resolved',
        false_positive: 'False positive',
    };
    const ordered = [...vulns].sort((a, b) => {
        const rank = (s) => s === 'open' ? 0 : s === 'in_progress' ? 1 : s === 'accepted' ? 2 : s === 'resolved' ? 3 : 4;
        return rank(a.status) - rank(b.status);
    });
    for (const v of ordered) {
        lines.push(``, `### [${v.severity.toUpperCase()}] ${v.title}`, `- Status: ${statusLabel[v.status]}`, `- Asset: \`${v.asset}\``, `- MITRE: ${v.mitre_tactic || '-'}`, `- CIS: ${v.cis_control || '-'}`, v.cve_id ? `- CVE: ${v.cve_id}` : '', ``, v.description, ``, `**Remediation:** ${v.remediation}`, v.remediation_code ? `\n\`\`\`${v.remediation_type === 'bash' ? 'bash' : v.remediation_type === 'terraform' ? 'hcl' : v.remediation_type === 'aws-cli' ? 'bash' : 'text'}\n${v.remediation_code}\n\`\`\`` : '', v.note ? `\n**Analyst note:** ${v.note}` : '');
    }
    return lines.filter(Boolean).join('\n');
}
