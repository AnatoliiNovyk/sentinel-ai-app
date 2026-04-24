import { describe, expect, it } from 'vitest';
import {
  generateTraceId,
  generateSpanId,
  parseTraceparent,
  extractTraceContext,
  buildTraceparent,
  injectTraceContext,
  buildChildSpan,
} from '../../../supabase/functions/ai-gateway/tracing';

describe('generateTraceId', () => {
  it('returns a 32-character lowercase hex string', () => {
    const id = generateTraceId();
    expect(id).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(id)).toBe(true);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
    expect(ids.size).toBe(100);
  });
});

describe('generateSpanId', () => {
  it('returns a 16-character lowercase hex string', () => {
    const id = generateSpanId();
    expect(id).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(id)).toBe(true);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSpanId()));
    expect(ids.size).toBe(100);
  });
});

describe('parseTraceparent', () => {
  const validTraceId = 'a'.repeat(32);
  const validSpanId = 'b'.repeat(16);

  it('parses a valid sampled traceparent', () => {
    const result = parseTraceparent(`00-${validTraceId}-${validSpanId}-01`);
    expect(result).not.toBeNull();
    expect(result?.traceId).toBe(validTraceId);
    expect(result?.parentSpanId).toBe(validSpanId);
    expect(result?.sampled).toBe(true);
  });

  it('parses a valid non-sampled traceparent', () => {
    const result = parseTraceparent(`00-${validTraceId}-${validSpanId}-00`);
    expect(result).not.toBeNull();
    expect(result?.sampled).toBe(false);
  });

  it('returns null for null input', () => {
    expect(parseTraceparent(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseTraceparent(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTraceparent('')).toBeNull();
  });

  it('returns null for wrong number of segments', () => {
    expect(parseTraceparent(`00-${validTraceId}-${validSpanId}`)).toBeNull();
    expect(parseTraceparent(`00-${validTraceId}-${validSpanId}-01-extra`)).toBeNull();
  });

  it('returns null for unsupported version', () => {
    expect(parseTraceparent(`01-${validTraceId}-${validSpanId}-01`)).toBeNull();
    expect(parseTraceparent(`ff-${validTraceId}-${validSpanId}-01`)).toBeNull();
  });

  it('returns null for invalid trace ID length', () => {
    expect(parseTraceparent(`00-${validTraceId.slice(0, 16)}-${validSpanId}-01`)).toBeNull();
  });

  it('returns null for invalid span ID length', () => {
    expect(parseTraceparent(`00-${validTraceId}-${validSpanId.slice(0, 8)}-01`)).toBeNull();
  });

  it('returns null for non-hex characters in trace ID', () => {
    const badTraceId = 'z'.repeat(32);
    expect(parseTraceparent(`00-${badTraceId}-${validSpanId}-01`)).toBeNull();
  });

  it('returns null for all-zeros trace ID (spec invalid)', () => {
    expect(parseTraceparent(`00-${'0'.repeat(32)}-${validSpanId}-01`)).toBeNull();
  });

  it('returns null for all-zeros span ID (spec invalid)', () => {
    expect(parseTraceparent(`00-${validTraceId}-${'0'.repeat(16)}-01`)).toBeNull();
  });
});

describe('extractTraceContext', () => {
  it('creates a new root trace context when no traceparent header', () => {
    const req = new Request('https://example.com/', { method: 'POST' });
    const ctx = extractTraceContext(req);

    expect(ctx.traceId).toHaveLength(32);
    expect(ctx.spanId).toHaveLength(16);
    expect(ctx.parentSpanId).toBeNull();
    expect(ctx.sampled).toBe(true);
  });

  it('creates a child span from a valid upstream traceparent', () => {
    const traceId = 'c'.repeat(32);
    const upstreamSpanId = 'd'.repeat(16);
    const req = new Request('https://example.com/', {
      method: 'POST',
      headers: { traceparent: `00-${traceId}-${upstreamSpanId}-01` },
    });
    const ctx = extractTraceContext(req);

    expect(ctx.traceId).toBe(traceId);
    expect(ctx.spanId).toHaveLength(16);
    expect(ctx.spanId).not.toBe(upstreamSpanId);
    expect(ctx.parentSpanId).toBe(upstreamSpanId);
    expect(ctx.sampled).toBe(true);
  });

  it('falls back to new root trace when traceparent is invalid', () => {
    const req = new Request('https://example.com/', {
      method: 'POST',
      headers: { traceparent: 'invalid-garbage' },
    });
    const ctx = extractTraceContext(req);

    expect(ctx.traceId).toHaveLength(32);
    expect(ctx.parentSpanId).toBeNull();
  });

  it('propagates sampled=false from upstream', () => {
    const traceId = 'e'.repeat(32);
    const spanId = 'f'.repeat(16);
    const req = new Request('https://example.com/', {
      method: 'POST',
      headers: { traceparent: `00-${traceId}-${spanId}-00` },
    });
    const ctx = extractTraceContext(req);
    expect(ctx.sampled).toBe(false);
  });
});

describe('buildTraceparent', () => {
  it('serializes a sampled context to correct format', () => {
    const traceId = '1'.repeat(32);
    const spanId = '2'.repeat(16);
    const tp = buildTraceparent({ traceId, spanId, parentSpanId: null, sampled: true });
    expect(tp).toBe(`00-${traceId}-${spanId}-01`);
  });

  it('serializes a non-sampled context with flags 00', () => {
    const traceId = '3'.repeat(32);
    const spanId = '4'.repeat(16);
    const tp = buildTraceparent({ traceId, spanId, parentSpanId: null, sampled: false });
    expect(tp).toBe(`00-${traceId}-${spanId}-00`);
  });
});

describe('injectTraceContext', () => {
  it('adds traceparent to headers', () => {
    const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), parentSpanId: null, sampled: true };
    const result = injectTraceContext({ 'Content-Type': 'application/json' }, ctx);
    expect(result['traceparent']).toBe(buildTraceparent(ctx));
    expect(result['Content-Type']).toBe('application/json');
  });

  it('clears tracestate to avoid stale vendor data', () => {
    const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), parentSpanId: null, sampled: true };
    const result = injectTraceContext({ tracestate: 'vendor=xyz' }, ctx);
    expect(result['tracestate']).toBe('');
  });

  it('does not mutate the original headers object', () => {
    const ctx = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), parentSpanId: null, sampled: true };
    const original = { 'Content-Type': 'application/json' };
    injectTraceContext(original, ctx);
    expect(original).not.toHaveProperty('traceparent');
  });
});

