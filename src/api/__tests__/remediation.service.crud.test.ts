import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemediationService } from '../remediation.service';

interface DbError {
  message: string;
}

interface DbResult {
  data: unknown;
  error: DbError | null;
}

interface QueryBuilder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (onfulfilled: (value: DbResult) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>;
}

const { mockFrom, setDbResult } = vi.hoisted(() => {
  let dbResult: DbResult = { data: null, error: null };

  const setDbResult = (next: DbResult) => {
    dbResult = next;
  };

  const makeBuilder = (): QueryBuilder => {
    const builder = {} as QueryBuilder;
    Object.assign(builder, {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(async () => dbResult),
      single: vi.fn(async () => dbResult),
      then: (onfulfilled: (value: DbResult) => unknown, _onrejected?: (reason: unknown) => unknown) =>
        Promise.resolve(dbResult).then(onfulfilled),
    });
    return builder;
  };

  const mockFrom = vi.fn(() => makeBuilder());

  return { mockFrom, setDbResult };
});

vi.mock('../client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('RemediationService CRUD/history branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDbResult({ data: null, error: null });
  });

  it('getWorkflows returns success with workflows', async () => {
    setDbResult({ data: [{ id: 'wf-1' }], error: null });

    const result = await RemediationService.getWorkflows('user-1');

    expect(result.success).toBe(true);
    expect(result.workflows).toHaveLength(1);
  });

  it('getWorkflows returns DB error', async () => {
    setDbResult({ data: null, error: { message: 'read failed' } });

    const result = await RemediationService.getWorkflows('user-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('read failed');
  });

  it('getWorkflow returns not found when data is missing', async () => {
    setDbResult({ data: null, error: null });

    const result = await RemediationService.getWorkflow('user-1', 'wf-404');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Workflow not found');
  });

  it('getWorkflowsForRule returns DB error', async () => {
    setDbResult({ data: null, error: { message: 'rule query failed' } });

    const result = await RemediationService.getWorkflowsForRule('user-1', 'rule-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('rule query failed');
  });

  it('updateWorkflow returns not found when row is missing', async () => {
    setDbResult({ data: null, error: null });

    const result = await RemediationService.updateWorkflow('user-1', 'wf-404', {
      name: 'new',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Workflow not found');
  });

  it('deleteWorkflow returns DB error branch', async () => {
    setDbResult({ data: null, error: { message: 'delete failed' } });

    const result = await RemediationService.deleteWorkflow('user-1', 'wf-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('delete failed');
  });

  it('getExecutionHistory returns events in success branch', async () => {
    setDbResult({ data: [{ id: 'event-1' }], error: null });

    const result = await RemediationService.getExecutionHistory('user-1', 'wf-1', 5);

    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
  });

  it('getExecutionHistory returns DB error branch', async () => {
    setDbResult({ data: null, error: { message: 'history failed' } });

    const result = await RemediationService.getExecutionHistory('user-1', 'wf-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('history failed');
  });

  it('getExecutionStats returns zeros for empty events', async () => {
    setDbResult({ data: [], error: null });

    const result = await RemediationService.getExecutionStats('user-1', 'wf-1');

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      avgTimeMs: 0,
    });
  });

  it('getExecutionStats returns DB error branch', async () => {
    setDbResult({ data: null, error: { message: 'stats failed' } });

    const result = await RemediationService.getExecutionStats('user-1', 'wf-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('stats failed');
  });
});
