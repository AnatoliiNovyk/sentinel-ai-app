import { describe, expect, it } from 'vitest';
import { InMemoryScanQueue, type ScanJob, type ScanPriority } from '../scanQueue';

function createMockJob(
  id: string,
  priority: ScanPriority = 'medium',
  delayMs = 0,
): ScanJob {
  return {
    id,
    projectId: `project-${id}`,
    targetUrl: `https://example-${id}.com`,
    scanTypes: ['nmap'],
    priority,
    createdAt: new Date(Date.now() - delayMs),
    userId: 'user-123',
  };
}

describe('InMemoryScanQueue', () => {
  it('enqueue and dequeue respects FIFO order for same priority', () => {
    const queue = new InMemoryScanQueue();
    queue.enqueue(createMockJob('job1', 'medium'));
    queue.enqueue(createMockJob('job2', 'medium'));
    queue.enqueue(createMockJob('job3', 'medium'));

    expect(queue.dequeue()?.id).toBe('job1');
    expect(queue.dequeue()?.id).toBe('job2');
    expect(queue.dequeue()?.id).toBe('job3');
    expect(queue.dequeue()).toBeNull();
  });

  it('prioritizes high > medium > low', () => {
    const queue = new InMemoryScanQueue();
    queue.enqueue(createMockJob('med1', 'medium'));
    queue.enqueue(createMockJob('low1', 'low'));
    queue.enqueue(createMockJob('high1', 'high'));
    queue.enqueue(createMockJob('high2', 'high'));

    expect(queue.dequeue()?.id).toBe('high1');
    expect(queue.dequeue()?.id).toBe('high2');
    expect(queue.dequeue()?.id).toBe('med1');
    expect(queue.dequeue()?.id).toBe('low1');
  });

  it('maintains FIFO within high priority', () => {
    const queue = new InMemoryScanQueue();
    queue.enqueue(createMockJob('high1', 'high', 100));
    queue.enqueue(createMockJob('high2', 'high', 50));
    queue.enqueue(createMockJob('high3', 'high', 0));

    // high1 was created first (oldest), high3 last (newest)
    expect(queue.dequeue()?.id).toBe('high1');
    expect(queue.dequeue()?.id).toBe('high2');
    expect(queue.dequeue()?.id).toBe('high3');
  });

  it('peek returns next job without removing', () => {
    const queue = new InMemoryScanQueue();
    queue.enqueue(createMockJob('job1', 'high'));
    queue.enqueue(createMockJob('job2', 'medium'));

    expect(queue.peek()?.id).toBe('job1');
    expect(queue.peek()?.id).toBe('job1'); // Still the same
    expect(queue.size()).toBe(2);
  });

  it('size returns correct count', () => {
    const queue = new InMemoryScanQueue();
    expect(queue.size()).toBe(0);
    queue.enqueue(createMockJob('j1', 'medium'));
    expect(queue.size()).toBe(1);
    queue.enqueue(createMockJob('j2', 'high'));
    expect(queue.size()).toBe(2);
    queue.dequeue();
    expect(queue.size()).toBe(1);
  });

  it('clear removes all jobs', () => {
    const queue = new InMemoryScanQueue();
    queue.enqueue(createMockJob('j1', 'high'));
    queue.enqueue(createMockJob('j2', 'medium'));
    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.peek()).toBeNull();
  });

  it('getAll returns copy of all jobs in sorted order', () => {
    const queue = new InMemoryScanQueue();
    queue.enqueue(createMockJob('low1', 'low'));
    queue.enqueue(createMockJob('high1', 'high'));
    queue.enqueue(createMockJob('med1', 'medium'));

    const all = queue.getAll();
    expect(all.length).toBe(3);
    expect(all[0].id).toBe('high1');
    expect(all[1].id).toBe('med1');
    expect(all[2].id).toBe('low1');

    // Verify it's a copy (mutation doesn't affect queue)
    all.pop();
    expect(queue.size()).toBe(3);
  });

  it('empty queue returns null on dequeue and peek', () => {
    const queue = new InMemoryScanQueue();
    expect(queue.dequeue()).toBeNull();
    expect(queue.peek()).toBeNull();
  });

  it('handles complex priority/FIFO scenario', () => {
    const queue = new InMemoryScanQueue();

    // Enqueue in random order
    queue.enqueue(createMockJob('med-a', 'medium', 300));
    queue.enqueue(createMockJob('high-x', 'high', 200));
    queue.enqueue(createMockJob('low-1', 'low', 100));
    queue.enqueue(createMockJob('high-y', 'high', 50));
    queue.enqueue(createMockJob('med-b', 'medium', 25));

    // Expected order: high-x, high-y (by timestamp), med-a, med-b, low-1
    expect(queue.dequeue()?.id).toBe('high-x');
    expect(queue.dequeue()?.id).toBe('high-y');
    expect(queue.dequeue()?.id).toBe('med-a');
    expect(queue.dequeue()?.id).toBe('med-b');
    expect(queue.dequeue()?.id).toBe('low-1');
  });
});
