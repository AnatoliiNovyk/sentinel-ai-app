/**
 * CVE Enrichment via NVD (National Vulnerability Database) API
 * https://services.nvd.nist.gov/rest/json/cves/2.0
 * No API key required for basic usage (rate-limited to 5 req/30s).
 */
const NVD_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const CACHE = new Map();
/**
 * Fetch CVE details from NVD. Returns null if not found or on error.
 * Results are cached in-memory for the browser session.
 */
export async function fetchCveDetail(cveId) {
    const normalized = cveId.trim().toUpperCase();
    if (!normalized.startsWith('CVE-'))
        return null;
    if (CACHE.has(normalized))
        return CACHE.get(normalized);
    try {
        const res = await fetch(`${NVD_BASE}?cveId=${encodeURIComponent(normalized)}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) {
            CACHE.set(normalized, null);
            return null;
        }
        const json = await res.json();
        const vuln = json?.vulnerabilities?.[0]?.cve;
        if (!vuln) {
            CACHE.set(normalized, null);
            return null;
        }
        // Extract CVSS v3 (preferred) then v2
        const metricsV31 = vuln.metrics?.cvssMetricV31?.[0]?.cvssData;
        const metricsV30 = vuln.metrics?.cvssMetricV30?.[0]?.cvssData;
        const metricsV2 = vuln.metrics?.cvssMetricV2?.[0]?.cvssData;
        const v3Data = metricsV31 ?? metricsV30;
        const detail = {
            id: normalized,
            description: vuln.descriptions?.find((d) => d.lang === 'en')?.value ?? '',
            cvssV3Score: v3Data?.baseScore ?? null,
            cvssV3Severity: v3Data?.baseSeverity ?? null,
            cvssV2Score: metricsV2?.baseScore ?? null,
            publishedDate: vuln.published ?? '',
            lastModifiedDate: vuln.lastModified ?? '',
            references: (vuln.references ?? []).map((r) => r.url).slice(0, 5),
            cweIds: (vuln.weaknesses ?? [])
                .flatMap((w) => w.description)
                .map((d) => d.value)
                .filter((v) => v.startsWith('CWE-')),
        };
        CACHE.set(normalized, detail);
        return detail;
    }
    catch {
        CACHE.set(normalized, null);
        return null;
    }
}
/**
 * Map CVSS score to our internal severity label
 */
export function cvssToSeverity(score) {
    if (score === null)
        return 'unknown';
    if (score >= 9.0)
        return 'critical';
    if (score >= 7.0)
        return 'high';
    if (score >= 4.0)
        return 'medium';
    if (score >= 0.1)
        return 'low';
    return 'info';
}
