import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getAiGatewayTelemetrySnapshot,
  handleAiGatewayRequest,
  resetAiGatewayTelemetryForTests,
} from '../../../supabase/functions/ai-gateway/handler';
import { resetGatewayRateLimitStoreForTests } from '../../../supabase/functions/ai-gateway/rateLimit';

describe('ai-gateway admin metrics endpoint', () => {
  beforeEach(() => {
    resetGatewayRateLimitStoreForTests();
    resetAiGatewayTelemetryForTests();
  });

  afterEach(() => {
    const runtime = globalThis as unknown as {
      Deno?: { env?: { get: (key: string) => string | undefined } };
    };
    delete runtime.Deno;
  });

  it('returns 401 for GET metrics without valid admin key', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'GET',
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid admin key is required.',
      },
    });
  });

  it('returns telemetry snapshot for GET metrics with valid admin key', async () => {
    const runtime = globalThis as unknown as {
      Deno?: { env?: { get: (key: string) => string | undefined } };
    };
    runtime.Deno = {
      env: {
        get: (key: string) => {
          if (key === 'AI_GATEWAY_ADMIN_KEY') return 'admin-secret';
          if (key === 'AI_GATEWAY_VERSION') return 'test-v1';
          return undefined;
        },
      },
    };

    const setupReq = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
    });
    await handleAiGatewayRequest(setupReq);

    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'GET',
      headers: {
        'x-gateway-admin-key': 'admin-secret',
        'x-forwarded-for': '203.0.113.11',
      },
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.request_id).toBeTruthy();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime_ms).toBe('number');
    expect(body.uptime_ms).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe('string');
    expect(body.version).toBe('test-v1');
    expect(body.telemetry).toEqual(getAiGatewayTelemetrySnapshot());
    expect(body.telemetry.unauthorized_count).toBe(1);
    expect(Array.isArray(body.recent_events)).toBe(true);
    expect(body.recent_events.length).toBeGreaterThan(0);
    expect(body.recent_events[0].event_type).toBe('unauthorized');
    expect(body.recent_events[0].status_code).toBe(401);
    expect(body.event_rates).toBeTruthy();
    expect(body.event_rates.window_5m).toBeTruthy();
    expect(body.event_rates.window_15m).toBeTruthy();
    expect(body.event_rates.window_5m.total).toBeGreaterThanOrEqual(1);
    expect(body.event_rates.window_5m.by_type.unauthorized).toBeGreaterThanOrEqual(1);
    expect(body.alerts).toEqual({
      high_rate_limited_5m: false,
      high_unauthorized_5m: false,
      high_invalid_json_5m: false,
      degraded_mode: false,
    });
    expect(body.overall_risk_level).toBe('low');
    expect(Array.isArray(body.recommended_actions)).toBe(true);
    expect(body.recommended_actions.length).toBeGreaterThan(0);
    expect(body.recommended_actions[0].id).toBe('monitor-baseline');
    expect(body.recommended_actions[0].priority).toBe('low');

    const serialized = JSON.stringify(body.recent_events);
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('test-token');
  });

  it('sets alerts to true when thresholds are exceeded', async () => {
    const runtime = globalThis as unknown as {
      Deno?: { env?: { get: (key: string) => string | undefined } };
    };
    runtime.Deno = {
      env: {
        get: (key: string) => (key === 'AI_GATEWAY_ADMIN_KEY' ? 'admin-secret' : undefined),
      },
    };

    for (let i = 0; i < 5; i++) {
      const unauthorizedReq = new Request('https://example.com/functions/v1/ai-gateway', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': `203.0.113.${20 + i}`,
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
      });
      await handleAiGatewayRequest(unauthorizedReq);
    }

    for (let i = 0; i < 5; i++) {
      const invalidJsonReq = new Request('https://example.com/functions/v1/ai-gateway', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
          'x-forwarded-for': `203.0.113.${40 + i}`,
        },
        body: '{"messages": [invalid]}',
      });
      await handleAiGatewayRequest(invalidJsonReq);
    }

    for (let i = 0; i < 20; i++) {
      const fallbackReq = new Request('https://example.com/functions/v1/ai-gateway', {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
          'x-forwarded-for': `203.0.113.${60 + i}`,
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'run audit' }] }),
      });
      await handleAiGatewayRequest(fallbackReq);
    }

    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'GET',
      headers: {
        'x-gateway-admin-key': 'admin-secret',
      },
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alerts.high_unauthorized_5m).toBe(true);
    expect(body.alerts.high_invalid_json_5m).toBe(true);
    expect(body.alerts.degraded_mode).toBe(true);
    expect(body.alerts.high_rate_limited_5m).toBe(false);
    expect(body.overall_risk_level).toBe('high');
    expect(body.recommended_actions.length).toBeGreaterThan(0);
    expect(body.recommended_actions.length).toBeLessThanOrEqual(5);

    const actionIds = body.recommended_actions.map((item: { id: string }) => item.id);
    expect(actionIds).toContain('review-auth-clients');
    expect(actionIds).toContain('validate-client-payloads');
    expect(actionIds).toContain('check-provider-health');
    expect(actionIds).toContain('trigger-incident-triage');
  });

  it('does not change standard POST behavior with valid auth', async () => {
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.12',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan audit quickly' }] }),
    });

    const res = await handleAiGatewayRequest(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.provider).toBe('mock');
    expect(typeof body.content).toBe('string');
  });
});
