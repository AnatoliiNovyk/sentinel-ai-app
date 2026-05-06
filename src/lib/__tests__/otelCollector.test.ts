import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  OTelCollectorClient,
  createMetricFromTelemetry,
  createSpanFromTrace,
  type OTelMetric,
  type OTelSpan,
} from '../otelCollector';

describe('OTelCollectorClient', () => {
  let client: OTelCollectorClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    client = new OTelCollectorClient({
      collectorEndpoint: 'http://localhost:4318/v1/traces',
      batchSize: 10,
      flushInterval: 1000,
      maxRetries: 2,
    });
  });

  afterEach(async () => {
    await client.shutdown();
    vi.clearAllMocks();
  });

  describe('Metric Recording', () => {
    it('records a single metric', async () => {
      const metric: OTelMetric = {
        name: 'request_count',
        value: 42,
        timestamp: Date.now(),
        type: 'counter',
      };

      client.recordMetric(metric);
      expect(client.getPendingMetricsCount()).toBe(1);
    });

    it('records multiple metrics', () => {
      const metrics: OTelMetric[] = [
        { name: 'metric1', value: 1, timestamp: Date.now(), type: 'gauge' },
        { name: 'metric2', value: 2, timestamp: Date.now(), type: 'counter' },
        { name: 'metric3', value: 3, timestamp: Date.now(), type: 'gauge' },
      ];

      client.recordMetrics(metrics);
      expect(client.getPendingMetricsCount()).toBe(3);
    });

    it('auto-flushes when batch size reached', async () => {
      const metrics: OTelMetric[] = Array.from({ length: 10 }, (_, i) => ({
        name: `metric${i}`,
        value: i,
        timestamp: Date.now(),
        type: 'counter',
      }));

      for (const metric of metrics) {
        client.recordMetric(metric);
      }

      // Should auto-flush after 10 metrics
      await new Promise((r) => setTimeout(r, 100));
      expect(client.getPendingMetricsCount()).toBe(0);
    });

    it('tracks metric statistics', async () => {
      const metric: OTelMetric = {
        name: 'request_count',
        value: 42,
        timestamp: Date.now(),
        type: 'counter',
      };

      client.recordMetric(metric);
      await client.flush();

      const stats = client.getStats();
      expect(stats.exported).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
    });
  });

  describe('Span Recording', () => {
    it('records a single span', async () => {
      const span: OTelSpan = {
        traceId: 'trace-123',
        spanId: 'span-456',
        name: 'process_request',
        startTime: Date.now(),
        endTime: Date.now() + 100,
        status: 'ok',
      };

      client.recordSpan(span);
      expect(client.getPendingSpansCount()).toBe(1);
    });

    it('records multiple spans', () => {
      const spans: OTelSpan[] = [
        {
          traceId: 'trace-1',
          spanId: 'span-1',
          name: 'span1',
          startTime: Date.now(),
          endTime: Date.now() + 50,
          status: 'ok',
        },
        {
          traceId: 'trace-1',
          spanId: 'span-2',
          name: 'span2',
          startTime: Date.now(),
          endTime: Date.now() + 100,
          status: 'ok',
        },
      ];

      client.recordSpans(spans);
      expect(client.getPendingSpansCount()).toBe(2);
    });

    it('auto-flushes spans when batch size reached', async () => {
      const spans: OTelSpan[] = Array.from({ length: 10 }, (_, i) => ({
        traceId: `trace-${i}`,
        spanId: `span-${i}`,
        name: `span${i}`,
        startTime: Date.now(),
        endTime: Date.now() + 100,
        status: 'ok',
      }));

      for (const span of spans) {
        client.recordSpan(span);
      }

      await new Promise((r) => setTimeout(r, 100));
      expect(client.getPendingSpansCount()).toBe(0);
    });
  });

  describe('Flushing', () => {
    it('flushes metrics and spans together', async () => {
      const metric: OTelMetric = {
        name: 'request',
        value: 1,
        timestamp: Date.now(),
        type: 'counter',
      };
      const span: OTelSpan = {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'op',
        startTime: Date.now(),
        endTime: Date.now() + 50,
        status: 'ok',
      };

      client.recordMetric(metric);
      client.recordSpan(span);

      const result = await client.flush();

      expect(result.success).toBe(true);
      expect(result.exported).toBe(2);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('sends correct payload to collector', async () => {
      const metric: OTelMetric = {
        name: 'requests',
        value: 5,
        timestamp: Date.now(),
        type: 'counter',
        labels: { service: 'ai-gateway' },
      };

      client.recordMetric(metric);
      await client.flush();

      const call = fetchMock.mock.calls[0];
      const payload = JSON.parse(call[1].body);

      expect(payload.metrics).toHaveLength(1);
      expect(payload.metrics[0].name).toBe('requests');
      expect(payload.metrics[0].value).toBe(5);
      expect(payload.metrics[0].labels.service).toBe('ai-gateway');
    });

    it('returns empty result when nothing to flush', async () => {
      const result = await client.flush();

      expect(result.success).toBe(true);
      expect(result.exported).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('auto-flushes when recordMetrics batch size reached', async () => {
      const metrics: OTelMetric[] = Array.from({ length: 10 }, (_, i) => ({
        name: `bulk${i}`,
        value: i,
        timestamp: Date.now(),
        type: 'counter' as const,
      }));

      client.recordMetrics(metrics);

      await new Promise((r) => setTimeout(r, 100));
      expect(client.getPendingMetricsCount()).toBe(0);
    });

    it('auto-flushes when recordSpans batch size reached', async () => {
      const spans: OTelSpan[] = Array.from({ length: 10 }, (_, i) => ({
        traceId: `trace-bulk-${i}`,
        spanId: `span-bulk-${i}`,
        name: `bulk-span-${i}`,
        startTime: Date.now(),
        endTime: Date.now() + 10,
        status: 'ok' as const,
      }));

      client.recordSpans(spans);

      await new Promise((r) => setTimeout(r, 100));
      expect(client.getPendingSpansCount()).toBe(0);
    });

    it('clears state after successful flush', async () => {
      const metric: OTelMetric = {
        name: 'metric',
        value: 1,
        timestamp: Date.now(),
        type: 'gauge',
      };

      client.recordMetric(metric);
      await client.flush();

      expect(client.getPendingMetricsCount()).toBe(0);
    });

    it('handles flush errors with retries', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });

      const metric: OTelMetric = {
        name: 'metric',
        value: 1,
        timestamp: Date.now(),
        type: 'gauge',
      };

      client.recordMetric(metric);
      const result = await client.flush();

      expect(result.success).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns failed count after max retries exceeded', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const metric: OTelMetric = {
        name: 'metric',
        value: 1,
        timestamp: Date.now(),
        type: 'gauge',
      };

      client.recordMetric(metric);
      const result = await client.flush();

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
    });

    it('throws and fails when collector returns non-ok HTTP status', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const metric: OTelMetric = {
        name: 'metric',
        value: 1,
        timestamp: Date.now(),
        type: 'gauge',
      };

      client.recordMetric(metric);
      const result = await client.flush();

      // Non-ok response causes exportToCollector to throw, which is retried then counted as failed
      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
    });

    it('silently ignores flush errors triggered by background flush timer', async () => {
      fetchMock.mockRejectedValue(new Error('Timer flush failure'));

      const timerClient = new OTelCollectorClient({
        collectorEndpoint: 'http://localhost:4318/v1/traces',
        batchSize: 100,
        flushInterval: 50,
        maxRetries: 1,
      });

      const metric: OTelMetric = {
        name: 'bg-metric',
        value: 1,
        timestamp: Date.now(),
        type: 'gauge',
      };
      timerClient.recordMetric(metric);

      // Allow the interval to fire and the .catch(() => {}) callback to run silently
      await new Promise((r) => setTimeout(r, 120));

      // No error should have escaped — the catch block suppresses it
      await timerClient.shutdown();
    });

    it('implements exponential backoff on retries', async () => {
      // Use fake timers so backoff delays are deterministic regardless of
      // event-loop pressure during parallel test runs.
      vi.useFakeTimers();
      try {
        let callCount = 0;
        fetchMock.mockImplementation(async () => {
          callCount++;
          if (callCount < 3) throw new Error('Retry');
          return { ok: true, status: 200 };
        });

        const metric: OTelMetric = {
          name: 'metric',
          value: 1,
          timestamp: Date.now(),
          type: 'gauge',
        };

        client.recordMetric(metric);
        const flushPromise = client.flush();

        // Advance past both backoff delays: 100ms (retry 1) + 200ms (retry 2)
        await vi.advanceTimersByTimeAsync(400);
        await flushPromise;

        // Verify the retry loop made exactly 3 attempts
        expect(fetchMock).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Statistics', () => {
    it('tracks exported metrics', async () => {
      const metrics: OTelMetric[] = Array.from({ length: 3 }, (_, i) => ({
        name: `metric${i}`,
        value: i,
        timestamp: Date.now(),
        type: 'gauge',
      }));

      for (const metric of metrics) {
        client.recordMetric(metric);
      }
      await client.flush();

      const stats = client.getStats();
      expect(stats.exported).toBe(3);
    });

    it('tracks failed metrics', async () => {
      fetchMock.mockRejectedValue(new Error('Export failed'));

      const metric: OTelMetric = {
        name: 'metric',
        value: 1,
        timestamp: Date.now(),
        type: 'gauge',
      };

      client.recordMetric(metric);
      await client.flush();

      const stats = client.getStats();
      expect(stats.failed).toBe(1);
    });

    it('resets statistics', async () => {
      const metric: OTelMetric = {
        name: 'metric',
        value: 1,
        timestamp: Date.now(),
        type: 'gauge',
      };

      client.recordMetric(metric);
      await client.flush();

      let stats = client.getStats();
      expect(stats.exported).toBe(1);

      client.resetStats();

      stats = client.getStats();
      expect(stats.exported).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('creates metric from telemetry', () => {
      const metric = createMetricFromTelemetry('request_duration', 250, {
        service: 'ai-gateway',
      });

      expect(metric.name).toBe('request_duration');
      expect(metric.value).toBe(250);
      expect(metric.labels?.service).toBe('ai-gateway');
      expect(metric.type).toBe('gauge');
    });

    it('creates counter metric for _total suffix', () => {
      const metric = createMetricFromTelemetry('requests_total', 100);

      expect(metric.type).toBe('counter');
    });

    it('creates span from trace', () => {
      const startTime = Date.now();
      const endTime = startTime + 100;

      const span = createSpanFromTrace(
        'trace-123',
        'span-456',
        'process',
        startTime,
        endTime,
        'ok',
        'parent-789',
      );

      expect(span.traceId).toBe('trace-123');
      expect(span.spanId).toBe('span-456');
      expect(span.parentSpanId).toBe('parent-789');
      expect(span.name).toBe('process');
      expect(span.status).toBe('ok');
      expect(span.endTime - span.startTime).toBe(100);
    });

    it('defaults span status to ok', () => {
      const span = createSpanFromTrace('trace-1', 'span-1', 'op', Date.now(), Date.now() + 50);

      expect(span.status).toBe('ok');
    });
  });

  describe('Concurrency', () => {
    it('handles concurrent metric recording', async () => {
      // Create client with large batch size to prevent auto-flush during test
      const largeClient = new OTelCollectorClient({
        collectorEndpoint: 'http://localhost:4318/v1/traces',
        batchSize: 100, // Large batch to avoid auto-flush
        flushInterval: 1000,
        maxRetries: 2,
      });

      const promises = Array.from({ length: 20 }, (_, i) =>
        Promise.resolve().then(() => {
          largeClient.recordMetric({
            name: `metric${i}`,
            value: i,
            timestamp: Date.now(),
            type: 'gauge',
          });
        }),
      );

      await Promise.all(promises);
      expect(largeClient.getPendingMetricsCount()).toBe(20);

      await largeClient.flush();
      expect(largeClient.getPendingMetricsCount()).toBe(0);

      await largeClient.shutdown();
    });
  });
});
