import {
  gatewayError,
  isPayloadTooLarge,
  parseGatewayRequest,
  type ChatMessage,
} from './contract.ts';
import { checkGatewayRateLimit, extractClientKey } from './rateLimit.ts';
import { MemoryCache, generateKillChainCacheKey } from './cache.ts';
import { gzipCompress, shouldCompress } from './compression.ts';
import { buildPrometheusResponse, buildGatewayPrometheusMetrics, serializePrometheusMetrics } from './prometheus.ts';
import {
  extractTraceContext,
  buildTraceparent,
  injectTraceContext,
  buildChildSpan,
  type TraceContext,
} from './tracing.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

const REQUEST_ID_HEADER = 'X-Request-Id';
const ADMIN_KEY_HEADER = 'x-gateway-admin-key';
const GATEWAY_STARTED_AT_MS = Date.now();

type TelemetryMetric =
  | 'unauthorized_count'
  | 'invalid_json_count'
  | 'payload_too_large_count'
  | 'rate_limited_count'
  | 'provider_fallback_count'
  | 'ai_invalid_json_count'
  | 'response_compressed_count'
  | 'response_skipped_compression_count';

type TelemetryEventType =
  | 'unauthorized'
  | 'invalid_json'
  | 'payload_too_large'
  | 'rate_limited'
  | 'provider_fallback'
  | 'ai_invalid_json'
  | 'response_compressed'
  | 'response_skipped_compression';

type TelemetryRecentEvent = {
  timestamp: string;
  request_id: string;
  event_type: TelemetryEventType;
  status_code?: number;
};

type TelemetryEventRateWindow = {
  total: number;
  per_minute: number;
  by_type: Record<TelemetryEventType, number>;
};

type GatewayAlerts = {
  high_rate_limited_5m: boolean;
  high_unauthorized_5m: boolean;
  high_invalid_json_5m: boolean;
  degraded_mode: boolean;
};

type GatewayRiskLevel = 'low' | 'medium' | 'high';

type RecommendedAction = {
  id: string;
  priority: 'low' | 'medium' | 'high';
  action: string;
};

const METRIC_TO_EVENT_TYPE: Record<TelemetryMetric, TelemetryEventType> = {
  unauthorized_count: 'unauthorized',
  invalid_json_count: 'invalid_json',
  payload_too_large_count: 'payload_too_large',
  rate_limited_count: 'rate_limited',
  provider_fallback_count: 'provider_fallback',
  ai_invalid_json_count: 'ai_invalid_json',
  response_compressed_count: 'response_compressed',
  response_skipped_compression_count: 'response_skipped_compression',
};

const RECENT_EVENTS_BUFFER_SIZE = 50;
const RECENT_EVENTS_RESPONSE_LIMIT = 20;
const EVENT_RATE_WINDOWS_MINUTES = [5, 15] as const;

const ALERT_RATE_LIMITED_5M_MIN = 5;
const ALERT_UNAUTHORIZED_5M_MIN = 5;
const ALERT_INVALID_JSON_5M_MIN = 5;
const ALERT_DEGRADED_MIN_TOTAL_15M = 3;
const ALERT_DEGRADED_FALLBACK_RATIO_15M = 0.6;
const MEDIUM_RISK_MIN_TOTAL_EVENTS_15M = 10;
const MAX_RECOMMENDED_ACTIONS = 5;

const telemetryMetrics: Record<TelemetryMetric, number> = {
  unauthorized_count: 0,
  invalid_json_count: 0,
  payload_too_large_count: 0,
  rate_limited_count: 0,
  provider_fallback_count: 0,
  ai_invalid_json_count: 0,
  response_compressed_count: 0,
  response_skipped_compression_count: 0,
};

const telemetryRecentEvents: TelemetryRecentEvent[] = [];

// In-memory cache for expensive operations (e.g., kill-chain generation).
// TTL: 5 minutes (300,000 ms)
const killChainCache = new MemoryCache<unknown>(5 * 60 * 1000);

