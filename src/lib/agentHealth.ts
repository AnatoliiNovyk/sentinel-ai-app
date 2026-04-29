export type AgentProbeResult = {
  reachable: boolean;
  statusCode: number | null;
  health: unknown | null;
  error: string | null;
  via: 'direct' | 'gateway';
};

export function isMixedContentAgentUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return window.location.protocol === 'https:' && parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isHttpsAgentUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function probeViaGateway(url: string): Promise<AgentProbeResult | null> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ action: 'agent_health_probe', url }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      return null;
    }

    const body = await res.json();
    return {
      reachable: Boolean(body?.reachable),
      statusCode: typeof body?.http_status === 'number' ? body.http_status : null,
      health: body?.health ?? null,
      error: typeof body?.error === 'string' ? body.error : null,
      via: 'gateway',
    };
  } catch {
    return null;
  }
}

export async function probeAgentHealth(url: string): Promise<AgentProbeResult> {
  const normalizedUrl = url.trim();

  const shouldSkipDirectFetch = isMixedContentAgentUrl(normalizedUrl);
  if (!shouldSkipDirectFetch) {
    try {
      const res = await fetch(normalizedUrl, { signal: AbortSignal.timeout(6_000) });
      let health: unknown | null = null;
      try {
        health = await res.json();
      } catch {
        health = null;
      }
      return {
        reachable: res.ok,
        statusCode: res.status,
        health,
        error: res.ok ? null : `HTTP ${res.status}`,
        via: 'direct',
      };
    } catch (err) {
      const gatewayFallback = await probeViaGateway(normalizedUrl);
      if (gatewayFallback) {
        return gatewayFallback;
      }

      const message = err instanceof Error ? err.message : 'Unreachable';
      return {
        reachable: false,
        statusCode: null,
        health: null,
        error: message,
        via: 'direct',
      };
    }
  }

  const gatewayProbe = await probeViaGateway(normalizedUrl);
  if (gatewayProbe) {
    return gatewayProbe;
  }

  return {
    reachable: false,
    statusCode: null,
    health: null,
    error: 'Blocked by browser policy: HTTPS app cannot fetch HTTP agent URL. Configure HTTPS/reverse-proxy for the agent endpoint.',
    via: 'direct',
  };
}
