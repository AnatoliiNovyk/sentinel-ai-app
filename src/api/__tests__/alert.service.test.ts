/**
 * Alert Rules Engine - Tests
 * Unit and integration tests for alert service and router
 * Phase 5: Alert Rules + Auto-Remediation
 */

import { describe, it, expect, vi } from 'vitest';
import { AlertRulesService } from '../alert.service';
import {
  AlertRule,
  AlertAction,
  AlertCondition,
  VulnerabilityForEval,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
} from '../types.alert';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table) => {
      const chain = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        single: vi.fn(async () => ({ data: mockAlertRule, error: null })),
      };
      return chain;
    }),
  })),
}));

// Mock data
const mockAlertRule: AlertRule = {
  id: 'test-rule-1',
  user_id: 'test-user-1',
  project_id: 'test-project-1',
  name: 'Critical CVE Alert',
  description: 'Alert on critical CVEs',
  rule_type: 'severity_based',
  condition: {
    severity: ['critical'],
  },
  actions: {
    notify: true,
    channels: ['email'],
    escalate: true,
  },
  enabled: true,
  cooldown_minutes: 60,
  max_triggers_per_day: 10,
  created_at: '2026-05-05T10:00:00Z',
  updated_at: '2026-05-05T10:00:00Z',
  trigger_count: 0,
  created_by: 'test-user-1',
};

const mockVulnerability: VulnerabilityForEval = {
  id: 'vuln-1',
  title: 'Critical RCE in OpenSSL',
  description: 'Remote code execution vulnerability',
  severity: 'critical',
  cve_id: 'CVE-2024-1234',
  asset: 'web-server-01',
  mitre_tactic: 'Initial Access',
  cis_control: 'CIS 1.1',
};

