/**
 * OpenTelemetry Exporter for AI Gateway Edge Function
 * Aggregates metrics and exports to centralized collector
 */

export interface EdgeOTelMetric {
  name: string;
  value: number;
  windowStart: number;
  windowEnd: number;
}

export interface EdgeOTelConfig {
  collectorUrl: string;
  apiKey?: string;
  batchSize?: number;
}

export class EdgeOTelExporter {
  private metrics: Map<string, { values: number[]; windowStart: number }> = new Map();
  private traces: Array<{
    traceId: string;
    spanId: string;
    name: string;
    duration: number;
  }> = [];
  private config: EdgeOTelConfig;
  private batchSize: number;
  private windowSize = 5000; // 5 second aggregation window
  private windowStart = Date.now();

  constructor(config: EdgeOTelConfig) {
    this.config = config;
    this.batchSize = config.batchSize ?? 50;
  }

  /**
   * Record metric value for aggregation
   */
  public recordMetricValue(name: string, value: number): void {
    const now = Date.now();

    // Check if we've crossed window boundary
    if (now - this.windowStart > this.windowSize) {
      this.rotateWindow();
    }

    let metric = this.metrics.get(name);
    if (!metric) {
      metric = { values: [], windowStart: this.windowStart };
      this.metrics.set(name, metric);
    }

    metric.values.push(value);

    // Auto-export if batch size reached
    if (this.metrics.size >= this.batchSize) {
      this.export();
    }
  }

  /**
   * Record trace span
   */
  public recordTrace(traceId: string, spanId: string, name: string, duration: number): void {
    this.traces.push({ traceId, spanId, name, duration });

    if (this.traces.length >= this.batchSize) {
      this.export();
    }
  }

  /**
   * Export aggregated metrics and traces
   */
  public async export(): Promise<boolean> {
    if (this.metrics.size === 0 && this.traces.length === 0) {
      return true;
    }

    const aggregated = this.aggregateMetrics();
    const traceData = [...this.traces];

    // Clear state
    this.metrics.clear();
    this.traces = [];

    try {
      await this.sendToCollector(aggregated, traceData);
      return true;
    } catch (error) {
      // Log but don't throw - OTEL export failures shouldn't break main app
      console.error('OTEL export failed:', error);
      return false;
    }
  }

  /**
   * Force export with current window data
   */
  public async flushWindow(): Promise<boolean> {
    if (this.metrics.size === 0 && this.traces.length === 0) {
      return true;
    }

    const aggregated = this.aggregateMetrics();
    const traceData = [...this.traces];

    this.metrics.clear();
    this.traces = [];

    try {
      await this.sendToCollector(aggregated, traceData);
      return true;
    } catch (error) {
      console.error('OTEL flush failed:', error);
      return false;
    }
  }

  /**
   * Get pending metrics count
   */
  public getPendingCount(): number {
    return this.metrics.size + this.traces.length;
  }

  /**
   * Rotate aggregation window
   */
  private rotateWindow(): void {
    this.windowStart = Date.now();
  }

  /**
   * Aggregate metric values (min, max, avg, sum)
   */
  private aggregateMetrics(): EdgeOTelMetric[] {
    const aggregated: EdgeOTelMetric[] = [];
    const now = Date.now();

    for (const [name, metric] of this.metrics.entries()) {
      if (metric.values.length === 0) continue;

      const sum = metric.values.reduce((a, b) => a + b, 0);
      const avg = sum / metric.values.length;

      aggregated.push({
        name: `${name}_avg`,
        value: avg,
        windowStart: metric.windowStart,
        windowEnd: now,
      });

      aggregated.push({
        name: `${name}_sum`,
        value: sum,
        windowStart: metric.windowStart,
        windowEnd: now,
      });

      aggregated.push({
        name: `${name}_count`,
        value: metric.values.length,
        windowStart: metric.windowStart,
        windowEnd: now,
      });
    }

    return aggregated;
  }

  /**
   * Send data to collector
   */
  private async sendToCollector(
    metrics: EdgeOTelMetric[],
    traces: Array<{
      traceId: string;
      spanId: string;
      name: string;
      duration: number;
    }>,
  ): Promise<void> {
    const payload = {
      metrics,
      traces,
      timestamp: Date.now(),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.collectorUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `OTEL export failed: ${response.status} ${response.statusText}`,
      );
    }
  }
}

/**
 * Create exporter instance with environment config
 */
export function createEdgeOTelExporter(): EdgeOTelExporter | null {
  const collectorUrl = Deno.env.get('OTEL_COLLECTOR_URL');

  if (!collectorUrl) {
    // OTEL export disabled
    return null;
  }

  return new EdgeOTelExporter({
    collectorUrl,
    apiKey: Deno.env.get('OTEL_API_KEY'),
    batchSize: parseInt(Deno.env.get('OTEL_BATCH_SIZE') ?? '50', 10),
  });
}

/**
 * Global exporter instance
 */
let globalExporter: EdgeOTelExporter | null = null;

export function getEdgeOTelExporter(): EdgeOTelExporter | null {
  if (!globalExporter) {
    globalExporter = createEdgeOTelExporter();
  }
  return globalExporter;
}

export function resetEdgeOTelExporter(): void {
  globalExporter = null;
}
