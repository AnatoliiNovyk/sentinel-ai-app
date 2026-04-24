/**
 * Connection Pool for AI Gateway Edge Function
 * Manages query caching and connection pooling for Supabase calls
 */

export interface EdgePoolMetrics {
  requestsServed: number;
  cacheHitRate: number;
  averageCacheAge: number;
  activeQueries: number;
  poolSize: number;
}

interface CachedResponse {
  data: unknown;
  timestamp: number;
  ttl: number;
  hits: number;
}

export class EdgeFunctionConnectionPool {
  private cache = new Map<string, CachedResponse>();
  private requestsServed = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(private maxCacheSize = 50, private defaultTtl = 5 * 60 * 1000) {}

  /**
   * Get a cached response
   */
  public getCachedResponse(key: string): unknown | null {
    const cached = this.cache.get(key);

    if (!cached) {
      this.cacheMisses += 1;
      return null;
    }

    // Check TTL expiration
    const age = Date.now() - cached.timestamp;
    if (age > cached.ttl) {
      this.cache.delete(key);
      this.cacheMisses += 1;
      return null;
    }

    cached.hits += 1;
    this.cacheHits += 1;
    return cached.data;
  }

  /**
   * Cache a response
   */
  public setCachedResponse(key: string, data: unknown, ttl?: number): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldest = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      )[0];

      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
      hits: 0,
    });
  }

  /**
   * Invalidate cache for a pattern
   */
  public invalidatePattern(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count += 1;
      }
    }
    return count;
  }

  /**
   * Clear all cache
   */
  public clearAll(): void {
    this.cache.clear();
  }

  /**
   * Increment request counter
   */
  public recordRequest(): void {
    this.requestsServed += 1;
  }

  /**
   * Get metrics
   */
  public getMetrics(): EdgePoolMetrics {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    const ages = Array.from(this.cache.values()).map((c) => Date.now() - c.timestamp);
    const averageCacheAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

    return {
      requestsServed: this.requestsServed,
      cacheHitRate,
      averageCacheAge,
      activeQueries: this.cache.size,
      poolSize: this.maxCacheSize,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  public resetMetrics(): void {
    this.requestsServed = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache hit count
   */
  public getCacheHits(): number {
    return this.cacheHits;
  }

  /**
   * Get cache miss count
   */
  public getCacheMisses(): number {
    return this.cacheMisses;
  }
}

/**
 * Global instance for Edge Function
 */
let globalEdgePool: EdgeFunctionConnectionPool | null = null;

export function getEdgeConnectionPool(): EdgeFunctionConnectionPool {
  if (!globalEdgePool) {
    globalEdgePool = new EdgeFunctionConnectionPool();
  }
  return globalEdgePool;
}

export function resetEdgeConnectionPool(): void {
  if (globalEdgePool) {
    globalEdgePool.clearAll();
    globalEdgePool.resetMetrics();
  }
}
