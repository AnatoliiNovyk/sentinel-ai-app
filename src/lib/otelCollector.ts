/**
 * OpenTelemetry Collector Client
 * Batches metrics and traces for export to centralized collector (Jaeger, Datadog, Zipkin)
 */
import { httpFetch } from './httpClient';

export interface OTelMetric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  type: 'gauge' | 'counter' | 'histogram';
}

export interface OTelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime: number;
  status: 'ok' | 'error';
  attributes?: Record<string, string | number>;
}

export interface OTelExportConfig {
  collectorEndpoint: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
}

export class OTelCollectorClient {
  private metrics: OTelMetric[] = [];
  private spans: OTelSpan[] = [];
  private batchSize: number;
  private flushInterval: number;
  private maxRetries: number;
  private collectorEndpoint: string;
  private flushTimer: NodeJS.Timer | null = null;
  private exportedCount = 0;
  private failedCount = 0;

  constructor(config: OTelExportConfig) {
    this.collectorEndpoint = config.collectorEndpoint;
    this.batchSize = config.batchSize ?? 100;
    this.flushInterval = config.flushInterval ?? 5000; // 5 seconds
    this.maxRetries = config.maxRetries ?? 3;

    this.startFlushTimer();
  }

  /**
   * Record a metric
   */
  public recordMetric(metric: OTelMetric): void {
    this.metrics.push(metric);

    // Auto-flush if batch is full
    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Record a span
   */
  public recordSpan(span: OTelSpan): void {
    this.spans.push(span);

    // Auto-flush if batch is full
    if (this.spans.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Record multiple metrics at once
   */
  public recordMetrics(metrics: OTelMetric[]): void {
    this.metrics.push(...metrics);

    if (this.metrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Record multiple spans at once
   */
  public recordSpans(spans: OTelSpan[]): void {
    this.spans.push(...spans);

    if (this.spans.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush pending metrics and spans to collector
   */
  public async flush(): Promise<{ success: boolean; exported: number; failed: number }> {
    if (this.metrics.length === 0 && this.spans.length === 0) {
      return { success: true, exported: 0, failed: 0 };
    }

    const metricsToSend = [...this.metrics];
    const spansToSend = [...this.spans];

    // Clear local state
    this.metrics = [];
    this.spans = [];

    // Export with retries
    let retries = 0;

    while (retries <= this.maxRetries) {
      try {
        await this.exportToCollector(metricsToSend, spansToSend);
        this.exportedCount += metricsToSend.length + spansToSend.length;
        return { success: true, exported: metricsToSend.length + spansToSend.length, failed: 0 };
      } catch {
        retries += 1;

        if (retries <= this.maxRetries) {
          // Exponential backoff
          const backoffMs = Math.pow(2, retries - 1) * 100;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // If all retries failed, track failure
    this.failedCount += metricsToSend.length + spansToSend.length;

    return {
      success: false,
      exported: 0,
      failed: metricsToSend.length + spansToSend.length,
    };
  }

  /**
   * Get pending metrics count
   */
  public getPendingMetricsCount(): number {
    return this.metrics.length;
  }

  /**
   * Get pending spans count
   */
  public getPendingSpansCount(): number {
    return this.spans.length;
  }

  /**
   * Get export statistics
   */
  public getStats(): {
    exported: number;
    failed: number;
    pending: number;
  } {
    return {
      exported: this.exportedCount,
      failed: this.failedCount,
      pending: this.metrics.length + this.spans.length,
    };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.exportedCount = 0;
    this.failedCount = 0;
  }

  /**
   * Shutdown the client
   */
  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer as unknown as NodeJS.Timeout);
      this.flushTimer = null;
    }

    // Final flush before shutdown
    await this.flush();
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Silently ignore errors in background flush
      });
    }, this.flushInterval) as unknown as NodeJS.Timer;

    // Allow process to exit even if timer is running
    (this.flushTimer as unknown as NodeJS.Timeout).unref();
  }

  /**
   * Export metrics and spans to collector
   */
  private async exportToCollector(metrics: OTelMetric[], spans: OTelSpan[]): Promise<void> {
    const payload = {
      metrics: metrics.map((m) => ({
        name: m.name,
        value: m.value,
        timestamp: m.timestamp,
        type: m.type,
        labels: m.labels || {},
      })),
      spans: spans.map((s) => ({
        traceId: s.traceId,
        spanId: s.spanId,
        parentSpanId: s.parentSpanId,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        status: s.status,
        attributes: s.attributes || {},
      })),
    };

    await httpFetch(this.collectorEndpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 30_000,
    });
  }
}

/**
 * Create a metric from gateway telemetry
 */
export function createMetricFromTelemetry(
  metricName: string,
  value: number,
  labels?: Record<string, string>,
): OTelMetric {
  return {
    name: metricName,
    value,
    timestamp: Date.now(),
    labels,
    type: metricName.endsWith('_total') ? 'counter' : 'gauge',
  };
}

/**
 * Create a span from trace context
 */
export function createSpanFromTrace(
  traceId: string,
  spanId: string,
  name: string,
  startTime: number,
  endTime: number,
  status: 'ok' | 'error' = 'ok',
  parentSpanId?: string,
): OTelSpan {
  return {
    traceId,
    spanId,
    parentSpanId,
    name,
    startTime,
    endTime,
    status,
  };
}
