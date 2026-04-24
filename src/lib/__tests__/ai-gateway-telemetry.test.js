import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAiGatewayRecentEventsSnapshot, getAiGatewayTelemetrySnapshot, handleAiGatewayRequest, resetAiGatewayTelemetryForTests, } from '../../../supabase/functions/ai-gateway/handler';
import { resetGatewayRateLimitStoreForTests } from '../../../supabase/functions/ai-gateway/rateLimit';
describe('ai-gateway telemetry', () => {
    beforeEach(() => {
        resetGatewayRateLimitStoreForTests();
        resetAiGatewayTelemetryForTests();
    });
    afterEach(() => {
        vi.restoreAllMocks();
        const runtime = globalThis;
        delete runtime.Deno;
    });
    it('increments unauthorized_count for missing auth', async () => {
        const req = new Request('https://example.com/functions/v1/ai-gateway', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-forwarded-for': '198.51.100.20',
            },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
        });
        const res = await handleAiGatewayRequest(req);
        expect(res.status).toBe(401);
        expect(getAiGatewayTelemetrySnapshot().unauthorized_count).toBe(1);
    });
    it('increments invalid_json_count for malformed JSON', async () => {
        const req = new Request('https://example.com/functions/v1/ai-gateway', {
            method: 'POST',
            headers: {
                authorization: 'Bearer test-token',
                'content-type': 'application/json',
                'x-forwarded-for': '198.51.100.21',
            },
            body: '{"messages": [invalid]}',
        });
        const res = await handleAiGatewayRequest(req);
        expect(res.status).toBe(400);
        expect(getAiGatewayTelemetrySnapshot().invalid_json_count).toBe(1);
    });
    it('increments payload_too_large_count for oversized body', async () => {
        const req = new Request('https://example.com/functions/v1/ai-gateway', {
            method: 'POST',
            headers: {
                authorization: 'Bearer test-token',
                'content-type': 'application/json',
                'x-forwarded-for': '198.51.100.22',
            },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'a'.repeat(110000) }] }),
        });
        const res = await handleAiGatewayRequest(req);
        expect(res.status).toBe(413);
        expect(getAiGatewayTelemetrySnapshot().payload_too_large_count).toBe(1);
    });
    it('increments rate_limited_count when requests exceed window limit', async () => {
        for (let i = 0; i < 30; i++) {
            const req = new Request('https://example.com/functions/v1/ai-gateway', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer test-token',
                    'content-type': 'application/json',
                    'x-forwarded-for': '198.51.100.23',
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
                'x-forwarded-for': '198.51.100.23',
            },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
        });
        const blockedRes = await handleAiGatewayRequest(blockedReq);
        expect(blockedRes.status).toBe(429);
        expect(getAiGatewayTelemetrySnapshot().rate_limited_count).toBe(1);
    });
    it('increments provider_fallback_count for successful mock fallback flow', async () => {
        const req = new Request('https://example.com/functions/v1/ai-gateway', {
            method: 'POST',
            headers: {
                authorization: 'Bearer test-token',
                'content-type': 'application/json',
                'x-forwarded-for': '198.51.100.24',
            },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'run audit' }] }),
        });
        const res = await handleAiGatewayRequest(req);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.provider).toBe('mock');
        expect(getAiGatewayTelemetrySnapshot().provider_fallback_count).toBe(1);
    });
    it('increments ai_invalid_json_count when kill-chain response is not valid JSON', async () => {
        const runtime = globalThis;
        runtime.Deno = {
            env: {
                get: (key) => (key === 'GEMINI_API_KEY' ? 'test-key' : undefined),
            },
        };
        vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => ({
                candidates: [{ content: { parts: [{ text: 'not-json' }] } }],
            }),
        });
        const req = new Request('https://example.com/functions/v1/ai-gateway', {
            method: 'POST',
            headers: {
                authorization: 'Bearer test-token',
                'content-type': 'application/json',
                'x-forwarded-for': '198.51.100.25',
            },
            body: JSON.stringify({
                action: 'generate_kill_chain',
                project: 'Acme',
                vulnerabilities: [{ title: 'Open S3 bucket' }],
            }),
        });
        const res = await handleAiGatewayRequest(req);
        expect(res.status).toBe(502);
        expect(getAiGatewayTelemetrySnapshot().ai_invalid_json_count).toBe(1);
    });
    it('keeps only last 50 recent events and returns safe event shape', async () => {
        for (let i = 0; i < 60; i++) {
            const req = new Request('https://example.com/functions/v1/ai-gateway', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-forwarded-for': `198.51.100.${100 + (i % 10)}`,
                },
                body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
            });
            await handleAiGatewayRequest(req);
        }
        const recentEvents = getAiGatewayRecentEventsSnapshot(50);
        expect(recentEvents).toHaveLength(50);
        expect(recentEvents.every((event) => event.event_type === 'unauthorized')).toBe(true);
        expect(recentEvents.every((event) => event.status_code === 401)).toBe(true);
        const serialized = JSON.stringify(recentEvents);
        expect(serialized).not.toContain('authorization');
        expect(serialized).not.toContain('Bearer');
        expect(serialized).not.toContain('messages');
    });
});
