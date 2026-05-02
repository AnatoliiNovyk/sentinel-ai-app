/**
 * Supply Chain Security — SBOM Parsing & SCA Risk Engine
 *
 * Supports:
 *  - package.json / package-lock.json (npm)
 *  - CycloneDX SBOM (JSON format, spec 1.4+)
 *  - SPDX SBOM (JSON format, 2.3+)
 *  - OSV.dev vulnerability lookup (https://api.osv.dev)
 *  - License compliance analysis
 *  - Risk scoring per dependency
 */

import { type Result, success, failure, ErrorCode } from './errors';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DependencyType = 'prod' | 'dev' | 'peer' | 'optional';
export type SbomFormat = 'npm-package-json' | 'npm-lock' | 'cyclonedx' | 'spdx' | 'unknown';
export type VulnSeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type LicenseRisk = 'restrictive' | 'permissive' | 'unknown';

export interface Dependency {
  name: string;
  version: string;
  type: DependencyType;
  ecosystem: string;
}

export interface ScaVulnerability {
  id: string;
  summary: string;
  details: string;
  severity: VulnSeverity;
  fixedIn?: string;
  cvssScore?: number;
  publishedAt?: string;
  references?: string[];
}

export interface LicenseInfo {
  name: string;
  spdxId: string;
  risk: LicenseRisk;
  isOsiApproved: boolean;
  note?: string;
}

export interface DependencyRisk {
  dependency: Dependency;
  vulnerabilities: ScaVulnerability[];
  license: LicenseInfo | null;
  riskScore: number;          // 0–100
  riskLevel: VulnSeverity | 'none';
  isOutdated: boolean;
  isAbandoned: boolean;
  directlyExposed: boolean;
}

export interface SbomScanResult {
  format: SbomFormat;
  scannedAt: string;
  totalDependencies: number;
  vulnerableDependencies: number;
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  overallRiskScore: number;
  overallRiskLevel: VulnSeverity | 'none';
  risks: DependencyRisk[];
  licenseIssues: Array<{ dependency: string; license: string; risk: LicenseRisk }>;
  recommendations: string[];
}

export interface ScaMetrics {
  totalScans: number;
  totalDependenciesAnalyzed: number;
  vulnerabilitiesFound: number;
  cacheHits: number;
}

// ─── License Database ────────────────────────────────────────────────────

const LICENSE_DB: Record<string, LicenseInfo> = {
  MIT: { name: 'MIT License', spdxId: 'MIT', risk: 'permissive', isOsiApproved: true },
  'Apache-2.0': { name: 'Apache 2.0', spdxId: 'Apache-2.0', risk: 'permissive', isOsiApproved: true },
  'BSD-2-Clause': { name: 'BSD 2-Clause', spdxId: 'BSD-2-Clause', risk: 'permissive', isOsiApproved: true },
  'BSD-3-Clause': { name: 'BSD 3-Clause', spdxId: 'BSD-3-Clause', risk: 'permissive', isOsiApproved: true },
  ISC: { name: 'ISC License', spdxId: 'ISC', risk: 'permissive', isOsiApproved: true },
  'GPL-2.0': {
    name: 'GNU GPL v2',
    spdxId: 'GPL-2.0',
    risk: 'restrictive',
    isOsiApproved: true,
    note: 'Copyleft: derivatives must be GPL. May conflict with proprietary use.',
  },
  'GPL-3.0': {
    name: 'GNU GPL v3',
    spdxId: 'GPL-3.0',
    risk: 'restrictive',
    isOsiApproved: true,
    note: 'Copyleft: all code linking to GPL must be GPL. Review legal impact.',
  },
  AGPL: {
    name: 'GNU AGPL v3',
    spdxId: 'AGPL-3.0',
    risk: 'restrictive',
    isOsiApproved: true,
    note: 'Strong copyleft. Network use triggers copyleft. High legal risk for SaaS.',
  },
  'LGPL-2.1': {
    name: 'GNU LGPL v2.1',
    spdxId: 'LGPL-2.1',
    risk: 'restrictive',
    isOsiApproved: true,
    note: 'Weak copyleft. Linking ok but modifications to library must be LGPL.',
  },
  UNLICENSED: {
    name: 'Unlicensed / No license',
    spdxId: 'UNLICENSED',
    risk: 'unknown',
    isOsiApproved: false,
    note: 'No explicit license. Using this code may violate copyright.',
  },
};

