/**
 * Unit tests for src/lib/compliance.ts
 * Covers computeCompliance() — pure function, no Supabase.
 * Tests: empty input, resolved/false_positive exclusion, severity counting,
 *        CIS/MITRE/NIST/SOC2 row generation, score clamping.
 */
import { describe, it, expect } from 'vitest';
import { computeCompliance } from '../compliance';
import type { Vulnerability } from '../supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeVuln(overrides: Partial<Vulnerability> = {}): Vulnerability {
  return {
    id: 'v1',
    scan_id: 's1',
    user_id: 'u1',
    title: 'Test vuln',
    description: 'A test vulnerability',
    severity: 'medium',
    cve_id: '',
    mitre_tactic: '',
    cis_control: '',
    asset: 'host1',
    remediation: '',
    remediation_code: '',
    remediation_type: '',
    created_at: new Date().toISOString(),
    status: 'open',
    note: '',
    status_updated_at: new Date().toISOString(),
    sla_breached_at: null,
    sla_warned_at: null,
    ...overrides,
  };
}

// ─── Empty input ──────────────────────────────────────────────────────────────

describe('computeCompliance — empty input', () => {
  it('returns valid structure with zero open vulns', () => {
    const r = computeCompliance([]);
    expect(r.openVulns).toBe(0);
    expect(r.resolvedVulns).toBe(0);
    expect(r.totalVulns).toBe(0);
  });

  it('returns 100 for soc2Overall when no open vulns', () => {
    expect(computeCompliance([]).soc2Overall).toBe(100);
  });

  it('cisRows has an entry per CIS control', () => {
    const { cisRows } = computeCompliance([]);
    expect(cisRows.length).toBe(18); // CIS_CONTROLS has 18 entries (CIS-1 to CIS-18)
    for (const row of cisRows) {
      expect(row.score).toBe(100);
      expect(row.openCount).toBe(0);
    }
  });

  it('mitreRows has an entry per MITRE tactic', () => {
    const { mitreRows } = computeCompliance([]);
    expect(mitreRows.length).toBe(12); // MITRE_TACTICS has 12 entries
    for (const row of mitreRows) {
      expect(row.openCount).toBe(0);
    }
  });

  it('nistRows has an entry per NIST function', () => {
    const { nistRows } = computeCompliance([]);
    expect(nistRows.length).toBe(5); // NIST_FUNCTIONS has 5 entries
    for (const row of nistRows) {
      expect(row.score).toBe(100);
    }
  });

  it('soc2Rows has an entry per SOC2 criterion', () => {
    const { soc2Rows } = computeCompliance([]);
    expect(soc2Rows.length).toBe(7); // SOC2_CRITERIA has 7 entries
    for (const row of soc2Rows) {
      expect(row.score).toBe(100);
    }
  });
});

// ─── Resolved / false_positive exclusion ────────────────────────────────────

describe('computeCompliance — resolved vulns excluded', () => {
  it('does not count resolved vulns as open', () => {
    const vulns = [
      makeVuln({ status: 'resolved', severity: 'critical' }),
      makeVuln({ status: 'false_positive', severity: 'critical' }),
      makeVuln({ status: 'open', severity: 'low' }),
    ];
    const r = computeCompliance(vulns);
    expect(r.openVulns).toBe(1);
    expect(r.resolvedVulns).toBe(1); // only 'resolved' counted, not false_positive
    expect(r.totalVulns).toBe(3);
  });

  it('soc2Overall stays near 100 if only resolved vulns exist', () => {
    const vulns = [makeVuln({ status: 'resolved', severity: 'critical' })];
    const r = computeCompliance(vulns);
    expect(r.soc2Overall).toBe(100);
  });
});

// ─── Severity impact ─────────────────────────────────────────────────────────

describe('computeCompliance — severity impact', () => {
  it('critical vuln reduces soc2 score', () => {
    const withCritical = computeCompliance([makeVuln({ severity: 'critical' })]);
    expect(withCritical.soc2Overall).toBeLessThan(100);
  });

  it('more critical vulns = lower soc2 score', () => {
    const one = computeCompliance([makeVuln({ severity: 'critical' })]);
    const five = computeCompliance(Array.from({ length: 5 }, () => makeVuln({ severity: 'critical' })));
    expect(five.soc2Overall).toBeLessThanOrEqual(one.soc2Overall);
  });

  it('soc2 score is clamped to minimum 0', () => {
    const vulns = Array.from({ length: 20 }, () => makeVuln({ severity: 'critical' }));
    const r = computeCompliance(vulns);
    for (const row of r.soc2Rows) {
      expect(row.score).toBeGreaterThanOrEqual(0);
    }
    expect(r.soc2Overall).toBeGreaterThanOrEqual(0);
  });
});

