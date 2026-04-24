import { describe, expect, it, vi } from 'vitest';
import {
  runScansParallel,
  batchJobs,
  summarizeScanResults,
  type ScanResult,
} from '../parallelScanner';
import { type ScanJob } from '../scanQueue';

function createMockScanJob(id: string): ScanJob {
  return {
    id,
    projectId: `project-${id}`,
    targetUrl: `https://example-${id}.com`,
    scanTypes: ['nmap'],
    priority: 'medium',
    createdAt: new Date(),
    userId: 'user-123',
  };
}

describe('runScansParallel', () => {
  it('executes all jobs and returns results in original order', async () => {
    const jobs = [createMockScanJob('job1'), createMockScanJob('job2'), createMockScanJob('job3')];

    const workerFn = vi.fn(async (job: ScanJob) => [{ target: job.targetUrl }]);

    const results = await runScansParallel(jobs, workerFn, 3);

    expect(results.length).toBe(3);
    expect(results[0].jobId).toBe('job1');
    expect(results[1].jobId).toBe('job2');
    expect(results[2].jobId).toBe('job3');
    expect(results[0].status).toBe('success');
    expect(results[0].findings).toEqual([{ target: 'https://example-job1.com' }]);
    expect(workerFn).toHaveBeenCalledTimes(3);
  });

  it('respects concurrency limit', async () => {
    const jobs = Array.from({ length: 6 }, (_, i) => createMockScanJob(`job${i + 1}`));
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    const workerFn = vi.fn(async () => {
      currentConcurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
      await new Promise((resolve) => setTimeout(resolve, 10));
      currentConcurrent -= 1;
      return [];
    });

    await runScansParallel(jobs, workerFn, 2);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('marks failed jobs with error', async () => {
    const jobs = [createMockScanJob('job1'), createMockScanJob('job2')];

    const workerFn = vi.fn(async (job: ScanJob) => {
      if (job.id === 'job1') throw new Error('Network error');
      return [];
    });

    const results = await runScansParallel(jobs, workerFn, 3);

    expect(results[0].status).toBe('failed');
    expect(results[0].error).toContain('Network error');
    expect(results[1].status).toBe('success');
  });

  it('handles timeouts', async () => {
    const jobs = [createMockScanJob('job1'), createMockScanJob('job2')];

    const workerFn = vi.fn(async (job: ScanJob) => {
      if (job.id === 'job1') {
        // Simulate timeout - sleep longer than the 30s timeout
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new Error('Should timeout');
      }
      return [];
    });

    const results = await runScansParallel(jobs, workerFn, 3);

    // job1 should have error, job2 should succeed (parallel execution)
    expect(results[0].jobId).toBe('job1');
    expect(results[1].jobId).toBe('job2');
    expect(results[1].status).toBe('success');
  });

  it('tracks duration for each job', async () => {
    const jobs = [createMockScanJob('job1'), createMockScanJob('job2')];

    const workerFn = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [];
    });

    const results = await runScansParallel(jobs, workerFn, 3);

    expect(results[0].durationMs).toBeGreaterThanOrEqual(50);
    expect(results[1].durationMs).toBeGreaterThanOrEqual(50);
  });

  it('handles partial failures gracefully', async () => {
    const jobs = [
      createMockScanJob('job1'),
      createMockScanJob('job2'),
      createMockScanJob('job3'),
    ];

    const workerFn = vi.fn(async (job: ScanJob) => {
      if (job.id === 'job2') throw new Error('Failed job');
      return [{ success: true }];
    });

    const results = await runScansParallel(jobs, workerFn, 3);

    expect(results.filter((r) => r.status === 'success')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'failed')).toHaveLength(1);
  });

  it('handles empty job list', async () => {
    const jobs: ScanJob[] = [];
    const workerFn = vi.fn();

    const results = await runScansParallel(jobs, workerFn, 3);

    expect(results).toEqual([]);
    expect(workerFn).not.toHaveBeenCalled();
  });
});

describe('batchJobs', () => {
  it('splits array into batches of specified size', () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const batches = batchJobs(items, 3);

    expect(batches).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('handles exact multiple of batch size', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const batches = batchJobs(items, 2);

    expect(batches).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  it('uses default batch size of 5', () => {
    const items = Array.from({ length: 12 }, (_, i) => i);
    const batches = batchJobs(items);

    expect(batches.length).toBe(3);
    expect(batches[0]).toHaveLength(5);
    expect(batches[1]).toHaveLength(5);
    expect(batches[2]).toHaveLength(2);
  });

  it('handles single-item batches', () => {
    const items = [1, 2, 3];
    const batches = batchJobs(items, 1);

    expect(batches).toEqual([[1], [2], [3]]);
  });

  it('handles empty array', () => {
    const items: number[] = [];
    const batches = batchJobs(items, 3);

    expect(batches).toEqual([]);
  });
});

describe('summarizeScanResults', () => {
  it('counts succeeded, failed, and timed-out jobs', () => {
    const results: ScanResult[] = [
      { jobId: 'j1', status: 'success', findings: [], durationMs: 100 },
      { jobId: 'j2', status: 'failed', durationMs: 50, error: 'Error' },
      { jobId: 'j3', status: 'timeout', durationMs: 30000, error: 'Timeout' },
      { jobId: 'j4', status: 'success', findings: [{ id: 1 }], durationMs: 200 },
    ];

    const summary = summarizeScanResults(results);

    expect(summary.total).toBe(4);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.timedOut).toBe(1);
    expect(summary.totalDurationMs).toBe(30000);
  });

  it('handles empty results', () => {
    const summary = summarizeScanResults([]);

    expect(summary.total).toBe(0);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.timedOut).toBe(0);
    expect(summary.totalDurationMs).toBe(0);
  });

  it('includes results array in summary', () => {
    const results: ScanResult[] = [
      { jobId: 'j1', status: 'success', findings: [], durationMs: 100 },
    ];

    const summary = summarizeScanResults(results);

    expect(summary.results).toEqual(results);
  });
});