const SYSTEM_PROMPT = `You are Sentinel, an autonomous AI cybersecurity auditor agent.

Your role is to orchestrate infrastructure security audits. You can reason about:
- External attack surface scanning (Nmap, Masscan, Amass)
- Cloud security posture (Prowler, CloudSploit for AWS/GCP/Azure)
- Infrastructure as Code analysis (tfsec, Checkov)
- Vulnerability assessment (OpenVAS, CVE databases)

When a user describes a goal, you:
1. Pick the appropriate scanner toolkit.
2. Explain the plan concisely (steps, estimated duration).
3. Map findings to MITRE ATT&CK and CIS Controls.
4. Offer to generate executive summary or technical deep-dive reports.
5. Provide ready-to-apply remediation as Terraform or Kubernetes patches when relevant.

Keep responses clear, technical, and action-oriented. Use Markdown formatting (bold, bullet points, code blocks). Never invent data you don't have — describe what you would do.`;

async function callGemini(apiKey: string, messages: ChatMessage[], traceCtx?: TraceContext): Promise<string> {
  const userMessages = messages.filter((m) => m.role !== 'system');

  const contents = userMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const spanHeaders = traceCtx
    ? injectTraceContext({ 'Content-Type': 'application/json' }, buildChildSpan(traceCtx))
    : { 'Content-Type': 'application/json' };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: spanHeaders,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callAnthropic(apiKey: string, messages: ChatMessage[], traceCtx?: TraceContext): Promise<string> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const spanHeaders = traceCtx ? injectTraceContext(baseHeaders, buildChildSpan(traceCtx)) : baseHeaders;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: spanHeaders,
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.filter((m) => m.role !== 'system'),
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic error: ${res.status}`);
  }

  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}

async function callOpenAI(apiKey: string, messages: ChatMessage[], traceCtx?: TraceContext): Promise<string> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  const spanHeaders = traceCtx ? injectTraceContext(baseHeaders, buildChildSpan(traceCtx)) : baseHeaders;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: spanHeaders,
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI error: ${res.status}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

function mockResponse(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes('aws') || lower.includes('cloud')) {
    return `I'll initiate a **cloud security assessment**.\n\n**Plan:**\n1. Reconnaissance with Prowler and CloudSploit across IAM, S3, and security groups.\n2. IaC analysis via tfsec and Checkov on your Terraform modules.\n3. Compliance mapping to CIS AWS Foundations and SOC2.\n4. Prioritization by MITRE ATT&CK cloud tactics.\n\n**Estimated duration:** 12-18 minutes. Shall I proceed with a read-only scan?`;
  }
  if (lower.includes('scan') || lower.includes('audit') || lower.includes('pentest')) {
    return `I'll orchestrate an external audit using Amass for subdomain enumeration, Masscan for port discovery, Nmap for service fingerprinting, and OpenVAS for CVE correlation. Findings will be normalized and mapped to MITRE ATT&CK. Would you like an **executive summary** for leadership?`;
  }
  if (lower.includes('report')) {
    return `I can generate two tiers:\n- **Executive Summary** — business risk language, KPIs\n- **Technical Deep Dive** — per-finding remediation with Terraform/Kubernetes patches\n\nWhich one should I produce first?`;
  }
  if (lower.includes('kill_chain_mock')) {
    return JSON.stringify([
      {
        phase: 'Initial Access',
        tactic: 'TA0001',
        description: 'Attacker exploits external vuln',
        exploited_vuln: 'RCE',
        asset: 'Web Server',
      },
      {
        phase: 'Execution',
        tactic: 'TA0002',
        description: 'Attacker drops shell',
        exploited_vuln: 'Weak OS config',
        asset: 'Internal Net',
      },
    ]);
  }

  return `I'm **Sentinel**, your AI security auditor. I can orchestrate external, cloud, IaC, and vulnerability scans, map findings to MITRE ATT&CK and CIS Controls, and generate reports with ready-to-apply remediation.\n\nTry: *"Scan my AWS account for SOC2 compliance"*.`;
}

type CompressionMetrics = {
  response_original_bytes: number;
  response_compressed_bytes: number;
  compression_ratio: number;
};

const compressionMetrics: CompressionMetrics = {
  response_original_bytes: 0,
  response_compressed_bytes: 0,
  compression_ratio: 0,
};

