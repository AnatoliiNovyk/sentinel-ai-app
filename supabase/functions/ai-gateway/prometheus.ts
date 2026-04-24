/**
 * Prometheus metrics export utilities for the AI Gateway.
 *
 * Produces standard Prometheus text format (text/plain; version=0.0.4)
 * compatible with Prometheus server, Grafana, and CloudWatch agent.
 *
 * Usage: GET /metrics with valid x-gateway-admin-key header.
 */

const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

export type PrometheusMetricType = 'counter' | 'gauge';

export type PrometheusMetric = {
  name: string;
  help: string;
  type: PrometheusMetricType;
  value: number;
  labels?: Record<string, string>;
};

export type GatewayMetricsInput = {
  uptimeSeconds: number;
  telemetry: Record<string, number>;
  cacheSize: number;
  compressionOriginalBytes: number;
  compressionCompressedBytes: number;
  compressionRatio: number;
  version: string;
};

/**
 * Sanitize a label value for Prometheus output (escape backslash, newline, double-quote).
 */
function sanitizeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

/**
 * Format a single Prometheus metric block (HELP + TYPE + value line).
 */
function formatMetric(metric: PrometheusMetric): string {
  const labelStr =
    metric.labels && Object.keys(metric.labels).length > 0
      ? '{' +
        Object.entries(metric.labels)
          .map(([k, v]) => `${k}="${sanitizeLabelValue(v)}"`)
          .join(',') +
        '}'
      : '';

  const lines: string[] = [
    `# HELP ${metric.name} ${metric.help}`,
    `# TYPE ${metric.name} ${metric.type}`,
    `${metric.name}${labelStr} ${metric.value}`,
  ];

  return lines.join('\n');
}

/**
 * Build Prometheus metrics from gateway state.
 * Returns an array of PrometheusMetric objects.
 */
export function buildGatewayPrometheusMetrics(input: GatewayMetricsInput): PrometheusMetric[] {
  const { uptimeSeconds, telemetry, cacheSize, compressionOriginalBytes, compressionCompressedBytes, compressionRatio, version } =
    input;

  const metrics: PrometheusMetric[] = [
    // Uptime
    {
      name: 'ai_gateway_uptime_seconds',
      help: 'Number of seconds the gateway instance has been running.',
      type: 'gauge',
      value: Math.max(0, Math.round(uptimeSeconds)),
      labels: { version: sanitizeLabelValue(version) },
    },

    // Security / error counters
    {
      name: 'ai_gateway_unauthorized_total',
      help: 'Total number of requests rejected due to missing or invalid authorization.',
      type: 'counter',
      value: telemetry['unauthorized_count'] ?? 0,
    },
    {
      name: 'ai_gateway_invalid_json_total',
      help: 'Total number of requests with malformed JSON payloads.',
      type: 'counter',
      value: telemetry['invalid_json_count'] ?? 0,
    },
    {
      name: 'ai_gateway_payload_too_large_total',
      help: 'Total number of requests rejected due to oversized payload.',
      type: 'counter',
      value: telemetry['payload_too_large_count'] ?? 0,
    },
    {
      name: 'ai_gateway_rate_limited_total',
      help: 'Total number of requests that were rate-limited.',
      type: 'counter',
      value: telemetry['rate_limited_count'] ?? 0,
    },

    // AI provider health
    {
      name: 'ai_gateway_provider_fallback_total',
      help: 'Total number of times a fallback AI provider was used.',
      type: 'counter',
      value: telemetry['provider_fallback_count'] ?? 0,
    },
    {
      name: 'ai_gateway_ai_invalid_json_total',
      help: 'Total number of times AI returned an unparseable JSON response.',
      type: 'counter',
      value: telemetry['ai_invalid_json_count'] ?? 0,
    },

    // Compression metrics
    {
      name: 'ai_gateway_response_compressed_total',
      help: 'Total number of responses sent with gzip compression.',
      type: 'counter',
      value: telemetry['response_compressed_count'] ?? 0,
    },
    {
      name: 'ai_gateway_response_skipped_compression_total',
      help: 'Total number of large responses sent without compression (client did not accept gzip).',
      type: 'counter',
      value: telemetry['response_skipped_compression_count'] ?? 0,
    },
    {
      name: 'ai_gateway_compression_original_bytes_total',
      help: 'Total uncompressed bytes of all gzip-compressed responses.',
      type: 'counter',
      value: compressionOriginalBytes,
    },
    {
      name: 'ai_gateway_compression_compressed_bytes_total',
      help: 'Total compressed bytes of all gzip-compressed responses.',
      type: 'counter',
      value: compressionCompressedBytes,
    },
    {
      name: 'ai_gateway_compression_ratio',
      help: 'Current overall compression ratio (compressed / original bytes). Lower = better.',
      type: 'gauge',
      value: Number(compressionRatio.toFixed(4)),
    },

    // Cache metrics
    {
      name: 'ai_gateway_cache_size',
      help: 'Current number of entries in the kill-chain in-memory cache.',
      type: 'gauge',
      value: cacheSize,
    },
  ];

  return metrics;
}

/**
 * Serialize PrometheusMetric array to Prometheus text exposition format.
 */
export function serializePrometheusMetrics(metrics: PrometheusMetric[]): string {
  return metrics.map(formatMetric).join('\n\n') + '\n';
}

/**
 * Build a full Prometheus response from gateway state.
 * Returns a Response with correct content-type for Prometheus scraping.
 */
export function buildPrometheusResponse(
  input: GatewayMetricsInput,
  requestId: string,
  corsHeaders: Record<string, string>,
  securityHeaders: Record<string, string>,
  requestIdHeader: string,
): Response {
  const metrics = buildGatewayPrometheusMetrics(input);
  const body = serializePrometheusMetrics(metrics);

  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      ...securityHeaders,
      [requestIdHeader]: requestId,
      'Content-Type': PROMETHEUS_CONTENT_TYPE,
      'Cache-Control': 'no-store',
    },
  });
}
