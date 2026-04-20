import { supabase, Project, Scan, Vulnerability } from './supabase';
import { runMockScan, AVAILABLE_SCANNERS } from './scanMock';
import { buildReport, ReportKind } from './reportBuilder';
import { computeCompliance } from './compliance';

export type ToolName =
  | 'list_projects'
  | 'list_scans'
  | 'run_scan'
  | 'generate_report'
  | 'summarize_findings'
  | 'compliance_check'
  | 'list_findings'
  | 'sla_status'
  | 'resolve_finding';

export type ToolCall = {
  name: ToolName;
  args: Record<string, unknown>;
};

export type ToolResult = {
  name: ToolName;
  ok: boolean;
  summary: string;
  data?: unknown;
};

export type AgentTurn = {
  content: string;
  toolCalls: ToolResult[];
};

function keywordScanner(text: string): string | null {
  const t = text.toLowerCase();
  if (/\bnmap\b/.test(t)) return 'nmap';
  if (/\bamass\b|subdomain/.test(t)) return 'amass';
  if (/\bprowler\b|aws|cloud/.test(t)) return 'prowler';
  if (/\btfsec\b|terraform|iac/.test(t)) return 'tfsec';
  return null;
}

function detectKind(text: string): ReportKind {
  const t = text.toLowerCase();
  if (/\btechnical\b|deep dive|detailed|engineer/.test(t)) return 'technical';
  return 'executive';
}

async function loadUserProjects(userId: string): Promise<Project[]> {
  const { data } = await supabase.from('projects').select('*').eq('user_id', userId);
  return (data ?? []) as Project[];
}

export type IntentMatcher = {
  name: ToolName | 'greeting' | 'help';
  patterns: RegExp[];
  extractArgs?: (text: string) => Record<string, unknown>;
};

const INTENT_MATCHERS: IntentMatcher[] = [
  {
    name: 'greeting',
    patterns: [/^(hi|hello|hey|greetings|morning|evening|hola|привіт|вітаю|добрий)(\b|$)/i],
  },
  {
    name: 'help',
    patterns: [/\b(help|assist|what can you do|capabilities|commands|допомога|що вмієш)\b/i],
  },
  {
    name: 'list_projects',
    patterns: [
      /(list|show|what|display|get).*(projects?|проект)/i,
      /^projects?$/i,
      /мої проекти/i,
      /які проекти/i,
    ],
  },
  {
    name: 'list_scans',
    patterns: [
      /(list|show|recent|view|display).*(scans?|audits?|history|скан)/i,
      /останн.*(скан|аудит)/i,
    ],
  },
  {
    name: 'list_findings',
    patterns: [
      /(list|show|display|get).*(finding|vulnerabilit|vuln|issue)/i,
      /what.*vulnerabilit/i,
      /open (issues?|findings?|vulns?)/i,
      /вразливост/i,
      /знахідки/i,
    ],
    extractArgs: (text) => ({ raw: text }),
  },
  {
    name: 'compliance_check',
    patterns: [
      /\b(compliance|compliant|soc\s?2|cis controls?|nist|mitre|att&ck)\b/i,
      /how.*compli/i,
      /compliance status/i,
      /комплаєнс|відповідність стандарт/i,
    ],
    extractArgs: (text) => ({ raw: text }),
  },
  {
    name: 'sla_status',
    patterns: [
      /\b(sla|breach|overdue|deadline|дедлайн|прострочен)\b/i,
      /sla status/i,
      /what.*overdue/i,
      /which.*breach/i,
    ],
    extractArgs: (text) => ({ raw: text }),
  },
  {
    name: 'resolve_finding',
    patterns: [
      /\b(resolve|fix|close|mark.*resolved|mark.*fixed)\b.*\b(finding|vuln|issue|cve)\b/i,
      /\b(resolve|fix|close)\b.*\b(critical|high|medium)\b/i,
    ],
    extractArgs: (text) => ({ raw: text }),
  },
  {
    name: 'run_scan',
    patterns: [
      /\b(run|start|launch|kick off|perform|execute|scan|audit|pentest|analyze|запуст|скануй|перевір)\b/i,
    ],
    extractArgs: (text) => ({
      raw: text,
      scanner: keywordScanner(text),
    }),
  },
  {
    name: 'generate_report',
    patterns: [
      /\b(generate|create|produce|write|build|get|згенеруй|створи).*(report|summary|write-up|writeup|звіт)\b/i,
      /executive summary/i,
      /technical report/i,
      /звіт/i,
    ],
    extractArgs: (text) => ({
      raw: text,
      kind: detectKind(text),
    }),
  },
  {
    name: 'summarize_findings',
    patterns: [
      /\bsummarize\b/i,
      /summary of findings/i,
      /risk profile/i,
      /top vulnerabilit/i,
      /posture/i,
      /огляд|резюме|підсумок/i,
    ],
    extractArgs: (text) => ({ raw: text }),
  },
];


