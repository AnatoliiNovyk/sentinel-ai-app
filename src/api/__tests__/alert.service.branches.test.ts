import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertRulesService } from '../alert.service';
import type { AlertCondition, AlertRule, VulnerabilityForEval } from '../types.alert';

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock('../client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

const baseRule: AlertRule = {
  id: 'rule-1',
  user_id: 'user-1',
  project_id: 'project-1',
  name: 'Critical Alert',
  description: '',
  rule_type: 'severity_based',
  condition: { severity: ['critical'] },
  actions: { notify: true, channels: ['email'] },
  enabled: true,
  cooldown_minutes: 60,
  max_triggers_per_day: 10,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  trigger_count: 0,
  created_by: 'user-1',
};

const vuln: VulnerabilityForEval = {
  id: 'vuln-1',
  title: 'Critical vuln',
  description: 'Remote code execution',
  severity: 'critical',
  cve_id: 'CVE-2026-1234',
  asset: 'api.example.local',
};

describe('AlertRulesService branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createRule returns DB insert error', async () => {
    mockFrom.mockImplementationOnce(() => {
      const chain = {
        insert: vi.fn(() => chain),
        select: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
      };
      return chain;
    });

    const result = await AlertRulesService.createRule('user-1', {
      name: 'Rule',
      rule_type: 'severity_based',
      condition: { severity: ['critical'] },
      actions: { notify: true, channels: ['email'] },
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('insert failed');
  });

  it('updateRule returns "Rule not found" when row is missing', async () => {
    mockFrom.mockImplementationOnce(() => {
      const chain = {
        update: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        select: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return chain;
    });

    const result = await AlertRulesService.updateRule('user-1', 'rule-404', { name: 'Updated' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rule not found');
  });

  it('deleteRule returns DB error message', async () => {
    mockFrom.mockImplementationOnce(() => ({
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: { message: 'permission denied' } }),
        })),
      })),
    }));

    const result = await AlertRulesService.deleteRule('user-1', 'rule-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('permission denied');
  });

  it('getRules adds project filter when projectId is provided', async () => {
    const eqSpy = vi.fn();
    const orderSpy = vi.fn().mockResolvedValue({ data: [baseRule], error: null });

    mockFrom.mockImplementationOnce(() => {
      const chain = {
        select: vi.fn(() => chain),
        eq: eqSpy,
        order: orderSpy,
      };
      eqSpy.mockImplementation(() => chain);
      return chain;
    });

    const result = await AlertRulesService.getRules('user-1', 'project-1');

    expect(result.success).toBe(true);
    expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqSpy).toHaveBeenCalledWith('project_id', 'project-1');
  });

  it('evaluateRulesForVulnerability skips cooldown and rate-limited rules', async () => {
    const nowIso = new Date().toISOString();
    const oldIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    vi.spyOn(AlertRulesService, 'getRules').mockResolvedValue({
      success: true,
      rules: [
        {
          ...baseRule,
          id: 'cooldown-rule',
          last_triggered_at: nowIso,
        },
        {
          ...baseRule,
          id: 'rate-limit-rule',
          trigger_count: 10,
          max_triggers_per_day: 10,
          last_triggered_at: oldIso,
        },
        {
          ...baseRule,
          id: 'matching-rule',
          trigger_count: 1,
          max_triggers_per_day: 10,
          last_triggered_at: oldIso,
        },
      ],
    });

    const results = await AlertRulesService.evaluateRulesForVulnerability('user-1', vuln);

    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('matching-rule');
  });

  it('evaluateCondition returns false for frequency/custom/unknown and checks pattern+severity', () => {
    const sevCond: AlertCondition = { severity: ['critical'] };
    expect(AlertRulesService.evaluateCondition(sevCond, 'severity_based', vuln)).toBe(true);

    const pattCond: AlertCondition = {
      cvePattern: 'CVE-2026-.*',
      assetPattern: 'api\\.example\\.local',
      descriptionPattern: 'code execution',
    };
    expect(AlertRulesService.evaluateCondition(pattCond, 'pattern_matching', vuln)).toBe(true);

    expect(AlertRulesService.evaluateCondition({}, 'frequency_based', vuln)).toBe(false);
    expect(AlertRulesService.evaluateCondition({}, 'custom', vuln)).toBe(false);
    expect(AlertRulesService.evaluateCondition({}, 'unknown' as never, vuln)).toBe(false);
  });

  it('triggerAlert returns error when update throws', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('update failed hard');
    });

    const result = await AlertRulesService.triggerAlert('user-1', baseRule, [vuln]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('update failed hard');
  });

  it('getHighestSeverity and isValidRuleType cover helper branches', () => {
    expect(
      AlertRulesService.getHighestSeverity([
        { ...vuln, severity: 'low' },
        { ...vuln, severity: 'high' },
        { ...vuln, severity: 'critical' },
      ])
    ).toBe('critical');

    expect(AlertRulesService.getHighestSeverity([{ ...vuln, severity: 'info' }])).toBe('info');

    expect(AlertRulesService.isValidRuleType('severity_based')).toBe(true);
    expect(AlertRulesService.isValidRuleType('invalid')).toBe(false);
  });

  it('resetDailyTriggerCounters swallows errors', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('reset exploded');
    });

    await expect(AlertRulesService.resetDailyTriggerCounters('user-1')).resolves.toBeUndefined();
  });
});
