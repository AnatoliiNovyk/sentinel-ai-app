/**
 * Alert Rules Engine - Types
 * Defines all types for alert rule creation, evaluation, and triggering
 */

export type AlertRuleType = 'severity_based' | 'pattern_matching' | 'frequency_based' | 'custom';

/**
 * Severity levels recognized by the system
 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Alert condition configuration (stored as JSONB in DB)
 */
export interface AlertCondition {
  // For severity_based rules
  severity?: SeverityLevel[];
  
  // For pattern_matching rules
  cvePattern?: string; // Regex pattern for CVE matching (e.g., "CVE-2024-.*")
  assetPattern?: string; // Regex for asset names
  descriptionPattern?: string; // Regex for vulnerability description
  
  // For frequency_based rules
  eventCount?: number; // Trigger if N events occur
  timeWindow?: number; // Within N seconds
  
  // For custom rules
  customLogic?: string; // Custom evaluation logic (e.g., "severity=critical AND cve_id LIKE 'CVE-2024%'")
}

/**
 * Alert action configuration (stored as JSONB in DB)
 */
export interface AlertAction {
  notify?: boolean;
  channels?: ('email' | 'webhook' | 'slack' | 'pagerduty')[];
  webhookUrl?: string;
  
  disable?: boolean; // Disable vulnerable asset
  escalate?: boolean; // Escalate to management
  
  // Custom actions
  customActions?: string[];
}

/**
 * Alert rule record from database
 */
export interface AlertRule {
  id: string;
  user_id: string;
  project_id?: string;
  
  name: string;
  description?: string;
  
  rule_type: AlertRuleType;
  condition: AlertCondition;
  actions: AlertAction;
  
  enabled: boolean;
  cooldown_minutes: number;
  max_triggers_per_day: number;
  
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  trigger_count: number;
  
  created_by?: string;
  updated_by?: string;
}

/**
 * Alert rule creation request
 */
export interface CreateAlertRuleRequest {
  name: string;
  description?: string;
  project_id?: string;
  
  rule_type: AlertRuleType;
  condition: AlertCondition;
  actions: AlertAction;
  
  cooldown_minutes?: number;
  max_triggers_per_day?: number;
}

/**
 * Alert rule update request
 */
export interface UpdateAlertRuleRequest {
  name?: string;
  description?: string;
  
  condition?: AlertCondition;
  actions?: AlertAction;
  
  enabled?: boolean;
  cooldown_minutes?: number;
  max_triggers_per_day?: number;
}

/**
 * Vulnerability record (for rule evaluation)
 */
export interface VulnerabilityForEval {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  cve_id?: string;
  asset: string;
  mitre_tactic?: string;
  cis_control?: string;
}

/**
 * Evaluation result
 */
export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  matchedVulnerabilities: VulnerabilityForEval[];
  reason?: string;
  timestamp: string;
}

/**
 * Alert trigger event (what gets logged/sent)
 */
export interface AlertTriggerEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  userId: string;
  projectId?: string;
  
  severity: SeverityLevel;
  message: string;
  
  vulnerabilities: VulnerabilityForEval[];
  actions: AlertAction;
  
  triggeredAt: string;
  deliveredAt?: string;
  status: 'pending' | 'sent' | 'failed';
}

/**
 * Rule statistics (for dashboards)
 */
export interface AlertRuleStats {
  ruleId: string;
  ruleName: string;
  enabled: boolean;
  
  triggersToday: number;
  lastTriggered?: string;
  
  totalMatches: number;
  successRate: number; // 0-100
}
