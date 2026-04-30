import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isMixedContentAgentUrl, isHttpsAgentUrl, probeAgentHealth } from '../agentHealth';

// ── supabase mock ─────────────────────────────────────────────────────────────

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock('../../api/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

// ── window.location helpers ───────────────────────────────────────────────────

function setWindowLocation(href: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new URL(href),
  });
}

// ── isMixedContentAgentUrl ────────────────────────────────────────────────────

describe('isMixedContentAgentUrl', () => {
  afterEach(() => {
    setWindowLocation('http://localhost');
  });

  it('returns true when page is https and agent url is http', () => {
    setWindowLocation('https://app.example.com');
    expect(isMixedContentAgentUrl('http://192.168.1.100:8080')).toBe(true);
  });

  it('returns false when page is http and agent url is http', () => {
    setWindowLocation('http://localhost');
    expect(isMixedContentAgentUrl('http://192.168.1.100:8080')).toBe(false);
  });

  it('returns false when page is https and agent url is also https', () => {
    setWindowLocation('https://app.example.com');
    expect(isMixedContentAgentUrl('https://agent.example.com')).toBe(false);
  });

  it('returns false for an invalid URL', () => {
    setWindowLocation('https://app.example.com');
    expect(isMixedContentAgentUrl('not-a-valid-url')).toBe(false);
  });

  it('returns false when URL constructor throws for malformed URL', () => {
    setWindowLocation('https://app.example.com');
    // 'http://[::1' has unclosed IPv6 bracket — WHATWG URL parser throws TypeError
    expect(isMixedContentAgentUrl('http://[::1')).toBe(false);
  });
});

// ── isHttpsAgentUrl ───────────────────────────────────────────────────────────

describe('isHttpsAgentUrl', () => {
  it('returns true for https URL', () => {
    expect(isHttpsAgentUrl('https://agent.example.com:8443')).toBe(true);
  });

  it('returns false for http URL', () => {
    expect(isHttpsAgentUrl('http://192.168.1.100:8080')).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(isHttpsAgentUrl('not-a-url')).toBe(false);
  });

  it('returns false when URL constructor throws for malformed URL', () => {
    // 'http://[::1' has unclosed IPv6 bracket — WHATWG URL parser throws TypeError
    expect(isHttpsAgentUrl('http://[::1')).toBe(false);
  });
});

// ── probeAgentHealth ──────────────────────────────────────────────────────────

describe('probeAgentHealth — direct fetch (http page → http agent)', () => {
  beforeEach(() => {
    setWindowLocation('http://localhost');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setWindowLocation('http://localhost');
  });

  it('returns reachable=true with status code on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.via).toBe('direct');
    expect(result.error).toBeNull();
  });

  it('returns reachable=false with HTTP error status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue(null),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.error).toBe('HTTP 503');
    expect(result.via).toBe('direct');
  });

  it('sets health to null when response json() throws', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('Non-JSON response')),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(true);
    expect(result.health).toBeNull();
    expect(result.statusCode).toBe(200);
    expect(result.via).toBe('direct');
  });

  it('falls back to gateway when fetch throws (network error)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
    vi.stubGlobal('fetch', mockFetch);

    mockInvoke.mockResolvedValue({
      data: { reachable: true, http_status: 200, health: { ok: true }, error: null },
      error: null,
    });

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(true);
    expect(result.via).toBe('gateway');
  });

  it('returns direct error when fetch fails and gateway is also unreachable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    mockInvoke.mockResolvedValue({
      data: { reachable: false, http_status: null, health: null, error: 'gateway timeout' },
      error: null,
    });

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(false);
    expect(result.error).toBe('Connection refused');
    expect(result.via).toBe('direct');
  });
});

describe('probeAgentHealth — forced gateway (mixed content: https page → http agent)', () => {
  beforeEach(() => {
    setWindowLocation('https://app.example.com');
  });

  afterEach(() => {
    setWindowLocation('http://localhost');
  });

  it('goes straight to gateway (no direct fetch)', async () => {
    mockInvoke.mockResolvedValue({
      data: { reachable: true, http_status: 200, health: { status: 'ok' }, error: null },
      error: null,
    });

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.via).toBe('gateway');
    expect(result.reachable).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: { action: 'agent_health_probe', url: 'http://192.168.1.100:8080/health' },
    });
  });

  it('returns reachable=false when gateway invoke returns error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Function invocation failed' },
    });

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(false);
    expect(result.via).toBe('gateway');
    expect(result.error).toBe('Function invocation failed');
  });

  it('uses fallback message when gateway error.message is empty', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: '' },
    });

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(false);
    expect(result.via).toBe('gateway');
    expect(result.error).toBe('Gateway probe request failed.');
  });

  it('handles gateway invoke throwing an exception', async () => {
    mockInvoke.mockRejectedValue(new Error('Edge function unreachable'));

    const result = await probeAgentHealth('http://192.168.1.100:8080/health');

    expect(result.reachable).toBe(false);
    expect(result.via).toBe('gateway');
    expect(result.error).toBe('Edge function unreachable');
  });
});
