/**
 * F-16: Threat Intelligence Integration
 * Uses VirusTotal API for reputation scoring and AlienVault OTX (optional)
 * Free API is limited to 4 requests/min, so we only fetch when explicitly requested
 * or we cache aggressively.
 */

export type ThreatIntelResult = {
  positives: number;
  total: number;
  tags: string[];
  owner: string;
  country: string;
  reputation: number;
  lastAnalysis: string;
  source: 'virustotal';
};

const VT_CACHE = new Map<string, ThreatIntelResult>();

export async function fetchThreatIntel(asset: string): Promise<ThreatIntelResult | null> {
  // Extract IP or Domain from asset string (e.g. "8.8.8.8" or "example.com:443" -> "example.com")
  const target = asset.split(':')[0].trim();
  if (!target || target.startsWith('10.') || target.startsWith('192.168.') || target.startsWith('127.')) {
    return null; // Skip private IPs
  }

  if (VT_CACHE.has(target)) return VT_CACHE.get(target)!;

  const apiKey = import.meta.env.VITE_VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    console.warn('[ThreatIntel] VITE_VIRUSTOTAL_API_KEY is not set');
    return null;
  }

  // Determine if IP or Domain
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(target);
  const endpoint = isIp ? `ip_addresses/${target}` : `domains/${target}`;

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/${endpoint}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      if (res.status === 404) return null; // Clean/unknown
      throw new Error(`VT API error: ${res.status}`);
    }

    const { data } = await res.json();
    const attrs = data.attributes;
    const stats = attrs.last_analysis_stats || { malicious: 0, suspicious: 0, undetected: 0 };
    
    const result: ThreatIntelResult = {
      positives: (stats.malicious || 0) + (stats.suspicious || 0),
      total: Object.values(stats).reduce((a: any, b: any) => a + b, 0) as number,
      tags: attrs.tags || [],
      owner: attrs.as_owner || attrs.registrar || 'Unknown',
      country: attrs.country || '—',
      reputation: attrs.reputation || 0,
      lastAnalysis: new Date((attrs.last_analysis_date || Date.now() / 1000) * 1000).toISOString(),
      source: 'virustotal',
    };

    VT_CACHE.set(target, result);
    return result;
  } catch (err) {
    console.warn('[ThreatIntel] Error fetching from VirusTotal:', err);
    return null;
  }
}
