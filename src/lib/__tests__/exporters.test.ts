/**
 * Unit tests for src/lib/exporters.ts
 * Tests toSarif() (generation) and fromSarif() (parsing) — pure functions, no DOM/Supabase.
 */
import { describe, it, expect } from 'vitest';
import { toSarif, fromSarif, summarize, toCsvExport, toJsonExport, downloadFile } from '../exporters';
import type { Project, Scan, Vulnerability } from '../supabase';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    user_id: 'u1',
    org_id: 'org-1',
    name: 'Test Project',
    description: 'A test project',
    target: 'https://example.com',
    environment: 'external',
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    risk_score: 42,
    ...overrides,
  };
}

function makeScan(overrides: Partial<Scan> = {}): Scan {
  return {
    id: 'scan-1',
    project_id: 'proj-1',
    user_id: 'u1',
    scanner: 'nmap',
    status: 'completed',
    severity_summary: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
    started_at: '2026-01-01T00:00:00Z',
    completed_at: '2026-01-01T01:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeVuln(overrides: Partial<Vulnerability> = {}): Vulnerability {
  return {
    id: 'v1',
    scan_id: 'scan-1',
    user_id: 'u1',
    title: 'Open SSH Port',
    description: 'Port 22 exposed to 0.0.0.0/0',
    severity: 'high',
    cve_id: 'CVE-2021-99999',
    mitre_tactic: 'Initial Access',
    cis_control: 'CIS-4',
    asset: 'bastion.example.com:22',
    remediation: 'Restrict SSH source CIDR',
    remediation_code: '',
    remediation_type: 'manual',
    created_at: '2026-01-01T00:00:00Z',
    status: 'open',
    note: '',
    status_updated_at: '2026-01-01T00:00:00Z',
    sla_breached_at: null,
    sla_warned_at: null,
    ...overrides,
  };
}

// ─── toSarif ─────────────────────────────────────────────────────────────────

describe('toSarif', () => {
  it('produces valid JSON string', () => {
    const sarif = toSarif(makeProject(), makeScan(), [makeVuln()]);
    expect(() => JSON.parse(sarif)).not.toThrow();
  });

  it('output has SARIF 2.1.0 schema and version', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln()]));
    expect(doc.version).toBe('2.1.0');
    expect(doc.$schema).toContain('sarif-schema-2.1.0');
  });

  it('contains a runs array with one entry', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln()]));
    expect(Array.isArray(doc.runs)).toBe(true);
    expect(doc.runs.length).toBe(1);
  });

  it('driver name is Sentinel AI', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln()]));
    expect(doc.runs[0].tool.driver.name).toBe('Sentinel AI');
  });

  it('produces one result per vuln', () => {
    const vulns = [makeVuln({ id: 'v1' }), makeVuln({ id: 'v2', title: 'SQLi', cve_id: '' })];
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), vulns));
    expect(doc.runs[0].results.length).toBe(2);
  });

  it('maps critical severity to error level', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln({ severity: 'critical' })]));
    expect(doc.runs[0].results[0].level).toBe('error');
  });

  it('maps medium severity to warning level', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln({ severity: 'medium' })]));
    expect(doc.runs[0].results[0].level).toBe('warning');
  });

  it('maps low severity to note level', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln({ severity: 'low' })]));
    expect(doc.runs[0].results[0].level).toBe('note');
  });

  it('maps info severity to none level', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln({ severity: 'info' })]));
    expect(doc.runs[0].results[0].level).toBe('none');
  });

  it('includes CVE in result properties', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln({ cve_id: 'CVE-2021-99999' })]));
    expect(doc.runs[0].results[0].properties.cve).toBe('CVE-2021-99999');
  });

  it('includes mitre_tactic in result properties', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln({ mitre_tactic: 'Initial Access' })]));
    expect(doc.runs[0].results[0].properties.mitre).toBe('Initial Access');
  });

  it('deduplicates rules for vulns with same title', () => {
    const vulns = [
      makeVuln({ id: 'v1', cve_id: '', title: 'Same Finding' }),
      makeVuln({ id: 'v2', cve_id: '', title: 'Same Finding' }),
    ];
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), vulns));
    expect(doc.runs[0].tool.driver.rules.length).toBe(1);
  });

  it('adds suppression for accepted-risk vulns', () => {
    const vuln = makeVuln({ status: 'accepted', note: 'Accepted by CISO' });
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [vuln]));
    expect(doc.runs[0].results[0].suppressions).toBeDefined();
    expect(doc.runs[0].results[0].suppressions[0].status).toBe('accepted');
  });

  it('adds suppression for false_positive vulns', () => {
    const vuln = makeVuln({ status: 'false_positive' });
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [vuln]));
    expect(doc.runs[0].results[0].suppressions[0].kind).toBe('external');
  });

  it('no suppression for open vulns', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), [makeVuln({ status: 'open' })]));
    expect(doc.runs[0].results[0].suppressions).toBeUndefined();
  });

  it('handles empty vulns array', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), []));
    expect(doc.runs[0].results.length).toBe(0);
    expect(doc.runs[0].tool.driver.rules.length).toBe(0);
  });

  it('invocation shows executionSuccessful=true for completed scan', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan({ status: 'completed' }), []));
    expect(doc.runs[0].invocations[0].executionSuccessful).toBe(true);
  });

  it('invocation shows executionSuccessful=false for failed scan', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan({ status: 'failed' }), []));
    expect(doc.runs[0].invocations[0].executionSuccessful).toBe(false);
  });
});

