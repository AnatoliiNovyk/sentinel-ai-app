/**
 * Batch E: alert.service.ts — evaluation paths & remaining branches
 * Covers: createRule validation, getRule, getRules error, evaluateSeverity,
 *         evaluatePattern all sub-branches, getHighestSeverity empty,
 *         evaluateRulesForVulnerability failure + no-match paths
 */
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

const baseVuln: VulnerabilityForEval = {
  id: 'v1',
  title: 'Test Vuln',
  description: 'SQL injection in login form',
  severity: 'high',
  cve_id: 'CVE-2026-9999',
  asset: 'web.example.local',
};

const baseRule: AlertRule = {
  id: 'rule-eval-1',
  user_id: 'user-1',
  project_id: undefined,
  name: 'Eval Rule',
  description: '',
  rule_type: 'severity_based',
  condition: { severity: ['critical'] },
  actions: { notify: true, channels: ['email'] },
  enabled: true,
  cooldown_minutes: 60,
  max_triggers_per_day: 10,
  trigger_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'user-1',
};

describe('AlertRulesService — evaluation & validation branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ──────────────────────────────
  // createRule — validation paths
  // ──────────────────────────────

  it('createRule returns error for missing required fields', async () => {
    const result = await AlertRulesService.createRule('user-1', {
      name: '',
      rule_type: 'severity_based',
      condition: { severity: ['critical'] },
      actions: { notify: true },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Missing required fields/);
  });

  it('createRule returns error for invalid rule_type', async () => {
    const result = await AlertRulesService.createRule('user-1', {
      name: 'Rule',
      rule_type: 'nonexistent' as never,
      condition: { severity: ['critical'] },
      actions: { notify: true },
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid rule_type/);
  });

  it('createRule handles unexpected throw', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('network crash');
    });

    const result = await AlertRulesService.createRule('user-1', {
      name: 'Rule',
      rule_type: 'severity_based',
      condition: { severity: ['high'] },
      actions: { notify: true },
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('network crash');
  });

  // ──────────────────────────────
  // getRules — DB error path
  // ──────────────────────────────

  it('getRules returns error on DB failure', async () => {
    mockFrom.mockImplementationOnce(() => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      return chain;
    });

    const result = await AlertRulesService.getRules('user-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('DB error');
  });

  // ──────────────────────────────
  // getRule — success & error path
  // ──────────────────────────────

  it('getRule returns success with rule data', async () => {
    mockFrom.mockImplementationOnce(() => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data: baseRule, error: null }),
      };
      return chain;
    });

    const result = await AlertRulesService.getRule('user-1', 'rule-eval-1');
    expect(result.success).toBe(true);
    expect(result.rule?.id).toBe('rule-eval-1');
  });

  it('getRule returns error when no data and no error message', async () => {
    mockFrom.mockImplementationOnce(() => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      return chain;
    });

    const result = await AlertRulesService.getRule('user-1', 'missing-rule');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Rule not found');
  });

  // ──────────────────────────────
  // evaluateSeverity
  // ──────────────────────────────

  it('evaluateSeverity returns false when severity does not match vuln', () => {
    const cond: AlertCondition = { severity: ['critical'] };
    expect(AlertRulesService.evaluateSeverity(cond, baseVuln)).toBe(false); // vuln is 'high'
  });

  it('evaluateSeverity returns false when condition.severity is empty', () => {
    const cond: AlertCondition = { severity: [] };
    expect(AlertRulesService.evaluateSeverity(cond, baseVuln)).toBe(false);
  });

  // ──────────────────────────────
  // evaluatePattern — all sub-branches
  // ──────────────────────────────

  it('evaluatePattern returns true when no patterns are set', () => {
    const cond: AlertCondition = {};
    expect(AlertRulesService.evaluatePattern(cond, baseVuln)).toBe(true);
  });

  it('evaluatePattern returns false when cvePattern does not match', () => {
    const cond: AlertCondition = { cvePattern: 'CVE-2020-.*' };
    expect(AlertRulesService.evaluatePattern(cond, baseVuln)).toBe(false); // vuln has CVE-2026-9999
  });

  it('evaluatePattern returns false when vuln has no cve_id and cvePattern is set', () => {
    const vulnNoCve: VulnerabilityForEval = { ...baseVuln, cve_id: undefined };
    const cond: AlertCondition = { cvePattern: 'CVE-.*' };
    expect(AlertRulesService.evaluatePattern(cond, vulnNoCve)).toBe(false);
  });

  it('evaluatePattern returns false when assetPattern does not match', () => {
    const cond: AlertCondition = { assetPattern: 'db\\.example\\.local' };
    expect(AlertRulesService.evaluatePattern(cond, baseVuln)).toBe(false); // asset is 'web.example.local'
  });

  it('evaluatePattern returns false when descriptionPattern does not match', () => {
    const cond: AlertCondition = { descriptionPattern: 'XSS injection' };
    expect(AlertRulesService.evaluatePattern(cond, baseVuln)).toBe(false); // description is 'SQL injection...'
  });

  // ──────────────────────────────
  // getHighestSeverity — edge cases
  // ──────────────────────────────

  it('getHighestSeverity returns "info" for empty array', () => {
    expect(AlertRulesService.getHighestSeverity([])).toBe('info');
  });

  it('getHighestSeverity ignores vulns with unknown severity score', () => {
    const unknownSev = { ...baseVuln, severity: 'unknown' as never };
    // 'unknown' maps to score 0, doesn't beat default highestScore=1
    expect(AlertRulesService.getHighestSeverity([unknownSev])).toBe('info');
  });

  // ──────────────────────────────
  // evaluateRulesForVulnerability — failure & no-match paths
  // ──────────────────────────────

  it('evaluateRulesForVulnerability returns [] when getRules fails', async () => {
    vi.spyOn(AlertRulesService, 'getRules').mockResolvedValue({ success: false });

    const results = await AlertRulesService.evaluateRulesForVulnerability('user-1', baseVuln);
    expect(results).toEqual([]);
  });

  it('evaluateRulesForVulnerability returns [] when enabled rule condition does not match', async () => {
    vi.spyOn(AlertRulesService, 'getRules').mockResolvedValue({
      success: true,
      rules: [
        {
          ...baseRule,
          rule_type: 'severity_based',
          condition: { severity: ['critical'] }, // baseVuln is 'high' — won't match
        },
      ],
    });

    const results = await AlertRulesService.evaluateRulesForVulnerability('user-1', baseVuln);
    expect(results).toEqual([]);
  });

  it('evaluateRulesForVulnerability returns [] when getRules throws internally', async () => {
    vi.spyOn(AlertRulesService, 'getRules').mockRejectedValue(new Error('inner crash'));

    const results = await AlertRulesService.evaluateRulesForVulnerability('user-1', baseVuln);
    expect(results).toEqual([]);
  });

  // ──────────────────────────────
  // updateRule / deleteRule — throw paths
  // ──────────────────────────────

  it('updateRule handles unexpected throw', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('update crash');
    });

    const result = await AlertRulesService.updateRule('user-1', 'rule-1', { name: 'X' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('update crash');
  });

  it('deleteRule handles unexpected throw', async () => {
    mockFrom.mockImplementationOnce(() => {
      throw new Error('delete crash');
    });

    const result = await AlertRulesService.deleteRule('user-1', 'rule-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('delete crash');
  });
});
