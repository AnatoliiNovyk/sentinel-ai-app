import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ScaAnalyzer,
  detectSbomFormat,
  parsePackageJson,
  parsePackageLock,
  parseCycloneDx,
  parseSpdx,
  parseSbom,
  resolveLicense,
  computeDependencyRiskScore,
  riskLevelFromScore,
  getGlobalScaAnalyzer,
  resetGlobalScaAnalyzer,
  type ScaVulnerability,
  type VulnSeverity,
} from '../supplyChain';

// ─── detectSbomFormat ─────────────────────────────────────────────────────

describe('detectSbomFormat', () => {
  it('detects npm package.json format', () => {
    expect(detectSbomFormat({ dependencies: { react: '^18.0.0' } })).toBe('npm-package-json');
  });

  it('detects npm package-lock.json format', () => {
    expect(detectSbomFormat({ lockfileVersion: 3, packages: {} })).toBe('npm-lock');
  });

  it('detects CycloneDX format by bomFormat field', () => {
    expect(detectSbomFormat({ bomFormat: 'CycloneDX', components: [] })).toBe('cyclonedx');
  });

  it('detects CycloneDX format by components field', () => {
    expect(detectSbomFormat({ components: [{ name: 'lodash', version: '4.17.21' }] })).toBe('cyclonedx');
  });

  it('detects SPDX format by SPDXID field', () => {
    expect(detectSbomFormat({ SPDXID: 'SPDXRef-DOCUMENT', packages: [] })).toBe('spdx');
    expect(detectSbomFormat({ spdxVersion: 'SPDX-2.3', packages: [] })).toBe('spdx');
  });

  it('returns unknown for unrecognized format', () => {
    expect(detectSbomFormat({ random: 'data' })).toBe('unknown');
    expect(detectSbomFormat(null)).toBe('unknown');
    expect(detectSbomFormat('string')).toBe('unknown');
  });
});

// ─── parsePackageJson ─────────────────────────────────────────────────────

describe('parsePackageJson', () => {
  it('parses production dependencies', () => {
    const deps = parsePackageJson({ dependencies: { react: '^18.2.0', lodash: '4.17.21' } });
    expect(deps).toHaveLength(2);
    expect(deps[0].name).toBe('react');
    expect(deps[0].version).toBe('18.2.0');
    expect(deps[0].type).toBe('prod');
    expect(deps[0].ecosystem).toBe('npm');
  });

  it('parses dev dependencies with correct type', () => {
    const deps = parsePackageJson({ devDependencies: { vitest: '^2.0.0' } });
    expect(deps[0].type).toBe('dev');
  });

  it('parses peer and optional dependencies', () => {
    const deps = parsePackageJson({
      peerDependencies: { react: '>=16' },
      optionalDependencies: { fsevents: '~2.3.3' },
    });
    const types = deps.map((d) => d.type);
    expect(types).toContain('peer');
    expect(types).toContain('optional');
  });

  it('handles entries without semver (falls back or skips)', () => {
    // Entries like 'github:user/repo' may produce empty version strings which are still included
    // We verify no crash occurs and the result is an array
    const deps = parsePackageJson({ dependencies: { lib: 'github:user/repo' } });
    expect(Array.isArray(deps)).toBe(true);
  });

  it('returns empty array when no sections present', () => {
    expect(parsePackageJson({})).toHaveLength(0);
  });
});

// ─── parsePackageLock ─────────────────────────────────────────────────────

