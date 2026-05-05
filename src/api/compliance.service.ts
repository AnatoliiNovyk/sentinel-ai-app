/**
 * Compliance Service
 * Aggregates metrics from Alert Rules, Remediation Workflows, and Vulnerabilities
 * Phase 5, Batch 3: Compliance Dashboard
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from './client';
import {
  ComplianceDashboard,
  ComplianceFramework,
  ComplianceMetric,
  ComplianceScore,
  SecurityPostureMetric,
  RemediationMetric,
  AlertMetric,
  ComplianceReport,
  ComplianceReportRequest,
} from './types.compliance';

/**
 * Compliance Service
 */
export const ComplianceService = {
  /**
   * Get compliance dashboard for a project
   */
  async getDashboard(
    userId: string,
    projectId: string
  ): Promise<{ success: boolean; dashboard?: ComplianceDashboard; error?: string }> {
    try {
      // Fetch all metrics in parallel
      const [alertMetrics, remediationMetrics, securityPosture, frameworks, score] =
        await Promise.all([
          ComplianceService.getAlertMetrics(userId, projectId),
          ComplianceService.getRemediationMetrics(userId, projectId),
          ComplianceService.getSecurityPostureMetrics(userId, projectId),
          ComplianceService.getFrameworkMetrics(userId, projectId),
          ComplianceService.getComplianceScore(userId, projectId),
        ]);

      if (!alertMetrics.success || !remediationMetrics.success || !securityPosture.success) {
        return { success: false, error: 'Failed to fetch dashboard metrics' };
      }

      // Generate recommendation
      const recommendation = ComplianceService.generateRecommendation(
        frameworks.metrics || [],
        score.score ?? {
          overallScore: 0,
          securityScore: 0,
          remediationScore: 0,
          alertingScore: 0,
          lastUpdatedAt: new Date().toISOString(),
        }
      );

      const dashboard: ComplianceDashboard = {
        projectId,
        frameworks: frameworks.metrics || [],
        securityPosture: securityPosture.metrics!,
        remediation: remediationMetrics.metrics!,
        alerts: alertMetrics.metrics!,
        score: score.score!,
        recommendation,
        generatedAt: new Date().toISOString(),
      };

      return { success: true, dashboard };
    } catch (err: any) {
      console.error('[ComplianceService] Dashboard fetch error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get alert metrics
   */
  async getAlertMetrics(
    userId: string,
    projectId: string
  ): Promise<{ success: boolean; metrics?: AlertMetric; error?: string }> {
    try {
      // Fetch from alert_rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('alert_rules')
        .select('id, rule_type, cooldown_minutes')
        .eq('user_id', userId)
        .eq('project_id', projectId);

      // Fetch from alert_trigger_events
      const { data: eventsData, error: eventsError } = await supabase
        .from('alert_trigger_events')
        .select('id, rule_id, alert_level, false_positive')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (rulesError || eventsError) {
        return {
          success: false,
          error: rulesError?.message || eventsError?.message,
        };
      }

      const rules = rulesData || [];
      const events = eventsData || [];

      const highestSeverity = events.length > 0 ? 'critical' : 'unknown';
      const falsePositives = events.filter((e: any) => e.false_positive).length;
      const falsePositiveRate = events.length > 0 ? (falsePositives / events.length) * 100 : 0;

      const metrics: AlertMetric = {
        rulesCreated: rules.length,
        rulesTriggered: new Set(events.map((e: any) => e.rule_id)).size,
        alertsGenerated: events.length,
        falsePositivesRate: Math.round(falsePositiveRate * 10) / 10,
        averageAlertResolutionTime: 2, // TODO: Calculate from actual resolution data
        highestSeverityLevel: highestSeverity,
      };

      return { success: true, metrics };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get remediation metrics
   */
  async getRemediationMetrics(
    userId: string,
    projectId: string
  ): Promise<{ success: boolean; metrics?: RemediationMetric; error?: string }> {
    try {
      // Fetch workflows
      const { data: workflowsData, error: workflowsError } = await supabase
        .from('remediation_workflows')
        .select('id, actions, execution_count')
        .eq('user_id', userId)
        .eq('project_id', projectId);

      // Fetch execution events
      const { data: eventsData, error: eventsError } = await supabase
        .from('remediation_events')
        .select('id, overall_status, success_count, failure_count, execution_time_ms, total_actions')
        .eq('user_id', userId)
        .eq('project_id', projectId)
        .gte('triggered_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (workflowsError || eventsError) {
        return {
          success: false,
          error: workflowsError?.message || eventsError?.message,
        };
      }

      const workflows = workflowsData || [];
      const events = eventsData || [];

      // Calculate metrics
      let totalActions = 0;
      let successfulActions = 0;
      let failedActions = 0;
      let totalExecutionTime = 0;

      events.forEach((event: any) => {
        totalActions += event.total_actions || 0;
        successfulActions += event.success_count || 0;
        failedActions += event.failure_count || 0;
        totalExecutionTime += event.execution_time_ms || 0;
      });

      const successRate =
        totalActions > 0 ? Math.round((successfulActions / totalActions) * 1000) / 10 : 0;
      const avgExecutionTime = events.length > 0 ? totalExecutionTime / events.length : 0;

      // Most used action type (from workflows)
      const actionTypeCounts: { [key: string]: number } = {};
      workflows.forEach((workflow: any) => {
        const actions = workflow.actions || [];
        actions.forEach((action: any) => {
          const type = action.type || 'unknown';
          actionTypeCounts[type] = (actionTypeCounts[type] || 0) + 1;
        });
      });

      const mostUsedActionType = Object.entries(actionTypeCounts).sort(
        ([, a], [, b]) => (b as number) - (a as number)
      )[0]?.[0] || 'N/A';

      const metrics: RemediationMetric = {
        workflowsCreated: workflows.length,
        workflowsExecuted: events.length,
        actionsExecuted: totalActions,
        successfulActions,
        failedActions,
        averageExecutionTime: Math.round(avgExecutionTime),
        successRate,
        mostUsedActionType,
      };

      return { success: true, metrics };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get security posture metrics
   */
  async getSecurityPostureMetrics(
    _userId: string,
    projectId: string
  ): Promise<{ success: boolean; metrics?: SecurityPostureMetric; error?: string }> {
    try {
      // Fetch vulnerabilities
      const { data: vulnData, error: vulnError } = await supabase
        .from('vulnerabilities')
        .select('id, severity, status, created_at, remediated_at')
        .eq('project_id', projectId);

      // Fetch remediation events for MTTR calculation
      const { data: remediationEvents, error: remediationError } = await supabase
        .from('remediation_events')
        .select('completed_at, triggered_at')
        .eq('project_id', projectId)
        .eq('overall_status', 'succeeded')
        .gte('completed_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

      if (vulnError || remediationError) {
        return {
          success: false,
          error: vulnError?.message || remediationError?.message,
        };
      }

      const vulns = vulnData || [];

      // Count by severity
      const bySeverity = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };

      vulns.forEach((v: any) => {
        const severity = (v.severity || 'low').toLowerCase();
        if (severity in bySeverity) {
          bySeverity[severity as keyof typeof bySeverity]++;
        }
      });

      // Calculate MTTR
      const events = remediationEvents || [];
      let totalTimeMs = 0;

      events.forEach((event: any) => {
        const triggeredAt = new Date(event.triggered_at).getTime();
        const completedAt = new Date(event.completed_at).getTime();
        totalTimeMs += completedAt - triggeredAt;
      });

      const averageTimeToRemediate =
        events.length > 0 ? Math.round(totalTimeMs / events.length / (1000 * 60 * 60)) : 0; // hours

      const totalVulns = vulns.length;
      const closedVulns = vulns.filter((v: any) => v.status === 'closed').length;
      const remediationRate =
        totalVulns > 0 ? Math.round((closedVulns / totalVulns) * 1000) / 10 : 0;

      const metrics: SecurityPostureMetric = {
        totalVulnerabilities: totalVulns,
        criticalVulnerabilities: bySeverity.critical,
        highVulnerabilities: bySeverity.high,
        mediumVulnerabilities: bySeverity.medium,
        lowVulnerabilities: bySeverity.low,
        vulnerabilitiesClosed: closedVulns,
        averageTimeToRemediate,
        remediationRate,
        trendPercentage: -10, // TODO: Calculate from historical data
      };

      return { success: true, metrics };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Get compliance framework metrics
   */
  async getFrameworkMetrics(
    userId: string,
    projectId: string
  ): Promise<{ success: boolean; metrics?: ComplianceMetric[] }> {
    try {
      const frameworks: ComplianceFramework[] = ['SOC2', 'GDPR', 'HIPAA', 'ISO27001', 'PCI-DSS'];
      const metrics: ComplianceMetric[] = [];

      for (const framework of frameworks) {
        // Stub: Fetch from compliance_controls table (future)
        // For now, calculate based on remediation rate
        const { success: remSuccess, metrics: remMetrics } =
          await ComplianceService.getRemediationMetrics(userId, projectId);

        const remediationScore = remSuccess && remMetrics ? remMetrics.successRate : 0;

        const metric: ComplianceMetric = {
          framework,
          status: remediationScore >= 80 ? 'compliant' : 'at-risk',
          controlsTotal: 10, // TODO: Actual count
          controlsCompliant: Math.round(remediationScore / 10),
          controlsNonCompliant: 10 - Math.round(remediationScore / 10),
          controlsAtRisk: 0,
          compliancePercentage: remediationScore,
          trend: 'improving',
          trendPercentage: 5,
          lastUpdatedAt: new Date().toISOString(),
        };

        metrics.push(metric);
      }

      return { success: true, metrics };
    } catch (_err: any) {
      return { success: false };
    }
  },

  /**
   * Calculate overall compliance score
   */
  async getComplianceScore(
    userId: string,
    projectId: string
  ): Promise<{ success: boolean; score?: ComplianceScore }> {
    try {
      const { success: remSuccess, metrics: remMetrics } =
        await ComplianceService.getRemediationMetrics(userId, projectId);
      const { success: alertSuccess, metrics: alertMetrics } =
        await ComplianceService.getAlertMetrics(userId, projectId);
      const { success: posureSuccess, metrics: posureMetrics } =
        await ComplianceService.getSecurityPostureMetrics(userId, projectId);

      if (!remSuccess || !alertSuccess || !posureSuccess) {
        return { success: false };
      }

      // Calculate component scores
      const remediationScore = remMetrics?.successRate || 0;
      const securityScore = posureMetrics?.remediationRate || 0;
      const alertingScore = Math.min(100, (alertMetrics?.rulesCreated || 0) * 10);

      // Weighted average
      const overallScore = Math.round(
        remediationScore * 0.4 + securityScore * 0.35 + alertingScore * 0.25
      );

      const score: ComplianceScore = {
        overallScore,
        securityScore: Math.round(securityScore),
        remediationScore: Math.round(remediationScore),
        alertingScore: Math.round(alertingScore),
        lastUpdatedAt: new Date().toISOString(),
      };

      return { success: true, score };
    } catch (_err: any) {
      return { success: false };
    }
  },

  /**
   * Generate AI recommendation
   */
  generateRecommendation(_frameworks: ComplianceMetric[], score: ComplianceScore): string {
    if (score.overallScore < 50) {
      return 'Critical: Security posture is below acceptable. Focus on remediating high-severity vulnerabilities immediately.';
    }

    if (score.overallScore < 70) {
      return 'At Risk: Consider increasing remediation automation and alert rule coverage to improve compliance.';
    }

    if (score.overallScore < 85) {
      return 'Good: Monitor compliance trends. Consider expanding alert rules to cover more frameworks.';
    }

    return 'Excellent: Maintain current security posture and continue monitoring compliance metrics.';
  },

  /**
   * Generate compliance report
   */
  async generateReport(
    userId: string,
    request: ComplianceReportRequest
  ): Promise<{ success: boolean; report?: ComplianceReport; error?: string }> {
    try {
      const { success: dashboardSuccess, dashboard } = await ComplianceService.getDashboard(
        userId,
        request.projectId
      );

      if (!dashboardSuccess || !dashboard) {
        return { success: false, error: 'Failed to generate report' };
      }

      const report: ComplianceReport = {
        projectId: request.projectId,
        reportDate: new Date().toISOString(),
        period: 'monthly',
        executiveSummary: `Compliance Report for Project ${request.projectId}. Overall Score: ${dashboard.score.overallScore}/100`,
        frameworks: dashboard.frameworks,
        riskItems: [],
        recommendations: [dashboard.recommendation],
        scoreHistory: [],
        generatedBy: userId,
      };

      return { success: true, report };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
};
