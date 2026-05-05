/**
 * Auto-Remediation Workflows - Types
 * Defines action execution, workflow execution, and audit trail
 * Phase 5, Batch 2: Auto-Remediation
 */

/**
 * Supported remediation action types
 */
export type RemediationActionType =
  | 'disable_asset'
  | 'isolate_network'
  | 'escalate_management'
  | 'notify_security_team'
  | 'webhook_call'
  | 'custom_action';

/**
 * Action execution status
 */
export type RemediationStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'retrying';

/**
 * Remediation action configuration
 * Defines what action to execute and how
 */
export interface RemediationAction {
  type: RemediationActionType;
  
  // Common fields
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  
  // Execution parameters
  parameters: {
    // For disable_asset
    assetId?: string;
    assetType?: 'server' | 'container' | 'database' | 'lambda' | 'vpc';
    
    // For isolate_network
    cidrBlock?: string;
    durationMinutes?: number;
    
    // For escalate_management
    escalationLevel?: 'manager' | 'director' | 'ciso';
    notificationChannels?: ('email' | 'slack' | 'pagerduty')[];
    
    // For notify_security_team
    teamId?: string;
    includeFindings?: boolean;
    
    // For webhook_call
    webhookUrl?: string;
    webhookMethod?: 'POST' | 'PUT' | 'PATCH';
    webhookPayload?: Record<string, unknown>;
    
    // For custom actions
    customLogic?: string;
    customParams?: Record<string, unknown>;
  };
  
  // Execution settings
  retryCount?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  
  // Conditional execution
  requiresApproval?: boolean;
  approverRole?: 'manager' | 'security_lead' | 'ciso';
}

/**
 * Remediation workflow
 * Sequence of remediation actions triggered by a rule
 */
export interface RemediationWorkflow {
  id: string;
  ruleId: string;
  ruleName: string;
  
  userId: string;
  projectId?: string;
  
  name: string;
  description?: string;
  
  // Actions to execute (in order)
  actions: RemediationAction[];
  
  // Workflow settings
  enabled: boolean;
  executeSequentially: boolean; // vs parallel
  stopOnFirstFailure: boolean;
  
  // Tracking
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

/**
 * Remediation event record (audit trail)
 * Tracks execution of a remediation workflow
 */
export interface RemediationEvent {
  id: string;
  workflowId: string;
  workflowName: string;
  
  ruleId: string;
  ruleName: string;
  
  userId: string;
  projectId?: string;
  
  // Trigger context
  triggerReason: string; // "Rule matched: Critical CVE"
  vulnerabilityIds?: string[];
  
  // Execution status
  status: RemediationStatus;
  overallStatus: 'pending' | 'in_progress' | 'succeeded' | 'partially_succeeded' | 'failed';
  
  // Action results
  actionResults: {
    actionIndex: number;
    actionType: RemediationActionType;
    status: RemediationStatus;
    startedAt: string;
    completedAt?: string;
    output?: Record<string, unknown>;
    errorMessage?: string;
  }[];
  
  // Metadata
  triggeredAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Audit
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  
  // Statistics
  totalActions: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
}

/**
 * Create workflow request
 */
export interface CreateRemediationWorkflowRequest {
  name: string;
  description?: string;
  ruleId: string;
  projectId?: string;
  
  actions: RemediationAction[];
  
  executeSequentially?: boolean;
  stopOnFirstFailure?: boolean;
}

/**
 * Update workflow request
 */
export interface UpdateRemediationWorkflowRequest {
  name?: string;
  description?: string;
  
  actions?: RemediationAction[];
  
  enabled?: boolean;
  executeSequentially?: boolean;
  stopOnFirstFailure?: boolean;
}

/**
 * Execute workflow request (with context)
 */
export interface ExecuteWorkflowRequest {
  workflowId: string;
  triggerReason: string;
  
  vulnerabilityIds?: string[];
  context?: Record<string, unknown>;
  
  // Optional: require approval
  requestApproval?: boolean;
  approverEmail?: string;
}

/**
 * Action execution result
 */
export interface ActionExecutionResult {
  actionIndex: number;
  actionType: RemediationActionType;
  status: RemediationStatus;
  output?: Record<string, unknown>;
  errorMessage?: string;
  executionTimeMs: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  eventId: string;
  overallStatus: 'pending' | 'in_progress' | 'succeeded' | 'partially_succeeded' | 'failed';
  
  actionResults: ActionExecutionResult[];
  
  message: string;
  
  totalExecutionTimeMs: number;
  successCount: number;
  failureCount: number;
}

/**
 * Remediation statistics for dashboards
 */
export interface RemediationStats {
  workflowId: string;
  workflowName: string;
  
  enabled: boolean;
  
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number; // 0-100
  
  lastExecuted?: string;
  avgExecutionTimeMs: number;
  
  linkedRules: number;
}

/**
 * Workflow with linked rule info
 */
export interface RemediationWorkflowWithRule extends RemediationWorkflow {
  linkedRule?: {
    ruleId: string;
    ruleName: string;
    triggerCount: number;
  };
}