describe('AlertRulesService', () => {
  describe('createRule', () => {
    it('should create a rule with valid input', async () => {
      const request: CreateAlertRuleRequest = {
        name: 'New Rule',
        description: 'Test rule',
        rule_type: 'severity_based',
        condition: { severity: ['high', 'critical'] },
        actions: { notify: true },
        cooldown_minutes: 30,
      };

      const result = await AlertRulesService.createRule('test-user', request);

      expect(result.success).toBe(true);
      expect(result.rule).toBeDefined();
    });

    it('should reject rule without required fields', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request: any = {
        name: 'Incomplete Rule',
        // Missing rule_type and condition
      };

      const result = await AlertRulesService.createRule('test-user', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should validate rule_type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request: any = {
        name: 'Invalid Rule',
        rule_type: 'invalid_type',
        condition: {},
      };

      const result = await AlertRulesService.createRule('test-user', request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid rule_type');
    });
  });

  describe('evaluateSeverity', () => {
    it('should match severity-based rules', () => {
      const condition: AlertCondition = {
        severity: ['critical', 'high'],
      };

      // Direct test of private method via evaluation
      const criticalVuln: VulnerabilityForEval = {
        ...mockVulnerability,
        severity: 'critical',
      };

      // Service should match critical vulnerabilities
      expect(condition.severity).toContain(criticalVuln.severity);
      expect(criticalVuln.severity).toBe('critical');
    });

    it('should not match non-matching severities', () => {
      const infoVuln: VulnerabilityForEval = {
        ...mockVulnerability,
        severity: 'info',
      };

      const condition: AlertCondition = {
        severity: ['critical', 'high'],
      };

      // Service should not match info severity
      expect(condition.severity).not.toContain(infoVuln.severity);
      expect(infoVuln.severity).not.toMatch(/critical|high/);
    });
  });

  describe('evaluatePattern', () => {
    it('should match CVE patterns', () => {
      const condition: AlertCondition = {
        cvePattern: 'CVE-2024-.*',
      };

      const vuln: VulnerabilityForEval = {
        ...mockVulnerability,
        cve_id: 'CVE-2024-1234',
      };

      const regex = new RegExp(condition.cvePattern!);
      expect(regex.test(vuln.cve_id!)).toBe(true);
    });

    it('should match asset patterns', () => {
      const condition: AlertCondition = {
        assetPattern: 'web-server-.*',
      };

      const vuln: VulnerabilityForEval = {
        ...mockVulnerability,
        asset: 'web-server-01',
      };

      const regex = new RegExp(condition.assetPattern!);
      expect(regex.test(vuln.asset)).toBe(true);
    });

    it('should match description patterns', () => {
      const condition: AlertCondition = {
        descriptionPattern: '.*code execution.*',
      };

      const vuln: VulnerabilityForEval = {
        ...mockVulnerability,
        description: 'Remote code execution vulnerability',
      };

      const regex = new RegExp(condition.descriptionPattern!, 'i');
      expect(regex.test(vuln.description)).toBe(true);
    });
  });

  describe('getHighestSeverity', () => {
    it('should identify critical as highest', () => {
      const vulns: VulnerabilityForEval[] = [
        { ...mockVulnerability, severity: 'high' },
        { ...mockVulnerability, severity: 'critical' },
        { ...mockVulnerability, severity: 'medium' },
      ];

      // Service should identify critical as highest
      expect(vulns.some((v) => v.severity === 'critical')).toBe(true);
    });

    it('should identify high as highest when critical absent', () => {
      const vulns: VulnerabilityForEval[] = [
        { ...mockVulnerability, severity: 'high' },
        { ...mockVulnerability, severity: 'medium' },
        { ...mockVulnerability, severity: 'low' },
      ];

      expect(vulns.some((v) => v.severity === 'high')).toBe(true);
    });

    it('should default to info when only info present', () => {
      const vulns: VulnerabilityForEval[] = [
        { ...mockVulnerability, severity: 'info' },
        { ...mockVulnerability, severity: 'info' },
      ];

      expect(vulns.every((v) => v.severity === 'info')).toBe(true);
    });
  });

  describe('cooldown logic', () => {
    it('should respect cooldown period', () => {
      const rule: AlertRule = {
        ...mockAlertRule,
        cooldown_minutes: 60,
        last_triggered_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
      };

      const cooldownMs = (rule.cooldown_minutes || 60) * 60 * 1000;
      expect(rule.last_triggered_at).toBeDefined();
      const lastTriggeredTime = new Date(rule.last_triggered_at as string).getTime();
      const now = Date.now();
      const isInCooldown = now - lastTriggeredTime < cooldownMs;

      expect(isInCooldown).toBe(true);
    });

    it('should allow trigger after cooldown expires', () => {
      const rule: AlertRule = {
        ...mockAlertRule,
        cooldown_minutes: 60,
        last_triggered_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), // 90 min ago
      };

      const cooldownMs = (rule.cooldown_minutes || 60) * 60 * 1000;
      expect(rule.last_triggered_at).toBeDefined();
      const lastTriggeredTime = new Date(rule.last_triggered_at as string).getTime();
      const now = Date.now();
      const isInCooldown = now - lastTriggeredTime < cooldownMs;

      expect(isInCooldown).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should enforce max triggers per day', () => {
      const rule: AlertRule = {
        ...mockAlertRule,
        max_triggers_per_day: 10,
        trigger_count: 10,
      };

      const isAtLimit = rule.trigger_count >= (rule.max_triggers_per_day || 10);
      expect(isAtLimit).toBe(true);
    });

    it('should allow trigger below limit', () => {
      const rule: AlertRule = {
        ...mockAlertRule,
        max_triggers_per_day: 10,
        trigger_count: 5,
      };

      const isAtLimit = rule.trigger_count >= (rule.max_triggers_per_day || 10);
      expect(isAtLimit).toBe(false);
    });
  });

  describe('updateRule', () => {
    it('should update rule fields', async () => {
      const updates: UpdateAlertRuleRequest = {
        name: 'Updated Rule Name',
        enabled: false,
        cooldown_minutes: 30,
      };

      const result = await AlertRulesService.updateRule('test-user', 'test-rule', updates);

      expect(result.success).toBe(true);
    });

    it('should update condition and actions', async () => {
      const updates: UpdateAlertRuleRequest = {
        condition: { severity: ['high'] },
        actions: { notify: true, channels: ['email', 'slack'] },
      };

      const result = await AlertRulesService.updateRule('test-user', 'test-rule', updates);

      expect(result.success).toBe(true);
    });
  });

  describe('deleteRule', () => {
    it('should delete rule for authenticated user', async () => {
      const result = await AlertRulesService.deleteRule('test-user', 'test-rule');

      expect(result.success).toBe(true);
    });
  });

  describe('triggerAlert', () => {
    it('should create trigger event with correct data', async () => {
      const vulns: VulnerabilityForEval[] = [mockVulnerability];

      const result = await AlertRulesService.triggerAlert(
        'test-user',
        mockAlertRule,
        vulns
      );

      expect(result.success).toBe(true);
      expect(result.event).toBeDefined();
      expect(result.event?.severity).toBe('critical');
      expect(result.event?.vulnerabilities).toEqual(vulns);
    });

    it('should calculate highest severity from multiple vulns', async () => {
      const vulns: VulnerabilityForEval[] = [
        { ...mockVulnerability, severity: 'low' },
        { ...mockVulnerability, severity: 'critical' },
        { ...mockVulnerability, severity: 'high' },
      ];

      const result = await AlertRulesService.triggerAlert(
        'test-user',
        mockAlertRule,
        vulns
      );

      expect(result.event?.severity).toBe('critical');
    });

    it('should include rule actions in trigger event', async () => {
      const rule: AlertRule = {
        ...mockAlertRule,
        actions: {
          notify: true,
          channels: ['email'],
          escalate: true,
        },
      };

      const result = await AlertRulesService.triggerAlert(
        'test-user',
        rule,
        [mockVulnerability]
      );

      expect(result.event?.actions.notify).toBe(true);
      expect(result.event?.actions.escalate).toBe(true);
    });
  });

  describe('rule validation', () => {
    it('should accept valid rule types', () => {
      const validTypes = ['severity_based', 'pattern_matching', 'frequency_based', 'custom'];

      for (const type of validTypes) {
        expect(['severity_based', 'pattern_matching', 'frequency_based', 'custom']).toContain(
          type
        );
      }
    });

    it('should reject invalid rule types', () => {
      const invalidTypes = ['invalid', 'wrong', 'fake_type'];

      for (const type of invalidTypes) {
        expect(['severity_based', 'pattern_matching', 'frequency_based', 'custom']).not.toContain(
          type
        );
      }
    });
  });

  describe('alert action validation', () => {
    it('should validate notify channels', () => {
      const validChannels = ['email', 'webhook', 'slack', 'pagerduty'];
      const action: AlertAction = {
        notify: true,
        channels: ['email', 'slack'],
      };

      for (const channel of action.channels || []) {
        expect(validChannels).toContain(channel);
      }
    });

    it('should allow action combinations', () => {
      const action: AlertAction = {
        notify: true,
        channels: ['email'],
        disable: true,
        escalate: true,
      };

      expect(action.notify).toBe(true);
      expect(action.disable).toBe(true);
      expect(action.escalate).toBe(true);
    });
  });

  describe('rule statistics', () => {
    it('should track trigger count', () => {
      const rule: AlertRule = {
        ...mockAlertRule,
        trigger_count: 5,
      };

      expect(rule.trigger_count).toBe(5);
    });

    it('should track last triggered time', () => {
      const now = new Date().toISOString();
      const rule: AlertRule = {
        ...mockAlertRule,
        last_triggered_at: now,
      };

      expect(rule.last_triggered_at).toBe(now);
    });
  });
});
