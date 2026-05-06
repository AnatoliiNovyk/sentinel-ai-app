import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockSingle,
  mockLimit,
  mockUpdateEq,
  mockFrom,
} = vi.hoisted(() => {
  type MockChain = {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };

  const mockSingle = vi.fn();
  const mockLimit = vi.fn();
  const mockUpdateEq = vi.fn();

  const mockFrom = vi.fn((_: string): unknown => {
    const chain = {} as MockChain;
    Object.assign(chain, {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn(() => ({ eq: mockUpdateEq })),
      delete: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: mockLimit,
      single: mockSingle,
    });
    return chain;
  });

  return { mockSingle, mockLimit, mockUpdateEq, mockFrom };
});

vi.mock('../client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { RemediationService } from '../remediation.service';
import type { RemediationWorkflow, RemediationAction } from '../types.remediation';

const baseActions: RemediationAction[] = [
  {
    type: 'disable_asset',
    description: 'Disable',
    priority: 'high',
    parameters: { assetId: 'asset-1' },
  },
  {
    type: 'notify_security_team',
    description: 'Notify',
    priority: 'high',
    parameters: { teamId: 'sec-team' },
  },
];

const makeWorkflow = (overrides: Partial<RemediationWorkflow> = {}): RemediationWorkflow => ({
  id: 'wf-1',
  userId: 'user-1',
  ruleId: 'rule-1',
  ruleName: 'Rule',
  projectId: 'project-1',
  name: 'Workflow',
  description: 'desc',
  actions: baseActions,
  enabled: true,
  executeSequentially: true,
  stopOnFirstFailure: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'user-1',
  updated_by: 'user-1',
  ...overrides,
});

describe('RemediationService workflow branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 'event-1' }, error: null });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  it('executeWorkflow returns error when workflow is missing', async () => {
    vi.spyOn(RemediationService, 'getWorkflow').mockResolvedValue({
      success: false,
      error: 'Workflow not found',
    });

    const result = await RemediationService.executeWorkflow('user-1', {
      workflowId: 'wf-404',
      triggerReason: 'manual',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Workflow not found');
  });

  it('executeWorkflow returns error when workflow is disabled', async () => {
    vi.spyOn(RemediationService, 'getWorkflow').mockResolvedValue({
      success: true,
      workflow: makeWorkflow({ enabled: false }),
    });

    const result = await RemediationService.executeWorkflow('user-1', {
      workflowId: 'wf-1',
      triggerReason: 'alert',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Workflow is disabled');
  });

  it('executeWorkflow returns failure when event creation fails', async () => {
    vi.spyOn(RemediationService, 'getWorkflow').mockResolvedValue({
      success: true,
      workflow: makeWorkflow(),
    });
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    const result = await RemediationService.executeWorkflow('user-1', {
      workflowId: 'wf-1',
      triggerReason: 'alert',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to create remediation event');
  });

  it('executeWorkflow sequential stopOnFirstFailure stops after first failure', async () => {
    vi.spyOn(RemediationService, 'getWorkflow').mockResolvedValue({
      success: true,
      workflow: makeWorkflow({ stopOnFirstFailure: true }),
    });

    const actionSpy = vi
      .spyOn(RemediationService, 'executeAction')
      .mockResolvedValueOnce({
        actionIndex: 0,
        actionType: 'disable_asset',
        status: 'failed',
        errorMessage: 'boom',
        executionTimeMs: 1,
      })
      .mockResolvedValue({
        actionIndex: 1,
        actionType: 'notify_security_team',
        status: 'succeeded',
        executionTimeMs: 1,
      });

    const result = await RemediationService.executeWorkflow('user-1', {
      workflowId: 'wf-1',
      triggerReason: 'alert',
    });

    expect(result.success).toBe(true);
    expect(result.result?.overallStatus).toBe('failed');
    expect(result.result?.failureCount).toBe(1);
    expect(result.result?.successCount).toBe(0);
    expect(actionSpy).toHaveBeenCalledTimes(1);
  });

  it('executeWorkflow parallel mode executes all actions and returns partially_succeeded', async () => {
    vi.spyOn(RemediationService, 'getWorkflow').mockResolvedValue({
      success: true,
      workflow: makeWorkflow({ executeSequentially: false }),
    });

    vi.spyOn(RemediationService, 'executeAction')
      .mockResolvedValueOnce({
        actionIndex: 0,
        actionType: 'disable_asset',
        status: 'succeeded',
        executionTimeMs: 2,
      })
      .mockResolvedValueOnce({
        actionIndex: 1,
        actionType: 'notify_security_team',
        status: 'failed',
        errorMessage: 'down',
        executionTimeMs: 2,
      });

    const result = await RemediationService.executeWorkflow('user-1', {
      workflowId: 'wf-1',
      triggerReason: 'manual',
      vulnerabilityIds: ['v-1'],
    });

    expect(result.success).toBe(true);
    expect(result.result?.overallStatus).toBe('partially_succeeded');
    expect(result.result?.successCount).toBe(1);
    expect(result.result?.failureCount).toBe(1);
  });

  it('getExecutionStats returns rounded average and status counts', async () => {
    const events = [
      { overall_status: 'succeeded', execution_time_ms: 110 },
      { overall_status: 'failed', execution_time_ms: 241 },
      { overall_status: 'succeeded', execution_time_ms: 150 },
    ];

    const eqLevel2 = vi.fn().mockResolvedValue({ data: events, error: null });
    const eqLevel1 = vi.fn(() => ({ eq: eqLevel2 }));

    mockFrom.mockImplementationOnce(() => ({
      select: vi.fn(() => ({ eq: eqLevel1 })),
    }));

    const result = await RemediationService.getExecutionStats('user-1', 'wf-1');

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({
      totalExecutions: 3,
      successCount: 2,
      failureCount: 1,
      avgTimeMs: 167,
    });
  });
});
