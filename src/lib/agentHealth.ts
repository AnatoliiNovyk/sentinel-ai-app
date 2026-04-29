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

async function probeViaGateway(url: string): Promise<AgentProbeResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!supabaseUrl || !anonKey) {
    return {
      reachable: false,
      statusCode: null,
      health: null,
      error: 'Gateway probe unavailable: missing Supabase env configuration.',
      via: 'gateway',
    };
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

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = typeof body?.error?.message === 'string'
        ? body.error.message
        : `Gateway probe HTTP ${res.status}`;
      return {
        reachable: false,
        statusCode: res.status,
        health: null,
        error: message,
        via: 'gateway',
      };
    }

    return {
      reachable: Boolean(body?.reachable),
      statusCode: typeof body?.http_status === 'number' ? body.http_status : null,
      health: body?.health ?? null,
      error: typeof body?.error === 'string' ? body.error : null,
      via: 'gateway',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gateway probe request failed.';
    return {
      reachable: false,
      statusCode: null,
      health: null,
      error: message,
      via: 'gateway',
    };
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
      if (gatewayFallback.reachable) {
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
  return gatewayProbe;
}