async function jsonResponse(
  payload: unknown,
  requestId: string,
  status = 200,
  extraHeaders: Record<string, string> = {},
  acceptEncoding: string | null = null,
  traceCtx?: TraceContext,
): Promise<Response> {
  const traceHeaders: Record<string, string> = traceCtx ? { traceparent: buildTraceparent(traceCtx) } : {};
  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const originalBytes = encoder.encode(jsonStr);
  const originalSize = originalBytes.length;

  // Attempt compression if client accepts it and payload is large enough
  if (shouldCompress(originalSize, acceptEncoding)) {
    try {
      const compressed = await gzipCompress(originalBytes);
      // Only use compression if it actually reduces size
      if (compressed.length < originalSize) {
        incrementTelemetry('response_compressed_count', requestId);
        compressionMetrics.response_original_bytes += originalSize;
        compressionMetrics.response_compressed_bytes += compressed.length;
        compressionMetrics.compression_ratio =
          compressionMetrics.response_compressed_bytes / compressionMetrics.response_original_bytes;
        logStructuredJson(requestId, 'info', 'response_compressed', {
          original_bytes: originalSize,
          compressed_bytes: compressed.length,
          ratio: (1 - compressed.length / originalSize).toFixed(2),
        });
        return new Response(compressed, {
          status,
          headers: {
            ...corsHeaders,
            ...securityHeaders,
            [REQUEST_ID_HEADER]: requestId,
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            ...traceHeaders,
            ...extraHeaders,
          },
        });
      }
    } catch (err) {
      // If compression fails, fall through to uncompressed
      logStructuredJson(requestId, 'warn', 'compression_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (originalSize >= 2048) {
    incrementTelemetry('response_skipped_compression_count', requestId);
  }

  return new Response(jsonStr, {
    status,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      [REQUEST_ID_HEADER]: requestId,
      'Content-Type': 'application/json',
      ...traceHeaders,
      ...extraHeaders,
    },
  });
}

function buildRequestId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `req-${Date.now().toString(36)}-${hex}`;
}

function resolveRequestId(req: Request): string {
  const incoming = req.headers.get('x-request-id')?.trim() ?? '';
  const isValid = /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming);
  return isValid ? incoming : buildRequestId();
}

function safeErrorDetails(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/(apikey|api_key|token|authorization)\s*[:=]\s*['"]?[^\s,'"]+/gi, '$1=[REDACTED]');
}

function logWithRequestId(requestId: string, message: string, err?: unknown): void {
  if (err === undefined) {
    console.error(`[ai-gateway][${requestId}] ${message}`);
    return;
  }

  console.error(`[ai-gateway][${requestId}] ${message}: ${safeErrorDetails(err)}`);
}

function logStructuredJson(
  requestId: string,
  level: 'info' | 'warn' | 'error',
  event: string,
  data: Record<string, unknown> = {},
  traceCtx?: TraceContext,
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    request_id: requestId,
    level,
    event,
    ...(traceCtx ? { trace_id: traceCtx.traceId, span_id: traceCtx.spanId } : {}),
    ...data,
  };
  console.log(JSON.stringify(logEntry));
}

function appendTelemetryEvent(event: TelemetryRecentEvent): void {
  telemetryRecentEvents.push(event);
  if (telemetryRecentEvents.length > RECENT_EVENTS_BUFFER_SIZE) {
    telemetryRecentEvents.splice(0, telemetryRecentEvents.length - RECENT_EVENTS_BUFFER_SIZE);
  }
}

function incrementTelemetry(metric: TelemetryMetric, requestId: string, statusCode?: number): void {
  telemetryMetrics[metric] += 1;
  appendTelemetryEvent({
    timestamp: new Date().toISOString(),
    request_id: requestId,
    event_type: METRIC_TO_EVENT_TYPE[metric],
    ...(statusCode === undefined ? {} : { status_code: statusCode }),
  });
  logStructuredJson(requestId, 'warn', 'telemetry_event', {
    metric,
    count: telemetryMetrics[metric],
    status_code: statusCode,
  });
}

export function getAiGatewayTelemetrySnapshot(): Record<TelemetryMetric, number> {
  return { ...telemetryMetrics };
}

export function getAiGatewayRecentEventsSnapshot(limit = RECENT_EVENTS_RESPONSE_LIMIT): TelemetryRecentEvent[] {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(0, Math.min(RECENT_EVENTS_BUFFER_SIZE, Math.floor(limit)))
    : RECENT_EVENTS_RESPONSE_LIMIT;
  return telemetryRecentEvents.slice(-normalizedLimit).reverse();
}

