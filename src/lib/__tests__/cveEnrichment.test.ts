/**
 * Unit tests for src/lib/cveEnrichment.ts
 * Tests cvssToSeverity() (pure function) and fetchCveDetail() (mocked fetch).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cvssToSeverity, fetchCveDetail } from '../cveEnrichment';

// ─── cvssToSeverity ───────────────────────────────────────────────────────────

describe('cvssToSeverity', () => {
  it('returns unknown for null score', () => {
    expect(cvssToSeverity(null)).toBe('unknown');
  });

  it('returns critical for score >= 9.0', () => {
    expect(cvssToSeverity(9.0)).toBe('critical');
    expect(cvssToSeverity(10.0)).toBe('critical');
    expect(cvssToSeverity(9.8)).toBe('critical');
  });

  it('returns high for score >= 7.0 and < 9.0', () => {
    expect(cvssToSeverity(7.0)).toBe('high');
    expect(cvssToSeverity(8.9)).toBe('high');
    expect(cvssToSeverity(7.5)).toBe('high');
  });

  it('returns medium for score >= 4.0 and < 7.0', () => {
    expect(cvssToSeverity(4.0)).toBe('medium');
    expect(cvssToSeverity(6.9)).toBe('medium');
    expect(cvssToSeverity(5.5)).toBe('medium');
  });

  it('returns low for score >= 0.1 and < 4.0', () => {
    expect(cvssToSeverity(0.1)).toBe('low');
    expect(cvssToSeverity(3.9)).toBe('low');
    expect(cvssToSeverity(2.0)).toBe('low');
  });

  it('returns info for score 0.0', () => {
    expect(cvssToSeverity(0.0)).toBe('info');
  });

  it('returns info for negative score', () => {
    expect(cvssToSeverity(-1)).toBe('info');
  });
});

// ─── fetchCveDetail ───────────────────────────────────────────────────────────

const NVD_RESPONSE = {
  vulnerabilities: [
    {
      cve: {
        id: 'CVE-2021-44228',
        published: '2021-12-10T00:00:00.000Z',
        lastModified: '2021-12-20T00:00:00.000Z',
        descriptions: [{ lang: 'en', value: 'Log4Shell RCE vulnerability' }],
        metrics: {
          cvssMetricV31: [
            { cvssData: { baseScore: 10.0, baseSeverity: 'CRITICAL' } },
          ],
        },
        references: [
          { url: 'https://nvd.nist.gov/vuln/detail/CVE-2021-44228' },
        ],
        weaknesses: [
          { description: [{ value: 'CWE-502' }] },
        ],
      },
    },
  ],
};

describe('fetchCveDetail', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Reset module-level cache between tests by re-importing is complex,
    // so we use unique CVE IDs per test to avoid cache collisions.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null for invalid CVE IDs (no CVE- prefix)', async () => {
    const result = await fetchCveDetail('NOTACVE');
    expect(result).toBeNull();
  });

  it('returns null for empty string', async () => {
    const result = await fetchCveDetail('');
    expect(result).toBeNull();
  });

  it('normalizes CVE ID to uppercase before lookup', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => NVD_RESPONSE,
    });
    vi.stubGlobal('fetch', mockFetch);

    // lowercase input is normalized to uppercase → becomes CVE-2099-NORMALIZED → fetch is called
    const result = await fetchCveDetail('cve-2099-normalized');
    // fetch should have been called (normalized id starts with CVE-)
    expect(mockFetch).toHaveBeenCalled();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('CVE-2099-NORMALIZED');
    // NVD_RESPONSE returns CVE-2021-44228, so our normalized id won't match — result may be non-null
    // (the module uses the NVD response id, not our id). We just verify fetch was called with uppercase.
    expect(result).not.toBeUndefined(); // may be null or detail, but no crash
  });

  it('returns CveDetail for a valid CVE ID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => NVD_RESPONSE,
    }));

    const result = await fetchCveDetail('CVE-2021-44228');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('CVE-2021-44228');
    expect(result!.description).toBe('Log4Shell RCE vulnerability');
    expect(result!.cvssV3Score).toBe(10.0);
    expect(result!.cvssV3Severity).toBe('CRITICAL');
    expect(result!.publishedDate).toBe('2021-12-10T00:00:00.000Z');
    expect(result!.cweIds).toContain('CWE-502');
    expect(result!.references.length).toBeGreaterThan(0);
  });

  it('returns null when HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const result = await fetchCveDetail('CVE-2099-00001');
    expect(result).toBeNull();
  });

  it('returns null when vulnerabilities array is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ vulnerabilities: [] }),
    }));

    const result = await fetchCveDetail('CVE-2099-00002');
    expect(result).toBeNull();
  });

  it('returns null when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await fetchCveDetail('CVE-2099-00003');
    expect(result).toBeNull();
  });

  it('uses cache for repeated calls with same CVE ID', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulnerabilities: [{
          cve: {
            ...NVD_RESPONSE.vulnerabilities[0].cve,
            id: 'CVE-2099-CACHE-TEST',
          },
        }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Use a unique CVE ID to avoid cross-test cache pollution
    await fetchCveDetail('CVE-2099-CACHE-TEST');
    await fetchCveDetail('CVE-2099-CACHE-TEST');

    // fetch called exactly once (second call hits cache)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('includes up to 5 references', async () => {
    const manyRefs = Array.from({ length: 10 }, (_, i) => ({ url: `https://ref${i}.com` }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulnerabilities: [{
          cve: {
            ...NVD_RESPONSE.vulnerabilities[0].cve,
            id: 'CVE-2099-00004',
            references: manyRefs,
          },
        }],
      }),
    }));

    const result = await fetchCveDetail('CVE-2099-00004');
    expect(result!.references.length).toBeLessThanOrEqual(5);
  });

  it('handles CVE with no CVSS v3 metrics (falls back to null)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vulnerabilities: [{
          cve: {
            id: 'CVE-2099-00005',
            published: '2020-01-01T00:00:00Z',
            lastModified: '2020-01-02T00:00:00Z',
            descriptions: [{ lang: 'en', value: 'Old CVE without v3' }],
            metrics: {
              cvssMetricV2: [{ cvssData: { baseScore: 6.5 } }],
            },
            references: [],
            weaknesses: [],
          },
        }],
      }),
    }));

    const result = await fetchCveDetail('CVE-2099-00005');
    expect(result).not.toBeNull();
    expect(result!.cvssV3Score).toBeNull();
    expect(result!.cvssV2Score).toBe(6.5);
  });
});