// ─── fromSarif ───────────────────────────────────────────────────────────────

describe('fromSarif', () => {
  it('round-trips through toSarif', () => {
    const project = makeProject();
    const scan = makeScan();
    const vulns = [makeVuln()];
    const sarif = toSarif(project, scan, vulns);
    const parsed = fromSarif(sarif);
    expect(parsed.findings.length).toBe(1);
    expect(parsed.findings[0].title).toBe('Open SSH Port');
  });

  it('parsed finding preserves CVE', () => {
    const sarif = toSarif(makeProject(), makeScan(), [makeVuln({ cve_id: 'CVE-2021-12345' })]);
    const parsed = fromSarif(sarif);
    expect(parsed.findings[0].cve_id).toBe('CVE-2021-12345');
  });

  it('parsed finding preserves severity', () => {
    const sarif = toSarif(makeProject(), makeScan(), [makeVuln({ severity: 'critical' })]);
    const parsed = fromSarif(sarif);
    expect(parsed.findings[0].severity).toBe('critical');
  });

  it('parsed finding preserves mitre_tactic', () => {
    const sarif = toSarif(makeProject(), makeScan(), [makeVuln({ mitre_tactic: 'Exfiltration' })]);
    const parsed = fromSarif(sarif);
    expect(parsed.findings[0].mitre_tactic).toBe('Exfiltration');
  });

  it('parsed finding preserves cis_control', () => {
    const sarif = toSarif(makeProject(), makeScan(), [makeVuln({ cis_control: 'CIS-7' })]);
    const parsed = fromSarif(sarif);
    expect(parsed.findings[0].cis_control).toBe('CIS-7');
  });

  it('scanner name is derived from tool driver name', () => {
    const sarif = toSarif(makeProject(), makeScan({ scanner: 'prowler' }), []);
    const parsed = fromSarif(sarif);
    expect(parsed.scanner).toBe('sentinel-ai');
  });

  it('throws on invalid JSON', () => {
    expect(() => fromSarif('not-json')).toThrow();
  });

  it('throws when runs array is missing', () => {
    expect(() => fromSarif(JSON.stringify({ version: '2.1.0' }))).toThrow('Invalid SARIF');
  });

  it('throws when runs array is empty', () => {
    expect(() => fromSarif(JSON.stringify({ runs: [] }))).toThrow('Invalid SARIF');
  });

  it('handles external SARIF — maps error level to high severity', () => {
    const externalSarif = {
      runs: [
        {
          tool: { driver: { name: 'SomeScanner', rules: [] } },
          results: [
            {
              ruleId: 'RULE-001',
              level: 'error',
              message: { text: 'A high severity finding' },
              locations: [],
              properties: {},
            },
          ],
        },
      ],
    };
    const parsed = fromSarif(JSON.stringify(externalSarif));
    expect(parsed.findings[0].severity).toBe('high');
  });

  it('handles external SARIF — maps warning level to medium severity', () => {
    const externalSarif = {
      runs: [
        {
          tool: { driver: { name: 'S', rules: [] } },
          results: [
            {
              ruleId: 'R1',
              level: 'warning',
              message: { text: 'Medium' },
              locations: [],
              properties: {},
            },
          ],
        },
      ],
    };
    const parsed = fromSarif(JSON.stringify(externalSarif));
    expect(parsed.findings[0].severity).toBe('medium');
  });

  it('handles security-severity score for severity resolution', () => {
    const externalSarif = {
      runs: [
        {
          tool: {
            driver: {
              name: 'S',
              rules: [{ id: 'R1', properties: { 'security-severity': '9.5' } }],
            },
          },
          results: [
            {
              ruleId: 'R1',
              message: { text: 'Critical via score' },
              locations: [],
              properties: {},
            },
          ],
        },
      ],
    };
    const parsed = fromSarif(JSON.stringify(externalSarif));
    expect(parsed.findings[0].severity).toBe('critical');
  });

  it('uses fallback title from ruleId when no shortDescription', () => {
    const externalSarif = {
      runs: [
        {
          tool: { driver: { name: 'S', rules: [] } },
          results: [
            {
              ruleId: 'CWE-89',
              level: 'warning',
              message: { text: 'SQL injection' },
              locations: [],
              properties: {},
            },
          ],
        },
      ],
    };
    const parsed = fromSarif(JSON.stringify(externalSarif));
    expect(parsed.findings[0].title).toBe('CWE-89');
  });
});

