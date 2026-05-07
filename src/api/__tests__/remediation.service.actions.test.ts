/**
 * Batch F: remediation.service.ts — action execution branch coverage
 * Covers: createWorkflow validation, executeAction null/custom/unknown/throw,
 *         executeDisableAsset missing assetId, executeIsolateNetwork missing cidrBlock,
 *         executeWebhook missing webhookUrl, executeWorkflow parallel path,
 *         createWorkflow DB error + throw, getWorkflow throw
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemediationService } from '../remediation.service';
import type {
  RemediationAction,
  RemediationWorkflow,
  ExecuteWorkflowRequest,
} from '../types.remediation';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

const baseWorkflow: RemediationWorkflow = {
  id: 'wf-1',
  userId: 'user-1',
  ruleId: 'rule-1',
  ruleName: 'Test Rule',
  projectId: undefined,
  name: 'Test Workflow',
  description: '',
  actions: [],
  enabled: true,
  executeSequentially: true,
  stopOnFirstFailure: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'user-1',
  updated_by: 'user-1',
};

const makeAction = (type: RemediationAction['type'], params?: Record<string, unknown>): RemediationAction => ({
  type,
  description: type,
  priority: 'medium',
  parameters: params ?? {},
});

describe('RemediationService — action execution branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ──────────────────────────────
  // createWorkflow — validation paths
  // ──────────────────────────────

  it('createWorkflow returns error when name is missing', async () => {
    const result = await RemediationService.createWorkflow('user-1', {
      name: '',
      ruleId: 'rule-1',
      actions: [makeAction('disable_asset')],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Missing required fields/);
  });

  it('createWorkflow returns error when actions are empty', async () => {
    const result = await RemediationService.createWorkflow('user-1', {
      name: 'Test',
      ruleId: 'rule-1',
      actions: [],
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Missing required fields/);
  });

  it('createWorkflow returns DB error', async () => {
    mockFrom.mockImplementationOnce(() => {
      const chain = {
        insert: vi.fn(() => chain),
        select: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
      };
      return chain;
    });

    const result = await RemediationService.createWorkflow('user-1', {
      name: 'Test',
      ruleId: 'rule-1',
      actions: [makeAction('disable_asset')],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('insert failed');
  });

  it('createWorkflow handles unexpected throw', async () => {
    mockFrom.mockImplementationOnce(() => { throw new Error('crash'); });

    const result = await RemediationService.createWorkflow('user-1', {
      name: 'Test',
      ruleId: 'rule-1',
      actions: [makeAction('disable_asset')],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('crash');
  });

  // ──────────────────────────────
  // getWorkflow — throw path
  // ──────────────────────────────

  it('getWorkflow handles unexpected throw', async () => {
    mockFrom.mockImplementationOnce(() => { throw new Error('db crash'); });

    const result = await RemediationService.getWorkflow('user-1', 'wf-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('db crash');
  });

  // ──────────────────────────────
  // executeAction — null action guard
  // ──────────────────────────────

  it('executeAction handles null action', async () => {
    const result = await RemediationService.executeAction(
      null as unknown as RemediationAction,
      'user-1',
      0
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/null or undefined/);
  });

  it('executeAction returns failed for custom_action type', async () => {
    const result = await RemediationService.executeAction(makeAction('custom_action'), 'user-1', 0);
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/Custom actions not yet supported/);
  });

  it('executeAction returns failed for unknown action type', async () => {
    const result = await RemediationService.executeAction(
      makeAction('unknown_type' as never),
      'user-1',
      0
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/Unknown action type/);
  });

  // ──────────────────────────────
  // executeDisableAsset — missing param
  // ──────────────────────────────

  it('executeDisableAsset returns failed when assetId is missing', async () => {
    const result = await RemediationService.executeDisableAsset(
      makeAction('disable_asset', {}) // no assetId
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('Missing assetId parameter');
  });

  it('executeDisableAsset succeeds with assetId provided', async () => {
    const result = await RemediationService.executeDisableAsset(
      makeAction('disable_asset', { assetId: 'srv-001', assetType: 'ec2' })
    );
    expect(result.status).toBe('succeeded');
    expect(result.output?.assetId).toBe('srv-001');
  });

  // ──────────────────────────────
  // executeIsolateNetwork — missing param
  // ──────────────────────────────

  it('executeIsolateNetwork returns failed when cidrBlock is missing', async () => {
    const result = await RemediationService.executeIsolateNetwork(
      makeAction('isolate_network', {})
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('Missing cidrBlock parameter');
  });

  it('executeIsolateNetwork succeeds with cidrBlock provided', async () => {
    const result = await RemediationService.executeIsolateNetwork(
      makeAction('isolate_network', { cidrBlock: '10.0.0.0/16', durationMinutes: 60 })
    );
    expect(result.status).toBe('succeeded');
    expect(result.output?.cidrBlock).toBe('10.0.0.0/16');
  });

  // ──────────────────────────────
  // executeWebhook — missing param
  // ──────────────────────────────

  it('executeWebhook returns failed when webhookUrl is missing', async () => {
    const result = await RemediationService.executeWebhook(
      makeAction('webhook_call', {})
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('Missing webhookUrl parameter');
  });

  it('executeWebhook succeeds with webhookUrl provided', async () => {
    const result = await RemediationService.executeWebhook(
      makeAction('webhook_call', { webhookUrl: 'https://hooks.example.com/notify', webhookMethod: 'POST' })
    );
    expect(result.status).toBe('succeeded');
    expect(result.output?.webhookUrl).toBe('https://hooks.example.com/notify');
  });

  // ──────────────────────────────
  // executeEscalateManagement — default params
  // ──────────────────────────────

  it('executeEscalateManagement uses default escalationLevel and channels', async () => {
    const result = await RemediationService.executeEscalateManagement(
      makeAction('escalate_management', {})
    );
    expect(result.status).toBe('succeeded');
    expect(result.output?.escalationLevel).toBe('manager');
  });

  // ──────────────────────────────
  // executeWorkflow — parallel execution path
  // ──────────────────────────────

  it('executeWorkflow executes actions in parallel when executeSequentially=false', async () => {
    const parallelWorkflow: RemediationWorkflow = {
      ...baseWorkflow,
      id: 'wf-parallel',
      executeSequentially: false,
      stopOnFirstFailure: false,
      actions: [
        makeAction('disable_asset', { assetId: 'srv-1' }),
        makeAction('notify_security_team', { teamId: 'ops' }),
      ],
    };

    vi.spyOn(RemediationService, 'getWorkflow').mockResolvedValue({
      success: true,
      workflow: parallelWorkflow,
    });

    // Mock: event insert (call 1), event update (call 2), workflow update (call 3)
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const chain = {
          insert: vi.fn(() => chain),
          select: vi.fn(() => chain),
          single: vi.fn().mockResolvedValue({
            data: { ...parallelWorkflow, id: 'evt-parallel' },
            error: null,
          }),
        };
        return chain;
      }
      // update chains — eq at the end must resolve
      return {
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
    });

    const request: ExecuteWorkflowRequest = {
      workflowId: 'wf-parallel',
      triggerReason: 'test parallel',
      vulnerabilityIds: [],
    };

    const result = await RemediationService.executeWorkflow('user-1', request);

    expect(result.success).toBe(true);
    expect(result.result?.actionResults).toHaveLength(2);
  });

  // ──────────────────────────────
  // executeAction — action throws
  // ──────────────────────────────

  it('executeAction catches exception from sub-method', async () => {
    vi.spyOn(RemediationService, 'executeDisableAsset').mockRejectedValueOnce(new Error('sub crash'));

    const result = await RemediationService.executeAction(
      makeAction('disable_asset', { assetId: 'srv-crash' }),
      'user-1',
      2
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toBe('sub crash');
  });
});
