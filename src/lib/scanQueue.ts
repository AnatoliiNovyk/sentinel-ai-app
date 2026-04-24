/**
 * In-memory scan job queue with priority support.
 * Implements FIFO ordering within each priority level.
 */

export type ScanPriority = 'high' | 'medium' | 'low';

export type ScanJob = {
  id: string;
  projectId: string;
  targetUrl: string;
  scanTypes: string[];
  priority: ScanPriority;
  createdAt: Date;
  userId: string;
};

export class InMemoryScanQueue {
  private jobs: ScanJob[] = [];

  /**
   * Add a job to the queue.
   */
  enqueue(job: ScanJob): void {
    this.jobs.push(job);
    this.sort();
  }

  /**
   * Remove and return the next highest-priority job.
   * Returns null if queue is empty.
   */
  dequeue(): ScanJob | null {
    if (this.jobs.length === 0) return null;
    return this.jobs.shift() ?? null;
  }

  /**
   * View the next job without removing it.
   */
  peek(): ScanJob | null {
    return this.jobs.length > 0 ? this.jobs[0] ?? null : null;
  }

  /**
   * Get the number of jobs in the queue.
   */
  size(): number {
    return this.jobs.length;
  }

  /**
   * Clear all jobs from the queue.
   */
  clear(): void {
    this.jobs = [];
  }

  /**
   * Get a copy of all jobs (for inspection).
   */
  getAll(): ScanJob[] {
    return [...this.jobs];
  }

  /**
   * Internal: sort by priority (high → medium → low), FIFO within each level.
   */
  private sort(): void {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    this.jobs.sort((a, b) => {
      const aPrio = priorityOrder[a.priority];
      const bPrio = priorityOrder[b.priority];
      if (aPrio !== bPrio) return aPrio - bPrio;
      // FIFO within same priority: maintain original insertion order
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }
}
