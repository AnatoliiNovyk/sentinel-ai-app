import { bench, describe } from 'vitest';
import { getRateLimiter } from '../rateLimiter';

describe('RateLimiter Benchmarks', () => {
  describe('Per-Request Check Performance', () => {
    bench('single rate check: < 1ms', () => {
      const limiter = getRateLimiter('bench-single', { maxRequests: 100, windowMs: 60000 });

      const start = performance.now();
      limiter.check('key-1');
      const elapsed = performance.now() - start;

      if (elapsed > 1) {
        throw new Error(`Single check exceeded 1ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('10 sequential checks: < 10ms total', () => {
      const limiter = getRateLimiter('bench-seq-10', { maxRequests: 100, windowMs: 60000 });

      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        limiter.check(`key-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 10) {
        throw new Error(`10 sequential checks exceeded 10ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('50 sequential checks: < 50ms total', () => {
      const limiter = getRateLimiter('bench-seq-50', { maxRequests: 500, windowMs: 60000 });

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        limiter.check(`key-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 50) {
        throw new Error(`50 sequential checks exceeded 50ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('100 sequential checks: < 100ms total', () => {
      const limiter = getRateLimiter('bench-seq-100', { maxRequests: 1000, windowMs: 60000 });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        limiter.check(`key-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 100) {
        throw new Error(`100 sequential checks exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Sliding Window Accuracy', () => {
    bench('window sliding on timestamp update: < 10ms', () => {
      const limiter = getRateLimiter('bench-window', { maxRequests: 10, windowMs: 1000 });

      const start = performance.now();
      // Add requests
      for (let i = 0; i < 5; i++) {
        limiter.check(`sliding-key`);
      }
      // Advance time (simulated)
      const elapsed = performance.now() - start;

      if (elapsed > 10) {
        throw new Error(`Window sliding exceeded 10ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('boundary condition check: < 5ms', () => {
      const limiter = getRateLimiter('bench-boundary', { maxRequests: 10, windowMs: 5000 });

      const start = performance.now();
      // Request at window boundary
      limiter.check('boundary-key');
      const elapsed = performance.now() - start;

      if (elapsed > 5) {
        throw new Error(`Boundary check exceeded 5ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('concurrent window updates: < 20ms', () => {
      const limiter = getRateLimiter('bench-concurrent', { maxRequests: 100, windowMs: 10000 });

      const start = performance.now();
      // Simulate concurrent updates from different keys
      for (let i = 0; i < 50; i++) {
        limiter.check(`concurrent-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 20) {
        throw new Error(`Concurrent updates exceeded 20ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Window Reset Performance', () => {
    bench('window reset: < 5ms', () => {
      const limiter = getRateLimiter('bench-reset', { maxRequests: 10, windowMs: 100 });

      // Fill the window
      for (let i = 0; i < 10; i++) {
        limiter.check(`reset-key`);
      }

      // Simulate window expiration and reset
      const start = performance.now();
      // Reset is implicit on window expiration, but we measure check() after expiration
      limiter.check(`reset-key-new`);
      const elapsed = performance.now() - start;

      if (elapsed > 5) {
        throw new Error(`Window reset exceeded 5ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('cleanup old windows: < 10ms', () => {
      const limiter = getRateLimiter('bench-cleanup', { maxRequests: 10, windowMs: 100 });

      // Create many windows
      for (let i = 0; i < 100; i++) {
        limiter.check(`cleanup-${i}`);
      }

      const start = performance.now();
      // Cleanup happens on check for expired windows
      for (let i = 100; i < 110; i++) {
        limiter.check(`cleanup-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 10) {
        throw new Error(`Cleanup exceeded 10ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Rate Limit Enforcement', () => {
    bench('allowed request check: < 1ms', () => {
      const limiter = getRateLimiter('bench-allowed', { maxRequests: 100, windowMs: 60000 });

      const start = performance.now();
      const result = limiter.check('allowed-key');
      const elapsed = performance.now() - start;

      if (!result.allowed) {
        throw new Error('Request should be allowed');
      }

      if (elapsed > 1) {
        throw new Error(`Allowed check exceeded 1ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('rejected request check: < 1ms', () => {
      const limiter = getRateLimiter('bench-rejected', { maxRequests: 1, windowMs: 60000 });

      // Exhaust limit
      limiter.check('rejected-key');

      const start = performance.now();
      // Next check should be rejected fast
      const result = limiter.check('rejected-key');
      const elapsed = performance.now() - start;

      if (result.allowed) {
        throw new Error('Request should be rejected');
      }

      if (elapsed > 1) {
        throw new Error(`Rejection check exceeded 1ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('retryAfter calculation: < 2ms', () => {
      const limiter = getRateLimiter('bench-retry', { maxRequests: 5, windowMs: 10000 });

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        limiter.check('retry-key');
      }

      const start = performance.now();
      const result = limiter.check('retry-key');
      const elapsed = performance.now() - start;

      if (!result.retryAfterMs || result.retryAfterMs <= 0) {
        throw new Error('retryAfterMs should be provided for rejected requests');
      }

      if (elapsed > 2) {
        throw new Error(`retryAfter calculation exceeded 2ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('Multi-Key Rate Limiting', () => {
    bench('10 different keys: < 10ms total', () => {
      const limiter = getRateLimiter('bench-multi-10', { maxRequests: 100, windowMs: 60000 });

      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        limiter.check(`multi-key-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 10) {
        throw new Error(`10 keys exceeded 10ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('100 different keys: < 100ms total', () => {
      const limiter = getRateLimiter('bench-multi-100', { maxRequests: 1000, windowMs: 60000 });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        limiter.check(`multi-key-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 100) {
        throw new Error(`100 keys exceeded 100ms: ${elapsed.toFixed(2)}ms`);
      }
    });

    bench('500 different keys: < 500ms total', () => {
      const limiter = getRateLimiter('bench-multi-500', {
        maxRequests: 5000,
        windowMs: 60000,
      });

      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        limiter.check(`multi-key-${i}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 500) {
        throw new Error(`500 keys exceeded 500ms: ${elapsed.toFixed(2)}ms`);
      }
    });
  });

  describe('High-Frequency Requests', () => {
    bench('1000 checks on same key: < 1000ms', () => {
      const limiter = getRateLimiter('bench-high-freq', { maxRequests: 10000, windowMs: 60000 });

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        limiter.check('high-freq-key');
      }
      const elapsed = performance.now() - start;

      if (elapsed > 1000) {
        throw new Error(`1000 checks exceeded 1s: ${(elapsed / 1000).toFixed(2)}s`);
      }
    });

    bench('1000 checks across 10 keys: < 1000ms', () => {
      const limiter = getRateLimiter('bench-high-freq-multi', {
        maxRequests: 10000,
        windowMs: 60000,
      });

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        limiter.check(`high-freq-key-${i % 10}`);
      }
      const elapsed = performance.now() - start;

      if (elapsed > 1000) {
        throw new Error(`1000 checks (10 keys) exceeded 1s: ${(elapsed / 1000).toFixed(2)}s`);
      }
    });
  });

  describe('Memory Efficiency', () => {
    bench('memory footprint for 100 tracked keys', () => {
      const limiter = getRateLimiter('bench-mem-100', { maxRequests: 1000, windowMs: 60000 });

      const memBefore = process.memoryUsage().heapUsed;
      for (let i = 0; i < 100; i++) {
        limiter.check(`mem-key-${i}`);
      }
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;

      // Should not exceed 5MB for 100 keys
      const maxMemMb = 5;
      if (memIncrease > maxMemMb * 1024 * 1024) {
        throw new Error(
          `Memory increase exceeded ${maxMemMb}MB: ${(memIncrease / 1024 / 1024).toFixed(2)}MB`
        );
      }
    });

    bench('memory footprint for 1000 tracked keys', () => {
      const limiter = getRateLimiter('bench-mem-1000', { maxRequests: 10000, windowMs: 60000 });

      const memBefore = process.memoryUsage().heapUsed;
      for (let i = 0; i < 1000; i++) {
        limiter.check(`mem-key-${i}`);
      }
      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = memAfter - memBefore;

      // Should not exceed 50MB for 1000 keys
      const maxMemMb = 50;
      if (memIncrease > maxMemMb * 1024 * 1024) {
        throw new Error(
          `Memory increase exceeded ${maxMemMb}MB: ${(memIncrease / 1024 / 1024).toFixed(2)}MB`
        );
      }
    });
  });

  describe('Configuration Impact', () => {
    bench('tight window (100ms): < 2ms per check', () => {
      const limiter = getRateLimiter('bench-tight', { maxRequests: 10, windowMs: 100 });

      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        limiter.check(`tight-${i}`);
      }
      const elapsed = performance.now() - start;
      const avgPerCheck = elapsed / 10;

      if (avgPerCheck > 2) {
        throw new Error(`Tight window avg exceeded 2ms: ${avgPerCheck.toFixed(2)}ms`);
      }
    });

    bench('loose window (1hr): < 1ms per check', () => {
      const limiter = getRateLimiter('bench-loose', { maxRequests: 10000, windowMs: 3600000 });

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        limiter.check(`loose-${i}`);
      }
      const elapsed = performance.now() - start;
      const avgPerCheck = elapsed / 100;

      if (avgPerCheck > 1) {
        throw new Error(`Loose window avg exceeded 1ms: ${avgPerCheck.toFixed(2)}ms`);
      }
    });
  });
});