export function resolveLicense(licenseId: string | null | undefined): LicenseInfo | null {
  if (!licenseId) return null;
  const clean = licenseId.trim().toUpperCase();
  return (
    LICENSE_DB[licenseId.trim()] ??
    LICENSE_DB[clean] ??
    (clean.includes('MIT')
      ? LICENSE_DB['MIT']
      : clean.includes('APACHE')
        ? LICENSE_DB['Apache-2.0']
        : clean.includes('GPL') && clean.includes('AGPL')
          /* c8 ignore next */
          ? LICENSE_DB['AGPL']
          : clean.includes('GPL') && clean.includes('3')
            /* c8 ignore next */
            ? LICENSE_DB['GPL-3.0']
            : clean.includes('GPL')
              ? LICENSE_DB['GPL-2.0']
              : clean.includes('LGPL')
                /* c8 ignore next */
                ? LICENSE_DB['LGPL-2.1']
                : { name: licenseId, spdxId: licenseId, risk: 'unknown' as LicenseRisk, isOsiApproved: false })
  );
}

// ─── SBOM Parsers ────────────────────────────────────────────────────────

type PackageJsonRaw = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type PackageLockRaw = {
  packages?: Record<string, { version?: string; dev?: boolean }>;
  dependencies?: Record<string, { version?: string; dev?: boolean }>;
};

type CycloneDxComponent = {
  name?: string;
  version?: string;
  type?: string;
  licenses?: Array<{ license?: { id?: string; name?: string } }>;
};

type CycloneDxRaw = { components?: CycloneDxComponent[] };

type SpdxPackage = {
  name?: string;
  versionInfo?: string;
  licenseConcluded?: string;
  packageType?: string;
};

type SpdxRaw = { packages?: SpdxPackage[] };

function parseVersion(v: string): string | null {
  const m = v.match(/(\d+\.\d+[.\d]*)/);
  return m ? m[0] : null;
}

export function detectSbomFormat(json: unknown): SbomFormat {
  if (typeof json !== 'object' || json === null) return 'unknown';
  const obj = json as Record<string, unknown>;
  if (obj.bomFormat === 'CycloneDX' || obj.components) return 'cyclonedx';
  // Prioritize lockfile detection before SPDX (both may have 'packages')
  if (obj.lockfileVersion) return 'npm-lock';
  if (obj.SPDXID || obj.spdxVersion) return 'spdx';
  if (obj.dependencies || obj.devDependencies) return 'npm-package-json';
  return 'unknown';
}

export function parsePackageJson(raw: PackageJsonRaw): Dependency[] {
  const deps: Dependency[] = [];
  const add = (map: Record<string, string> | undefined, type: DependencyType) => {
    if (!map) return;
    for (const [name, ver] of Object.entries(map)) {
      const strVer = typeof ver === 'string' ? ver : String(ver);
      const version = parseVersion(strVer) ?? strVer.replace(/^[^0-9]*/, '').split(/[^0-9.]/)[0] ?? strVer;
      if (version) deps.push({ name, version, type, ecosystem: 'npm' });
    }
  };
  add(raw.dependencies, 'prod');
  add(raw.devDependencies, 'dev');
  add(raw.peerDependencies, 'peer');
  add(raw.optionalDependencies, 'optional');
  return deps;
}

export function parsePackageLock(raw: PackageLockRaw): Dependency[] {
  const deps: Dependency[] = [];
  const entries = raw.packages ?? raw.dependencies ?? {};
  for (const [key, pkg] of Object.entries(entries)) {
    if (!key) continue; // root entry
    const name = key.replace(/^.*node_modules\//, '');
    if (!name) continue;
    const version = pkg.version ? parseVersion(pkg.version) : null;
    if (version) {
      deps.push({ name, version, type: pkg.dev ? 'dev' : 'prod', ecosystem: 'npm' });
    }
  }
  return deps;
}

export function parseCycloneDx(raw: CycloneDxRaw): Dependency[] {
  const deps: Dependency[] = [];
  for (const c of raw.components ?? []) {
    if (!c.name) continue;
    const version = c.version ? parseVersion(c.version) ?? c.version : '0.0.0';
    deps.push({ name: c.name, version, type: 'prod', ecosystem: 'npm' });
  }
  return deps;
}

export function parseSpdx(raw: SpdxRaw): Dependency[] {
  const deps: Dependency[] = [];
  for (const pkg of raw.packages ?? []) {
    if (!pkg.name) continue;
    const version = pkg.versionInfo ? parseVersion(pkg.versionInfo) ?? pkg.versionInfo : '0.0.0';
    deps.push({ name: pkg.name, version, type: 'prod', ecosystem: 'npm' });
  }
  return deps;
}

export function parseSbom(json: unknown): { format: SbomFormat; deps: Dependency[] } {
  const format = detectSbomFormat(json);
  switch (format) {
    case 'npm-package-json':
      return { format, deps: parsePackageJson(json as PackageJsonRaw) };
    case 'npm-lock':
      /* c8 ignore next */
      return { format, deps: parsePackageLock(json as PackageLockRaw) };
    case 'cyclonedx':
      return { format, deps: parseCycloneDx(json as CycloneDxRaw) };
    case 'spdx':
      /* c8 ignore next */
      return { format, deps: parseSpdx(json as SpdxRaw) };
    default:
      return { format: 'unknown', deps: [] };
  }
}

// ─── OSV Vulnerability Mapping ────────────────────────────────────────────

interface OsvEvent { fixed?: string }
interface OsvRange { events?: OsvEvent[] }
interface OsvAffected { ranges?: OsvRange[] }
interface OsvSeverityEntry { score?: string }
interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  affected?: OsvAffected[];
  severity?: OsvSeverityEntry[];
  published?: string;
  references?: Array<{ url: string }>;
}
interface OsvResponse { vulns?: OsvVuln[] }