function createEmptyByTypeCounter(): Record<TelemetryEventType, number> {
  return {
    unauthorized: 0,
    invalid_json: 0,
    payload_too_large: 0,
    rate_limited: 0,
    provider_fallback: 0,
    ai_invalid_json: 0,
    response_compressed: 0,
    response_skipped_compression: 0,
  };
}

export function getAiGatewayEventRatesSnapshot(
  nowMs = Date.now(),
): Record<`window_${number}m`, TelemetryEventRateWindow> {
  const result: Record<`window_${number}m`, TelemetryEventRateWindow> = {};

  for (const minutes of EVENT_RATE_WINDOWS_MINUTES) {
    const windowMs = minutes * 60_000;
    const threshold = nowMs - windowMs;
    const byType = createEmptyByTypeCounter();
    let total = 0;

    for (const event of telemetryRecentEvents) {
      const eventMs = Date.parse(event.timestamp);
      if (!Number.isFinite(eventMs) || eventMs < threshold) {
        continue;
      }

      total += 1;
      byType[event.event_type] += 1;
    }

    const key = `window_${minutes}m` as const;
    result[key] = {
      total,
      per_minute: Number((total / minutes).toFixed(2)),
      by_type: byType,
    };
  }

  return result;
}

function getAiGatewayAlertsSnapshot(
  eventRates: Record<`window_${number}m`, TelemetryEventRateWindow>,
): GatewayAlerts {
  const window5m = eventRates.window_5m;
  const window15m = eventRates.window_15m;
  const fallbackRatio15m =
    window15m.total > 0 ? window15m.by_type.provider_fallback / window15m.total : 0;

  return {
    high_rate_limited_5m: window5m.by_type.rate_limited >= ALERT_RATE_LIMITED_5M_MIN,
    high_unauthorized_5m: window5m.by_type.unauthorized >= ALERT_UNAUTHORIZED_5M_MIN,
    high_invalid_json_5m: window5m.by_type.invalid_json >= ALERT_INVALID_JSON_5M_MIN,
    degraded_mode:
      window15m.total >= ALERT_DEGRADED_MIN_TOTAL_15M &&
      fallbackRatio15m >= ALERT_DEGRADED_FALLBACK_RATIO_15M,
  };
}

function getAiGatewayOverallRiskLevel(
  alerts: GatewayAlerts,
  eventRates: Record<`window_${number}m`, TelemetryEventRateWindow>,
): GatewayRiskLevel {
  if (alerts.degraded_mode || alerts.high_rate_limited_5m) {
    return 'high';
  }

  if (alerts.high_unauthorized_5m || alerts.high_invalid_json_5m) {
    return 'medium';
  }

  if (eventRates.window_15m.total >= MEDIUM_RISK_MIN_TOTAL_EVENTS_15M) {
    return 'medium';
  }

  return 'low';
}

function getAiGatewayRecommendedActions(
  alerts: GatewayAlerts,
  overallRiskLevel: GatewayRiskLevel,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];

  if (alerts.high_rate_limited_5m) {
    actions.push({
      id: 'tighten-rate-limits',
      priority: 'high',
      action: 'Increase edge rate-limiting strictness and investigate burst traffic sources.',
    });
  }

  if (alerts.high_unauthorized_5m) {
    actions.push({
      id: 'review-auth-clients',
      priority: 'high',
      action: 'Audit clients sending unauthorized requests and rotate exposed credentials if needed.',
    });
  }

  if (alerts.high_invalid_json_5m) {
    actions.push({
      id: 'validate-client-payloads',
      priority: 'medium',
      action: 'Review client payload serialization and enforce stricter schema validation upstream.',
    });
  }

  if (alerts.degraded_mode) {
    actions.push({
      id: 'check-provider-health',
      priority: 'high',
      action: 'Check upstream AI provider health and failover policy due to elevated fallback ratio.',
    });
  }

  if (overallRiskLevel === 'low' && actions.length === 0) {
    actions.push({
      id: 'monitor-baseline',
      priority: 'low',
      action: 'Gateway health is stable; continue routine monitoring and keep thresholds under review.',
    });
  }

  if (overallRiskLevel === 'medium' && actions.length < MAX_RECOMMENDED_ACTIONS) {
    actions.push({
      id: 'schedule-config-review',
      priority: 'medium',
      action: 'Schedule a configuration review for auth, payload validation, and traffic patterns.',
    });
  }

  if (overallRiskLevel === 'high' && actions.length < MAX_RECOMMENDED_ACTIONS) {
    actions.push({
      id: 'trigger-incident-triage',
      priority: 'high',
      action: 'Trigger incident triage and assign ownership for immediate gateway stabilization actions.',
    });
  }

  return actions.slice(0, MAX_RECOMMENDED_ACTIONS);
}