describe('buildChildSpan', () => {
  it('inherits traceId and sampled from parent', () => {
    const parent = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), parentSpanId: null, sampled: true };
    const child = buildChildSpan(parent);
    expect(child.traceId).toBe(parent.traceId);
    expect(child.sampled).toBe(parent.sampled);
  });

  it('generates a new spanId different from parent', () => {
    const parent = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), parentSpanId: null, sampled: true };
    const child = buildChildSpan(parent);
    expect(child.spanId).toHaveLength(16);
    expect(child.spanId).not.toBe(parent.spanId);
  });

  it('sets parentSpanId to the parent spanId', () => {
    const parent = { traceId: 'a'.repeat(32), spanId: 'c'.repeat(16), parentSpanId: null, sampled: false };
    const child = buildChildSpan(parent);
    expect(child.parentSpanId).toBe(parent.spanId);
  });
});

describe('handler integration: traceparent response header', () => {
  it('returns traceparent header in POST response', async () => {
    const { handleAiGatewayRequest } = await import('../../../supabase/functions/ai-gateway/handler');
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.99',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
    });
    const res = await handleAiGatewayRequest(req);
    const tp = res.headers.get('traceparent');
    expect(tp).not.toBeNull();
    expect(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/.test(tp!)).toBe(true);
  });

  it('propagates upstream trace ID in response traceparent', async () => {
    const { handleAiGatewayRequest } = await import('../../../supabase/functions/ai-gateway/handler');
    const upstreamTraceId = 'f'.repeat(32);
    const upstreamSpanId = 'e'.repeat(16);
    const req = new Request('https://example.com/functions/v1/ai-gateway', {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.98',
        traceparent: `00-${upstreamTraceId}-${upstreamSpanId}-01`,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'scan' }] }),
    });
    const res = await handleAiGatewayRequest(req);
    const tp = res.headers.get('traceparent');
    expect(tp).not.toBeNull();
    expect(tp!.startsWith(`00-${upstreamTraceId}-`)).toBe(true);
  });
});