function findProject(projects: Project[], text: string): Project | null {
  if (projects.length === 0) return null;
  const t = text.toLowerCase();
  const byName = projects.find((p) => t.includes(p.name.toLowerCase()));
  if (byName) return byName;
  const byTarget = projects.find((p) => p.target && t.includes(p.target.toLowerCase()));
  if (byTarget) return byTarget;
  return projects[0];
}

function parseIntent(text: string): ToolCall | { name: 'greeting' | 'help'; args?: Record<string, unknown> } | null {
  const t = text.trim();
  for (const matcher of INTENT_MATCHERS) {
    if (matcher.patterns.some((p) => p.test(t))) {
      return {
        name: matcher.name as any,
        args: matcher.extractArgs ? matcher.extractArgs(t) : {},
      };
    }
  }
  return null;
}



async function toolListProjects(userId: string): Promise<ToolResult> {
  const projects = await loadUserProjects(userId);
  if (projects.length === 0) {
    return {
      name: 'list_projects',
      ok: true,
      summary: 'You have no projects yet. Create one from the Projects page to begin.',
      data: [],
    };
  }
  const lines = projects.map((p) => `- **${p.name}** (${p.environment}) -> \`${p.target}\``);
  return {
    name: 'list_projects',
    ok: true,
    summary: `Found ${projects.length} project(s):\n\n${lines.join('\n')}`,
    data: projects,
  };
}

async function toolListScans(userId: string): Promise<ToolResult> {
  const { data: scans } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  const list = (scans ?? []) as Scan[];
  if (list.length === 0) {
    return { name: 'list_scans', ok: true, summary: 'No scans on record yet.', data: [] };
  }
  const lines = list.map((s) => {
    const sev = s.severity_summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    return `- \`${s.scanner}\` · ${s.status} · C:${sev.critical} H:${sev.high} M:${sev.medium} L:${sev.low}`;
  });
  return {
    name: 'list_scans',
    ok: true,
    summary: `Last ${list.length} scan(s):\n\n${lines.join('\n')}`,
    data: list,
  };
}

