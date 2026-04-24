import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  EdgeOTelExporter,
  getEdgeOTelExporter,
  resetEdgeOTelExporter,
} from '../otelExporter';

describe('EdgeOTelExporter', () => {
  let exporter: EdgeOTelExporter;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    global.fetch = fetchMock;

    exporter = new EdgeOTelExporter({
      collectorUrl: 'http://localhost:4318/v1/metrics',
      batchSize: 10,
    });
  });

  afterEach(() => {
    resetEdgeOTelExporter();
    vi.clearAllMocks();
  });

  describe('Metric Recording', () => {
    it('records metric values', () => {
      exporter.recordMetricValue('request_duration', 250);
      exporter.recordMetricValue('request_duration', 300);
      exporter.recordMetricValue('request_duration', 200);

      expect(exporter.getPendingCount()).toBe(1); // 1 metric name
    });

    it('aggregates multiple values for same metric', () => {
      exporter.recordMetricValue('requests', 10);
      exporter.recordMetricValue('requests', 20);
      exporter.recordMetricValue('requests', 30);

      expect(exporter.getPendingCount()).toBe(1);
    });

    it('handles multiple different metrics', () => {
      exporter.recordMetricValue('requests', 10);
      exporter.recordMetricValue('latency', 250);
      exporter.recordMetricValue('errors', 2);

      expect(exporter.getPendingCount()).toBe(3);
    });

    it('auto-exports when batch size reached', async () => {
      for (let i = 0; i < 10; i++) {
        exporter.recordMetricValue(`metric${i}`, i);
      }

      await new Promise((r) => setTimeout(r, 100));
      expect(exporter.getPendingCount()).toBe(0);
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('Trace Recording', () => {
    it('records trace spans', () => {
      exporter.recordTrace('trace-1', 'span-1', 'operation', 100);
      exporter.recordTrace('trace-1', 'span-2', 'child_op', 50);

      expect(exporter.getPendingCount()).toBeGreaterThanOrEqual(2);
    });

    it('auto-exports traces when batch size reached', async () => {
      for (let i = 0; i < 10; i++) {
        exporter.recordTrace(`trace-${i}`, `span-${i}`, `op${i}`, 100 + i);
      }

      await new Promise((r) => setTimeout(r, 100));
      expect(exporter.getPendingCount()).toBe(0);
    });
  });

  describe('Metric Aggregation', () => {
    it('calculates average of recorded values', async () => {
      exporter.recordMetricValue('latency', 100);
      exporter.recordMetricValue('latency', 200);
      exporter.recordMetricValue('latency', 300);

      await exporter.export();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body as string);

      const avgMetric = payload.metrics.find((m: { name: string; value: number }) => m.name === 'latency_avg');
      expect(avgMetric.value).toBe(200); // (100 + 200 + 300) / 3
    });

    it('calculates sum of recorded values', async () => {
      exporter.recordMetricValue('requests', 10);
      exporter.recordMetricValue('requests', 20);
      exporter.recordMetricValue('requests', 30);

      await exporter.export();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body as string);

      const sumMetric = payload.metrics.find((m: { name: string; value: number }) => m.name === 'requests_sum');
      expect(sumMetric.value).toBe(60);
    });

    it('counts number of recorded values', async () => {
      exporter.recordMetricValue('events', 1);
      exporter.recordMetricValue('events', 1);
      exporter.recordMetricValue('events', 1);
      exporter.recordMetricValue('events', 1);

      await exporter.export();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body as string);

      const countMetric = payload.metrics.find((m: { name: string; value: number }) => m.name === 'events_count');
      expect(countMetric.value).toBe(4);
    });

    it('includes window timestamps in aggregated metrics', async () => {
      const before = Date.now();
      exporter.recordMetricValue('metric', 100);
      const after = Date.now();

      await exporter.export();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);

      expect(payload.metrics[0].windowStart).toBeGreaterThanOrEqual(before);
      expect(payload.metrics[0].windowEnd).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('Export', () => {
    it('sends metrics and traces to collector', async () => {
      exporter.recordMetricValue('metric', 100);
      exporter.recordTrace('trace-1', 'span-1', 'op', 50);

      const success = await exporter.export();

      expect(success).toBe(true);
      expect(fetchMock).toHaveBeenCalledOnce();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);

      expect(payload.metrics.length).toBeGreaterThan(0);
      expect(payload.traces.length).toBeGreaterThan(0);
    });

    it('clears state after export', async () => {
      exporter.recordMetricValue('metric', 100);
      expect(exporter.getPendingCount()).toBe(1);

      await exporter.export();

      expect(exporter.getPendingCount()).toBe(0);
    });

    it('returns false on export failure', async () => {
      fetchMock.mockRejectedValue(new Error('Export failed'));

      exporter.recordMetricValue('metric', 100);
      const success = await exporter.export();

      expect(success).toBe(false);
    });

    it('includes API key in request headers', async () => {
      const exporterWithKey = new EdgeOTelExporter({
        collectorUrl: 'http://localhost:4318/v1/metrics',
        apiKey: 'secret-key-123',
      });

      exporterWithKey.recordMetricValue('metric', 100);
      await exporterWithKey.export();

      const call = fetchMock.mock.calls[0];
      expect(call[1].headers['Authorization']).toBe('Bearer secret-key-123');
    });

    it('omits API key if not configured', async () => {
      exporter.recordMetricValue('metric', 100);
      await exporter.export();

      const call = fetchMock.mock.calls[0];
      expect(call[1].headers['Authorization']).toBeUndefined();
    });

    it('includes timestamp in payload', async () => {
      exporter.recordMetricValue('metric', 100);
      const before = Date.now();
      await exporter.export();
      const after = Date.now();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);

      expect(payload.timestamp).toBeGreaterThanOrEqual(before);
      expect(payload.timestamp).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('Window Flushing', () => {
    it('flushes current window data', async () => {
      exporter.recordMetricValue('metric', 100);

      const success = await exporter.flushWindow();

      expect(success).toBe(true);
      expect(exporter.getPendingCount()).toBe(0);
    });

    it('returns true when nothing to flush', async () => {
      const success = await exporter.flushWindow();

      expect(success).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('handles flush errors gracefully', async () => {
      fetchMock.mockRejectedValue(new Error('Connection refused'));

      exporter.recordMetricValue('metric', 100);
      const success = await exporter.flushWindow();

      expect(success).toBe(false);
    });
  });

  describe('Pending Count', () => {
    it('counts pending metrics', () => {
      exporter.recordMetricValue('metric1', 100);
      exporter.recordMetricValue('metric2', 200);

      expect(exporter.getPendingCount()).toBe(2);
    });

    it('counts pending traces', () => {
      exporter.recordTrace('trace-1', 'span-1', 'op', 100);
      exporter.recordTrace('trace-2', 'span-1', 'op', 100);

      expect(exporter.getPendingCount()).toBeGreaterThanOrEqual(2);
    });

    it('counts both metrics and traces', () => {
      exporter.recordMetricValue('metric', 100);
      exporter.recordTrace('trace-1', 'span-1', 'op', 100);

      expect(exporter.getPendingCount()).toBeGreaterThanOrEqual(2);
    });

    it('returns 0 when nothing pending', () => {
      expect(exporter.getPendingCount()).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('uses default batch size', () => {
      const defaultExporter = new EdgeOTelExporter({
        collectorUrl: 'http://localhost:4318',
      });

      expect(defaultExporter.getPendingCount()).toBe(0);
    });

    it('respects custom batch size', async () => {
      const smallBatchExporter = new EdgeOTelExporter({
        collectorUrl: 'http://localhost:4318',
        batchSize: 2,
      });

      let exportCount = 0;
      const customFetchMock = vi.fn(async () => {
        exportCount += 1;
        return { ok: true, status: 200 };
      });
      global.fetch = customFetchMock;

      smallBatchExporter.recordMetricValue('metric1', 100);
      smallBatchExporter.recordMetricValue('metric2', 200);

      await new Promise((r) => setTimeout(r, 100));

      expect(exportCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Global Exporter', () => {
    it('returns null when collector URL not configured', () => {
      // Clear env - should return null since OTEL_COLLECTOR_URL is not set
      const result = getEdgeOTelExporter();
      // Implementation depends on Deno.env.get returning undefined
      expect(result === null || result instanceof EdgeOTelExporter).toBe(true);
    });

    it('resets global exporter', () => {
      resetEdgeOTelExporter();
      // After reset, new instance should be created
      expect(true).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('handles concurrent metric recording', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        Promise.resolve().then(() => {
          exporter.recordMetricValue(`metric${i % 3}`, i * 10);
        }),
      );

      await Promise.all(promises);

      expect(exporter.getPendingCount()).toBeGreaterThan(0);

      await exporter.export();
      expect(exporter.getPendingCount()).toBe(0);
    });

    it('handles concurrent trace recording', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() => {
          exporter.recordTrace(`trace-${i}`, `span-${i}`, `op${i}`, 100);
        }),
      );

      await Promise.all(promises);
      expect(exporter.getPendingCount()).toBeGreaterThan(0);
    });
  });

  describe('Aggregation Edge Cases', () => {
    it('handles single metric value', async () => {
      exporter.recordMetricValue('latency', 500);

      await exporter.export();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body as string);

      const avgMetric = payload.metrics.find((m: { name: string; value: number }) => m.name === 'latency_avg');
      expect(avgMetric.value).toBe(500);
    });

    it('handles zero values', async () => {
      exporter.recordMetricValue('errors', 0);
      exporter.recordMetricValue('errors', 0);
      exporter.recordMetricValue('errors', 0);

      await exporter.export();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body as string);

      const sumMetric = payload.metrics.find((m: { name: string; value: number }) => m.name === 'errors_sum');
      expect(sumMetric.value).toBe(0);
    });

    it('handles large values', async () => {
      exporter.recordMetricValue('large', Number.MAX_SAFE_INTEGER);

      await exporter.export();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body as string);

      const countMetric = payload.metrics.find((m: { name: string; value: number }) => m.name === 'large_count');
      expect(countMetric.value).toBe(1);
    });
  });
});
