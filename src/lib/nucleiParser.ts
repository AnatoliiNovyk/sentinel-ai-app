/**
 * Pure nuclei JSONL output parser — no side effects, no external deps.
 * Mirrors the logic in sentinel-agent/src/index.ts so it can be unit-tested
 * inside the front-end test suite (vitest).
 */

export type NucleiFinding = {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  asset: string;
  remediation: string;
  remediation_type: 'patch';
  status: 'open';
};

export function nucleiSeverityMap(raw: string): NucleiFinding['severity'] {
  switch (raw.toLowerCase()) {
    case 'critical': return 'critical';
    case 'high':     return 'high';
    case 'medium':   return 'medium';
    case 'low':      return 'low';
    default:         return 'info';
  }
}

/**
 * Parses nuclei JSONL output (one JSON object per line).
 * Returns at least one finding (info-level placeholder) when output is empty.
 */
export function parseNucleiOutput(output: string, target: string): NucleiFinding[] {
  const findings: NucleiFinding[] = [];

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('{')) continue;

    try {
      const entry = JSON.parse(trimmed) as {
        'template-id'?: string;
        info?: { name?: string; severity?: string; description?: string; reference?: string[] };
        'matched-at'?: string;
        host?: string;
        type?: string;
      };

      const name        = entry.info?.name ?? entry['template-id'] ?? 'Unknown finding';
      const severity    = nucleiSeverityMap(entry.info?.severity ?? 'info');
      const description = entry.info?.description ?? `Nuclei template matched on ${entry['matched-at'] ?? target}`;
      const matchedAt   = entry['matched-at'] ?? target;
      const reference   = entry.info?.reference?.[0];

      findings.push({
        title: name,
        description: `${description}\nMatched at: ${matchedAt}`,
        severity,
        asset: target,
        remediation: reference
          ? `See: ${reference}`
          : 'Review and patch the identified vulnerability based on template guidance.',
        remediation_type: 'patch',
        status: 'open',
      });
    } catch {
      // skip malformed lines
    }
  }

  if (findings.length === 0) {
    findings.push({
      title: 'No vulnerabilities detected by Nuclei',
      description: `Nuclei scan of ${target} completed. No template matches found.`,
      severity: 'info',
      asset: target,
      remediation: 'No action required.',
      remediation_type: 'patch',
      status: 'open',
    });
  }

  return findings;
}