// ─── toSarif — mock watermark ─────────────────────────────────────────────────

describe('toSarif — mock watermark', () => {
  it('includes _mockData and _notice when scan.is_mock is true', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan({ is_mock: true }), []));
    expect(doc.properties).toBeDefined();
    expect(doc.properties._mockData).toBe(true);
    expect(doc.properties._notice).toBe('DEMO DATA - NOT FOR PRODUCTION USE');
  });

  it('invocation properties also carry _mockData when scan.is_mock is true', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan({ is_mock: true }), []));
    const invocation = doc.runs[0].invocations[0];
    expect(invocation.properties._mockData).toBe(true);
    expect(invocation.properties._notice).toBe('DEMO DATA - NOT FOR PRODUCTION USE');
  });

  it('does NOT include _mockData when scan.is_mock is false', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan({ is_mock: false }), []));
    expect(doc.properties).toBeUndefined();
    expect(doc.runs[0].invocations[0].properties._mockData).toBeUndefined();
  });

  it('does NOT include _mockData when scan.is_mock is undefined', () => {
    const doc = JSON.parse(toSarif(makeProject(), makeScan(), []));
    expect(doc.properties).toBeUndefined();
    expect(doc.runs[0].invocations[0].properties._mockData).toBeUndefined();
  });
});

// ─── summarize ────────────────────────────────────────────────────────────────

describe('summarize', () => {
  it('returns all-zero for empty array', () => {
    expect(summarize([])).toEqual({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  });

  it('counts each severity correctly', () => {
    const findings = [
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'low' },
      { severity: 'info' },
    ] as ReturnType<typeof fromSarif>['findings'];
    expect(summarize(findings)).toEqual({ critical: 2, high: 1, medium: 1, low: 1, info: 1 });
  });
});

// ─── toCsvExport ─────────────────────────────────────────────────────────────

describe('toCsvExport', () => {
  it('produces a CSV string with header row', () => {
    const csv = toCsvExport([makeVuln()]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('severity');
    expect(lines[0]).toContain('title');
  });

  it('has exactly header + N data rows', () => {
    const csv = toCsvExport([makeVuln(), makeVuln({ id: 'v2' })]);
    expect(csv.split('\n').length).toBe(3);
  });

  it('escapes double quotes in string values', () => {
    const vuln = makeVuln({ title: 'He said "oops"' });
    const csv = toCsvExport([vuln]);
    expect(csv).toContain('He said ""oops""');
  });

  it('normalizes newlines in values to spaces', () => {
    const vuln = makeVuln({ note: 'line1\nline2' });
    const csv = toCsvExport([vuln]);
    expect(csv).not.toContain('\nline2');
    expect(csv).toContain('line1 line2');
  });

  it('returns only header for empty array', () => {
    const csv = toCsvExport([]);
    expect(csv.split('\n').length).toBe(1);
  });
});

// ─── toJsonExport ─────────────────────────────────────────────────────────────

describe('toJsonExport', () => {
  it('produces valid JSON string', () => {
    const json = toJsonExport(makeProject(), makeScan(), [makeVuln()]);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes project metadata', () => {
    const json = JSON.parse(toJsonExport(makeProject(), makeScan(), []));
    expect(json.project.id).toBe('proj-1');
    expect(json.project.name).toBe('Test Project');
    expect(json.project.target).toBe('https://example.com');
  });

  it('includes scan metadata', () => {
    const json = JSON.parse(toJsonExport(makeProject(), makeScan(), []));
    expect(json.scan.id).toBe('scan-1');
    expect(json.scan.scanner).toBe('nmap');
    expect(json.scan.status).toBe('completed');
  });

  it('includes all findings', () => {
    const json = JSON.parse(toJsonExport(makeProject(), makeScan(), [makeVuln(), makeVuln({ id: 'v2' })]));
    expect(json.findings.length).toBe(2);
  });

  it('includes triage_summary grouped by status', () => {
    const vulns = [
      makeVuln({ id: 'v1', status: 'open' }),
      makeVuln({ id: 'v2', status: 'open' }),
      makeVuln({ id: 'v3', status: 'resolved' }),
    ];
    const json = JSON.parse(toJsonExport(makeProject(), makeScan(), vulns));
    expect(json.triage_summary.open).toBe(2);
    expect(json.triage_summary.resolved).toBe(1);
  });

  it('includes exported_at timestamp', () => {
    const json = JSON.parse(toJsonExport(makeProject(), makeScan(), []));
    expect(json.exported_at).toBeTruthy();
    expect(new Date(json.exported_at).getTime()).not.toBeNaN();
  });
});

// ─── downloadFile ─────────────────────────────────────────────────────────────

describe('downloadFile', () => {
  it('calls URL.createObjectURL and URL.revokeObjectURL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    const clickFn = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const el = origCreate('a');
        el.click = clickFn;
        return el;
      }
      return origCreate(tag);
    });

    downloadFile('report.csv', 'a,b,c', 'text/csv');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickFn).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
