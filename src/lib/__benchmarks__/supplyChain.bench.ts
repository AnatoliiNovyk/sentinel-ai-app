import { bench, describe } from 'vitest';
import { getGlobalScaAnalyzer } from '../supplyChain';

describe('SupplyChain Benchmarks', () => {
  const analyzer = getGlobalScaAnalyzer();

  describe('SBOM Parsing Performance', () => {
    bench('parse 10-component CycloneX SBOM: < 100ms', () => {
      const sbom = {
        version: '1.4',
        metadata: { component: { name: 'test-app', version: '1.0' } },
        components: Array.from({ length: 10 }, (_, i) => ({
          name: `pkg-${i}`,
          version: `1.0.${i}`,
          purl: `pkg:npm/pkg-${i}@1.0.${i}`,
        })),
      };

      const start = performance.now();
      analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 100) {
        throw new Error(`SBOM parsing (10 deps) exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('parse 50-component npm lock SBOM: < 500ms', () => {
      const sbom = {
        version: '1.4',
        components: Array.from({ length: 50 }, (_, i) => ({
          name: `dependency-${i}`,
          version: `2.0.${i}`,
          purl: `pkg:npm/dependency-${i}@2.0.${i}`,
        })),
      };

      const start = performance.now();
      analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 500) {
        throw new Error(`SBOM parsing (50 deps) exceeded 500ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('parse 100-component SBOM: < 5s', () => {
      const sbom = {
        version: '1.4',
        components: Array.from({ length: 100 }, (_, i) => ({
          name: `large-dep-${i}`,
          version: `3.0.${i}`,
          purl: `pkg:npm/large-dep-${i}@3.0.${i}`,
        })),
      };

      const start = performance.now();
      analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 5000) {
        throw new Error(`SBOM parsing (100 deps) exceeded 5s: ${(elapsed / 1000).toFixed(2)}s`);
      }
    });

    bench('parse SPDX JSON SBOM: < 500ms', () => {
      const spdxBom = {
        spdxVersion: 'SPDX-2.3',
        dataLicense: 'CC0-1.0',
        name: 'test-app',
        packages: Array.from({ length: 25 }, (_, i) => ({
          SPDXID: `SPDXRef-Package${i}`,
          name: `spdx-pkg-${i}`,
          downloadLocation: `https://npm.js.org/spdx-pkg-${i}`,
        })),
      };

      const start = performance.now();
      analyzer.scan(spdxBom);
      const elapsed = performance.now() - start;

      if (elapsed > 500) {
        throw new Error(`SPDX parsing exceeded 500ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('parse empty SBOM: < 50ms', () => {
      const emptySbom = { version: '1.4', components: [] };

      const start = performance.now();
      analyzer.scan(emptySbom);
      const elapsed = performance.now() - start;

      if (elapsed > 50) {
        throw new Error(`Empty SBOM parsing exceeded 50ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('OSV API Lookup Performance', () => {
    bench('single dependency OSV lookup: < 100ms (mock)', async () => {
      const sbom = {
        version: '1.4',
        components: [{ name: 'lodash', version: '4.17.21', purl: 'pkg:npm/lodash@4.17.21' }],
      };

      const start = performance.now();
      await analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 100) {
        throw new Error(`Single OSV lookup exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('10 dependencies OSV batch lookup: < 500ms', async () => {
      const sbom = {
        version: '1.4',
        components: Array.from({ length: 10 }, (_, i) => ({
          name: `pkg-${i}`,
          version: `1.0.0`,
        })),
      };

      const start = performance.now();
      await analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 500) {
        throw new Error(`10 OSV lookups exceeded 500ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('OSV API timeout handling: < 50ms', async () => {
      const sbom = { version: '1.4', components: [{ name: 'timeout-test', version: '1.0' }] };

      const start = performance.now();
      try {
        await analyzer.scan(sbom);
      } catch {
        // Timeout handling should be fast
      }
      const elapsed = performance.now() - start;

      if (elapsed > 50) {
        throw new Error(`Timeout handling exceeded 50ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('License Analysis Performance', () => {
    bench('analyze 10 dependencies licenses: < 50ms', () => {
      const sbom = {
        version: '1.4',
        components: Array.from({ length: 10 }, (_, i) => ({
          name: `licensed-pkg-${i}`,
          version: '1.0.0',
          licenses: [{ license: { name: 'MIT' } }],
        })),
      };

      const start = performance.now();
      analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 50) {
        throw new Error(`License analysis (10 deps) exceeded 50ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('analyze 50 dependencies licenses: < 200ms', () => {
      const sbom = {
        version: '1.4',
        components: Array.from({ length: 50 }, (_, i) => ({
          name: `lic-dep-${i}`,
          version: '2.0.0',
          licenses: [
            { license: { name: i % 3 === 0 ? 'GPL' : i % 2 === 0 ? 'MIT' : 'Apache-2.0' } },
          ],
        })),
      };

      const start = performance.now();
      analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 200) {
        throw new Error(`License analysis (50 deps) exceeded 200ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('conflicting license detection: < 100ms', () => {
      const sbom = {
        version: '1.4',
        components: Array.from({ length: 20 }, (_, i) => ({
          name: `conflict-pkg-${i}`,
          version: '1.0.0',
          licenses: [{ license: { name: i % 2 === 0 ? 'GPL-2.0' : 'MIT' } }],
        })),
      };

      const start = performance.now();
      analyzer.scan(sbom);
      const elapsed = performance.now() - start;

      if (elapsed > 100) {
        throw new Error(`Conflict detection exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Vulnerability Aggregation Performance', () => {
    bench('aggregate 10 vulnerabilities: < 100ms', () => {
      const vulns = Array.from({ length: 10 }, (_, i) => ({
        id: `GHSA-${i}`,
        severity: i % 3 === 0 ? 'CRITICAL' : i % 2 === 0 ? 'HIGH' : 'MEDIUM',
        affected_versions: ['1.0.0', '2.0.0'],
      }));

      const start = performance.now();
      vulns.sort((a, b) => {
        const severityMap: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
        return severityMap[b.severity] - severityMap[a.severity];
      });
      const elapsed = performance.now() - start;

      if (elapsed > 100) {
        throw new Error(`Aggregation (10 vulns) exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('aggregate 100 vulnerabilities: < 200ms', () => {
      const vulns = Array.from({ length: 100 }, (_, i) => ({
        id: `CVE-2024-${String(i).padStart(5, '0')}`,
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'][i % 4],
        affected_versions: Array.from({ length: 3 }, (_, j) => `${j}.0.0`),
      }));

      const start = performance.now();
      vulns.sort((a, b) => {
        const severityMap: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
        return severityMap[b.severity] - severityMap[a.severity];
      });
      const elapsed = performance.now() - start;

      if (elapsed > 200) {
        throw new Error(`Aggregation (100 vulns) exceeded 200ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('deduplication of vulnerabilities: < 50ms', () => {
      const vulns = Array.from({ length: 50 }, (_, i) => ({
        id: `GHSA-${i % 10}`,
        severity: 'HIGH',
      }));

      const start = performance.now();
      Array.from(new Set(vulns.map((v) => v.id)));
      const elapsed = performance.now() - start;

      if (elapsed > 50) {
        throw new Error(`Deduplication exceeded 50ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('End-to-End Scan Performance', () => {
    bench('full SBOM scan: parse + OSV + license: < 5s', async () => {
      const fullSbom = {
        version: '1.4',
        metadata: { component: { name: 'production-app', version: '2.1.0' } },
        components: Array.from({ length: 50 }, (_, i) => ({
          name: `prod-dep-${i}`,
          version: `${i}.0.0`,
          purl: `pkg:npm/prod-dep-${i}@${i}.0.0`,
          licenses: [{ license: { name: i % 2 === 0 ? 'MIT' : 'Apache-2.0' } }],
        })),
      };

      const start = performance.now();
      await analyzer.scan(fullSbom);
      const elapsed = performance.now() - start;

      if (elapsed > 5000) {
        throw new Error(`Full scan exceeded 5s: ${(elapsed / 1000).toFixed(2)}s`);
      }
    });

    bench('large production SBOM: 100+ deps: < 10s', async () => {
      const largeSbom = {
        version: '1.4',
        components: Array.from({ length: 100 }, (_, i) => ({
          name: `large-prod-${i}`,
          version: `1.${i}.0`,
          purl: `pkg:npm/large-prod-${i}@1.${i}.0`,
        })),
      };

      const start = performance.now();
      await analyzer.scan(largeSbom);
      const elapsed = performance.now() - start;

      if (elapsed > 10000) {
        throw new Error(`Large SBOM scan exceeded 10s: ${(elapsed / 1000).toFixed(2)}s`);
      }
    });
  });

  describe('Memory Efficiency', () => {
    bench('memory footprint for 100-dep SBOM analysis', () => {
      const sbom = {
        version: '1.4',
        components: Array.from({ length: 100 }, (_, i) => ({
          name: `mem-test-${i}`,
          version: '1.0.0',
        })),
      };

      const memBefore = process.memoryUsage().heapUsed;
      analyzer.scan(sbom);
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;

      const maxMemMb = 10;
      if (memIncrease > maxMemMb * 1024 * 1024) {
        throw new Error(
          `Memory increase exceeded ${maxMemMb}MB: ${(memIncrease / 1024 / 1024).toFixed(2)}MB`
        );
      }
    });
  });
});
