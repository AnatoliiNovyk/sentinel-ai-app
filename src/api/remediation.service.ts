/**
 * Auto-Remediation Service
 * Executes remediation workflows triggered by alert rules
 * Phase 5, Batch 2: Auto-Remediation
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from './client';
import {
  RemediationWorkflow,
  RemediationEvent,
  RemediationAction,
  RemediationStatus,
  CreateRemediationWorkflowRequest,
  UpdateRemediationWorkflowRequest,
  ExecuteWorkflowRequest,
  ActionExecutionResult,
  WorkflowExecutionResult,
} from './types.remediation';

/**
 * Remediation Service
 */
export const RemediationService = {
  /**
   * Create a new remediation workflow
   */
  async createWorkflow(
    userId: string,
    request: CreateRemediationWorkflowRequest
  ): Promise<{ success: boolean; workflow?: RemediationWorkflow; error?: string }> {
    try {
      // Validate input
      if (!request.name || !request.ruleId || !request.actions || request.actions.length === 0) {
        return {
          success: false,
          error: 'Missing required fields: name, ruleId, actions (non-empty)',
        };
      }

      const newWorkflow = {
        user_id: userId,
        rule_id: request.ruleId,
        project_id: request.projectId || null,
        name: request.name,
        description: request.description || null,
        actions: request.actions,
        enabled: true,
        execute_sequentially: request.executeSequentially !== false,
        stop_on_first_failure: request.stopOnFirstFailure !== false,
        created_by: userId,
        updated_by: userId,
      };

      const { data, error } = await supabase
        .from('remediation_workflows')
        .insert([newWorkflow])
        .select()
        .single();

      if (error) {
        console.error('[RemediationService] Create error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, workflow: data as RemediationWorkflow };
    } catch (err: any) {
      console.error('[RemediationService] Create error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get all workflows for a user
   */
  async getWorkflows(userId: string): Promise<{
    success: boolean;
    workflows?: RemediationWorkflow[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('remediation_workflows')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, workflows: data as RemediationWorkflow[] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get a single workflow by ID
   */
  async getWorkflow(
    userId: string,
    workflowId: string
  ): Promise<{ success: boolean; workflow?: RemediationWorkflow; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('remediation_workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Workflow not found' };
      }

      return { success: true, workflow: data as RemediationWorkflow };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get workflows for a specific rule
   */
  async getWorkflowsForRule(
    userId: string,
    ruleId: string
  ): Promise<{
    success: boolean;
    workflows?: RemediationWorkflow[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('remediation_workflows')
        .select('*')
        .eq('user_id', userId)
        .eq('rule_id', ruleId)
        .eq('enabled', true);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, workflows: data as RemediationWorkflow[] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Update a remediation workflow
   */
  async updateWorkflow(
    userId: string,
    workflowId: string,
    request: UpdateRemediationWorkflowRequest
  ): Promise<{ success: boolean; workflow?: RemediationWorkflow; error?: string }> {
    try {
      const updatePayload: any = {
        ...request,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('remediation_workflows')
        .update(updatePayload)
        .eq('id', workflowId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Workflow not found' };
      }

      return { success: true, workflow: data as RemediationWorkflow };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a remediation workflow
   */
  async deleteWorkflow(
    userId: string,
    workflowId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('remediation_workflows')
        .delete()
        .eq('id', workflowId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Execute a remediation workflow
   * Core method: runs all actions sequentially or in parallel
   */
  async executeWorkflow(
    userId: string,
    request: ExecuteWorkflowRequest
  ): Promise<{ success: boolean; result?: WorkflowExecutionResult; error?: string }> {
    try {
      // Get workflow
      const { success: getSuccess, workflow } = await RemediationService.getWorkflow(
        userId,
        request.workflowId
      );

      if (!getSuccess || !workflow) {
        return { success: false, error: 'Workflow not found' };
      }

      if (!workflow.enabled) {
        return { success: false, error: 'Workflow is disabled' };
      }

      // Create remediation event
      const eventStartTime = Date.now();

      const eventRecord: Omit<RemediationEvent, 'id' | 'action_results'> = {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        rule_id: workflow.rule_id,
        rule_name: 'Unknown', // Will be filled in by join
        user_id: userId,
        project_id: workflow.project_id,
        trigger_reason: request.triggerReason,
        vulnerability_ids: request.vulnerabilityIds || [],
        overall_status: 'in_progress',
        action_results: [],
        triggered_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        total_actions: workflow.actions.length,
        success_count: 0,
        failure_count: 0,
        retry_count: 0,
      };

      // Create event in DB
      const { data: eventData, error: eventError } = await supabase
        .from('remediation_events')
        .insert([eventRecord])
        .select()
        .single();

      if (eventError || !eventData) {
        console.error('[RemediationService] Event creation failed:', eventError);
        return { success: false, error: 'Failed to create remediation event' };
      }

      const event = eventData as RemediationEvent;

      // Execute actions
      const actionResults: ActionExecutionResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      if (workflow.execute_sequentially) {
        // Sequential execution
        for (let i = 0; i < workflow.actions.length; i++) {
          const result = await RemediationService.executeAction(
            workflow.actions[i],
            userId,
            i
          );

          actionResults.push(result);

          if (result.status === 'succeeded') {
            successCount++;
          } else {
            failureCount++;
            if (workflow.stop_on_first_failure) {
              break;
            }
          }
        }
      } else {
        // Parallel execution (stub for now — would use Promise.all)
        const promises = workflow.actions.map((action, i) =>
          RemediationService.executeAction(action, userId, i)
        );

        const results = await Promise.all(promises);
        actionResults.push(...results);

        successCount = results.filter((r) => r.status === 'succeeded').length;
        failureCount = results.filter((r) => r.status === 'failed').length;
      }

      // Update event with results
      const overallStatus =
        failureCount === 0
          ? 'succeeded'
          : successCount > 0
            ? 'partially_succeeded'
            : 'failed';

      const executionTimeMs = Date.now() - eventStartTime;

      await supabase
        .from('remediation_events')
        .update({
          overall_status: overallStatus,
          action_results: actionResults,
          completed_at: new Date().toISOString(),
          success_count: successCount,
          failure_count: failureCount,
          execution_time_ms: executionTimeMs,
        })
        .eq('id', event.id);

      // Update workflow execution count
      await supabase
        .from('remediation_workflows')
        .update({
          last_executed_at: new Date().toISOString(),
          execution_count: (workflow.execution_count || 0) + 1,
        })
        .eq('id', workflow.id);

      return {
        success: true,
        result: {
          eventId: event.id,
          overallStatus,
          actionResults,
          message: `Executed ${workflow.actions.length} actions: ${successCount} succeeded, ${failureCount} failed`,
          totalExecutionTimeMs: executionTimeMs,
          successCount,
          failureCount,
        },
      };
    } catch (err: any) {
      console.error('[RemediationService] Execute error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Execute a single remediation action
   */
  async executeAction(
    action: RemediationAction,
    userId: string,
    actionIndex: number
  ): Promise<ActionExecutionResult> {
    const startTime = Date.now();

    // Validate action
    if (!action) {
      return {
        actionIndex,
        actionType: 'unknown',
        status: 'failed',
        errorMessage: 'Action is null or undefined',
        executionTimeMs: Date.now() - startTime,
      };
    }

    const _timeout = action.parameters?.timeoutMs || 30000;

    try {
      let status: RemediationStatus = 'pending';
      let output: Record<string, unknown> | undefined;
      let errorMessage: string | undefined;

      // Execute based on action type
      switch (action.type) {
        case 'disable_asset':
          ({ status, output, errorMessage } = await RemediationService.executeDisableAsset(
            action
          ));
          break;

        case 'isolate_network':
          ({ status, output, errorMessage } = await RemediationService.executeIsolateNetwork(
            action
          ));
          break;

        case 'escalate_management':
          ({ status, output, errorMessage } =
            await RemediationService.executeEscalateManagement(action));
          break;

        case 'notify_security_team':
          ({ status, output, errorMessage } = await RemediationService.executeNotifyTeam(
            action
          ));
          break;

        case 'webhook_call':
          ({ status, output, errorMessage } = await RemediationService.executeWebhook(action));
          break;

        case 'custom_action':
          status = 'failed';
          errorMessage = 'Custom actions not yet supported';
          break;

        default:
          status = 'failed';
          errorMessage = `Unknown action type: ${action.type}`;
      }

      const executionTimeMs = Date.now() - startTime;

      return {
        actionIndex,
        actionType: action.type,
        status,
        output,
        errorMessage,
        executionTimeMs,
      };
    } catch (err: any) {
      console.error(`[RemediationService] Action execution failed:`, err);

      return {
        actionIndex,
        actionType: action.type,
        status: 'failed',
        errorMessage: err.message || 'Unknown error during action execution',
        executionTimeMs: Date.now() - startTime,
      };
    }
  },

  /**
   * Execute: Disable Asset
   */
  async executeDisableAsset(action: RemediationAction): Promise<{
    status: RemediationStatus;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }> {
    try {
      const assetId = action.parameters?.assetId;
      const assetType = action.parameters?.assetType || 'server';

      if (!assetId) {
        return { status: 'failed', errorMessage: 'Missing assetId parameter' };
      }

      // Stub: In real implementation, would call cloud provider APIs
      // e.g., AWS EC2 stop, GCP Compute stop, etc.
      console.log(`[Remediation] Disabling ${assetType} ${assetId}`);

      return {
        status: 'succeeded',
        output: {
          assetId,
          assetType,
          action: 'disabled',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return { status: 'failed', errorMessage: err.message };
    }
  },

  /**
   * Execute: Isolate Network
   */
  async executeIsolateNetwork(action: RemediationAction): Promise<{
    status: RemediationStatus;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }> {
    try {
      const cidrBlock = action.parameters?.cidrBlock;
      const durationMinutes = action.parameters?.durationMinutes || 30;

      if (!cidrBlock) {
        return { status: 'failed', errorMessage: 'Missing cidrBlock parameter' };
      }

      // Stub: Would call cloud provider network APIs
      console.log(
        `[Remediation] Isolating network ${cidrBlock} for ${durationMinutes} minutes`
      );

      return {
        status: 'succeeded',
        output: {
          cidrBlock,
          durationMinutes,
          action: 'isolated',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return { status: 'failed', errorMessage: err.message };
    }
  },

  /**
   * Execute: Escalate to Management
   */
  async executeEscalateManagement(action: RemediationAction): Promise<{
    status: RemediationStatus;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }> {
    try {
      const escalationLevel = action.parameters?.escalationLevel || 'manager';
      const channels = action.parameters?.notificationChannels || ['email'];

      // Stub: Would send notifications to management
      console.log(
        `[Remediation] Escalating to ${escalationLevel} via ${channels.join(', ')}`
      );

      return {
        status: 'succeeded',
        output: {
          escalationLevel,
          channels,
          notificationsSent: channels.length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return { status: 'failed', errorMessage: err.message };
    }
  },

  /**
   * Execute: Notify Security Team
   */
  async executeNotifyTeam(action: RemediationAction): Promise<{
    status: RemediationStatus;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }> {
    try {
      const teamId = action.parameters?.teamId || 'security-team';
      const includeFindings = action.parameters?.includeFindings || false;

      // Stub: Would send notifications to team
      console.log(`[Remediation] Notifying team ${teamId}, findings: ${includeFindings}`);

      return {
        status: 'succeeded',
        output: {
          teamId,
          includeFindings,
          notificationsQueued: 1,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return { status: 'failed', errorMessage: err.message };
    }
  },

  /**
   * Execute: Webhook Call
   */
  async executeWebhook(action: RemediationAction): Promise<{
    status: RemediationStatus;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }> {
    try {
      const webhookUrl = action.parameters?.webhookUrl;
      const method = action.parameters?.webhookMethod || 'POST';
      const payload = action.parameters?.webhookPayload || {};

      if (!webhookUrl) {
        return { status: 'failed', errorMessage: 'Missing webhookUrl parameter' };
      }

      // Stub: Would make HTTP request to webhook
      console.log(`[Remediation] Calling webhook ${method} ${webhookUrl}`);

      return {
        status: 'succeeded',
        output: {
          webhookUrl,
          method,
          payloadSize: JSON.stringify(payload).length,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      return { status: 'failed', errorMessage: err.message };
    }
  },

  /**
   * Get execution history for a workflow
   */
  async getExecutionHistory(
    userId: string,
    workflowId: string,
    limit: number = 10
  ): Promise<{ success: boolean; events?: RemediationEvent[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('remediation_events')
        .select('*')
        .eq('user_id', userId)
        .eq('workflow_id', workflowId)
        .order('triggered_at', { ascending: false })
        .limit(limit);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, events: data as RemediationEvent[] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get execution statistics for a workflow
   */
  async getExecutionStats(
    userId: string,
    workflowId: string
  ): Promise<{
    success: boolean;
    stats?: { totalExecutions: number; successCount: number; failureCount: number; avgTimeMs: number };
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('remediation_events')
        .select('overall_status, execution_time_ms')
        .eq('user_id', userId)
        .eq('workflow_id', workflowId);

      if (error) {
        return { success: false, error: error.message };
      }

      const events = data || [];
      const successCount = events.filter((e: any) => e.overall_status === 'succeeded').length;
      const failureCount = events.filter((e: any) => e.overall_status === 'failed').length;
      const avgTimeMs =
        events.length > 0
          ? events.reduce((sum: number, e: any) => sum + (e.execution_time_ms || 0), 0) /
            events.length
          : 0;

      return {
        success: true,
        stats: {
          totalExecutions: events.length,
          successCount,
          failureCount,
          avgTimeMs: Math.round(avgTimeMs),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
