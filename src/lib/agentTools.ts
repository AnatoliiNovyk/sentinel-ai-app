import { supabase, Project, Scan, Vulnerability } from './supabase';
import { runMockScan, AVAILABLE_SCANNERS } from './scanMock';
import { buildReport, ReportKind } from './reportBuilder';

export type ToolName =
  | 'list_projects'
  | 'list_scans'
  | 'run_scan'
  | 'generate_report'
  | 'summarize_findings';

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
    patterns: [/^(hi|hello|hey|greetings|morning|evening|hola)(\b|$)/i],
  },
  {
    name: 'help',
    patterns: [/\b(help|assist|what can you do|capabilities|commands)\b/i],
  },
  {
    name: 'list_projects',
    patterns: [/(list|show|what).*(projects)/i, /^projects$/i],
  },
  {
    name: 'list_scans',
    patterns: [/(list|show|recent|view).*(scans|audits|history)/i],
  },
  {
    name: 'run_scan',
    patterns: [/\b(run|start|launch|kick off|perform|execute|scan|audit|pentest|analyze)\b/i],
    extractArgs: (text) => ({
      raw: text,
      scanner: keywordScanner(text),
    }),
  },
  {
    name: 'generate_report',
    patterns: [/\b(generate|create|produce|write|build|get).*(report|summary|write-up|writeup)\b/i, /executive summary/i, /technical report/i],
    extractArgs: (text) => ({
      raw: text,
      kind: detectKind(text),
    }),
  },
  {
    name: 'summarize_findings',
    patterns: [/\bsummarize\b/i, /summary of findings/i, /risk profile/i, /top vulnerabilities/i],
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
- **Project Audit**: Ask me to "scan", "audit", or "pentest" a project.
- **Reporting**: Ask me to "generate a report" (executive or technical).
- **History**: Ask to "show recent scans" or "list projects".
- **Analysis**: Ask to "summarize findings" for a quick posture snapshot.

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
    case 'run_scan':
      result = await toolRunScan(userId, intent.args as { raw: string; scanner: string | null });
      break;
    case 'generate_report':
      result = await toolGenerateReport(userId, intent.args as { raw: string; kind: ReportKind });
      break;
    case 'summarize_findings':
      result = await toolSummarizeFindings(userId);
      break;
    default:
      return null;
  }

  return { content: result.summary, toolCalls: [result] };
}


export const TOOL_LABELS: Record<ToolName, string> = {
  list_projects: 'Listed projects',
  list_scans: 'Listed scans',
  run_scan: 'Ran scan',
  generate_report: 'Generated report',
  summarize_findings: 'Summarized findings',
};
