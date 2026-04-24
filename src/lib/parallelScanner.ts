/**
 * Parallel scan executor with concurrency limiting and timeout protection.
 */

import type { ScanJob } from './scanQueue';

export type ScanResult = {
  jobId: string;
  status: 'success' | 'failed' | 'timeout';
  findings?: unknown[];
  durationMs: number;
  error?: string;
};

/**
 * Execute a function with timeout protection.
 * @param fn Function to execute
 * @param timeoutMs Timeout in milliseconds (default 30000ms = 30s)
 * @returns Promise that rejects if timeout exceeded
 */
async function withTimeout<T>(fn: () => Promise<T>, timeoutMs = 30000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

/**
 * Execute multiple scan jobs in parallel with concurrency limit.
 *
 * @param jobs Array of ScanJob to process
 * @param workerFn Async function that processes a job and returns findings
 * @param concurrency Maximum concurrent executions (default 3)
 * @returns Array of ScanResult, one per job (order preserved)
 */
export async function runScansParallel(
  jobs: ScanJob[],
  workerFn: (job: ScanJob) => Promise<unknown[]>,
  concurrency = 3,
): Promise<ScanResult[]> {
  const results: ScanResult[] = new Array(jobs.length);
  const executing = new Set<Promise<void>>();

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const startTime = Date.now();

    const createTask = async () => {
      try {
        const findings = await withTimeout(() => workerFn(job), 30000);
        results[i] = {
          jobId: job.id,
          status: 'success',
          findings,
          durationMs: Date.now() - startTime,
        };
      } catch (err) {
        const isTimeout = err instanceof Error && err.message.includes('Timeout');
        results[i] = {
          jobId: job.id,
          status: isTimeout ? 'timeout' : 'failed',
          durationMs: Date.now() - startTime,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    };

    const promise = createTask().then(() => {
      executing.delete(promise);
    });

    executing.add(promise);

    // Wait if we've hit the concurrency limit
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  // Wait for all remaining tasks to complete
  await Promise.all(executing);

  return results;
}

/**
 * Batch split an array into chunks of specified size.
 * Useful for processing large scan lists in multiple rounds.
 *
 * @param items Array to split
 * @param batchSize Size of each batch (default 5)
 * @returns Array of batches
 */
export function batchJobs<T>(items: T[], batchSize = 5): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Aggregate ScanResults with summary stats.
 */
export type ScanResultsSummary = {
  total: number;
  succeeded: number;
  failed: number;
  timedOut: number;
  totalDurationMs: number;
  results: ScanResult[];
};

/**
 * Summarize scan results with aggregate statistics.
 */
export function summarizeScanResults(results: ScanResult[]): ScanResultsSummary {
  return {
    total: results.length,
    succeeded: results.filter((r) => r.status === 'success').length,
    failed: results.filter((r) => r.status === 'failed').length,
    timedOut: results.filter((r) => r.status === 'timeout').length,
    totalDurationMs: Math.max(...results.map((r) => r.durationMs), 0),
    results,
  };
}
