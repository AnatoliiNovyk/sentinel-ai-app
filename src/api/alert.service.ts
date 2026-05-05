/**
 * Alert Rules Engine Service
 * Core logic for rule matching, evaluation, and triggering
 * Phase 5: Alert Rules + Auto-Remediation
 * Frontend service for managing alert rules via Supabase
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from './client';
import {
  AlertRule,
  AlertRuleType,
  AlertCondition,
  VulnerabilityForEval,
  RuleEvaluationResult,
  AlertTriggerEvent,
  SeverityLevel,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
} from './types.alert';

/**
 * Alert Rules Engine Service
 * Exported as object with methods (following ScansService pattern)
 */
export const AlertRulesService = {
  /**
   * Create a new alert rule
   */
  async createRule(
    userId: string,
    request: CreateAlertRuleRequest
  ): Promise<{ success: boolean; rule?: AlertRule; error?: string }> {
    try {
      // Validate input
      if (!request.name || !request.rule_type || !request.condition) {
        return { success: false, error: 'Missing required fields: name, rule_type, condition' };
      }

      if (!AlertRulesService.isValidRuleType(request.rule_type)) {
        return { success: false, error: `Invalid rule_type: ${request.rule_type}` };
      }

      const newRule = {
        user_id: userId,
        project_id: request.project_id || null,
        name: request.name,
        description: request.description || null,
        rule_type: request.rule_type,
        condition: request.condition,
        actions: request.actions || { notify: true, channels: ['email'] },
        enabled: true,
        cooldown_minutes: request.cooldown_minutes || 60,
        max_triggers_per_day: request.max_triggers_per_day || 10,
        trigger_count: 0,
        created_by: userId,
        updated_by: userId,
      };

      const { data, error } = await supabase
        .from('alert_rules')
        .insert([newRule])
        .select()
        .single();

      if (error) {
        console.error('[AlertRulesService] Insert error:', error);
        return { success: false, error: error.message };
      }

      return { success: true, rule: data as AlertRule };
    } catch (err: any) {
      console.error('[AlertRulesService] Create error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Update an alert rule
   */
  async updateRule(
    userId: string,
    ruleId: string,
    request: UpdateAlertRuleRequest
  ): Promise<{ success: boolean; rule?: AlertRule; error?: string }> {
    try {
      const updatePayload: any = {
        ...request,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('alert_rules')
        .update(updatePayload)
        .eq('id', ruleId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Rule not found' };
      }

      return { success: true, rule: data as AlertRule };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete an alert rule
   */
  async deleteRule(
    userId: string,
    ruleId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('alert_rules')
        .delete()
        .eq('id', ruleId)
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
   * Get all rules for a user (optionally filtered by project)
   */
  async getRules(
    userId: string,
    projectId?: string
  ): Promise<{ success: boolean; rules?: AlertRule[]; error?: string }> {
    try {
      let query = supabase
        .from('alert_rules')
        .select('*')
        .eq('user_id', userId);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, rules: data as AlertRule[] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get a single rule by ID
   */
  async getRule(
    userId: string,
    ruleId: string
  ): Promise<{ success: boolean; rule?: AlertRule; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { success: false, error: error?.message || 'Rule not found' };
      }

      return { success: true, rule: data as AlertRule };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Evaluate all enabled rules against a vulnerability
   * Returns list of rules that matched
   */
  async evaluateRulesForVulnerability(
    userId: string,
    vuln: VulnerabilityForEval
  ): Promise<RuleEvaluationResult[]> {
    try {
      const { success, rules } = await AlertRulesService.getRules(userId);
      if (!success || !rules) {
        return [];
      }

      const enabledRules = rules.filter((r) => r.enabled);
      const results: RuleEvaluationResult[] = [];

      for (const rule of enabledRules) {
        // Check cooldown
        if (rule.last_triggered_at) {
          const cooldownMs = (rule.cooldown_minutes || 60) * 60 * 1000;
          const lastTriggeredTime = new Date(rule.last_triggered_at).getTime();
          const now = Date.now();

          if (now - lastTriggeredTime < cooldownMs) {
            continue; // Skip rule due to cooldown
          }
        }

        // Check rate limit
        if (rule.trigger_count >= (rule.max_triggers_per_day || 10)) {
          continue; // Skip rule due to daily limit
        }

        // Evaluate condition
        const matched = AlertRulesService.evaluateCondition(
          rule.condition,
          rule.rule_type,
          vuln
        );

        if (matched) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            matched: true,
            matchedVulnerabilities: [vuln],
            reason: `Matched ${rule.rule_type} rule: ${rule.name}`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return results;
    } catch (err: any) {
      console.error('[AlertRulesService] Evaluation error:', err);
      return [];
    }
  },

  /**
   * Trigger an alert based on rule match
   * Updates rule stats and returns trigger event
   */
  async triggerAlert(
    userId: string,
    rule: AlertRule,
    vulns: VulnerabilityForEval[]
  ): Promise<{ success: boolean; event?: AlertTriggerEvent; error?: string }> {
    try {
      // Determine severity from vulnerabilities
      const severity = AlertRulesService.getHighestSeverity(vulns);

      // Build trigger event
      const event: AlertTriggerEvent = {
        id: crypto.randomUUID?.() || Math.random().toString(36).substring(7),
        ruleId: rule.id,
        ruleName: rule.name,
        userId,
        projectId: rule.project_id,
        severity,
        message: `Alert rule "${rule.name}" triggered: ${vulns.length} vulnerability(ies) found`,
        vulnerabilities: vulns,
        actions: rule.actions,
        triggeredAt: new Date().toISOString(),
        status: 'pending',
      };

      // Update rule stats
      await supabase
        .from('alert_rules')
        .update({
          last_triggered_at: event.triggeredAt,
          trigger_count: (rule.trigger_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id);

      return { success: true, event };
    } catch (err: any) {
      console.error('[AlertRulesService] Trigger error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Evaluate a single condition against a vulnerability
   */
  evaluateCondition(
    condition: AlertCondition,
    ruleType: AlertRuleType,
    vuln: VulnerabilityForEval
  ): boolean {
    switch (ruleType) {
      case 'severity_based':
        return AlertRulesService.evaluateSeverity(condition, vuln);

      case 'pattern_matching':
        return AlertRulesService.evaluatePattern(condition, vuln);

      case 'frequency_based':
        // Frequency-based rules require time-windowed event aggregation (handled separately)
        return false;

      case 'custom':
        // Custom rules require backend evaluation support (stub for now)
        return false;

      default:
        return false;
    }
  },

  /**
   * Evaluate severity-based condition
   */
  evaluateSeverity(condition: AlertCondition, vuln: VulnerabilityForEval): boolean {
    if (!condition.severity || condition.severity.length === 0) {
      return false;
    }

    return condition.severity.includes(vuln.severity);
  },

  /**
   * Evaluate pattern-matching condition
   */
  evaluatePattern(condition: AlertCondition, vuln: VulnerabilityForEval): boolean {
    if (condition.cvePattern) {
      const regex = new RegExp(condition.cvePattern, 'i');
      if (!vuln.cve_id || !regex.test(vuln.cve_id)) {
        return false;
      }
    }

    if (condition.assetPattern) {
      const regex = new RegExp(condition.assetPattern, 'i');
      if (!regex.test(vuln.asset)) {
        return false;
      }
    }

    if (condition.descriptionPattern) {
      const regex = new RegExp(condition.descriptionPattern, 'i');
      if (!regex.test(vuln.description)) {
        return false;
      }
    }

    return true;
  },

  /**
   * Helper: Get highest severity from vulnerability list
   */
  getHighestSeverity(vulns: VulnerabilityForEval[]): SeverityLevel {
    const severityOrder: Record<SeverityLevel, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };

    let highest: SeverityLevel = 'info';
    let highestScore = 1;

    for (const vuln of vulns) {
      const score = severityOrder[vuln.severity] || 0;
      if (score > highestScore) {
        highestScore = score;
        highest = vuln.severity;
      }
    }

    return highest;
  },

  /**
   * Validate rule type
   */
  isValidRuleType(type: string): type is AlertRuleType {
    return ['severity_based', 'pattern_matching', 'frequency_based', 'custom'].includes(type);
  },

  /**
   * Reset daily trigger counter (should be called at midnight UTC)
   */
  async resetDailyTriggerCounters(userId: string): Promise<void> {
    try {
      await supabase
        .from('alert_rules')
        .update({ trigger_count: 0, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    } catch (err) {
      console.error('[AlertRulesService] Reset counter error:', err);
    }
  },
};

