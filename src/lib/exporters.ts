import { Scan, Vulnerability, Project } from './supabase';

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const SARIF_LEVEL: Record<string, 'error' | 'warning' | 'note' | 'none'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'note',
  info: 'none',
};

export function toSarif(project: Project, scan: Scan, vulns: Vulnerability[]): string {
  const ruleMap = new Map<string, Vulnerability>();
  for (const v of vulns) {
    const id = (v.cve_id || v.title).replace(/\s+/g, '_').slice(0, 80);
    if (!ruleMap.has(id)) ruleMap.set(id, v);
  }
  const rules = Array.from(ruleMap.entries()).map(([id, v]) => ({
    id,
    name: v.title,
    shortDescription: { text: v.title },
    fullDescription: { text: v.description },
    help: { text: v.remediation },
    properties: {
      severity: v.severity,
      'security-severity': severityScore(v.severity),
      tags: [v.mitre_tactic, v.cis_control].filter(Boolean),
    },
  }));

  const results = vulns.map((v) => {
    const ruleId = (v.cve_id || v.title).replace(/\s+/g, '_').slice(0, 80);
    return {
      ruleId,
      level: SARIF_LEVEL[v.severity] ?? 'warning',
      message: { text: v.description },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: v.asset || project.target },
          },
        },
      ],
      properties: {
        severity: v.severity,
        mitre: v.mitre_tactic,
        cis: v.cis_control,
        cve: v.cve_id,
        status: v.status,
        note: v.note,
      },
      suppressions:
        v.status === 'accepted' || v.status === 'false_positive'
          ? [
              {
                kind: v.status === 'false_positive' ? 'external' : 'inSource',
                status: 'accepted',
                justification:
                  v.note || (v.status === 'false_positive' ? 'Marked as false positive' : 'Accepted risk'),
              },
            ]
          : undefined,
    };
  });

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Sentinel AI',
            version: '1.0.0',
            informationUri: 'https://santinelai.online',
            rules,
          },
        },
        invocations: [
          {
            executionSuccessful: scan.status === 'completed',
            endTimeUtc: scan.created_at,
            properties: { scanner: scan.scanner, project: project.name, target: project.target },
          },
        ],
        results,
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}

function severityScore(s: string): number {
  return { critical: 9.8, high: 7.5, medium: 5.0, low: 3.0, info: 1.0 }[s] ?? 5.0;
}

export type ParsedFinding = {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cve_id: string;
  mitre_tactic: string;
  cis_control: string;
  asset: string;
  remediation: string;
};

export type ParsedSarif = {
  scanner: string;
  findings: ParsedFinding[];
};

function normalizeSeverity(raw: unknown): ParsedFinding['severity'] {
  const s = String(raw ?? '').toLowerCase();
  if (['critical', 'high', 'medium', 'low', 'info'].includes(s)) return s as ParsedFinding['severity'];
  if (s === 'error') return 'high';
  if (s === 'warning') return 'medium';
  if (s === 'note' || s === 'none') return 'info';
  return 'info';
}

function scoreToSeverity(score: number): ParsedFinding['severity'] {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score >= 1) return 'low';
  return 'info';
}

export function fromSarif(raw: string): ParsedSarif {
  const doc = JSON.parse(raw);
  if (!doc || !Array.isArray(doc.runs) || doc.runs.length === 0) {
    throw new Error('Invalid SARIF: missing runs');
  }
  const findings: ParsedFinding[] = [];
  let scanner = 'sarif-import';

  for (const run of doc.runs) {
    const driver = run?.tool?.driver;
    if (driver?.name) scanner = String(driver.name).toLowerCase().replace(/\s+/g, '-');
    const rules = new Map<string, unknown>();
    for (const r of driver?.rules ?? []) rules.set(r.id, r);

    for (const res of run?.results ?? []) {
      const rule = rules.get(res.ruleId);
      const props = { ...(rule?.properties ?? {}), ...(res.properties ?? {}) };
      const score = Number(props['security-severity']);
      const severity = props.severity
        ? normalizeSeverity(props.severity)
        : !Number.isNaN(score) && score > 0
          ? scoreToSeverity(score)
          : normalizeSeverity(res.level);

      const loc = res.locations?.[0]?.physicalLocation;
      const asset =
        loc?.artifactLocation?.uri ??
        loc?.address?.absoluteAddress ??
        res.locations?.[0]?.logicalLocations?.[0]?.fullyQualifiedName ??
        '';

      findings.push({
        title: rule?.shortDescription?.text ?? rule?.name ?? res.ruleId ?? 'Untitled finding',
        description:
          res.message?.text ??
          rule?.fullDescription?.text ??
          rule?.shortDescription?.text ??
          '',
        severity,
        cve_id: String(props.cve ?? ''),
        mitre_tactic: String(props.mitre ?? ''),
        cis_control: String(props.cis ?? ''),
        asset: String(asset ?? ''),
        remediation: String(rule?.help?.text ?? rule?.helpUri ?? ''),
      });
    }
  }

  return { scanner, findings };
}

export function summarize(findings: ParsedFinding[]) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;
  return summary;
}

export function toCsvExport(vulns: Vulnerability[]): string {
  const header = [
    'id',
    'severity',
    'status',
    'title',
    'asset',
    'cve_id',
    'mitre_tactic',
    'cis_control',
    'note',
    'status_updated_at',
  ];
  const escape = (s: string) => `"${String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
  const rows = vulns.map((v) =>
    [
      v.id,
      v.severity,
      v.status,
      v.title,
      v.asset,
      v.cve_id,
      v.mitre_tactic,
      v.cis_control,
      v.note,
      v.status_updated_at,
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

export function toJsonExport(project: Project, scan: Scan, vulns: Vulnerability[]): string {
  return JSON.stringify(
    {
      project: {
        id: project.id,
        name: project.name,
        target: project.target,
        environment: project.environment,
      },
      scan: {
        id: scan.id,
        scanner: scan.scanner,
        status: scan.status,
        severity_summary: scan.severity_summary,
        created_at: scan.created_at,
      },
      findings: vulns.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        severity: v.severity,
        asset: v.asset,
        cve_id: v.cve_id,
        mitre_tactic: v.mitre_tactic,
        cis_control: v.cis_control,
        remediation: v.remediation,
        status: v.status,
        note: v.note,
        status_updated_at: v.status_updated_at,
      })),
      triage_summary: vulns.reduce(
        (acc, v) => {
          acc[v.status] = (acc[v.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      exported_at: new Date().toISOString(),
    },
    null,
    2
  );
}
