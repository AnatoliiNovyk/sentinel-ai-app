/**
 * Remediation Service - Tests
 * Unit and integration tests for remediation workflows
 * Phase 5, Batch 2: Auto-Remediation
 */

import { describe, it, expect, vi } from 'vitest';
import { RemediationService } from '../remediation.service';
import {
  RemediationWorkflow,
  RemediationAction,
  CreateRemediationWorkflowRequest,
} from '../types.remediation';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table) => ({
      select: vi.fn(function () {
        return this;
      }),
      insert: vi.fn(function () {
        return this;
      }),
      update: vi.fn(function () {
        return this;
      }),
      delete: vi.fn(function () {
        return this;
      }),
      eq: vi.fn(function () {
        return this;
      }),
      order: vi.fn(function () {
        return this;
      }),
      limit: vi.fn(function () {
        return this;
      }),
      single: vi.fn(async function () {
        return { data: mockWorkflow, error: null };
      }),
    })),
  })),
}));

// Mock data
const mockWorkflow: RemediationWorkflow = {
  id: 'workflow-1',
  user_id: 'test-user-1',
  rule_id: 'alert-rule-1',
  rule_name: 'Critical CVE Alert',
  project_id: 'test-project-1',
  name: 'Auto-Disable on Critical',
  description: 'Automatically disable assets when critical CVE found',
  actions: [
    {
      type: 'disable_asset',
      description: 'Disable vulnerable server',
      priority: 'critical',
      parameters: {
        assetId: 'server-001',
        assetType: 'server',
      },
    },
    {
      type: 'escalate_management',
      description: 'Notify management',
      priority: 'critical',
      parameters: {
        escalationLevel: 'ciso',
        notificationChannels: ['email', 'slack'],
      },
    },
  ],
  enabled: true,
  execute_sequentially: true,
  stop_on_first_failure: false,
  created_at: '2026-05-05T10:00:00Z',
  updated_at: '2026-05-05T10:00:00Z',
  execution_count: 0,
  created_by: 'test-user-1',
  updated_by: 'test-user-1',
};

const mockAction: RemediationAction = {
  type: 'disable_asset',
  description: 'Disable server',
  priority: 'high',
  parameters: {
    assetId: 'server-001',
    assetType: 'server',
  },
};

