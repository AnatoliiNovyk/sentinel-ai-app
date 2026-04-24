/**
 * Unit tests for src/lib/reportBuilder.ts
 * Tests buildReport() for both 'executive' and 'technical' report kinds.
 * Pure function — no Supabase or DOM involved.
 */
import { describe, it, expect } from 'vitest';
import { buildReport } from '../reportBuilder';
import type { Project, Scan, Vulnerability } from '../supabase';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    user_id: 'u1',
    org_id: 'org-1',
    name: 'Acme Corp Platform',
    description: '',
    target: 'https://acme.com',
    environment: 'production' as Project['environment'],
    created_at: '2026-01-01T00:00:00Z',
    tags: [],
    risk_score: 50,
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
    severity_summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
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
    title: 'Open Port 22',
    description: 'SSH exposed to internet',
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

// ─── Executive report ─────────────────────────────────────────────────────────

describe('buildReport — executive', () => {
  it('returns a non-empty string', () => {
    const report = buildReport('executive', makeProject(), [makeScan()], [makeVuln()]);
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('starts with an H1 heading containing project name', () => {
    const report = buildReport('executive', makeProject(), [makeScan()], [makeVuln()]);
    expect(report).toContain('# Executive Summary');
    expect(report).toContain('Acme Corp Platform');
  });

  it('includes scan count in overview', () => {
    const report = buildReport('executive', makeProject(), [makeScan(), makeScan({ id: 'scan-2' })], []);
    expect(report).toContain('2 scan');
  });

  it('includes active finding count', () => {
    const vulns = [makeVuln(), makeVuln({ id: 'v2', title: 'SQLi' })];
    const report = buildReport('executive', makeProject(), [makeScan()], vulns);
    expect(report).toContain('2 active finding');
  });

  it('does not count resolved vulns as active', () => {
    const vulns = [
      makeVuln({ status: 'open' }),
      makeVuln({ id: 'v2', status: 'resolved' }),
    ];
    const report = buildReport('executive', makeProject(), [makeScan()], vulns);
    expect(report).toContain('1 active finding');
  });

  it('shows critical count in risk profile', () => {
    const vulns = [makeVuln({ severity: 'critical' }), makeVuln({ id: 'v2', severity: 'critical' })];
    const report = buildReport('executive', makeProject(), [makeScan()], vulns);
    expect(report).toContain('Critical: 2');
  });

  it('shows resolved count in triage status', () => {
    const vulns = [makeVuln({ status: 'resolved' })];
    const report = buildReport('executive', makeProject(), [makeScan()], vulns);
    expect(report).toContain('Resolved: 1');
  });

  it('shows critical urgency message when criticals exist', () => {
    const report = buildReport('executive', makeProject(), [makeScan()], [makeVuln({ severity: 'critical' })]);
    expect(report).toContain('Immediate attention required');
  });

  it('shows positive message when no criticals', () => {
    const report = buildReport('executive', makeProject(), [makeScan()], [makeVuln({ severity: 'low' })]);
    expect(report).toContain('No critical exposures detected');
  });

  it('no criticals message also shown when vuln list empty', () => {
    const report = buildReport('executive', makeProject(), [], []);
    expect(report).toContain('No critical exposures detected');
  });

  it('mentions compliance frameworks', () => {
    const report = buildReport('executive', makeProject(), [makeScan()], []);
    expect(report).toContain('SOC2');
    expect(report).toContain('MITRE ATT&CK');
    expect(report).toContain('CIS Controls');
  });
});

// ─── Technical report ────────────────────────────────────────────────────────

describe('buildReport — technical', () => {
  it('returns a non-empty string', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [makeVuln()]);
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });

  it('starts with an H1 heading containing project name', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [makeVuln()]);
    expect(report).toContain('# Technical Deep Dive');
    expect(report).toContain('Acme Corp Platform');
  });

  it('includes target URL', () => {
    const report = buildReport('technical', makeProject({ target: 'https://acme.com' }), [makeScan()], []);
    expect(report).toContain('https://acme.com');
  });

  it('lists each vulnerability as H3 heading', () => {
    const vulns = [makeVuln({ title: 'Open Port 22' })];
    const report = buildReport('technical', makeProject(), [makeScan()], vulns);
    expect(report).toContain('### [HIGH] Open Port 22');
  });

  it('includes severity in uppercase in H3', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [makeVuln({ severity: 'critical' })]);
    expect(report).toContain('[CRITICAL]');
  });

  it('includes asset in finding section', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [makeVuln({ asset: 'bastion:22' })]);
    expect(report).toContain('bastion:22');
  });

  it('includes MITRE tactic in finding section', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [makeVuln({ mitre_tactic: 'Exfiltration' })]);
    expect(report).toContain('Exfiltration');
  });

  it('includes CVE when present', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [makeVuln({ cve_id: 'CVE-2021-12345' })]);
    expect(report).toContain('CVE-2021-12345');
  });

  it('includes remediation text', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [
      makeVuln({ remediation: 'Apply patch X immediately' }),
    ]);
    expect(report).toContain('Apply patch X immediately');
  });

  it('includes bash code block when remediation_type is bash', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [
      makeVuln({ remediation_code: 'apt-get upgrade nginx', remediation_type: 'bash' }),
    ]);
    expect(report).toContain('```bash');
    expect(report).toContain('apt-get upgrade nginx');
  });

  it('includes hcl code block when remediation_type is terraform', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [
      makeVuln({ remediation_code: 'resource "aws_s3_bucket" {}', remediation_type: 'terraform' }),
    ]);
    expect(report).toContain('```hcl');
  });

  it('includes analyst note when present', () => {
    const report = buildReport('technical', makeProject(), [makeScan()], [
      makeVuln({ note: 'Review with security team' }),
    ]);
    expect(report).toContain('Review with security team');
    expect(report).toContain('Analyst note');
  });

  it('sorts open vulns before resolved ones', () => {
    const vulns = [
      makeVuln({ id: 'v-resolved', title: 'Old Finding', status: 'resolved' }),
      makeVuln({ id: 'v-open', title: 'New Finding', status: 'open' }),
    ];
    const report = buildReport('technical', makeProject(), [makeScan()], vulns);
    const openIdx = report.indexOf('New Finding');
    const resolvedIdx = report.indexOf('Old Finding');
    expect(openIdx).toBeLessThan(resolvedIdx);
  });

  it('includes total scan count', () => {
    const scans = [makeScan(), makeScan({ id: 's2' }), makeScan({ id: 's3' })];
    const report = buildReport('technical', makeProject(), scans, []);
    expect(report).toContain('Total scans: 3');
  });

  it('handles empty vulns list without throwing', () => {
    expect(() => buildReport('technical', makeProject(), [], [])).not.toThrow();
  });
});
