import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  EdgeFunctionConnectionPool,
  getEdgeConnectionPool,
  resetEdgeConnectionPool,
} from '../connectionPool';

describe('EdgeFunctionConnectionPool', () => {
  let pool: EdgeFunctionConnectionPool;

  beforeEach(() => {
    pool = new EdgeFunctionConnectionPool(50, 5 * 60 * 1000);
  });

  afterEach(() => {
    pool.clearAll();
    resetEdgeConnectionPool();
  });

  describe('Response Caching', () => {
    it('caches response data', () => {
      const data = { result: 'success' };
      pool.setCachedResponse('key-1', data);

      const cached = pool.getCachedResponse('key-1');
      expect(cached).toEqual(data);
    });

    it('returns null for missing cache key', () => {
      const cached = pool.getCachedResponse('missing-key');
      expect(cached).toBeNull();
    });

    it('respects default TTL', async () => {
      const shortPool = new EdgeFunctionConnectionPool(50, 100); // 100ms TTL
      const data = { result: 'success' };

      shortPool.setCachedResponse('key-1', data);
      let cached = shortPool.getCachedResponse('key-1');
      expect(cached).not.toBeNull();

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));
      cached = shortPool.getCachedResponse('key-1');
      expect(cached).toBeNull();
    });

    it('respects custom TTL', async () => {
      const data = { result: 'success' };
      pool.setCachedResponse('key-1', data, 200);

      let cached = pool.getCachedResponse('key-1');
      expect(cached).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 250));
      cached = pool.getCachedResponse('key-1');
      expect(cached).toBeNull();
    });

    it('tracks cache hits', () => {
      pool.setCachedResponse('key-1', { data: 'value' });

      pool.getCachedResponse('key-1');
      pool.getCachedResponse('key-1');
      pool.getCachedResponse('key-1');

      expect(pool.getCacheHits()).toBe(3);
    });

    it('tracks cache misses', () => {
      pool.getCachedResponse('missing-1');
      pool.getCachedResponse('missing-2');

      expect(pool.getCacheMisses()).toBe(2);
    });

    it('distinguishes between hits and misses', () => {
      pool.setCachedResponse('key-1', { data: 'value' });

      pool.getCachedResponse('key-1');
      pool.getCachedResponse('key-1');
      pool.getCachedResponse('missing');

      expect(pool.getCacheHits()).toBe(2);
      expect(pool.getCacheMisses()).toBe(1);
    });
  });

  describe('Request Tracking', () => {
    it('increments request counter', () => {
      pool.recordRequest();
      pool.recordRequest();
      pool.recordRequest();

      const metrics = pool.getMetrics();
      expect(metrics.requestsServed).toBe(3);
    });

    it('calculates cache hit rate', () => {
      pool.setCachedResponse('key-1', { data: 'value' });

      // 2 hits, 1 miss = 66.67% hit rate
      pool.getCachedResponse('key-1');
      pool.getCachedResponse('key-1');
      pool.getCachedResponse('missing');

      const metrics = pool.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(60);
      expect(metrics.cacheHitRate).toBeLessThan(70);
    });

    it('calculates 0 hit rate with no requests', () => {
      const metrics = pool.getMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates cache by pattern', () => {
      pool.setCachedResponse('query:users:1', { data: 'user1' });
      pool.setCachedResponse('query:users:2', { data: 'user2' });
      pool.setCachedResponse('query:posts:1', { data: 'post1' });

      const invalidated = pool.invalidatePattern('users');

      expect(invalidated).toBe(2);
      expect(pool.getCachedResponse('query:users:1')).toBeNull();
      expect(pool.getCachedResponse('query:posts:1')).not.toBeNull();
    });

    it('invalidates no entries with non-matching pattern', () => {
      pool.setCachedResponse('query:users:1', { data: 'user1' });

      const invalidated = pool.invalidatePattern('posts');

      expect(invalidated).toBe(0);
      expect(pool.getCachedResponse('query:users:1')).not.toBeNull();
    });

    it('clears all cache', () => {
      pool.setCachedResponse('key-1', { data: 'value1' });
      pool.setCachedResponse('key-2', { data: 'value2' });
      pool.setCachedResponse('key-3', { data: 'value3' });

      pool.clearAll();

      expect(pool.getCachedResponse('key-1')).toBeNull();
      expect(pool.getCachedResponse('key-2')).toBeNull();
      expect(pool.getCachedResponse('key-3')).toBeNull();
    });
  });

  describe('Metrics', () => {
    it('returns complete metrics snapshot', () => {
      pool.setCachedResponse('key-1', { data: 'value' });
      pool.recordRequest();

      pool.getCachedResponse('key-1');
      pool.getCachedResponse('key-1');
      pool.getCachedResponse('missing');

      const metrics = pool.getMetrics();

      expect(metrics.requestsServed).toBe(1);
      expect(metrics.cacheHitRate).toBeGreaterThan(60);
      expect(metrics.activeQueries).toBe(1);
      expect(metrics.poolSize).toBe(50);
      expect(metrics.averageCacheAge).toBeGreaterThanOrEqual(0);
    });

    it('calculates average cache age', async () => {
      pool.setCachedResponse('key-1', { data: 'value' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      pool.setCachedResponse('key-2', { data: 'value' });

      const metrics = pool.getMetrics();
      expect(metrics.averageCacheAge).toBeGreaterThan(20); // At least some age
    });

    it('resets metrics', () => {
      pool.recordRequest();
      pool.setCachedResponse('key-1', { data: 'value' });
      pool.getCachedResponse('key-1');
      pool.getCachedResponse('key-1');

      pool.resetMetrics();

      expect(pool.getCacheHits()).toBe(0);
      expect(pool.getCacheMisses()).toBe(0);
      const metrics = pool.getMetrics();
      expect(metrics.requestsServed).toBe(0);
    });
  });

  describe('Cache Size Management', () => {
    it('respects max cache size', () => {
      const limitedPool = new EdgeFunctionConnectionPool(2, 5 * 60 * 1000); // max 2 entries

      limitedPool.setCachedResponse('key-1', { data: 'value1' });
      limitedPool.setCachedResponse('key-2', { data: 'value2' });
      limitedPool.setCachedResponse('key-3', { data: 'value3' });

      // Cache should not exceed max size
      const metrics = limitedPool.getMetrics();
      expect(metrics.activeQueries).toBeLessThanOrEqual(2);

      limitedPool.clearAll();
    });

    it('evicts oldest entry when cache is full', () => {
      const limitedPool = new EdgeFunctionConnectionPool(2, 5 * 60 * 1000);

      limitedPool.setCachedResponse('key-1', { data: 'value1' });
      limitedPool.setCachedResponse('key-2', { data: 'value2' });
      limitedPool.setCachedResponse('key-3', { data: 'value3' });

      // key-1 should be evicted (oldest)
      expect(limitedPool.getCachedResponse('key-1')).toBeNull();

      limitedPool.clearAll();
    });
  });

  describe('Global Pool', () => {
    it('returns singleton global pool', () => {
      const pool1 = getEdgeConnectionPool();
      const pool2 = getEdgeConnectionPool();

      expect(pool1).toBe(pool2);
    });

    it('resets global pool', () => {
      const pool = getEdgeConnectionPool();
      pool.setCachedResponse('key-1', { data: 'value' });
      pool.recordRequest();

      resetEdgeConnectionPool();

      expect(pool.getCachedResponse('key-1')).toBeNull();
      expect(pool.getCacheHits()).toBe(0);
      expect(pool.getMetrics().requestsServed).toBe(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('handles multiple concurrent cache operations', () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            pool.setCachedResponse(`key-${i}`, { data: i });
            return pool.getCachedResponse(`key-${i}`);
          }),
        );
      }

      return Promise.all(promises).then((results) => {
        expect(results).toHaveLength(10);
        results.forEach((result, i) => {
          expect(result).toEqual({ data: i });
        });
      });
    });

    it('tracks metrics during concurrent operations', async () => {
      const promises = [];

      for (let i = 0; i < 20; i++) {
        promises.push(
          Promise.resolve().then(() => {
            pool.recordRequest();
            pool.setCachedResponse(`key-${i}`, { data: i });
            if (i % 2 === 0) {
              return pool.getCachedResponse(`key-${i}`);
            }
            return pool.getCachedResponse('missing');
          }),
        );
      }

      await Promise.all(promises);

      const metrics = pool.getMetrics();
      expect(metrics.requestsServed).toBe(20);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });
});
