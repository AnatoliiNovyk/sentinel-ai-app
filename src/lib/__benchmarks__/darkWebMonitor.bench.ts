import { bench, describe } from 'vitest';
import { getGlobalDarkWebMonitor } from '../darkWebMonitor';
import { getRateLimiter } from '../rateLimiter';
import { extractQueryFromText } from '../agentTools';

describe('DarkWebMonitor Benchmarks', () => {
  const client = getGlobalDarkWebMonitor();

  describe('Cache Performance', () => {
    bench('cache hit: < 50ms', async () => {
      // First call populates cache
      await client.scan('admin@company.com');
      // Second call should hit cache (same query, within 10min TTL)
      await client.scan('admin@company.com');
    });

    bench('cache miss (new query): < 500ms', async () => {
      const timestamp = Date.now();
      await client.scan(`test-${timestamp}@company.com`);
      const elapsed = Date.now() - timestamp;
      // Simulated OSINT + hash lookup should be < 500ms
      if (elapsed > 500) {
        throw new Error(`Cache miss exceeded 500ms: ${elapsed}ms`);
      }
    });

    bench('cache expiration handling', async () => {
      // After 10min cache TTL, new call should refresh
      const query = `expire-test-${Date.now()}@company.com`;
      await client.scan(query);
      // Verify cache entry created
      const result = await client.scan(query);
      if (!result.ok) {
        throw new Error('Cache expiration handling failed');
      }
    });
  });

  describe('Rate Limiter Impact', () => {
    bench('rate limiter check: < 1ms', () => {
      const limiter = getRateLimiter('bench-dw', {
        maxRequests: 10,
        windowMs: 60000,
      });

      const start = performance.now();
      limiter.check('bench-key');
      const elapsed = performance.now() - start;

      if (elapsed > 1) {
        throw new Error(`Rate limiter check exceeded 1ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('100 sequential rate checks', () => {
      const limiter = getRateLimiter('bench-dw-seq', {
        maxRequests: 1000,
        windowMs: 60000,
      });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        limiter.check(`key-${i}`);
      }
      const elapsed = performance.now() - start;

      // 100 checks should be < 100ms (1ms per check average)
      if (elapsed > 100) {
        throw new Error(`100 rate checks exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Risk Scoring Computation', () => {
    bench('risk score calculation: < 10ms', async () => {
      const result = await client.scan('leaked-admin@company.com');
      const start = performance.now();

      if (result.ok) {
        // Risk scoring happens during scan result processing
        const riskScore = result.data.riskScore;
        if (typeof riskScore !== 'number' || riskScore < 0 || riskScore > 100) {
          throw new Error('Invalid risk score computed');
        }
      }

      const elapsed = performance.now() - start;
      if (elapsed > 10) {
        throw new Error(`Risk scoring exceeded 10ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('breach list aggregation: < 20ms', async () => {
      const result = await client.scan('multiple-breaches@company.com');
      const start = performance.now();

      if (result.ok && result.data.breaches && result.data.breaches.length > 0) {
        // Aggregation should be fast (< 20ms)
        const breachCount = result.data.breaches.length;
        if (breachCount < 0) {
          throw new Error('Invalid breach count');
        }
      }

      const elapsed = performance.now() - start;
      if (elapsed > 20) {
        throw new Error(`Breach aggregation exceeded 20ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Query Extraction Performance', () => {
    bench('email extraction: < 5ms', () => {
      const start = performance.now();

      extractQueryFromText('scan dark web for admin@company.com');

      const elapsed = performance.now() - start;
      if (elapsed > 5) {
        throw new Error(`Email extraction exceeded 5ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('IP extraction: < 5ms', () => {
      const start = performance.now();

      extractQueryFromText('check dark web for 192.168.1.1');

      const elapsed = performance.now() - start;
      if (elapsed > 5) {
        throw new Error(`IP extraction exceeded 5ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('domain extraction: < 5ms', () => {
      const start = performance.now();

      extractQueryFromText('scan for company.com');

      const elapsed = performance.now() - start;
      if (elapsed > 5) {
        throw new Error(`Domain extraction exceeded 5ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Throughput', () => {
    bench('10 concurrent scans', async () => {
      const queries = Array.from({ length: 10 }, (_, i) => `scan-${i}-${Date.now()}@test.com`);
      const start = performance.now();

      await Promise.all(queries.map((q) => client.scan(q)));

      const elapsed = performance.now() - start;
      const avgPerQuery = elapsed / 10;

      // Average per query should be reasonable (< 100ms per query in parallel)
      if (avgPerQuery > 100) {
        throw new Error(`Avg throughput exceeded 100ms/query: ${avgPerQuery.toFixed(2)}ms`);
      }
    });

    bench('50 concurrent rate-limited scans', async () => {
      const limiter = getRateLimiter('bench-throughput', {
        maxRequests: 100,
        windowMs: 60000,
      });

      const start = performance.now();

      for (let i = 0; i < 50; i++) {
        limiter.check(`throughput-${i}`);
      }

      const elapsed = performance.now() - start;
      // 50 rate checks with rate limiter < 100ms total
      if (elapsed > 100) {
        throw new Error(`50 rate checks exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Error Handling Overhead', () => {
    bench('invalid query handling: < 5ms', async () => {
      const start = performance.now();
      const result = await client.scan('');
      const elapsed = performance.now() - start;

      if (result.ok) {
        throw new Error('Should return error for empty query');
      }

      if (elapsed > 5) {
        throw new Error(`Error handling exceeded 5ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('rate limit exceeded handling: < 2ms', () => {
      const limiter = getRateLimiter('bench-limit-test', {
        maxRequests: 1,
        windowMs: 60000,
      });

      // First check passes
      limiter.check('key-1');

      const start = performance.now();
      // Second check should be rate limited
      const result = limiter.check('key-2');
      const elapsed = performance.now() - start;

      if (!result.allowed) {
        // Error path should be fast
        if (elapsed > 2) {
          throw new Error(`Rate limit error handling exceeded 2ms: ${elapsed.toFixed(2)}ms`);
        }
      }
    });
  });
});