describe('parsePackageLock', () => {
  it('parses packages section', () => {
    const deps = parsePackageLock({
      packages: {
        '': { version: '1.0.0' }, // root entry, should be skipped
        'node_modules/lodash': { version: '4.17.21', dev: false },
        'node_modules/vitest': { version: '2.0.0', dev: true },
      },
    });
    const names = deps.map((d) => d.name);
    expect(names).toContain('lodash');
    expect(names).toContain('vitest');
    expect(names).not.toContain(''); // root skipped
  });

  it('marks dev packages correctly', () => {
    const deps = parsePackageLock({
      packages: { 'node_modules/ts-node': { version: '10.9.0', dev: true } },
    });
    expect(deps[0].type).toBe('dev');
  });

  it('strips node_modules/ prefix from names', () => {
    const deps = parsePackageLock({
      packages: { 'node_modules/@types/node': { version: '20.0.0' } },
    });
    expect(deps[0].name).toBe('@types/node');
  });

  it('falls back to raw.dependencies when packages is absent (npm lock v1)', () => {
    const deps = parsePackageLock({
      dependencies: {
        lodash: { version: '4.17.21', dev: false },
        typescript: { version: '5.0.0', dev: true },
      },
    });
    const names = deps.map((d) => d.name);
    expect(names).toContain('lodash');
    expect(names).toContain('typescript');
    expect(deps.find((d) => d.name === 'typescript')?.type).toBe('dev');
  });

  it('returns empty array when both packages and dependencies are absent', () => {
    expect(parsePackageLock({})).toHaveLength(0);
  });
});

// ─── parseCycloneDx ──────────────────────────────────────────────────────

describe('parseCycloneDx', () => {
  it('parses CycloneDX components', () => {
    const deps = parseCycloneDx({
      components: [
        { name: 'express', version: '4.18.2', type: 'library' },
        { name: 'axios', version: '1.6.0' },
      ],
    });
    expect(deps).toHaveLength(2);
    expect(deps[0].name).toBe('express');
    expect(deps[0].version).toBe('4.18.2');
  });

  it('skips components without name', () => {
    const deps = parseCycloneDx({ components: [{ version: '1.0.0' }] });
    expect(deps).toHaveLength(0);
  });

  it('returns empty array for empty components', () => {
    expect(parseCycloneDx({ components: [] })).toHaveLength(0);
  });
});

// ─── parseSpdx ───────────────────────────────────────────────────────────

describe('parseSpdx', () => {
  it('parses SPDX packages', () => {
    const deps = parseSpdx({
      packages: [
        { name: 'webpack', versionInfo: '5.88.0', licenseConcluded: 'MIT' },
      ],
    });
    expect(deps).toHaveLength(1);
    expect(deps[0].name).toBe('webpack');
    expect(deps[0].version).toBe('5.88.0');
  });

  it('skips packages without name', () => {
    const deps = parseSpdx({ packages: [{ versionInfo: '1.0.0' }] });
    expect(deps).toHaveLength(0);
  });
});

// ─── parseSbom ───────────────────────────────────────────────────────────

describe('parseSbom', () => {
  it('auto-detects and parses package.json', () => {
    const result = parseSbom({ dependencies: { react: '^18.0.0' } });
    expect(result.format).toBe('npm-package-json');
    expect(result.deps.length).toBeGreaterThan(0);
  });

  it('returns unknown format for unrecognized input', () => {
    const result = parseSbom({ totally: 'unknown' });
    expect(result.format).toBe('unknown');
    expect(result.deps).toHaveLength(0);
  });
});

// ─── resolveLicense ──────────────────────────────────────────────────────

