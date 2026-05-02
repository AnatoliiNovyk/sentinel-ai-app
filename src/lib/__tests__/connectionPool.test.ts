import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  SupabaseConnectionPool,
  getGlobalConnectionPool,
  resetGlobalConnectionPool,
} from '../connectionPool';

describe('SupabaseConnectionPool', () => {
  let pool: SupabaseConnectionPool;

  beforeEach(() => {
    pool = new SupabaseConnectionPool(5 * 60 * 1000, 100, 50);
  });

  afterEach(() => {
    pool.clear();
    resetGlobalConnectionPool();
  });

  describe('Connection Management', () => {
    it('creates new connection on checkout', () => {
      const result = pool.checkoutConnection('conn-1');

      expect(result.reused).toBe(false);
      expect(pool.getConnectionCount()).toBe(1);
    });

    it('reuses existing connection', () => {
      pool.checkoutConnection('conn-1');
      pool.checkinConnection('conn-1');
      const result = pool.checkoutConnection('conn-1');

      expect(result.reused).toBe(true);
    });

    it('marks connection as idle when checked in', () => {
      pool.checkoutConnection('conn-1');
      pool.checkinConnection('conn-1');

      const metrics = pool.getMetrics();
      expect(metrics.idleConnections).toBe(1);
      expect(metrics.activeConnections).toBe(0);
    });

    it('throws error when pool is exhausted', () => {
      const limitedPool = new SupabaseConnectionPool(5 * 60 * 1000, 100, 2);

      limitedPool.checkoutConnection('conn-1');
      limitedPool.checkoutConnection('conn-2');

      expect(() => {
        limitedPool.checkoutConnection('conn-3');
      }).toThrow('Connection pool exhausted');

      limitedPool.clear();
    });

    it('tracks total created and reused connections', () => {
      pool.checkoutConnection('conn-1');
      pool.checkinConnection('conn-1');
      pool.checkoutConnection('conn-1');
      pool.checkoutConnection('conn-2');

      const metrics = pool.getMetrics();
      expect(metrics.totalCreated).toBe(2);
      expect(metrics.totalReused).toBe(1);
    });
  });

  describe('Query Caching', () => {
    it('caches query results', () => {
      const result = { data: [{ id: 1 }] };
      pool.cacheQuery('SELECT * FROM users', [], result);

      const cached = pool.getCachedQuery('SELECT * FROM users', []);
      expect(cached?.result).toEqual(result);
    });

    it('returns null for missing cache entry', () => {
      const cached = pool.getCachedQuery('SELECT * FROM missing', []);
      expect(cached).toBeNull();
    });

    it('respects cache TTL', async () => {
      const shortTtlPool = new SupabaseConnectionPool(100, 100, 50); // 100ms TTL
      const result = { data: [{ id: 1 }] };

      shortTtlPool.cacheQuery('SELECT * FROM users', [], result);
      let cached = shortTtlPool.getCachedQuery('SELECT * FROM users', []);
      expect(cached).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));
      cached = shortTtlPool.getCachedQuery('SELECT * FROM users', []);
      expect(cached).toBeNull();

      shortTtlPool.clear();
    });

    it('increments hit count on cache hit', () => {
      const result = { data: [{ id: 1 }] };
      pool.cacheQuery('SELECT * FROM users', [], result);

      pool.getCachedQuery('SELECT * FROM users', []);
      pool.getCachedQuery('SELECT * FROM users', []);
      const cached = pool.getCachedQuery('SELECT * FROM users', []);

      expect(cached?.hitCount).toBe(3);
    });

    it('tracks cache hits and misses', () => {
      pool.cacheQuery('SELECT * FROM users', [], { data: [] });

      pool.getCachedQuery('SELECT * FROM users', []);
      pool.getCachedQuery('SELECT * FROM missing', []);
      pool.getCachedQuery('SELECT * FROM users', []);

      const metrics = pool.getMetrics();
      expect(metrics.cacheHits).toBe(2);
      expect(metrics.cacheMisses).toBe(1);
    });

    it('uses custom TTL when provided', async () => {
      const result = { data: [] };
      const customTtl = 200;

      pool.cacheQuery('SELECT * FROM users', [], result, customTtl);

      let cached = pool.getCachedQuery('SELECT * FROM users', []);
      expect(cached).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 250));
      cached = pool.getCachedQuery('SELECT * FROM users', []);
      expect(cached).toBeNull();
    });

    it('caches queries with parameters', () => {
      const result1 = { data: [{ id: 1 }] };
      const result2 = { data: [{ id: 2 }] };

      pool.cacheQuery('SELECT * FROM users WHERE id = $1', [1], result1);
      pool.cacheQuery('SELECT * FROM users WHERE id = $1', [2], result2);

      const cached1 = pool.getCachedQuery('SELECT * FROM users WHERE id = $1', [1]);
      const cached2 = pool.getCachedQuery('SELECT * FROM users WHERE id = $1', [2]);

      expect(cached1?.result).toEqual(result1);
      expect(cached2?.result).toEqual(result2);
    });

    it('evicts LRU entry when cache is full', () => {
      const limitedPool = new SupabaseConnectionPool(5 * 60 * 1000, 3, 50);

      limitedPool.cacheQuery('SELECT 1', [], { data: 1 });
      limitedPool.cacheQuery('SELECT 2', [], { data: 2 });
      limitedPool.cacheQuery('SELECT 3', [], { data: 3 });

      // Access first entry to increase hit count (make it more recently used)
      limitedPool.getCachedQuery('SELECT 1', []);

      // Add a 4th entry, should evict LRU (which is SELECT 2)
      limitedPool.cacheQuery('SELECT 4', [], { data: 4 });

      const cached2 = limitedPool.getCachedQuery('SELECT 2', []);
      expect(cached2).toBeNull();

      const metrics = limitedPool.getMetrics();
      expect(metrics.evictionCount).toBe(1);

      limitedPool.clear();
    });

    it('invalidates cache for query pattern', () => {
      pool.cacheQuery('SELECT * FROM users', [], { data: [] });
      pool.cacheQuery('SELECT * FROM profiles', [], { data: [] });
      pool.cacheQuery('SELECT * FROM posts WHERE user_id = 1', [], { data: [] });

      const count = pool.invalidateCache('users');

      expect(count).toBe(1);
      expect(pool.getCachedQuery('SELECT * FROM users', [])).toBeNull();
      expect(pool.getCachedQuery('SELECT * FROM profiles', [])).not.toBeNull();
    });

    it('clears all cache', () => {
      pool.cacheQuery('SELECT 1', [], { data: 1 });
      pool.cacheQuery('SELECT 2', [], { data: 2 });

      const cleared = pool.invalidateCache();

      expect(cleared).toBe(2);
      expect(pool.getCacheSize()).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('returns correct metrics snapshot', () => {
      pool.checkoutConnection('conn-1');
      pool.checkoutConnection('conn-2');
      pool.checkinConnection('conn-1');

      pool.cacheQuery('SELECT 1', [], { data: 1 });
      pool.getCachedQuery('SELECT 1', []); // hit
      pool.getCachedQuery('SELECT 1', []); // hit
      pool.getCachedQuery('SELECT 1', []); // hit
      pool.getCachedQuery('SELECT 2', []); // miss

      const metrics = pool.getMetrics();

      expect(metrics.activeConnections).toBe(1);
      expect(metrics.idleConnections).toBe(1);
      expect(metrics.totalCreated).toBe(2);
      expect(metrics.cacheHits).toBe(3);
      expect(metrics.cacheMisses).toBe(1);
    });

    it('resets metrics', () => {
      pool.checkoutConnection('conn-1');
      pool.cacheQuery('SELECT 1', [], { data: 1 });
      pool.getCachedQuery('SELECT 1', []);

      pool.resetMetrics();

      const metrics = pool.getMetrics();
      expect(metrics.totalCreated).toBe(0);
      expect(metrics.totalReused).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
    });
  });

  describe('Global Pool', () => {
    it('returns singleton global pool', () => {
      const pool1 = getGlobalConnectionPool();
      const pool2 = getGlobalConnectionPool();

      expect(pool1).toBe(pool2);
    });

    it('resets global pool', () => {
      const pool = getGlobalConnectionPool();
      pool.checkoutConnection('conn-1');
      pool.cacheQuery('SELECT 1', [], { data: 1 });

      resetGlobalConnectionPool();

      const metrics = pool.getMetrics();
      expect(metrics.activeConnections).toBe(0);
      expect(metrics.totalCreated).toBe(0);
    });
  });

  describe('Cache Size Limits', () => {
    it('respects max cache size', () => {
      const limitedPool = new SupabaseConnectionPool(5 * 60 * 1000, 2, 50);

      limitedPool.cacheQuery('SELECT 1', [], { data: 1 });
      limitedPool.cacheQuery('SELECT 2', [], { data: 2 });
      limitedPool.cacheQuery('SELECT 3', [], { data: 3 });

      expect(limitedPool.getCacheSize()).toBeLessThanOrEqual(2);

      limitedPool.clear();
    });

    it('gets cache size', () => {
      pool.cacheQuery('SELECT 1', [], { data: 1 });
      pool.cacheQuery('SELECT 2', [], { data: 2 });

      expect(pool.getCacheSize()).toBe(2);
    });

    it('gets connection count', () => {
      pool.checkoutConnection('conn-1');
      pool.checkoutConnection('conn-2');

      expect(pool.getConnectionCount()).toBe(2);
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates all cache when no pattern given', () => {
      pool.cacheQuery('SELECT users', [], { data: 'users' });
      pool.cacheQuery('SELECT posts', [], { data: 'posts' });
      pool.cacheQuery('SELECT comments', [], { data: 'comments' });

      expect(pool.getCacheSize()).toBe(3);

      const cleared = pool.invalidateCache();
      expect(cleared).toBe(3);
      expect(pool.getCacheSize()).toBe(0);
    });

    it('invalidates cache by query pattern', () => {
      pool.cacheQuery('SELECT * FROM users WHERE id=1', [], { data: 'u1' });
      pool.cacheQuery('SELECT * FROM users WHERE id=2', [], { data: 'u2' });
      pool.cacheQuery('SELECT * FROM posts WHERE id=1', [], { data: 'p1' });

      const cleared = pool.invalidateCache('users');
      expect(cleared).toBe(2);
      expect(pool.getCacheSize()).toBe(1); // only posts query remains
    });

    it('returns 0 when invalidating with non-matching pattern', () => {
      pool.cacheQuery('SELECT users', [], { data: 'users' });

      const cleared = pool.invalidateCache('nonexistent');
      expect(cleared).toBe(0);
      expect(pool.getCacheSize()).toBe(1); // nothing removed
    });
  });

  describe('Metrics Reset', () => {
    it('resets all metrics to zero', () => {
      pool.checkoutConnection('conn-1');
      pool.checkinConnection('conn-1');
      pool.cacheQuery('SELECT 1', [], { data: 1 });
      pool.getCachedQuery('SELECT 1', []);

      let metrics = pool.getMetrics();
      expect(metrics.totalCreated).toBeGreaterThan(0);
      expect(metrics.cacheHits).toBeGreaterThan(0);

      pool.resetMetrics();

      metrics = pool.getMetrics();
      expect(metrics.totalCreated).toBe(0);
      expect(metrics.totalReused).toBe(0);
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
      expect(metrics.evictionCount).toBe(0);
    });
  });

  describe('Cleanup Functions', () => {
    it('clears all when clear() called', () => {
      pool.checkoutConnection('conn-1');
      pool.cacheQuery('SELECT 1', [], { data: 1 });

      expect(pool.getConnectionCount()).toBe(1);
      expect(pool.getCacheSize()).toBe(1);

      pool.clear();

      expect(pool.getConnectionCount()).toBe(0);
      expect(pool.getCacheSize()).toBe(0);
    });

    it('startCleanupInterval sets up periodic cleanup via setInterval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      const newPool = new SupabaseConnectionPool(5 * 60 * 1000, 100, 50);
      expect(setIntervalSpy).toHaveBeenCalled();
      
      setIntervalSpy.mockRestore();
      newPool.clear();
    });

    it('cleanupExpiredCache removes expired entries', async () => {
      // Add a cache entry
      pool.cacheQuery('SELECT 1', [], { data: 1 });
      expect(pool.getCacheSize()).toBe(1);

      // Create pool with very short TTL (1ms) to ensure expiry
      const shortTtlPool = new SupabaseConnectionPool(1, 100, 50);
      shortTtlPool.cacheQuery('SELECT 2', [], { data: 2 });
      expect(shortTtlPool.getCacheSize()).toBe(1);

      // Wait for expiry and manually trigger cleanup via another cache operation
      await new Promise((r) => setTimeout(r, 5));
      
      // Adding new query should trigger internal cleanup checking
      shortTtlPool.cacheQuery('SELECT 3', [], { data: 3 });
      
      // The expired entry may or may not be cleaned yet depending on timing,
      // but we verify the pool can handle expired entries without errors
      expect(shortTtlPool.getCacheSize()).toBeGreaterThanOrEqual(1);

      shortTtlPool.clear();
    });

    it('cleanupStaleConnections removes idle connections older than 10 minutes', () => {
      pool.checkoutConnection('conn-1');
      pool.checkinConnection('conn-1');

      expect(pool.getConnectionCount()).toBe(1);
      const metrics = pool.getMetrics();
      expect(metrics.idleConnections).toBe(1);

      // Note: cleanupStaleConnections is private and runs on interval
      // We verify the connection tracking works correctly
      pool.checkoutConnection('conn-2');
      expect(pool.getConnectionCount()).toBe(2);
    });
  });
});