async function toolRunScan(
  userId: string,
  args: { raw: string; scanner: string | null }
): Promise<ToolResult> {
  const projects = await loadUserProjects(userId);
  const project = findProject(projects, args.raw);
  if (!project) {
    return {
      name: 'run_scan',
      ok: false,
      summary:
        'I need a project to scan. Create one in the Projects tab first, then ask me again.',
    };
  }
  const scanner =
    args.scanner ??
    (project.environment === 'cloud'
      ? 'prowler'
      : project.environment === 'iac'
        ? 'tfsec'
        : 'nmap');
  const meta = AVAILABLE_SCANNERS.find((s) => s.id === scanner);
  const scanId = await runMockScan(userId, project.id, scanner);
  if (!scanId) {
    return { name: 'run_scan', ok: false, summary: 'Scan could not be dispatched.' };
  }
  const { data: scan } = await supabase.from('scans').select('*').eq('id', scanId).maybeSingle();
  const sev = (scan as Scan | null)?.severity_summary ?? {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const summary = `Launched **${meta?.label ?? scanner}** against **${project.name}** and completed successfully.

Findings: ${sev.critical} critical · ${sev.high} high · ${sev.medium} medium · ${sev.low} low.

Open the Scans page to drill into individual vulnerabilities, or ask me to generate a report.`;
  return { name: 'run_scan', ok: true, summary, data: { scanId, project, scanner } };
}

async function toolGenerateReport(
  userId: string,
  args: { raw: string; kind: ReportKind }
): Promise<ToolResult> {
  const projects = await loadUserProjects(userId);
  const project = findProject(projects, args.raw);
  if (!project) {
    return {
      name: 'generate_report',
      ok: false,
      summary: 'No project available for report generation. Create one first.',
    };
  }
  const { data: scans } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });
  const scanList = (scans ?? []) as Scan[];
  const scanIds = scanList.map((s) => s.id);
  const { data: vulns } = scanIds.length
    ? await supabase.from('vulnerabilities').select('*').in('scan_id', scanIds)
    : { data: [] as Vulnerability[] };

  const content = buildReport(args.kind, project, scanList, (vulns ?? []) as Vulnerability[]);
  const title = `${args.kind === 'executive' ? 'Executive Summary' : 'Technical Deep Dive'} - ${project.name}`;

  const { data: report } = await supabase
    .from('reports')
    .insert({
      user_id: userId,
      project_id: project.id,
      kind: args.kind,
      title,
      content,
    })
    .select()
    .maybeSingle();

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'report_ready',
    title: `${args.kind === 'executive' ? 'Executive' : 'Technical'} report ready`,
    body: `${title} has been generated and is available in the Reports tab.`,
    link: 'reports',
    severity: 'success',
    metadata: { report_id: report?.id, project_id: project.id, kind: args.kind },
  });

  return {
    name: 'generate_report',
    ok: true,
    summary: `Generated the **${args.kind}** report for **${project.name}** and saved it to the Reports tab.`,
    data: { reportId: report?.id, title },
  };
}

async function toolSummarizeFindings(userId: string): Promise<ToolResult> {
  const { data: vulns } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  const list = (vulns ?? []) as Vulnerability[];
  if (list.length === 0) {
    return {
      name: 'summarize_findings',
      ok: true,
      summary: 'No findings recorded yet. Run a scan and I will summarize the results.',
    };
  }
  const by: Record<string, number> = {};
  for (const v of list) by[v.severity] = (by[v.severity] ?? 0) + 1;
  const top = [...list]
    .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    .slice(0, 5)
    .map((v) => `- **${v.title}** (${v.severity}) · \`${v.asset}\``);
  const summary = `Posture snapshot based on ${list.length} recent findings:

- Critical: ${by.critical ?? 0}
- High: ${by.high ?? 0}
- Medium: ${by.medium ?? 0}
- Low: ${by.low ?? 0}

Top priority items:
${top.join('\n')}`;
  return { name: 'summarize_findings', ok: true, summary };
}

function severityWeight(s: string): number {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[s] ?? 0;
}