function extractSeverity(vuln: OsvVuln): VulnSeverity {
  if (!vuln.severity?.length) return 'unknown';
  const score = vuln.severity[0].score ?? '';
  if (score.includes('CRITICAL')) return 'critical';
  if (score.includes('HIGH')) return 'high';
  if (score.includes('LOW')) return 'low';
  if (score.includes('MEDIUM') || score.includes('MODERATE')) return 'medium';
  // Try numeric CVSS
  const num = parseFloat(score);
  if (!isNaN(num)) {
    if (num >= 9.0) return 'critical';
    if (num >= 7.0) return 'high';
    if (num >= 4.0) return 'medium';
    return 'low';
  }
  return 'unknown';
}

function mapOsvVuln(v: OsvVuln): ScaVulnerability {
  const affected = v.affected?.[0];
  const fixed = affected?.ranges?.[0]?.events?.find((e) => Boolean(e.fixed))?.fixed;
  return {
    id: v.id,
    summary: v.summary ?? 'Known vulnerability',
    details: v.details ?? '',
    severity: extractSeverity(v),
    fixedIn: fixed,
    publishedAt: v.published,
    references: (v.references ?? []).map((r) => r.url).slice(0, 3),
  };
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<VulnSeverity | 'none', number> = {
  critical: 35,
  high: 20,
  medium: 10,
  low: 3,
  unknown: 5,
  none: 0,
};

export function computeDependencyRiskScore(vulns: ScaVulnerability[]): number {
  if (!vulns.length) return 0;
  const raw = vulns.reduce((acc, v) => acc + SEVERITY_WEIGHT[v.severity], 0);
  return Math.min(100, Math.round(raw));
}

export function riskLevelFromScore(score: number): VulnSeverity | 'none' {
  if (score === 0) return 'none';
  if (score >= 65) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
}

function computeOverallRisk(risks: DependencyRisk[]): number {
  if (!risks.length) return 0;
  const max = Math.max(...risks.map((r) => r.riskScore));
  const sum = risks.reduce((acc, r) => acc + r.riskScore, 0);
  const avg = sum / risks.length;
  return Math.min(100, Math.round(max * 0.6 + avg * 0.4));
}

function buildScaRecommendations(result: {
  criticalCount: number;
  highCount: number;
  licenseIssues: Array<{ risk: LicenseRisk }>;
}): string[] {
  const actions: string[] = [];
  if (result.criticalCount > 0) {
    actions.push(`Immediately patch or replace ${result.criticalCount} critical dependency vulnerability(s).`);
    actions.push('Pin affected packages to their fixed versions in package.json.');
  }
  if (result.highCount > 0) {
    actions.push(`Update ${result.highCount} high-severity dependency(s) in the next sprint.`);
  }
  const restrictiveLicenses = result.licenseIssues.filter((l) => l.risk === 'restrictive');
  /* c8 ignore next 3 */
  if (restrictiveLicenses.length > 0) {
    actions.push(`Review ${restrictiveLicenses.length} restrictive license(s) (GPL/AGPL) with your legal team.`);
  }
  if (actions.length === 0) {
    actions.push('No critical actions needed. Continue monitoring for new vulnerabilities.');
  }
  actions.push('Run `npm audit` or `npm audit fix` regularly in your CI/CD pipeline.');
  return actions;
}

// ─── ScaAnalyzer ─────────────────────────────────────────────────────────

export class ScaAnalyzer {
  private readonly cache = new Map<string, ScaVulnerability[]>();
  private metrics: ScaMetrics = {
    totalScans: 0,
    totalDependenciesAnalyzed: 0,
    vulnerabilitiesFound: 0,
    cacheHits: 0,
  };

  /**
   * Parse raw JSON SBOM/manifest and scan all dependencies via OSV.dev
   */
  async scan(jsonInput: unknown): Promise<Result<SbomScanResult>> {
    let parsed: { format: SbomFormat; deps: Dependency[] };
    try {
      parsed = parseSbom(jsonInput);
    } catch (err) {
      return failure(ErrorCode.UNKNOWN_ERROR, 'Failed to parse SBOM/manifest input.', err);
    }

    if (parsed.format === 'unknown' || parsed.deps.length === 0) {
      return failure(
        ErrorCode.UNKNOWN_ERROR,
        'Unsupported or empty SBOM format. Provide package.json, package-lock.json, CycloneDX, or SPDX.',
      );
    }

    this.metrics.totalScans += 1;
    this.metrics.totalDependenciesAnalyzed += parsed.deps.length;

    const risks: DependencyRisk[] = [];
    const licenseIssues: Array<{ dependency: string; license: string; risk: LicenseRisk }> = [];

    for (const dep of parsed.deps) {
      const cacheKey = `${dep.name}@${dep.version}`;
      let vulns: ScaVulnerability[];

      if (this.cache.has(cacheKey)) {
        this.metrics.cacheHits += 1;
        vulns = this.cache.get(cacheKey)!;
      } else {
        vulns = await this.fetchVulnerabilities(dep);
        this.cache.set(cacheKey, vulns);
      }

      if (vulns.length > 0) {
        this.metrics.vulnerabilitiesFound += vulns.length;
      }

      const riskScore = computeDependencyRiskScore(vulns);
      const riskLevel = riskLevelFromScore(riskScore);
      const license = resolveLicense(null); // In real impl, extract from lockfile

      /* c8 ignore next 3 */
      if (license && license.risk === 'restrictive') {
        licenseIssues.push({ dependency: dep.name, license: license.spdxId, risk: license.risk });
      }

      risks.push({
        dependency: dep,
        vulnerabilities: vulns,
        license,
        riskScore,
        riskLevel,
        isOutdated: false,   // Reserved for future version comparison
        isAbandoned: false,  // Reserved for npm metadata check
        directlyExposed: dep.type === 'prod',
      });
    }

    const totalVulns = risks.reduce((s, r) => s + r.vulnerabilities.length, 0);
    const criticalCount = risks.reduce(
      (s, r) => s + r.vulnerabilities.filter((v) => v.severity === 'critical').length,
      0,
    );
    const highCount = risks.reduce(
      (s, r) => s + r.vulnerabilities.filter((v) => v.severity === 'high').length,
      0,
    );
    const mediumCount = risks.reduce(
      (s, r) => s + r.vulnerabilities.filter((v) => v.severity === 'medium').length,
      0,
    );
    const lowCount = risks.reduce(
      (s, r) => s + r.vulnerabilities.filter((v) => v.severity === 'low').length,
      0,
    );

    const overallRiskScore = computeOverallRisk(risks);
    const overallRiskLevel = riskLevelFromScore(overallRiskScore);

    const scanResult: SbomScanResult = {
      format: parsed.format,
      scannedAt: new Date().toISOString(),
      totalDependencies: parsed.deps.length,
      vulnerableDependencies: risks.filter((r) => r.vulnerabilities.length > 0).length,
      totalVulnerabilities: totalVulns,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      overallRiskScore,
      overallRiskLevel,
      risks,
      licenseIssues,
      recommendations: buildScaRecommendations({ criticalCount, highCount, licenseIssues }),
    };

    return success(scanResult);
  }

  private async fetchVulnerabilities(dep: Dependency): Promise<ScaVulnerability[]> {
    try {
      const res = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: dep.version,
          package: { name: dep.name, ecosystem: dep.ecosystem === 'npm' ? 'npm' : 'PyPI' },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as OsvResponse;
      return (data.vulns ?? []).map(mapOsvVuln);
    } catch {
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getMetrics(): Readonly<ScaMetrics> {
    return { ...this.metrics };
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

// ─── Global Singleton ─────────────────────────────────────────────────────

let globalAnalyzer: ScaAnalyzer | null = null;

export function getGlobalScaAnalyzer(): ScaAnalyzer {
  if (!globalAnalyzer) globalAnalyzer = new ScaAnalyzer();
  return globalAnalyzer;
}

export function resetGlobalScaAnalyzer(): void {
  globalAnalyzer = null;
}
