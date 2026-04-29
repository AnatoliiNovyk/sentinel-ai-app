import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAiGatewayRequest } from '../../../supabase/functions/ai-gateway/handler';
import { resetGatewayRateLimitStoreForTests } from '../../../supabase/functions/ai-gateway/rateLimit';

describe('ai-gateway handler', () => {
  beforeEach(() => {
    resetGatewayRateLimitStoreForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 405 for unsupported method with safe error payload', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'PUT',
      headers: {
        'x-forwarded-for': '198.51.100.10',
      },
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(405);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    expect(body).toEqual({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed.',
      },
    });
  });

  it('returns 400 for invalid JSON with safe error payload', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.11',
      },
      body: '{"messages": [invalid]}',
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    expect(body).toEqual({
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON body.',
      },
    });
  });

  it('returns 413 for payload too large', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.12',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'a'.repeat(110_000) }],
      }),
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    expect(body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large.',
      },
    });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    // Default rate limit is 30 req/min. Send 31 requests to trigger blocking.
    for (let i = 0; i < 31; i++) {
      const req = new Request('https://example.com/functions/v1/ai-gateway', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
          'x-forwarded-for': '198.51.100.13',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
      });
      await handleAiGatewayRequest(req);
    }

    const blockedReq = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.13',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
    });

    const blockedRes = await handleAiGatewayRequest(blockedReq);
    const blockedBody = await blockedRes.json();

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('Retry-After')).toBeTruthy();
    expect(blockedRes.headers.get('X-Request-Id')).toBeTruthy();
    expect(blockedBody).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please retry later.',
      },
    });
  });

  it('returns 401 when authorization header is missing', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.14',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization Bearer token is required.',
      },
    });
  });

  it('returns 401 when authorization scheme is not Bearer', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Basic abc123',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.15',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization Bearer token is required.',
      },
    });
  });

  it('applies security headers on JSON responses', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.16',
      },
      body: '{"messages": [invalid]}',
    });

    const res = await handleAiGatewayRequest(req);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Request-Id')).toBeTruthy();
  });

  it('preserves incoming x-request-id when valid', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.17',
        'x-request-id': 'client.req-12345',
      },
      body: '{"messages": [invalid]}',
    });

    const res = await handleAiGatewayRequest(req);

    expect(res.headers.get('X-Request-Id')).toBe('client.req-12345');
  });

  it('generates x-request-id when incoming one is invalid', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.18',
        'x-request-id': 'bad id with spaces',
      },
      body: '{"messages": [invalid]}',
    });

    const res = await handleAiGatewayRequest(req);
    const generated = res.headers.get('X-Request-Id') ?? '';

    expect(generated).toMatch(/^req-/);
    expect(generated.length).toBeGreaterThan(10);
  });

  it('probes agent health via action=agent_health_probe', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'ok', jobsProcessed: 5 }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.19',
      },
      body: JSON.stringify({
        action: 'agent_health_probe',
        url: 'http://95.67.75.146:9090/health',
      }),
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe('agent_health_probe');
    expect(body.reachable).toBe(true);
    expect(body.http_status).toBe(200);
    expect(body.health).toEqual({ status: 'ok', jobsProcessed: 5 });
  });

  it('blocks private host probe targets', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.20',
      },
      body: JSON.stringify({
        action: 'agent_health_probe',
        url: 'http://127.0.0.1:9090/health',
      }),
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.action).toBe('agent_health_probe');
    expect(body.reachable).toBe(false);
    expect(body.error).toContain('not allowed');
  });
});
