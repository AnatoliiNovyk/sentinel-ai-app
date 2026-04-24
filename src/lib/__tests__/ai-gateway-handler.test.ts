import { beforeEach, describe, expect, it } from 'vitest';
import { handleAiGatewayRequest } from '../../../supabase/functions/ai-gateway/handler';
import { resetGatewayRateLimitStoreForTests } from '../../../supabase/functions/ai-gateway/rateLimit';

describe('ai-gateway handler', () => {
  beforeEach(() => {
    resetGatewayRateLimitStoreForTests();
  });

  it('returns 405 for non-POST method with safe error payload', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'GET',
      headers: {
        'x-forwarded-for': '198.51.100.10',
      },
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(405);
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
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.11',
      },
      body: '{"messages": [invalid]}',
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(400);
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
    expect(body).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload is too large.',
      },
    });
  });

  it('returns 429 when rate limit is exceeded', async () => {
    for (let i = 0; i < 30; i++) {
      const req = new Request('https://example.com/functions/v1/ai-gateway', {
        method: 'POST',
        headers: {
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
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.13',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
    });

    const blockedRes = await handleAiGatewayRequest(blockedReq);
    const blockedBody = await blockedRes.json();

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('Retry-After')).toBeTruthy();
    expect(blockedBody).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please retry later.',
      },
    });
  });
});