export function resetAiGatewayTelemetryForTests(): void {
  (Object.keys(telemetryMetrics) as TelemetryMetric[]).forEach((metric) => {
    telemetryMetrics[metric] = 0;
  });
  telemetryRecentEvents.length = 0;
  compressionMetrics.response_original_bytes = 0;
  compressionMetrics.response_compressed_bytes = 0;
  compressionMetrics.compression_ratio = 0;
  killChainCache.clear();
}

export function getAiGatewayPrometheusMetrics(): string {
  const now = Date.now();
  const metrics = buildGatewayPrometheusMetrics({
    uptimeSeconds: Math.max(0, (now - GATEWAY_STARTED_AT_MS) / 1000),
    telemetry: getAiGatewayTelemetrySnapshot(),
    cacheSize: killChainCache.size(),
    compressionOriginalBytes: compressionMetrics.response_original_bytes,
    compressionCompressedBytes: compressionMetrics.response_compressed_bytes,
    compressionRatio: compressionMetrics.compression_ratio,
    version: getGatewayVersion(),
  });
  return serializePrometheusMetrics(metrics);
}

function hasValidBearerAuth(req: Request): boolean {
  const auth = req.headers.get('authorization')?.trim() ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return false;
  }

  const token = auth.slice(7).trim();
  return token.length > 0;
}

function hasValidApiKeyHeader(req: Request): boolean {
  const apiKey = req.headers.get('apikey')?.trim() ?? '';
  return apiKey.length > 0;
}

function hasValidClientAuth(req: Request): boolean {
  return hasValidBearerAuth(req) || hasValidApiKeyHeader(req);
}

function hasValidAdminKey(req: Request): boolean {
  const configured = getEnvKey('AI_GATEWAY_ADMIN_KEY')?.trim() ?? '';
  const provided = req.headers.get(ADMIN_KEY_HEADER)?.trim() ?? '';
  return configured.length > 0 && provided.length > 0 && configured === provided;
}

function getEnvKey(name: string): string | undefined {
  const denoLike = globalThis as unknown as {
    Deno?: {
      env?: {
        get: (key: string) => string | undefined;
      };
    };
  };

  return denoLike.Deno?.env?.get(name);
}

function getGatewayVersion(): string {
  return getEnvKey('AI_GATEWAY_VERSION')?.trim() || 'unknown';
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return true;

  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '169.254.169.254'
  ) {
    return true;
  }

  // IPv6 loopback / unique-local / link-local ranges
  if (host.includes(':')) {
    return host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
  }

  // IPv4 private, loopback, link-local, CGNAT ranges
  const parts = host.split('.').map((p) => Number(p));
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  return false;
}

async function probeAgentHealthUrl(targetUrl: string, requestId: string): Promise<{
  reachable: boolean;
  http_status: number | null;
  health: unknown | null;
  error: string | null;
}> {
  try {
    const parsed = new URL(targetUrl);
    if (isPrivateOrLoopbackHost(parsed.hostname)) {
      return {
        reachable: false,
        http_status: null,
        health: null,
        error: 'Target host is not allowed for probe.',
      };
    }

    const res = await fetch(parsed.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(6_000),
      redirect: 'follow',
      headers: {
        'User-Agent': 'sentinel-ai-gateway/agent-health-probe',
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.5',
      },
    });

    const contentType = res.headers.get('content-type') ?? '';
    let health: unknown | null = null;
    if (contentType.toLowerCase().includes('application/json')) {
      try {
        health = await res.json();
      } catch {
        health = null;
      }
    }

    return {
      reachable: res.ok,
      http_status: res.status,
      health,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    logWithRequestId(requestId, 'Agent health probe failed', err);
    return {
      reachable: false,
      http_status: null,
      health: null,
      error: safeErrorDetails(err),
    };
  }
}

