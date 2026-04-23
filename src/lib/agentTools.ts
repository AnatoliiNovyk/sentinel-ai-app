import { supabase, Project, Scan } from './supabase';
import { ScansService } from '../api/scans.service';

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

async function loadUserProjects(): Promise<Project[]> {
  // RLS handles the organization-based filtering
  const { data } = await supabase.from('projects').select('*');
  return (data ?? []) as Project[];
}

export type IntentMatcher = {
  name: ToolName | 'greeting' | 'help';
  patterns: RegExp[];
  extractArgs?: (text: string) => Record<string, unknown>;
};

const INTENT_MATCHERS: IntentMatcher[] = [
  { name: 'greeting', patterns: [/^(hi|hello|hey|greetings|morning|evening|hola|привіт|вітаю|добрий)(\b|$)/i] },
  { name: 'help', patterns: [/\b(help|assist|capabilities|commands|допомога|що вмієш)\b/i] },
  { name: 'list_projects', patterns: [/(list|show|what|display|get).*(projects?|проект)/i, /^projects?$/i, /мої проекти/i] },
  { name: 'list_scans', patterns: [/(list|show|recent|view|display).*(scans?|audits?|history|скан)/i, /останн.*(скан|аудит)/i] },
  { name: 'list_findings', patterns: [/(list|show|display|get).*(finding|vulnerabilit|vuln|issue)/i, /вразливост/i, /знахідки/i], extractArgs: (text) => ({ raw: text }) },
  { name: 'compliance_check', patterns: [/\b(compliance|compliant|soc\s?2|cis controls?|nist|mitre|att&ck)\b/i, /комплаєнс/i], extractArgs: (text) => ({ raw: text }) },
  { name: 'sla_status', patterns: [/\b(sla|breach|overdue|deadline|дедлайн|прострочен)\b/i], extractArgs: (text) => ({ raw: text }) },
  { name: 'resolve_finding', patterns: [/\b(resolve|fix|close|mark.*resolved|mark.*fixed)\b.*\b(finding|vuln|issue|cve)\b/i], extractArgs: (text) => ({ raw: text }) },
  { name: 'run_scan', patterns: [/\b(run|start|launch|kick off|perform|execute|scan|audit|pentest|analyze|запуст|скануй|перевір)\b/i], extractArgs: (text) => ({ raw: text, scanner: keywordScanner(text) }) },
  { name: 'generate_report', patterns: [/\b(generate|create|produce|write|build|get|згенеруй|створи).*(report|summary|звіт)\b/i], extractArgs: (text) => ({ raw: text, kind: text.includes('technical') ? 'technical' : 'executive' }) },
  { name: 'summarize_findings', patterns: [/\bsummarize\b/i, /summary of findings/i, /поточний стан/i], extractArgs: (text) => ({ raw: text }) },
];

function parseIntent(text: string): { name: any; args: any } | null {
  const t = text.trim();
  for (const matcher of INTENT_MATCHERS) {
    if (matcher.patterns.some((p) => p.test(t))) {
      return { name: matcher.name as any, args: matcher.extractArgs ? matcher.extractArgs(t) : {} };
    }
  }
  return null;
}

// TOOL IMPLEMENTATIONS
async function toolListProjects(): Promise<ToolResult> {
  const projects = await loadUserProjects();
  if (projects.length === 0) return { name: 'list_projects', ok: true, summary: 'No projects found in your organization.', data: [] };
  const lines = projects.map((p) => `- **${p.name}** (${p.environment}) -> \`${p.target}\``);
  return { name: 'list_projects', ok: true, summary: `Found ${projects.length} project(s):\n\n${lines.join('\n')}`, data: projects };
}

async function toolListScans(): Promise<ToolResult> {
  const { data: scans } = await supabase.from('scans').select('*').order('created_at', { ascending: false }).limit(10);
  const list = (scans ?? []) as Scan[];
  if (list.length === 0) return { name: 'list_scans', ok: true, summary: 'No scans found.', data: [] };
  const lines = list.map((s) => `- \`${s.scanner}\` · ${s.status} · ${new Date(s.created_at).toLocaleString()}`);
  return { name: 'list_scans', ok: true, summary: `Last ${list.length} scan(s):\n\n${lines.join('\n')}`, data: list };
}

async function toolRunScan(args: { raw: string; scanner: string | null }, orgId: string): Promise<ToolResult> {
  const projects = await loadUserProjects();
  const project = projects.find(p => args.raw.toLowerCase().includes(p.name.toLowerCase())) || projects[0];
  if (!project) return { name: 'run_scan', ok: false, summary: 'No project found to scan.' };
  
  const scanner = args.scanner || (project.environment === 'cloud' ? 'prowler' : project.environment === 'iac' ? 'tfsec' : 'nmap');
  const { scan } = await ScansService.dispatchScan(project.id, scanner, project.target, orgId);
  
  return { name: 'run_scan', ok: true, summary: `Successfully launched **${scanner}** scan for **${project.name}**.`, data: { scanId: scan.id } };
}

// ... (other tools) ...

export async function runAgent(_userId: string, userText: string, orgId?: string): Promise<AgentTurn | null> {
  const intent = parseIntent(userText);
  if (!intent) return null;

  if (intent.name === 'greeting') return { content: "Hello! I'm Sentinel AI. How can I help you today?", toolCalls: [] };
  if (intent.name === 'help') return { content: "I can list projects, run scans, show findings, and generate reports.", toolCalls: [] };

  let result: ToolResult;
  switch (intent.name) {
    case 'list_projects': result = await toolListProjects(); break;
    case 'list_scans': result = await toolListScans(); break;
    case 'run_scan': 
      if (!orgId) return { content: "Error: No organization context.", toolCalls: [] };
      result = await toolRunScan(intent.args, orgId); 
      break;
    case 'list_findings':
      const { data } = await supabase.from('vulnerabilities').select('*').limit(10);
      result = { name: 'list_findings', ok: true, summary: `Found ${data?.length || 0} findings.` };
      break;
    default: return null;
  }

  return { content: result.summary, toolCalls: [result] };
}

export const TOOL_LABELS: Record<string, string> = {
  list_projects: '📁 Listed projects',
  list_scans: '🔍 Listed scans',
  run_scan: '🚀 Running scan',
  list_findings: '🐛 Listed findings'
};