export async function runAgent(userId: string, userText: string): Promise<AgentTurn | null> {
  const intent = parseIntent(userText);
  if (!intent) return null;

  if (intent.name === 'greeting') {
    return {
      content: "Hello! I'm Sentinel AI, your autonomous security auditor. How can I help you secure your infrastructure today?",
      toolCalls: [],
    };
  }

  if (intent.name === 'help') {
    return {
      content: `I can help you with the following tasks:

**🔍 Scanning & Auditing**
- "Run a scan on [project]" — launch nmap / prowler / tfsec / amass
- "Show recent scans"

**📋 Findings & Triage**
- "List open findings" — see your top vulnerabilities
- "Summarize findings" — posture snapshot
- "Resolve the critical [finding name]" — mark as resolved

**📊 Compliance**
- "Check compliance" — SOC 2, CIS Controls, NIST CSF, MITRE ATT&CK
- "SLA status" — which findings are overdue or at risk

**📄 Reporting**
- "Generate executive summary" — board-ready PDF
- "Generate technical report" — engineer deep dive

**📁 Projects**
- "List my projects"

How would you like to proceed?`,
      toolCalls: [],
    };
  }

  let result: ToolResult;
  switch (intent.name) {
    case 'list_projects':
      result = await toolListProjects(userId);
      break;
    case 'list_scans':
      result = await toolListScans(userId);
      break;
    case 'list_findings':
      result = await toolListFindings(userId);
      break;
    case 'run_scan':
      result = await toolRunScan(userId, intent.args as { raw: string; scanner: string | null });
      break;
    case 'generate_report':
      result = await toolGenerateReport(userId, intent.args as { raw: string; kind: ReportKind });
      break;
    case 'summarize_findings':
      result = await toolSummarizeFindings(userId);
      break;
    case 'compliance_check':
      result = await toolComplianceCheck(userId);
      break;
    case 'sla_status':
      result = await toolSlaStatus(userId);
      break;
    case 'resolve_finding':
      result = await toolResolveFinding(userId, intent.args as { raw: string });
      break;
    default:
      return null;
  }

  return { content: result.summary, toolCalls: [result] };
}


export const TOOL_LABELS: Record<ToolName, string> = {
  list_projects:     '📁 Listed projects',
  list_scans:        '🔍 Listed scans',
  list_findings:     '🐛 Listed findings',
  run_scan:          '🚀 Running scan',
  generate_report:   '📄 Generated report',
  summarize_findings:'📊 Summarized findings',
  compliance_check:  '🛡️ Checked compliance',
  sla_status:        '⏱️ Checked SLA status',
  resolve_finding:   '✅ Resolved finding',
};

// ── New tool implementations ───────────────────────────────────────────────

async function toolListFindings(userId: string): Promise<ToolResult> {
  const { data } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(100);
  const list = (data ?? []) as Vulnerability[];
  if (list.length === 0) {
    return { name: 'list_findings', ok: true, summary: 'No open findings. Your infrastructure is clean! 🎉' };
  }
  const bySev: Record<string, Vulnerability[]> = {};
  for (const v of list) (bySev[v.severity] ??= []).push(v);

  const sections: string[] = [];
  for (const sev of ['critical', 'high', 'medium', 'low'] as const) {
    const items = bySev[sev];
    if (!items?.length) continue;
    const emoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[sev];
    sections.push(`**${emoji} ${sev.toUpperCase()} (${items.length})**`);
    items.slice(0, 3).forEach(v => sections.push(`- ${v.title} · \`${v.asset}\``));
    if (items.length > 3) sections.push(`  _…and ${items.length - 3} more_`);
  }
  return {
    name: 'list_findings',
    ok: true,
    summary: `Found **${list.length} open findings** across your projects:\n\n${sections.join('\n')}\n\nOpen the **Findings** tab in any project to triage or apply automated fixes.`,
  };
}

async function toolComplianceCheck(userId: string): Promise<ToolResult> {
  const { data } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('user_id', userId)
    .limit(500);
  const vulns = (data ?? []) as Vulnerability[];
  const { soc2Overall, nistRows, mitreRows } = computeCompliance(vulns);

  const soc2Emoji = soc2Overall >= 80 ? '✅' : soc2Overall >= 60 ? '⚠️' : '🔴';
  const nistSummary = nistRows.map(r => `- **${r.id} — ${r.label}**: ${r.score}% (${r.openCount} open)`).join('\n');
  const activeTactics = mitreRows.filter(r => r.openCount > 0);
  const mitreText = activeTactics.length
    ? activeTactics.map(r => `- **${r.label}**: ${r.openCount} finding(s)`).join('\n')
    : '_No active MITRE tactics detected_ ✅';

  return {
    name: 'compliance_check',
    ok: true,
    summary: `## Compliance Posture\n\n**${soc2Emoji} SOC 2 Readiness: ${soc2Overall}%**\n${soc2Overall >= 80 ? 'On track for audit.' : soc2Overall >= 60 ? 'Address high-severity findings to improve.' : 'Critical gaps — immediate action required.'}\n\n**NIST CSF Functions:**\n${nistSummary}\n\n**Active MITRE ATT&CK Tactics:**\n${mitreText}\n\nView the full breakdown on the **Compliance** page.`,
  };
}

