import { describe, expect, it } from 'vitest';
import {
  buildGatewayPrometheusMetrics,
  serializePrometheusMetrics,
  type GatewayMetricsInput,
  type PrometheusMetric,
} from '../../../supabase/functions/ai-gateway/prometheus';

const DEFAULT_INPUT: GatewayMetricsInput = {
  uptimeSeconds: 120,
  telemetry: {
    unauthorized_count: 3,
    invalid_json_count: 1,
    payload_too_large_count: 0,
    rate_limited_count: 5,
    provider_fallback_count: 2,
    ai_invalid_json_count: 0,
    response_compressed_count: 10,
    response_skipped_compression_count: 4,
  },
  cacheSize: 7,
  compressionOriginalBytes: 200000,
  compressionCompressedBytes: 60000,
  compressionRatio: 0.3,
  version: 'test-v1',
};

describe('buildGatewayPrometheusMetrics', () => {
  it('returns an array of PrometheusMetric objects', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    expect(Array.isArray(metrics)).toBe(true);
    expect(metrics.length).toBeGreaterThan(0);
  });

  it('every metric has required fields', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    for (const m of metrics) {
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.help).toBe('string');
      expect(m.help.length).toBeGreaterThan(0);
      expect(['counter', 'gauge']).toContain(m.type);
      expect(typeof m.value).toBe('number');
    }
  });

  it('metric names are unique', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const names = metrics.map((m) => m.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('contains ai_gateway_uptime_seconds gauge with version label', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const uptime = metrics.find((m) => m.name === 'ai_gateway_uptime_seconds');
    expect(uptime).toBeDefined();
    expect(uptime?.type).toBe('gauge');
    expect(uptime?.value).toBe(120);
    expect(uptime?.labels?.version).toBe('test-v1');
  });

  it('contains all security/error counters with correct values', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const byName = Object.fromEntries(metrics.map((m) => [m.name, m]));

    expect(byName['ai_gateway_unauthorized_total']?.value).toBe(3);
    expect(byName['ai_gateway_invalid_json_total']?.value).toBe(1);
    expect(byName['ai_gateway_payload_too_large_total']?.value).toBe(0);
    expect(byName['ai_gateway_rate_limited_total']?.value).toBe(5);
    expect(byName['ai_gateway_provider_fallback_total']?.value).toBe(2);
    expect(byName['ai_gateway_ai_invalid_json_total']?.value).toBe(0);
  });

  it('contains compression metrics with correct values', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const byName = Object.fromEntries(metrics.map((m) => [m.name, m]));

    expect(byName['ai_gateway_response_compressed_total']?.value).toBe(10);
    expect(byName['ai_gateway_response_skipped_compression_total']?.value).toBe(4);
    expect(byName['ai_gateway_compression_original_bytes_total']?.value).toBe(200000);
    expect(byName['ai_gateway_compression_compressed_bytes_total']?.value).toBe(60000);
    expect(byName['ai_gateway_compression_ratio']?.type).toBe('gauge');
    expect(byName['ai_gateway_compression_ratio']?.value).toBe(0.3);
  });

  it('contains cache size gauge', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const cacheMetric = metrics.find((m) => m.name === 'ai_gateway_cache_size');
    expect(cacheMetric).toBeDefined();
    expect(cacheMetric?.type).toBe('gauge');
    expect(cacheMetric?.value).toBe(7);
  });

  it('clamps negative uptime to 0', () => {
    const metrics = buildGatewayPrometheusMetrics({ ...DEFAULT_INPUT, uptimeSeconds: -5 });
    const uptime = metrics.find((m) => m.name === 'ai_gateway_uptime_seconds');
    expect(uptime?.value).toBe(0);
  });

  it('handles missing telemetry keys gracefully (defaults to 0)', () => {
    const metrics = buildGatewayPrometheusMetrics({ ...DEFAULT_INPUT, telemetry: {} });
    const byName = Object.fromEntries(metrics.map((m) => [m.name, m]));
    expect(byName['ai_gateway_unauthorized_total']?.value).toBe(0);
    expect(byName['ai_gateway_rate_limited_total']?.value).toBe(0);
  });
});

describe('serializePrometheusMetrics', () => {
  it('produces non-empty string', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const output = serializePrometheusMetrics(metrics);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);
  });

  it('contains HELP and TYPE lines for every metric', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const output = serializePrometheusMetrics(metrics);
    for (const m of metrics) {
      expect(output).toContain(`# HELP ${m.name}`);
      expect(output).toContain(`# TYPE ${m.name} ${m.type}`);
    }
  });

  it('ends with a trailing newline', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const output = serializePrometheusMetrics(metrics);
    expect(output.endsWith('\n')).toBe(true);
  });

  it('includes version label in uptime line', () => {
    const metrics = buildGatewayPrometheusMetrics(DEFAULT_INPUT);
    const output = serializePrometheusMetrics(metrics);
    expect(output).toContain('ai_gateway_uptime_seconds{version="test-v1"}');
  });

  it('serializes a single custom metric correctly', () => {
    const metric: PrometheusMetric = {
      name: 'test_counter_total',
      help: 'A test counter.',
      type: 'counter',
      value: 42,
    };
    const output = serializePrometheusMetrics([metric]);
    expect(output).toContain('# HELP test_counter_total A test counter.');
    expect(output).toContain('# TYPE test_counter_total counter');
    expect(output).toContain('test_counter_total 42');
  });

  it('escapes double-quotes in label values', () => {
    const metric: PrometheusMetric = {
      name: 'test_gauge',
      help: 'Test.',
      type: 'gauge',
      value: 1,
      labels: { version: 'v1.0"special' },
    };
    const output = serializePrometheusMetrics([metric]);
    expect(output).toContain('version="v1.0\\"special"');
  });

  it('escapes backslash in label values', () => {
    const metric: PrometheusMetric = {
      name: 'test_gauge',
      help: 'Test.',
      type: 'gauge',
      value: 1,
      labels: { path: 'C:\\Windows' },
    };
    const output = serializePrometheusMetrics([metric]);
    expect(output).toContain('path="C:\\\\Windows"');
  });
});
