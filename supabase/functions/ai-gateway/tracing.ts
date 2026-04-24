/**
 * W3C Trace Context (traceparent) implementation for the AI Gateway.
 *
 * Spec: https://www.w3.org/TR/trace-context/
 * Format: 00-{traceId:32hex}-{spanId:16hex}-{flags:2hex}
 *
 * Compatible with: Jaeger, Zipkin, Datadog APM, AWS X-Ray, OpenTelemetry Collector.
 */

/** Incoming/outgoing W3C trace context for a single request. */
export type TraceContext = {
  /** 128-bit trace ID as 32 lowercase hex characters. */
  traceId: string;
  /** 64-bit parent span ID as 16 lowercase hex characters. */
  spanId: string;
  /** 64-bit span ID of the upstream caller, if present. */
  parentSpanId: string | null;
  /** Whether this trace is sampled (flags bit 0). */
  sampled: boolean;
};

const TRACEPARENT_HEADER = 'traceparent';
const TRACESTATE_HEADER = 'tracestate';

/**
 * Produce a cryptographically random hex string of the given byte count.
 * Returns a string of length `byteCount * 2`.
 */
function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Generate a 128-bit trace ID (32 hex chars). */
export function generateTraceId(): string {
  return randomHex(16);
}

/** Generate a 64-bit span ID (16 hex chars). */
export function generateSpanId(): string {
  return randomHex(8);
}

/**
 * Parse a W3C `traceparent` header value.
 * Returns null if the value is missing, malformed, or uses an unsupported version.
 *
 * Expected format: `00-{traceId:32hex}-{parentSpanId:16hex}-{flags:2hex}`
 */
export function parseTraceparent(traceparent: string | null | undefined): {
  traceId: string;
  parentSpanId: string;
  sampled: boolean;
} | null {
  if (!traceparent) return null;

  const parts = traceparent.trim().split('-');
  // Must have exactly 4 parts for version 00
  if (parts.length !== 4) return null;

  const [version, traceId, parentSpanId, flags] = parts;

  // Only version 00 is supported
  if (version !== '00') return null;

  // Validate field lengths and hex format
  if (!/^[0-9a-f]{32}$/.test(traceId)) return null;
  if (!/^[0-9a-f]{16}$/.test(parentSpanId)) return null;
  if (!/^[0-9a-f]{2}$/.test(flags)) return null;

  // All-zeros trace ID is invalid per spec
  if (traceId === '0'.repeat(32)) return null;
  // All-zeros span ID is invalid per spec
  if (parentSpanId === '0'.repeat(16)) return null;

  const sampled = (parseInt(flags, 16) & 1) === 1;

  return { traceId, parentSpanId, sampled };
}

/**
 * Extract W3C trace context from an incoming request.
 * If `traceparent` is present and valid, creates a child span under the incoming trace.
 * Otherwise generates a new root trace context.
 */
export function extractTraceContext(req: Request): TraceContext {
  const traceparentHeader = req.headers.get(TRACEPARENT_HEADER);
  const parsed = parseTraceparent(traceparentHeader);

  if (parsed) {
    return {
      traceId: parsed.traceId,
      spanId: generateSpanId(),
      parentSpanId: parsed.parentSpanId,
      sampled: parsed.sampled,
    };
  }

  // No valid upstream trace — start a new root trace
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: null,
    sampled: true,
  };
}

/**
 * Serialize a TraceContext into a W3C `traceparent` header value.
 * Format: `00-{traceId}-{spanId}-{flags}`
 */
export function buildTraceparent(ctx: TraceContext): string {
  const flags = ctx.sampled ? '01' : '00';
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Inject trace context headers into an existing headers object (for downstream calls).
 * Sets `traceparent` (and clears any stale `tracestate` to avoid stale vendor data).
 */
export function injectTraceContext(
  headers: Record<string, string>,
  ctx: TraceContext,
): Record<string, string> {
  return {
    ...headers,
    [TRACEPARENT_HEADER]: buildTraceparent(ctx),
    [TRACESTATE_HEADER]: '',
  };
}

/**
 * Build a child TraceContext for a downstream span (same traceId, new spanId).
 */
export function buildChildSpan(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: generateSpanId(),
    parentSpanId: parent.spanId,
    sampled: parent.sampled,
  };
}