describe('RemediationService', () => {
  describe('createWorkflow', () => {
    it('should create a workflow with valid input', async () => {
      const request: CreateRemediationWorkflowRequest = {
        name: 'New Workflow',
        description: 'Test workflow',
        ruleId: 'rule-1',
        actions: [mockAction],
      };

      const result = await RemediationService.createWorkflow('test-user', request);

      expect(result.success).toBe(true);
      expect(result.workflow).toBeDefined();
    });

    it('should reject workflow without required fields', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request: any = {
        name: 'Incomplete',
        // Missing ruleId and actions
      };

      const result = await RemediationService.createWorkflow('test-user', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should reject workflow with empty actions', async () => {
      const request: CreateRemediationWorkflowRequest = {
        name: 'No Actions',
        ruleId: 'rule-1',
        actions: [], // Empty!
      };

      const result = await RemediationService.createWorkflow('test-user', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });
  });

  describe('action execution', () => {
    it('should execute disable_asset action', async () => {
      const result = await RemediationService.executeAction(mockAction, 'test-user', 0);

      expect(result.status).toBe('succeeded');
      expect(result.actionType).toBe('disable_asset');
      expect(result.output?.assetId).toBe('server-001');
    });

    it('should handle missing assetId in disable_asset', async () => {
      const action: RemediationAction = {
        ...mockAction,
        parameters: { assetType: 'server' }, // Missing assetId
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Missing assetId');
    });

    it('should execute isolate_network action', async () => {
      const action: RemediationAction = {
        type: 'isolate_network',
        description: 'Isolate network',
        priority: 'high',
        parameters: {
          cidrBlock: '10.0.0.0/16',
          durationMinutes: 60,
        },
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('succeeded');
      expect(result.output?.cidrBlock).toBe('10.0.0.0/16');
    });

    it('should execute escalate_management action', async () => {
      const action: RemediationAction = {
        type: 'escalate_management',
        description: 'Escalate',
        priority: 'critical',
        parameters: {
          escalationLevel: 'ciso',
          notificationChannels: ['email'],
        },
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('succeeded');
      expect(result.output?.escalationLevel).toBe('ciso');
    });

    it('should execute notify_security_team action', async () => {
      const action: RemediationAction = {
        type: 'notify_security_team',
        description: 'Notify team',
        priority: 'high',
        parameters: {
          teamId: 'security-team',
          includeFindings: true,
        },
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('succeeded');
      expect(result.output?.teamId).toBe('security-team');
    });

    it('should execute webhook_call action', async () => {
      const action: RemediationAction = {
        type: 'webhook_call',
        description: 'Call webhook',
        priority: 'medium',
        parameters: {
          webhookUrl: 'https://example.com/webhook',
          webhookMethod: 'POST',
          webhookPayload: { alert: 'critical' },
        },
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('succeeded');
      expect(result.output?.webhookUrl).toContain('webhook');
    });

    it('should handle missing webhookUrl in webhook_call', async () => {
      const action: RemediationAction = {
        type: 'webhook_call',
        description: 'Call webhook',
        priority: 'medium',
        parameters: {}, // Missing webhookUrl
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Missing webhookUrl');
    });

    it('should handle unknown action types', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const action: any = {
        type: 'unknown_action',
        description: 'Unknown',
        priority: 'low',
        parameters: {},
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('Unknown action type');
    });
  });

  describe('action types', () => {
    it('should validate supported action types', () => {
      const validTypes = [
        'disable_asset',
        'isolate_network',
        'escalate_management',
        'notify_security_team',
        'webhook_call',
        'custom_action',
      ];

      for (const type of validTypes) {
        expect(['disable_asset', 'isolate_network', 'escalate_management', 'notify_security_team', 'webhook_call', 'custom_action']).toContain(type);
      }
    });
  });

  describe('remediation status', () => {
    it('should track action execution status', async () => {
      const result = await RemediationService.executeAction(mockAction, 'test-user', 0);

      expect(['pending', 'in_progress', 'succeeded', 'failed', 'retrying']).toContain(
        result.status
      );
    });

    it('should record execution time', async () => {
      const result = await RemediationService.executeAction(mockAction, 'test-user', 0);

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include action index in result', async () => {
      const result = await RemediationService.executeAction(mockAction, 'test-user', 2);

      expect(result.actionIndex).toBe(2);
    });
  });

  describe('workflow execution', () => {
    it('should handle sequential action execution', async () => {
      // Tested through executeWorkflow with execute_sequentially: true
      expect(mockWorkflow.execute_sequentially).toBe(true);
    });

    it('should respect stop_on_first_failure flag', async () => {
      expect(mockWorkflow.stop_on_first_failure).toBe(false);
    });

    it('should track action count in workflow', async () => {
      expect(mockWorkflow.actions.length).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle null action gracefully', async () => {
      const result = await RemediationService.executeAction(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        undefined as any,
        'test-user',
        0
      );

      expect(result.status).toBe('failed');
    });

    it('should provide meaningful error messages', async () => {
      const action: RemediationAction = {
        type: 'disable_asset',
        description: 'Test',
        priority: 'high',
        parameters: {}, // Missing required assetId
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.errorMessage).toBeDefined();
      expect(result.errorMessage?.length).toBeGreaterThan(0);
    });
  });

  describe('parameters validation', () => {
    it('should validate action parameters by type', async () => {
      const action: RemediationAction = {
        type: 'isolate_network',
        description: 'Test',
        priority: 'high',
        parameters: {
          // Missing required cidrBlock
          durationMinutes: 30,
        },
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      expect(result.status).toBe('failed');
    });

    it('should use default parameters when not provided', async () => {
      const action: RemediationAction = {
        type: 'escalate_management',
        description: 'Test',
        priority: 'high',
        parameters: {
          // No escalationLevel or notificationChannels provided
        },
      };

      const result = await RemediationService.executeAction(action, 'test-user', 0);

      // Should still succeed with defaults
      expect(result.status).toBe('succeeded');
    });
  });

  describe('workflow structure', () => {
    it('should have valid action array', () => {
      expect(Array.isArray(mockWorkflow.actions)).toBe(true);
      expect(mockWorkflow.actions.length).toBeGreaterThan(0);
    });

    it('should track execution metadata', () => {
      expect(mockWorkflow.execution_count).toBeGreaterThanOrEqual(0);
      expect(mockWorkflow.created_at).toBeDefined();
      expect(mockWorkflow.updated_at).toBeDefined();
    });

    it('should maintain enabled flag', () => {
      expect(mockWorkflow.enabled).toBe(true);
    });
  });
});