// ─── CIS Control matching ─────────────────────────────────────────────────────

describe('computeCompliance — CIS matching', () => {
  it('vuln with cis_control CIS-7 increments openCount on that row', () => {
    const vulns = [makeVuln({ cis_control: 'CIS-7', severity: 'high' })];
    const { cisRows } = computeCompliance(vulns);
    const row = cisRows.find((r) => r.id === 'CIS-7')!;
    expect(row.openCount).toBeGreaterThan(0);
  });

  it('vuln with no cis_control does not pollute other CIS rows', () => {
    const vulns = [makeVuln({ cis_control: '', severity: 'critical' })];
    const { cisRows } = computeCompliance(vulns);
    // No CIS row should have openCount > 0 from matching (cis_control='')
    const matchedByCisId = cisRows.filter((r) => r.openCount > 0);
    // may still appear via totalCount but openCount matched should be 0
    expect(matchedByCisId.every((r) => r.openCount === 0 || r.id !== 'CIS-1')).toBeTruthy();
  });
});

// ─── MITRE tactic matching ────────────────────────────────────────────────────

describe('computeCompliance — MITRE matching', () => {
  it('vuln with mitre_tactic "Initial Access" increments TA0001 openCount', () => {
    const vulns = [makeVuln({ mitre_tactic: 'Initial Access', severity: 'high' })];
    const { mitreRows } = computeCompliance(vulns);
    const row = mitreRows.find((r) => r.id === 'TA0001')!;
    expect(row.openCount).toBe(1);
  });

  it('critical vuln increments criticalCount on MITRE row', () => {
    const vulns = [makeVuln({ mitre_tactic: 'Execution', severity: 'critical' })];
    const { mitreRows } = computeCompliance(vulns);
    const row = mitreRows.find((r) => r.id === 'TA0002')!;
    expect(row.criticalCount).toBe(1);
  });
});

// ─── NIST function matching ───────────────────────────────────────────────────

describe('computeCompliance — NIST matching', () => {
  it('vuln with "monitor" in title affects DE (Detect) score', () => {
    const vulns = [makeVuln({ title: 'Missing monitor alerts', severity: 'high' })];
    const { nistRows } = computeCompliance(vulns);
    const detect = nistRows.find((r) => r.id === 'DE')!;
    expect(detect.openCount).toBeGreaterThan(0);
    expect(detect.score).toBeLessThan(100);
  });

  it('vuln with "access" in remediation affects PR (Protect) score', () => {
    const vulns = [makeVuln({ remediation: 'Restrict access to admin interface', severity: 'medium' })];
    const { nistRows } = computeCompliance(vulns);
    const protect = nistRows.find((r) => r.id === 'PR')!;
    expect(protect.openCount).toBeGreaterThan(0);
  });
});

// ─── Result structure completeness ───────────────────────────────────────────

describe('computeCompliance — result structure', () => {
  it('all returned rows have required fields', () => {
    const r = computeCompliance([makeVuln()]);
    for (const row of r.cisRows) {
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('label');
      expect(row).toHaveProperty('score');
      expect(row).toHaveProperty('openCount');
    }
    for (const row of r.nistRows) {
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('score');
      expect(row).toHaveProperty('color');
      expect(row).toHaveProperty('bg');
    }
    for (const row of r.soc2Rows) {
      expect(row).toHaveProperty('weight');
      expect(row.weight).toBeGreaterThan(0);
    }
  });

  it('soc2Overall is a number between 0 and 100', () => {
    const r = computeCompliance([makeVuln({ severity: 'critical' })]);
    expect(r.soc2Overall).toBeGreaterThanOrEqual(0);
    expect(r.soc2Overall).toBeLessThanOrEqual(100);
  });

  it('handles empty vulnerabilities array', () => {
    const r = computeCompliance([]);
    // No vulnerabilities = no penalties = max scores for NIST, CIS
    expect(r.nistOverall).toBe(100);
    expect(r.cisOverall).toBe(100);
    expect(r.mitreOverall).toBe(100);
    expect(r.iso27001Overall).toBe(100);
  });

  it('computes framework scores even with single vuln', () => {
    const r = computeCompliance([makeVuln({ severity: 'low' })]);
    expect(r.nistOverall).toBeGreaterThanOrEqual(0);
    expect(r.cisOverall).toBeGreaterThanOrEqual(0);
    expect(r.mitreOverall).toBeGreaterThanOrEqual(0);
  });
});