async function toolSlaStatus(userId: string): Promise<ToolResult> {
  const { data } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['open', 'in_progress'])
    .in('severity', ['critical', 'high', 'medium'])
    .limit(200);
  const vulns = (data ?? []) as Vulnerability[];
  const SLA_DAYS: Record<string, number> = { critical: 3, high: 7, medium: 30 };
  const now = Date.now();

  const rows = vulns.map(v => {
    const ageDays = (now - new Date(v.created_at).getTime()) / 86_400_000;
    const budget = SLA_DAYS[v.severity] ?? 30;
    return { v, ageDays, budget, overdue: ageDays > budget, remaining: budget - ageDays };
  });

  const overdue = rows.filter(r => r.overdue);
  const atRisk  = rows.filter(r => !r.overdue && r.ageDays / r.budget >= 0.75);
  const healthy = rows.filter(r => !r.overdue && r.ageDays / r.budget < 0.75);

  if (rows.length === 0) {
    return { name: 'sla_status', ok: true, summary: '✅ No open critical/high/medium findings. All SLAs are on track.' };
  }

  const fmtRow = (r: typeof rows[0]) =>
    `- **${r.v.severity.toUpperCase()}** — ${r.v.title}${
      r.overdue ? ` 🔴 *+${Math.floor(r.ageDays - r.budget)}d overdue*` :
      ` ⚠️ *${Math.max(0, Math.ceil(r.remaining))}d remaining*`}`;

  const lines: string[] = [];
  if (overdue.length) {
    lines.push(`**🔴 Overdue (${overdue.length})**`);
    overdue.slice(0, 4).forEach(r => lines.push(fmtRow(r)));
  }
  if (atRisk.length) {
    lines.push(`\n**⚠️ At Risk — ≥75% of SLA budget used (${atRisk.length})**`);
    atRisk.slice(0, 4).forEach(r => lines.push(fmtRow(r)));
  }
  if (healthy.length) {
    lines.push(`\n**✅ Healthy (${healthy.length})** — within SLA`);
  }

  return {
    name: 'sla_status',
    ok: overdue.length === 0,
    summary: `## SLA Status Report\n\n${lines.join('\n')}\n\nView the SLA watch panel on the **Dashboard** for real-time tracking.`,
  };
}

async function toolResolveFinding(userId: string, args: { raw: string }): Promise<ToolResult> {
  const text = args.raw.toLowerCase();
  // Find best matching open vuln by keyword in title
  const { data } = await supabase
    .from('vulnerabilities')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['open', 'in_progress'])
    .limit(100);
  const vulns = (data ?? []) as Vulnerability[];
  if (vulns.length === 0) {
    return { name: 'resolve_finding', ok: false, summary: 'No open findings to resolve.' };
  }
  // Score each by word-overlap with user text
  const scored = vulns.map(v => {
    const titleWords = v.title.toLowerCase().split(/\W+/);
    const score = titleWords.filter(w => w.length > 3 && text.includes(w)).length;
    return { v, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (best.score === 0) {
    return {
      name: 'resolve_finding',
      ok: false,
      summary: `I couldn't match a specific finding from your message. Try being more specific, e.g. "resolve the S3 public access finding".\n\nOpen findings: ${vulns.slice(0, 5).map(v => `**${v.title}**`).join(', ')}`,
    };
  }

  await supabase
    .from('vulnerabilities')
    .update({ status: 'resolved', status_updated_at: new Date().toISOString(), note: 'Resolved via AI Agent.' })
    .eq('id', best.v.id);

  return {
    name: 'resolve_finding',
    ok: true,
    summary: `✅ Marked **"${best.v.title}"** (${best.v.severity}) as **resolved**. The finding has been updated in the database.`,
  };
}
