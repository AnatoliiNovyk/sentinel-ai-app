import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComplianceService } from '../compliance.service';

type DbError = { message: string };
type DbResult = { data: unknown[] | null; error: DbError | null };

const { mockFrom, setTableResult } = vi.hoisted(() => {
  const tableResults = new Map<string, DbResult>();

  const setTableResult = (table: string, result: DbResult) => {
    tableResults.set(table, result);
  };

  const defaultResult = (): DbResult => ({ data: [], error: null });

  const mockFrom = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      then: (
        onfulfilled: (value: DbResult) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(tableResults.get(table) ?? defaultResult()).then(onfulfilled, onrejected),
    };
    return builder;
  });

  return { mockFrom, setTableResult };
});

vi.mock('../client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('ComplianceService branch coverage', () => {
  const userId = 'user-1';
  const projectId = 'project-1';

  beforeEach(() => {
    vi.clearAllMocks();
    setTableResult('alert_rules', { data: [], error: null });
    setTableResult('alert_trigger_events', { data: [], error: null });
    setTableResult('remediation_workflows', { data: [], error: null });
    setTableResult('remediation_events', { data: [], error: null });
    setTableResult('vulnerabilities', { data: [], error: null });
  });

  it('getAlertMetrics returns DB error branch', async () => {
    setTableResult('alert_rules', { data: null, error: { message: 'rules failed' } });

    const result = await ComplianceService.getAlertMetrics(userId, projectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('rules failed');
  });

  it('getAlertMetrics prefers eventsError when rulesError is empty', async () => {
    setTableResult('alert_rules', { data: [], error: null });
    setTableResult('alert_trigger_events', { data: null, error: { message: 'events failed' } });

    const result = await ComplianceService.getAlertMetrics(userId, projectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('events failed');
  });

  it('getAlertMetrics calculates false positive rate and triggered rules', async () => {
    setTableResult('alert_rules', {
      data: [{ id: 'r1' }, { id: 'r2' }],
      error: null,
    });
    setTableResult('alert_trigger_events', {
      data: [
        { id: 'e1', rule_id: 'r1', false_positive: true },
        { id: 'e2', rule_id: 'r1', false_positive: false },
        { id: 'e3', rule_id: 'r2', false_positive: true },
      ],
      error: null,
    });

    const result = await ComplianceService.getAlertMetrics(userId, projectId);

    expect(result.success).toBe(true);
    expect(result.metrics?.rulesCreated).toBe(2);
    expect(result.metrics?.rulesTriggered).toBe(2);
    expect(result.metrics?.alertsGenerated).toBe(3);
    expect(result.metrics?.falsePositivesRate).toBe(66.7);
    expect(result.metrics?.highestSeverityLevel).toBe('critical');
  });

  it('getRemediationMetrics returns DB error branch', async () => {
    setTableResult('remediation_workflows', { data: null, error: { message: 'wf failed' } });

    const result = await ComplianceService.getRemediationMetrics(userId, projectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('wf failed');
  });

  it('getRemediationMetrics uses eventsError when workflowsError is absent', async () => {
    setTableResult('remediation_workflows', { data: [], error: null });
    setTableResult('remediation_events', { data: null, error: { message: 'events failed' } });

    const result = await ComplianceService.getRemediationMetrics(userId, projectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('events failed');
  });

  it('getRemediationMetrics computes success rate and most used action type', async () => {
    setTableResult('remediation_workflows', {
      data: [
        { actions: [{ type: 'disable_asset' }, { type: 'notify_security_team' }] },
        { actions: [{ type: 'disable_asset' }] },
      ],
      error: null,
    });
    setTableResult('remediation_events', {
      data: [
        { total_actions: 3, success_count: 2, failure_count: 1, execution_time_ms: 300 },
        { total_actions: 2, success_count: 2, failure_count: 0, execution_time_ms: 100 },
      ],
      error: null,
    });

    const result = await ComplianceService.getRemediationMetrics(userId, projectId);

    expect(result.success).toBe(true);
    expect(result.metrics?.actionsExecuted).toBe(5);
    expect(result.metrics?.successfulActions).toBe(4);
    expect(result.metrics?.failedActions).toBe(1);
    expect(result.metrics?.successRate).toBe(80);
    expect(result.metrics?.averageExecutionTime).toBe(200);
    expect(result.metrics?.mostUsedActionType).toBe('disable_asset');
  });

  it('getRemediationMetrics covers fallback branches for missing action fields and counters', async () => {
    setTableResult('remediation_workflows', {
      data: [{ actions: null }, { actions: [{}] }],
      error: null,
    });
    setTableResult('remediation_events', {
      data: [{ total_actions: undefined, success_count: undefined, failure_count: undefined, execution_time_ms: undefined }],
      error: null,
    });

    const result = await ComplianceService.getRemediationMetrics(userId, projectId);

    expect(result.success).toBe(true);
    expect(result.metrics?.actionsExecuted).toBe(0);
    expect(result.metrics?.successfulActions).toBe(0);
    expect(result.metrics?.failedActions).toBe(0);
    expect(result.metrics?.averageExecutionTime).toBe(0);
    expect(result.metrics?.mostUsedActionType).toBe('unknown');
  });

  it('getSecurityPostureMetrics returns DB error branch', async () => {
    setTableResult('vulnerabilities', { data: null, error: { message: 'vuln failed' } });

    const result = await ComplianceService.getSecurityPostureMetrics(userId, projectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('vuln failed');
  });

  it('getSecurityPostureMetrics uses remediationError when vulnError is absent', async () => {
    setTableResult('vulnerabilities', { data: [], error: null });
    setTableResult('remediation_events', { data: null, error: { message: 'rem failed' } });

    const result = await ComplianceService.getSecurityPostureMetrics(userId, projectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('rem failed');
  });

  it('getSecurityPostureMetrics computes severity, remediation rate and MTTR', async () => {
    setTableResult('vulnerabilities', {
      data: [
        { severity: 'critical', status: 'open' },
        { severity: 'high', status: 'closed' },
        { severity: 'medium', status: 'closed' },
        { severity: 'low', status: 'open' },
      ],
      error: null,
    });

    const now = Date.now();
    setTableResult('remediation_events', {
      data: [
        { triggered_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(), completed_at: new Date(now).toISOString() },
        { triggered_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(), completed_at: new Date(now).toISOString() },
      ],
      error: null,
    });

    const result = await ComplianceService.getSecurityPostureMetrics(userId, projectId);

    expect(result.success).toBe(true);
    expect(result.metrics?.totalVulnerabilities).toBe(4);
    expect(result.metrics?.criticalVulnerabilities).toBe(1);
    expect(result.metrics?.highVulnerabilities).toBe(1);
    expect(result.metrics?.mediumVulnerabilities).toBe(1);
    expect(result.metrics?.lowVulnerabilities).toBe(1);
    expect(result.metrics?.vulnerabilitiesClosed).toBe(2);
    expect(result.metrics?.remediationRate).toBe(50);
    expect(result.metrics?.averageTimeToRemediate).toBe(3);
  });

  it('getSecurityPostureMetrics covers unknown severity and default low severity branches', async () => {
    setTableResult('vulnerabilities', {
      data: [
        { severity: null, status: 'open' },
        { severity: 'informational', status: 'closed' },
      ],
      error: null,
    });
    setTableResult('remediation_events', { data: [], error: null });

    const result = await ComplianceService.getSecurityPostureMetrics(userId, projectId);

    expect(result.success).toBe(true);
    expect(result.metrics?.lowVulnerabilities).toBe(1);
    expect(result.metrics?.criticalVulnerabilities).toBe(0);
    expect(result.metrics?.highVulnerabilities).toBe(0);
    expect(result.metrics?.mediumVulnerabilities).toBe(0);
  });

  it('getFrameworkMetrics covers compliant path and remediation fallback path', async () => {
    const remSpy = vi
      .spyOn(ComplianceService, 'getRemediationMetrics')
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue({
        success: true,
        metrics: {
          workflowsCreated: 1,
          workflowsExecuted: 1,
          actionsExecuted: 1,
          successfulActions: 1,
          failedActions: 0,
          averageExecutionTime: 10,
          successRate: 85,
          mostUsedActionType: 'disable_asset',
        },
      });

    const result = await ComplianceService.getFrameworkMetrics(userId, projectId);

    expect(result.success).toBe(true);
    expect(result.metrics?.[0]?.compliancePercentage).toBe(0);
    expect(result.metrics?.[0]?.status).toBe('at-risk');
    expect(result.metrics?.[1]?.status).toBe('compliant');

    remSpy.mockRestore();
  });

  it('getFrameworkMetrics returns false on unexpected error', async () => {
    vi.spyOn(ComplianceService, 'getRemediationMetrics').mockRejectedValueOnce(new Error('boom'));

    const result = await ComplianceService.getFrameworkMetrics(userId, projectId);

    expect(result.success).toBe(false);
  });

  it('getComplianceScore returns false when one component metric fails', async () => {
    vi.spyOn(ComplianceService, 'getRemediationMetrics').mockResolvedValueOnce({
      success: false,
      error: 'failed',
    });

    const result = await ComplianceService.getComplianceScore(userId, projectId);

    expect(result.success).toBe(false);
  });

  it('getDashboard returns failure when core metrics fail', async () => {
    vi.spyOn(ComplianceService, 'getAlertMetrics').mockResolvedValueOnce({
      success: false,
      error: 'alert fail',
    });

    const result = await ComplianceService.getDashboard(userId, projectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to fetch dashboard metrics');
  });

  it('getDashboard uses framework and score fallbacks when optional payloads are missing', async () => {
    vi.spyOn(ComplianceService, 'getAlertMetrics').mockResolvedValueOnce({
      success: true,
      metrics: {
        rulesCreated: 0,
        rulesTriggered: 0,
        alertsGenerated: 0,
        falsePositivesRate: 0,
        averageAlertResolutionTime: 0,
        highestSeverityLevel: 'unknown',
      },
    });
    vi.spyOn(ComplianceService, 'getRemediationMetrics').mockResolvedValueOnce({
      success: true,
      metrics: {
        workflowsCreated: 0,
        workflowsExecuted: 0,
        actionsExecuted: 0,
        successfulActions: 0,
        failedActions: 0,
        averageExecutionTime: 0,
        successRate: 0,
        mostUsedActionType: 'N/A',
      },
    });
    vi.spyOn(ComplianceService, 'getSecurityPostureMetrics').mockResolvedValueOnce({
      success: true,
      metrics: {
        totalVulnerabilities: 0,
        criticalVulnerabilities: 0,
        highVulnerabilities: 0,
        mediumVulnerabilities: 0,
        lowVulnerabilities: 0,
        vulnerabilitiesClosed: 0,
        averageTimeToRemediate: 0,
        remediationRate: 0,
        trendPercentage: 0,
      },
    });
    vi.spyOn(ComplianceService, 'getFrameworkMetrics').mockResolvedValueOnce({ success: true });
    vi.spyOn(ComplianceService, 'getComplianceScore').mockResolvedValueOnce({ success: true });

    const result = await ComplianceService.getDashboard(userId, projectId);

    expect(result.success).toBe(true);
    expect(result.dashboard?.frameworks).toEqual([]);
    expect(result.dashboard?.recommendation).toContain('Critical');
  });

  it('generateReport returns failure when dashboard cannot be generated', async () => {
    vi.spyOn(ComplianceService, 'getDashboard').mockResolvedValueOnce({
      success: false,
      error: 'dashboard fail',
    });

    const result = await ComplianceService.generateReport(userId, {
      projectId,
      frameworks: ['SOC2'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to generate report');
  });
});