describe('resolveLicense', () => {
  it('resolves MIT as permissive', () => {
    const lic = resolveLicense('MIT');
    expect(lic?.risk).toBe('permissive');
    expect(lic?.isOsiApproved).toBe(true);
  });

  it('resolves GPL as restrictive', () => {
    const lic = resolveLicense('GPL-3.0');
    expect(lic?.risk).toBe('restrictive');
  });

  it('returns null for null input', () => {
    expect(resolveLicense(null)).toBeNull();
    expect(resolveLicense(undefined)).toBeNull();
  });

  it('handles Apache-2.0 license', () => {
    const lic = resolveLicense('Apache-2.0');
    expect(lic?.risk).toBe('permissive');
  });

  it('handles AGPL restriction note', () => {
    const lic = resolveLicense('AGPL');
    expect(lic?.risk).toBe('restrictive');
  });

  it('resolves BSD-2-Clause as permissive (exact match)', () => {
    const lic = resolveLicense('BSD-2-Clause');
    expect(lic?.risk).toBe('permissive');
    expect(lic?.isOsiApproved).toBe(true);
  });

  it('resolves ISC as permissive (exact match)', () => {
    const lic = resolveLicense('ISC');
    expect(lic?.risk).toBe('permissive');
  });

  it('resolves UNLICENSED as unknown risk', () => {
    const lic = resolveLicense('UNLICENSED');
    expect(lic?.risk).toBe('unknown');
    expect(lic?.isOsiApproved).toBe(false);
  });

  it('resolves LGPL-2.1 via exact match', () => {
    const lic = resolveLicense('LGPL-2.1');
    expect(lic?.risk).toBe('restrictive');
  });

  it('resolves license containing "lgpl" (lowercase) via LGPL branch', () => {
    // No exact DB match → falls through to clean.includes('LGPL') branch
    const lic = resolveLicense('Some-LGPL-License');
    expect(lic?.risk).toBe('restrictive');
  });

  it('resolves license containing "gpl" without version number → GPL-2.0 branch', () => {
    const lic = resolveLicense('Custom-GPL-License');
    expect(lic?.risk).toBe('restrictive');
  });

  it('resolves license containing "apache" (case-insensitive) → Apache-2.0', () => {
    const lic = resolveLicense('apache-something');
    expect(lic?.risk).toBe('permissive');
  });

  it('resolves license containing "mit" (lowercase) → MIT branch', () => {
    const lic = resolveLicense('some-mit-variant');
    expect(lic?.risk).toBe('permissive');
  });

  it('falls back to unknown risk for unrecognized license string', () => {
    const lic = resolveLicense('Proprietary-Custom-v2');
    expect(lic?.risk).toBe('unknown');
    expect(lic?.isOsiApproved).toBe(false);
    expect(lic?.name).toBe('Proprietary-Custom-v2');
  });
});

// ─── computeDependencyRiskScore ───────────────────────────────────────────

describe('computeDependencyRiskScore', () => {
  it('returns 0 for empty vulnerabilities', () => {
    expect(computeDependencyRiskScore([])).toBe(0);
  });

  it('returns high score for critical vulnerability', () => {
    const vulns: ScaVulnerability[] = [
      { id: 'GHSA-001', summary: 'RCE', details: '', severity: 'critical' as VulnSeverity },
    ];
    expect(computeDependencyRiskScore(vulns)).toBeGreaterThanOrEqual(35);
  });

  it('caps score at 100', () => {
    const manyVulns: ScaVulnerability[] = Array(10).fill({
      id: 'GHSA-XXX',
      summary: 'RCE',
      details: '',
      severity: 'critical' as VulnSeverity,
    });
    expect(computeDependencyRiskScore(manyVulns)).toBe(100);
  });

  it('accumulates scores across severity levels', () => {
    const vulns: ScaVulnerability[] = [
      { id: 'GHSA-1', summary: 'high', details: '', severity: 'high' as VulnSeverity },
      { id: 'GHSA-2', summary: 'medium', details: '', severity: 'medium' as VulnSeverity },
    ];
    expect(computeDependencyRiskScore(vulns)).toBe(30); // 20 + 10
  });
});

// ─── riskLevelFromScore ───────────────────────────────────────────────────

describe('riskLevelFromScore', () => {
  it('returns none for 0', () => expect(riskLevelFromScore(0)).toBe('none'));
  it('returns low for 1–14', () => expect(riskLevelFromScore(10)).toBe('low'));
  it('returns medium for 15–39', () => expect(riskLevelFromScore(20)).toBe('medium'));
  it('returns high for 40–64', () => expect(riskLevelFromScore(50)).toBe('high'));
  it('returns critical for 65+', () => expect(riskLevelFromScore(75)).toBe('critical'));
});

// ─── ScaAnalyzer ─────────────────────────────────────────────────────────

