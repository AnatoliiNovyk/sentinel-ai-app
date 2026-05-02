/**
 * Connection Pool for Supabase with TTL and metrics tracking.
 * Provides query result caching and connection reuse statistics.
 */

export type PoolMetrics = {
  activeConnections: number;
  idleConnections: number;
  totalReused: number;
  totalCreated: number;
  cacheHits: number;
  cacheMisses: number;
  evictionCount: number;
};

export type PooledQuery = {
  id: string;
  query: string;
  params: unknown[];
  result: unknown;
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
};

export class SupabaseConnectionPool {
  private activeConnections = new Map<string, { createdAt: Date; inUse: boolean }>();
  private queryCache = new Map<string, PooledQuery>();
  private metrics = {
    totalCreated: 0,
    totalReused: 0,
    cacheHits: 0,
    cacheMisses: 0,
    evictionCount: 0,
  };

  private ttl: number; // milliseconds
  private maxCacheSize: number;
  private maxConnections: number;

  constructor(ttl = 5 * 60 * 1000, maxCacheSize = 100, maxConnections = 50) {
    this.ttl = ttl;
    this.maxCacheSize = maxCacheSize;
    this.maxConnections = maxConnections;

    // Cleanup stale connections every minute
    this.startCleanupInterval();
  }

  /**
   * Get or create a connection
   */
  public checkoutConnection(connectionId: string): { reused: boolean } {
    const existing = this.activeConnections.get(connectionId);

    if (existing) {
      existing.inUse = true;
      this.metrics.totalReused += 1;
      return { reused: true };
    }

    if (this.activeConnections.size >= this.maxConnections) {
      throw new Error(`Connection pool exhausted: max ${this.maxConnections} connections`);
    }

    this.activeConnections.set(connectionId, {
      createdAt: new Date(),
      inUse: true,
    });
    this.metrics.totalCreated += 1;

    return { reused: false };
  }

  /**
   * Return a connection to the pool
   */
  public checkinConnection(connectionId: string): void {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      conn.inUse = false;
    }
  }

  /**
   * Cache a query result
   */
  public cacheQuery(
    query: string,
    params: unknown[],
    result: unknown,
    ttl?: number,
  ): PooledQuery {
    const cacheKey = this.generateCacheKey(query, params);

    // Evict LRU if cache is full
    if (this.queryCache.size >= this.maxCacheSize) {
      const lruKey = Array.from(this.queryCache.entries()).sort(
        ([, a], [, b]) => a.hitCount - b.hitCount || a.createdAt.getTime() - b.createdAt.getTime(),
      )[0]?.[0];

      if (lruKey) {
        this.queryCache.delete(lruKey);
        this.metrics.evictionCount += 1;
      }
    }

    const cachedQuery: PooledQuery = {
      id: cacheKey,
      query,
      params,
      result,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (ttl ?? this.ttl)),
      hitCount: 0,
    };

    this.queryCache.set(cacheKey, cachedQuery);
    return cachedQuery;
  }

  /**
   * Retrieve a cached query result
   */
  public getCachedQuery(query: string, params: unknown[]): PooledQuery | null {
    const cacheKey = this.generateCacheKey(query, params);
    const cached = this.queryCache.get(cacheKey);

    if (!cached) {
      this.metrics.cacheMisses += 1;
      return null;
    }

    // Check expiration
    if (cached.expiresAt.getTime() < Date.now()) {
      this.queryCache.delete(cacheKey);
      this.metrics.cacheMisses += 1;
      return null;
    }

    cached.hitCount += 1;
    this.metrics.cacheHits += 1;
    return cached;
  }

  /**
   * Clear cache for a specific query pattern
   */
  public invalidateCache(queryPattern?: string): number {
    let count = 0;

    if (!queryPattern) {
      count = this.queryCache.size;
      this.queryCache.clear();
      return count;
    }

    for (const [key, value] of this.queryCache.entries()) {
      if (value.query.includes(queryPattern)) {
        this.queryCache.delete(key);
        count += 1;
      }
    }

    return count;
  }

  /**
   * Get current pool metrics
   */
  public getMetrics(): PoolMetrics {
    const activeCount = Array.from(this.activeConnections.values()).filter((c) => c.inUse).length;
    const idleCount = this.activeConnections.size - activeCount;

    return {
      activeConnections: activeCount,
      idleConnections: idleCount,
      totalReused: this.metrics.totalReused,
      totalCreated: this.metrics.totalCreated,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      evictionCount: this.metrics.evictionCount,
    };
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalCreated: 0,
      totalReused: 0,
      cacheHits: 0,
      cacheMisses: 0,
      evictionCount: 0,
    };
  }

  /**
   * Clear all connections and cache
   */
  public clear(): void {
    this.activeConnections.clear();
    this.queryCache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.queryCache.size;
  }

  /**
   * Get active connection count
   */
  public getConnectionCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Generate cache key from query and params
   */
  private generateCacheKey(query: string, params: unknown[]): string {
    const paramsStr = JSON.stringify(params);
    return `${query}:${paramsStr}`;
  }

  /**
   * Start periodic cleanup of expired cache and stale connections
   */
  private startCleanupInterval(): void {
    const cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
      this.cleanupStaleConnections();
    }, 60 * 1000); // Every minute

    // Allow process to exit even if interval is running
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  /**
   * Remove expired cache entries
   */
  /* c8 ignore start */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (value.expiresAt.getTime() < now) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Remove stale idle connections (older than 10 minutes)
   */
  private cleanupStaleConnections(): void {
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();

    for (const [key, value] of this.activeConnections.entries()) {
      if (!value.inUse && now - value.createdAt.getTime() > staleThreshold) {
        this.activeConnections.delete(key);
      }
    }
  }
  /* c8 ignore stop */
}

/**
 * Global singleton instance
 */
let globalPool: SupabaseConnectionPool | null = null;

export function getGlobalConnectionPool(): SupabaseConnectionPool {
  if (!globalPool) {
    globalPool = new SupabaseConnectionPool();
  }
  return globalPool;
}

export function resetGlobalConnectionPool(): void {
  if (globalPool) {
    globalPool.clear();
    globalPool.resetMetrics();
  }
}
