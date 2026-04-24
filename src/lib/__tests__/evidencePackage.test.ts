/**
 * Unit tests for src/lib/evidencePackage.ts
 * Tests buildEvidencePackage() and buildEvidenceMarkdown() — pure functions.
 */
import { describe, it, expect } from 'vitest';
import { buildEvidencePackage, buildEvidenceMarkdown } from '../evidencePackage';
import type { Vulnerability } from '../supabase';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeVuln(overrides: Partial<Vulnerability> = {}): Vulnerability {
  return {
    id: 'v1',
    scan_id: 's1',
    user_id: 'u1',
    title: 'Open Port',
    description: 'Port 22 exposed',
    severity: 'high',
    cve_id: 'CVE-2021-99999',
    mitre_tactic: 'Initial Access',
    cis_control: 'CIS-4',
    asset: 'bastion:22',
    remediation: 'Restrict CIDR',
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

// ─── buildEvidencePackage ─────────────────────────────────────────────────────

describe('buildEvidencePackage', () => {
  it('returns a package with the correct organization name', () => {
    const pkg = buildEvidencePackage([], 'Acme Corp');
    expect(pkg.organization).toBe('Acme Corp');
  });

  it('generatedAt is a valid ISO date string', () => {
    const pkg = buildEvidencePackage([], 'Org');
    expect(() => new Date(pkg.generatedAt)).not.toThrow();
    expect(new Date(pkg.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it('auditPeriod.to is today (YYYY-MM-DD)', () => {
    const pkg = buildEvidencePackage([], 'Org');
    const today = new Date().toISOString().split('T')[0];
    expect(pkg.auditPeriod.to).toBe(today);
  });

  it('auditPeriod.from is auditPeriodDays days before today', () => {
    const pkg = buildEvidencePackage([], 'Org', 30);
    const from = new Date(pkg.auditPeriod.from);
    const to = new Date(pkg.auditPeriod.to);
    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it('defaults auditPeriodDays to 90', () => {
    const pkg = buildEvidencePackage([], 'Org');
    const from = new Date(pkg.auditPeriod.from);
    const to = new Date(pkg.auditPeriod.to);
    const diffDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(90);
  });

  it('summary.totalVulns equals vulns.length', () => {
    const vulns = [makeVuln(), makeVuln({ id: 'v2' }), makeVuln({ id: 'v3' })];
    expect(buildEvidencePackage(vulns, 'Org').summary.totalVulns).toBe(3);
  });

  it('summary.openVulns counts only non-resolved/non-fp vulns', () => {
    const vulns = [
      makeVuln({ status: 'open' }),
      makeVuln({ id: 'v2', status: 'resolved' }),
      makeVuln({ id: 'v3', status: 'false_positive' }),
    ];
    expect(buildEvidencePackage(vulns, 'Org').summary.openVulns).toBe(1);
  });

  it('summary.resolvedVulns counts only resolved vulns', () => {
    const vulns = [
      makeVuln({ status: 'resolved' }),
      makeVuln({ id: 'v2', status: 'resolved' }),
      makeVuln({ id: 'v3', status: 'open' }),
    ];
    expect(buildEvidencePackage(vulns, 'Org').summary.resolvedVulns).toBe(2);
  });

  it('soc2Criteria has 7 entries', () => {
    const pkg = buildEvidencePackage([], 'Org');
    expect(pkg.soc2Criteria.length).toBe(7);
  });

  it('nistFunctions has 5 entries', () => {
    const pkg = buildEvidencePackage([], 'Org');
    expect(pkg.nistFunctions.length).toBe(5);
  });

  it('cisControls has 18 entries', () => {
    const pkg = buildEvidencePackage([], 'Org');
    expect(pkg.cisControls.length).toBe(18);
  });

  it('findings array contains all vulns', () => {
    const vulns = [makeVuln(), makeVuln({ id: 'v2', title: 'SQLi' })];
    const pkg = buildEvidencePackage(vulns, 'Org');
    expect(pkg.findings.length).toBe(2);
    const titles = pkg.findings.map((f) => f.title);
    expect(titles).toContain('Open Port');
    expect(titles).toContain('SQLi');
  });

  it('findings preserve severity, status, asset, cve_id', () => {
    const vuln = makeVuln({ severity: 'critical', status: 'accepted', asset: 'api:443', cve_id: 'CVE-2021-1' });
    const { findings } = buildEvidencePackage([vuln], 'Org');
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].status).toBe('accepted');
    expect(findings[0].asset).toBe('api:443');
    expect(findings[0].cve_id).toBe('CVE-2021-1');
  });

  it('attestation string contains organization name', () => {
    const pkg = buildEvidencePackage([], 'Acme Corp');
    expect(pkg.attestation).toContain('Acme Corp');
  });

  it('attestation string contains vuln count', () => {
    const vulns = [makeVuln(), makeVuln({ id: 'v2' })];
    const pkg = buildEvidencePackage(vulns, 'Org');
    expect(pkg.attestation).toContain('2 vulnerability records');
  });

  it('soc2Overall is 100 for empty vuln list', () => {
    expect(buildEvidencePackage([], 'Org').summary.soc2Overall).toBe(100);
  });

  it('soc2Overall drops below 100 with critical vulns', () => {
    const vulns = [makeVuln({ severity: 'critical' })];
    expect(buildEvidencePackage(vulns, 'Org').summary.soc2Overall).toBeLessThan(100);
  });
});

// ─── buildEvidenceMarkdown ───────────────────────────────────────────────────

describe('buildEvidenceMarkdown', () => {
  it('returns a non-empty string', () => {
    const pkg = buildEvidencePackage([], 'Org');
    const md = buildEvidenceMarkdown(pkg);
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(0);
  });

  it('starts with the report H1 heading', () => {
    const md = buildEvidenceMarkdown(buildEvidencePackage([], 'Org'));
    expect(md).toContain('# Security Compliance Evidence Report');
  });

  it('includes organization name', () => {
    const md = buildEvidenceMarkdown(buildEvidencePackage([], 'Acme Corp'));
    expect(md).toContain('Acme Corp');
  });

  it('includes audit period dates', () => {
    const pkg = buildEvidencePackage([], 'Org', 30);
    const md = buildEvidenceMarkdown(pkg);
    expect(md).toContain(pkg.auditPeriod.from);
    expect(md).toContain(pkg.auditPeriod.to);
  });

  it('includes SOC 2 section', () => {
    const md = buildEvidenceMarkdown(buildEvidencePackage([], 'Org'));
    expect(md).toContain('## SOC 2 Trust Services Criteria');
  });

  it('includes NIST section', () => {
    const md = buildEvidenceMarkdown(buildEvidencePackage([], 'Org'));
    expect(md).toContain('## NIST Cybersecurity Framework');
  });

  it('includes CIS Controls section', () => {
    const md = buildEvidenceMarkdown(buildEvidencePackage([], 'Org'));
    expect(md).toContain('## CIS Controls v8');
  });

  it('includes attestation section', () => {
    const md = buildEvidenceMarkdown(buildEvidencePackage([], 'Org'));
    expect(md).toContain('## Attestation');
  });

  it('includes finding title and severity', () => {
    const pkg = buildEvidencePackage([makeVuln({ title: 'Log4Shell', severity: 'critical' })], 'Org');
    const md = buildEvidenceMarkdown(pkg);
    expect(md).toContain('Log4Shell');
    expect(md).toContain('[CRITICAL]');
  });

  it('includes CVE when present in finding', () => {
    const pkg = buildEvidencePackage([makeVuln({ cve_id: 'CVE-2021-44228' })], 'Org');
    const md = buildEvidenceMarkdown(pkg);
    expect(md).toContain('CVE-2021-44228');
  });

  it('shows total findings count in Findings section header', () => {
    const pkg = buildEvidencePackage([makeVuln(), makeVuln({ id: 'v2' })], 'Org');
    const md = buildEvidenceMarkdown(pkg);
    expect(md).toContain('## All Findings (2)');
  });

  it('renders SOC2 readiness score in table', () => {
    const pkg = buildEvidencePackage([], 'Org');
    const md = buildEvidenceMarkdown(pkg);
    expect(md).toContain('SOC 2 Readiness');
    expect(md).toContain('100%');
  });

  it('does not throw for empty vuln list', () => {
    expect(() => buildEvidenceMarkdown(buildEvidencePackage([], 'Org'))).not.toThrow();
  });
});