describe('ScaAnalyzer', () => {
  let analyzer: ScaAnalyzer;

  beforeEach(() => {
    analyzer = new ScaAnalyzer();
    // Mock fetch to avoid real network calls
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vulns: [] }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails for unknown SBOM format', async () => {
    const result = await analyzer.scan({ totally: 'unknown' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/unsupported/i);
    }
  });

  it('returns failure when parseSbom throws (malicious getter)', async () => {
    // parseSbom calls detectSbomFormat which accesses properties.
    // A getter that throws causes parseSbom to throw, which is caught by scan().
    const malicious = {};
    Object.defineProperty(malicious, 'bomFormat', {
      get() { throw new Error('getter boom'); },
      enumerable: true,
    });
    const result = await analyzer.scan(malicious);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/failed to parse/i);
    }
  });

  it('fails for empty manifest', async () => {
    const result = await analyzer.scan({});
    expect(result.ok).toBe(false);
  });

  it('scans package.json and returns result structure', async () => {
    const result = await analyzer.scan({
      dependencies: { react: '^18.2.0', lodash: '4.17.21' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.format).toBe('npm-package-json');
      expect(result.data.totalDependencies).toBe(2);
      expect(typeof result.data.overallRiskScore).toBe('number');
      expect(Array.isArray(result.data.risks)).toBe(true);
      expect(Array.isArray(result.data.recommendations)).toBe(true);
    }
  });

  it('scans CycloneDX SBOM', async () => {
    const result = await analyzer.scan({
      bomFormat: 'CycloneDX',
      components: [{ name: 'express', version: '4.18.2' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.format).toBe('cyclonedx');
      expect(result.data.totalDependencies).toBe(1);
    }
  });

  it('tracks vulnerabilities found in metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [
          {
            id: 'GHSA-0001',
            summary: 'Test vuln',
            details: 'RCE in test',
            severity: [{ score: 'CRITICAL' }],
          },
        ],
      }),
    }));
    await analyzer.scan({ dependencies: { vulnerable: '1.0.0' } });
    expect(analyzer.getMetrics().vulnerabilitiesFound).toBeGreaterThan(0);
  });

  it('caches vulnerability results per dep@version', async () => {
    await analyzer.scan({ dependencies: { cached: '1.0.0' } });
    await analyzer.scan({ dependencies: { cached: '1.0.0' } });
    expect(analyzer.getMetrics().cacheHits).toBeGreaterThan(0);
  });

  it('clears cache on clearCache()', async () => {
    await analyzer.scan({ dependencies: { react: '18.0.0' } });
    expect(analyzer.getCacheSize()).toBeGreaterThan(0);
    analyzer.clearCache();
    expect(analyzer.getCacheSize()).toBe(0);
  });

  it('increments totalScans per scan call', async () => {
    await analyzer.scan({ dependencies: { a: '1.0.0' } });
    await analyzer.scan({ dependencies: { b: '2.0.0' } });
    expect(analyzer.getMetrics().totalScans).toBe(2);
  });

  it('handles fetch failure gracefully (returns empty vulns)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await analyzer.scan({ dependencies: { broken: '1.0.0' } });
    expect(result.ok).toBe(true); // should not fail, just no vulns
  });

  it('includes prod dep as directlyExposed', async () => {
    const result = await analyzer.scan({ dependencies: { express: '4.18.2' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const prodRisk = result.data.risks.find((r) => r.dependency.type === 'prod');
      expect(prodRisk?.directlyExposed).toBe(true);
    }
  });

  it('includes scannedAt timestamp in result', async () => {
    const result = await analyzer.scan({ dependencies: { ts: '5.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.data.scannedAt).toBe('string');
      expect(new Date(result.data.scannedAt).getTime()).not.toBeNaN();
    }
  });

  // ─── extractSeverity branches via fetch mock ──────────────────────────

  it('maps OSV vuln with severity score "HIGH" to high', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-HIGH', summary: 'High vuln', details: '', severity: [{ score: 'HIGH' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const vuln = result.data.risks[0].vulnerabilities[0];
      expect(vuln.severity).toBe('high');
    }
  });

  it('maps OSV vuln with severity score "LOW" to low', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-LOW', summary: 'Low vuln', details: '', severity: [{ score: 'LOW' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities[0].severity).toBe('low');
  });

  it('maps OSV vuln with severity score "MODERATE" to medium', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-MOD', summary: 'Moderate vuln', details: '', severity: [{ score: 'MODERATE' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities[0].severity).toBe('medium');
  });

  it('maps OSV vuln with numeric CVSS 9.5 to critical', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-NUM-C', summary: 'Num critical', details: '', severity: [{ score: '9.5' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities[0].severity).toBe('critical');
  });

  it('maps OSV vuln with numeric CVSS 7.5 to high', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-NUM-H', summary: 'Num high', details: '', severity: [{ score: '7.5' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities[0].severity).toBe('high');
  });

  it('maps OSV vuln with numeric CVSS 5.0 to medium', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-NUM-M', summary: 'Num medium', details: '', severity: [{ score: '5.0' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities[0].severity).toBe('medium');
  });

  it('maps OSV vuln with numeric CVSS 2.0 to low', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-NUM-L', summary: 'Num low', details: '', severity: [{ score: '2.0' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities[0].severity).toBe('low');
  });

  it('maps OSV vuln with non-numeric unrecognized score to unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-UNK', summary: 'Unknown', details: '', severity: [{ score: 'UNRECOGNIZED_SCORE' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities[0].severity).toBe('unknown');
  });

  it('maps OSV vuln with no summary/details/affected to defaults', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-SPARSE', severity: [{ score: 'CRITICAL' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const vuln = result.data.risks[0].vulnerabilities[0];
      expect(vuln.summary).toBe('Known vulnerability');
      expect(vuln.details).toBe('');
      expect(vuln.fixedIn).toBeUndefined();
    }
  });

  it('maps OSV vuln with references to reference list (max 3)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{
          id: 'GHSA-REFS',
          summary: 'Ref vuln',
          details: '',
          severity: [{ score: 'HIGH' }],
          references: [
            { url: 'https://a.com' },
            { url: 'https://b.com' },
            { url: 'https://c.com' },
            { url: 'https://d.com' },
          ],
        }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.risks[0].vulnerabilities[0].references).toHaveLength(3);
    }
  });

  it('handles OSV response with non-ok HTTP status (returns empty vulns)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.risks[0].vulnerabilities).toHaveLength(0);
  });

  // ─── buildScaRecommendations branches ─────────────────────────────────

  it('recommendations include high-severity action when high vulns found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-H1', summary: 'High', details: '', severity: [{ score: 'HIGH' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.recommendations.some((r) => r.includes('high-severity'))).toBe(true);
    }
  });

  it('recommendations include critical + pin action when critical vulns found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulns: [{ id: 'GHSA-C1', summary: 'Crit', details: '', severity: [{ score: 'CRITICAL' }] }],
      }),
    }));
    const result = await analyzer.scan({ dependencies: { pkg: '1.0.0' } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.recommendations.some((r) => r.includes('Immediately patch'))).toBe(true);
      expect(result.data.recommendations.some((r) => r.includes('Pin affected packages'))).toBe(true);
    }
  });
});

// ─── Global Singleton ─────────────────────────────────────────────────────

describe('Global ScaAnalyzer', () => {
  beforeEach(() => resetGlobalScaAnalyzer());

  it('returns ScaAnalyzer instance', () => {
    expect(getGlobalScaAnalyzer()).toBeInstanceOf(ScaAnalyzer);
  });

  it('returns same singleton on repeated calls', () => {
    const a = getGlobalScaAnalyzer();
    const b = getGlobalScaAnalyzer();
    expect(a).toBe(b);
  });

  it('creates new instance after reset', () => {
    const before = getGlobalScaAnalyzer();
    resetGlobalScaAnalyzer();
    const after = getGlobalScaAnalyzer();
    expect(before).not.toBe(after);
  });
});