export async function handleAiGatewayRequest(req: Request): Promise<Response> {
  const requestId = resolveRequestId(req);
  const acceptEncoding = req.headers.get('accept-encoding');
  const traceCtx = extractTraceContext(req);
  const traceparentValue = buildTraceparent(traceCtx);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        ...securityHeaders,
        [REQUEST_ID_HEADER]: requestId,
        traceparent: traceparentValue,
      },
    });
  }

  try {
    if (req.method === 'GET') {
      if (!hasValidAdminKey(req)) {
        incrementTelemetry('unauthorized_count', requestId, 401);
        const err = gatewayError('UNAUTHORIZED', 'Valid admin key is required.', 401);
        return await jsonResponse(err.body, requestId, err.status, {}, acceptEncoding, traceCtx);
      }

      // Prometheus metrics endpoint: GET /metrics
      const url = new URL(req.url);
      if (url.pathname.endsWith('/metrics')) {
        return buildPrometheusResponse(
          {
            uptimeSeconds: Math.max(0, (Date.now() - GATEWAY_STARTED_AT_MS) / 1000),
            telemetry: getAiGatewayTelemetrySnapshot(),
            cacheSize: killChainCache.size(),
            compressionOriginalBytes: compressionMetrics.response_original_bytes,
            compressionCompressedBytes: compressionMetrics.response_compressed_bytes,
            compressionRatio: compressionMetrics.compression_ratio,
            version: getGatewayVersion(),
          },
          requestId,
          corsHeaders,
          securityHeaders,
          REQUEST_ID_HEADER,
        );
      }

      const now = Date.now();
      const eventRates = getAiGatewayEventRatesSnapshot(now);
      const alerts = getAiGatewayAlertsSnapshot(eventRates);
      const overallRiskLevel = getAiGatewayOverallRiskLevel(alerts, eventRates);

      return await jsonResponse(
        {
          request_id: requestId,
          status: 'ok',
          uptime_ms: Math.max(0, now - GATEWAY_STARTED_AT_MS),
          timestamp: new Date(now).toISOString(),
          version: getGatewayVersion(),
          telemetry: getAiGatewayTelemetrySnapshot(),
          recent_events: getAiGatewayRecentEventsSnapshot(RECENT_EVENTS_RESPONSE_LIMIT),
          event_rates: eventRates,
          alerts,
          overall_risk_level: overallRiskLevel,
          recommended_actions: getAiGatewayRecommendedActions(alerts, overallRiskLevel),
        },
        requestId,
        200,
        {},
        acceptEncoding,
        traceCtx,
      );
    }

    if (req.method !== 'POST') {
      const err = gatewayError('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
      return await jsonResponse(err.body, requestId, err.status, {}, acceptEncoding, traceCtx);
    }

    if (!hasValidClientAuth(req)) {
      incrementTelemetry('unauthorized_count', requestId, 401);
      const err = gatewayError('UNAUTHORIZED', 'Authorization Bearer token or apikey header is required.', 401);
      return await jsonResponse(err.body, requestId, err.status, {}, acceptEncoding, traceCtx);
    }

    // Rate limit check (30 req/min default policy)
    const clientKey = extractClientKey(req);
    const rateLimit = checkGatewayRateLimit(clientKey);
    if (!rateLimit.allowed) {
      incrementTelemetry('rate_limited_count', requestId, 429);
      logStructuredJson(requestId, 'warn', 'rate_limit_exceeded', {
        retry_after_seconds: rateLimit.retryAfterSeconds,
      }, traceCtx);
      const err = gatewayError('RATE_LIMITED', 'Too many requests. Please retry later.', 429);
      return await jsonResponse(err.body, requestId, err.status, {
        'Retry-After': String(rateLimit.retryAfterSeconds),
      }, acceptEncoding, traceCtx);
    }

    let rawBody: unknown;
    try {
      const bodyText = await req.text();
      if (isPayloadTooLarge(bodyText)) {
        incrementTelemetry('payload_too_large_count', requestId, 413);
        const err = gatewayError('PAYLOAD_TOO_LARGE', 'Request payload is too large.', 413);
        return await jsonResponse(err.body, requestId, err.status, {}, acceptEncoding, traceCtx);
      }

      rawBody = JSON.parse(bodyText);
    } catch {
      incrementTelemetry('invalid_json_count', requestId, 400);
      const err = gatewayError('INVALID_JSON', 'Invalid JSON body.', 400);
      return await jsonResponse(err.body, requestId, err.status, {}, acceptEncoding, traceCtx);
    }

    const parsed = parseGatewayRequest(rawBody);
    if (!parsed.ok) {
      return await jsonResponse(parsed.error.body, requestId, parsed.error.status, {}, acceptEncoding, traceCtx);
    }

    if (parsed.value.action === 'agent_health_probe') {
      const probe = await probeAgentHealthUrl(parsed.value.url, requestId);
      return await jsonResponse(
        {
          request_id: requestId,
          action: 'agent_health_probe',
          status: probe.reachable ? 'ok' : 'error',
          reachable: probe.reachable,
          http_status: probe.http_status,
          health: probe.health,
          error: probe.error,
          probed_url: parsed.value.url,
          timestamp: new Date().toISOString(),
        },
        requestId,
        200,
        {},
        acceptEncoding,
        traceCtx,
      );
    }

    const { action, messages } = parsed.value;

    const geminiKey = getEnvKey('GEMINI_API_KEY');
    const anthropicKey = getEnvKey('ANTHROPIC_API_KEY');
    const openaiKey = getEnvKey('OPENAI_API_KEY');

    let content = '';
    let provider = 'mock';

    if (geminiKey) {
      try {
        content = await callGemini(geminiKey, messages, traceCtx);
        provider = 'gemini-1.5-pro';
      } catch (err) {
        logWithRequestId(requestId, 'Gemini error, trying next provider', err);
      }
    }

    if (!content && anthropicKey) {
      try {
        content = await callAnthropic(anthropicKey, messages, traceCtx);
        provider = 'anthropic';
      } catch (err) {
        logWithRequestId(requestId, 'Anthropic error, trying next provider', err);
      }
    }

    if (!content && openaiKey) {
      try {
        content = await callOpenAI(openaiKey, messages, traceCtx);
        provider = 'openai';
      } catch (err) {
        logWithRequestId(requestId, 'OpenAI error, using mock', err);
      }
    }

    if (!content) {
      incrementTelemetry('provider_fallback_count', requestId);
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      content = mockResponse(
        (lastUser?.content ?? '') + (action === 'generate_kill_chain' ? ' kill_chain_mock' : ''),
      );
      provider = 'mock';
    }

    if (action === 'generate_kill_chain') {
      // Check cache first before calling expensive AI endpoint.
      const cacheKey = generateKillChainCacheKey(
        (parsed.value as unknown as Record<string, unknown>).project as string,
        (parsed.value as unknown as Record<string, unknown>).vulnerabilities as unknown[],
      );
      const cachedResult = killChainCache.get(cacheKey);
      if (cachedResult) {
        logStructuredJson(requestId, 'info', 'cache_hit', { cache_key: cacheKey }, traceCtx);
        return await jsonResponse({ kill_chain: cachedResult, provider: 'cache' }, requestId, 200, {}, acceptEncoding, traceCtx);
      }

      try {
        const cleaned = content.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
        const killChain = JSON.parse(cleaned);
        // Store in cache for future requests.
        killChainCache.set(cacheKey, killChain);
        logStructuredJson(requestId, 'info', 'cache_set', { cache_key: cacheKey }, traceCtx);
        return await jsonResponse({ kill_chain: killChain, provider }, requestId, 200, {}, acceptEncoding, traceCtx);
      } catch {
        incrementTelemetry('ai_invalid_json_count', requestId, 502);
        const err = gatewayError('AI_INVALID_JSON', 'AI failed to return a valid JSON payload.', 502);
        return await jsonResponse(err.body, requestId, err.status, {}, acceptEncoding, traceCtx);
      }
    }

    return await jsonResponse({ content, provider }, requestId, 200, {}, acceptEncoding, traceCtx);
  } catch (err) {
    logWithRequestId(requestId, 'Unhandled gateway error', err);
    const safeError = gatewayError('INTERNAL_ERROR', 'Unexpected gateway error.', 500);
    return await jsonResponse(safeError.body, requestId, safeError.status, {}, acceptEncoding, traceCtx);
  }
}
