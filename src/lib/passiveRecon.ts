/**
 * F-03: Passive Reconnaissance via Shodan & Censys APIs
 * Shodan: https://api.shodan.io
 * Censys: https://search.censys.io/api
 */

export type ShodanHostInfo = {
  ip: string;
  hostnames: string[];
  country_name: string;
  city: string;
  org: string;
  isp: string;
  os: string | null;
  ports: number[];
  vulns: string[];
  services: {
    port: number;
    proto: string;
    product: string;
    version: string;
    banner?: string;
    cpe?: string[];
  }[];
  last_update: string;
  asn: string;
};

export type ShodanDnsResult = {
  subdomains: string[];
  hostnames: string[];
  ips: string[];
};

export type CensysHostInfo = {
  ip: string;
  services: {
    port: number;
    service_name: string;
    transport_protocol: string;
    certificate?: { subject_dn: string; issuer_dn: string; validity: { start: string; end: string } };
  }[];
  location: {
    country: string;
    city: string;
    coordinates?: { latitude: number; longitude: number };
  };
  autonomous_system: { name: string; asn: number; bgp_prefix: string };
};

/** Lookup a host by IP on Shodan */
export async function shodanLookupHost(ip: string, apiKey: string): Promise<ShodanHostInfo> {
  const res = await fetch(
    `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(apiKey)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (res.status === 401) throw new Error('Invalid Shodan API key');
  if (res.status === 404) throw new Error(`Host ${ip} not found in Shodan`);
  if (res.status === 429) throw new Error('Shodan rate limit — wait 1 second');
  if (!res.ok) throw new Error(`Shodan error: ${res.status}`);
  const d = await res.json();

  return {
    ip: d.ip_str ?? ip,
    hostnames: d.hostnames ?? [],
    country_name: d.country_name ?? '—',
    city: d.city ?? '—',
    org: d.org ?? '—',
    isp: d.isp ?? '—',
    os: d.os ?? null,
    ports: d.ports ?? [],
    vulns: Object.keys(d.vulns ?? {}),
    asn: d.asn ?? '—',
    last_update: d.last_update ?? '',
    services: (d.data ?? []).map((s: any) => ({
      port: s.port,
      proto: s.transport ?? 'tcp',
      product: s.product ?? '',
      version: s.version ?? '',
      banner: s.banner?.slice(0, 200),
      cpe: s.cpe ?? [],
    })),
  };
}

/** DNS lookup / subdomain enumeration via Shodan DNS API */
export async function shodanDnsLookup(domain: string, apiKey: string): Promise<ShodanDnsResult> {
  const [subRes, resolveRes] = await Promise.allSettled([
    fetch(`https://api.shodan.io/dns/domain/${encodeURIComponent(domain)}?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(10000) }),
    fetch(`https://api.shodan.io/dns/resolve?hostnames=${encodeURIComponent(domain)}&key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(10000) }),
  ]);

  const subdomains: string[] = [];
  const ips: string[] = [];

  if (subRes.status === 'fulfilled' && subRes.value.ok) {
    const d = await subRes.value.json();
    subdomains.push(...(d.subdomains ?? []).slice(0, 50));
  }
  if (resolveRes.status === 'fulfilled' && resolveRes.value.ok) {
    const d = await resolveRes.value.json();
    ips.push(...Object.values(d).filter(Boolean) as string[]);
  }

  return { subdomains, hostnames: subdomains.map(s => `${s}.${domain}`), ips };
}

/** Lookup host info via Censys Search API */
export async function censysLookupHost(ip: string, apiId: string, apiSecret: string): Promise<CensysHostInfo> {
  const creds = btoa(`${apiId}:${apiSecret}`);
  const res = await fetch(`https://search.censys.io/api/v2/hosts/${encodeURIComponent(ip)}`, {
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (res.status === 401) throw new Error('Invalid Censys credentials');
  if (res.status === 404) throw new Error(`Host ${ip} not found in Censys`);
  if (!res.ok) throw new Error(`Censys error: ${res.status}`);
  const d = (await res.json()).result ?? {};
  return {
    ip: d.ip ?? ip,
    services: (d.services ?? []).map((s: any) => ({
      port: s.port,
      service_name: s.service_name ?? s._decoded ?? 'unknown',
      transport_protocol: s.transport_protocol ?? 'TCP',
      certificate: s.tls?.certificates?.leaf_data ? {
        subject_dn: s.tls.certificates.leaf_data.subject_dn ?? '',
        issuer_dn: s.tls.certificates.leaf_data.issuer_dn ?? '',
        validity: s.tls.certificates.leaf_data.validity ?? {},
      } : undefined,
    })),
    location: {
      country: d.location?.country ?? '—',
      city: d.location?.city ?? '—',
      coordinates: d.location?.coordinates,
    },
    autonomous_system: {
      name: d.autonomous_system?.name ?? '—',
      asn: d.autonomous_system?.asn ?? 0,
      bgp_prefix: d.autonomous_system?.bgp_prefix ?? '—',
    },
  };
}

/** Convert Shodan service list to vulnerability-like findings */
export function shodanToFindings(host: ShodanHostInfo): { title: string; severity: string; asset: string; cve_id: string; description: string }[] {
  const findings: { title: string; severity: string; asset: string; cve_id: string; description: string }[] = [];
  
  // Known dangerous ports
  const dangerousPorts: Record<number, { title: string; severity: string }> = {
    21: { title: 'FTP exposed', severity: 'high' },
    23: { title: 'Telnet exposed (unencrypted)', severity: 'critical' },
    445: { title: 'SMB/CIFS exposed', severity: 'critical' },
    3389: { title: 'RDP exposed', severity: 'critical' },
    1433: { title: 'MSSQL exposed', severity: 'high' },
    3306: { title: 'MySQL exposed', severity: 'high' },
    5432: { title: 'PostgreSQL exposed', severity: 'high' },
    27017: { title: 'MongoDB exposed', severity: 'critical' },
    6379: { title: 'Redis exposed (no auth)', severity: 'critical' },
    9200: { title: 'Elasticsearch exposed', severity: 'critical' },
    8080: { title: 'HTTP alternative port exposed', severity: 'medium' },
    2375: { title: 'Docker daemon exposed', severity: 'critical' },
    8443: { title: 'HTTPS alternative port exposed', severity: 'low' },
  };

  for (const port of host.ports) {
    const known = dangerousPorts[port];
    if (known) {
      findings.push({
        title: known.title,
        severity: known.severity,
        asset: `${host.ip}:${port}`,
        cve_id: '',
        description: `Port ${port} is publicly accessible on ${host.ip} (${host.org}). Exposed via Shodan passive recon.`,
      });
    }
  }
  // Add CVEs from Shodan's vuln data
  for (const cve of host.vulns.slice(0, 10)) {
    findings.push({
      title: `Known vulnerability: ${cve}`,
      severity: 'high',
      asset: host.ip,
      cve_id: cve,
      description: `${host.ip} is listed in Shodan as vulnerable to ${cve}. Verify and patch immediately.`,
    });
  }
  return findings;
}
