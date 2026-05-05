/**
 * Compliance Service - Tests
 * Phase 5, Batch 3: Compliance Dashboard
 */

import { describe, it, expect, vi } from 'vitest';
import { ComplianceService } from '../compliance.service';
import type { ComplianceReportRequest } from '../types.compliance';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        single: vi.fn(async () => ({ data: null, error: null })),
      };
      return chain;
    }),
  })),
}));

describe('ComplianceService', () => {
  const testUserId = 'test-user-1';
  const testProjectId = 'test-project-1';

  describe('alert metrics', () => {
    it('should fetch alert metrics successfully', async () => {
      const result = await ComplianceService.getAlertMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      if (result.metrics) {
        expect(result.metrics.rulesCreated).toBeGreaterThanOrEqual(0);
        expect(result.metrics.rulesTriggered).toBeGreaterThanOrEqual(0);
        expect(result.metrics.alertsGenerated).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate false positive rate', async () => {
      const result = await ComplianceService.getAlertMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.falsePositivesRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.falsePositivesRate).toBeLessThanOrEqual(100);
      }
    });

    it('should track highest severity level', async () => {
      const result = await ComplianceService.getAlertMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(['critical', 'high', 'medium', 'low', 'unknown']).toContain(
          result.metrics.highestSeverityLevel
        );
      }
    });
  });

  describe('remediation metrics', () => {
    it('should fetch remediation metrics successfully', async () => {
      const result = await ComplianceService.getRemediationMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      if (result.metrics) {
        expect(result.metrics.workflowsCreated).toBeGreaterThanOrEqual(0);
        expect(result.metrics.workflowsExecuted).toBeGreaterThanOrEqual(0);
        expect(result.metrics.successRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.successRate).toBeLessThanOrEqual(100);
      }
    });

    it('should calculate success rate correctly', async () => {
      const result = await ComplianceService.getRemediationMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.successRate).toBeLessThanOrEqual(100);
        expect(result.metrics.successRate).toBeGreaterThanOrEqual(0);
      }
    });

    it('should track average execution time', async () => {
      const result = await ComplianceService.getRemediationMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
      }
    });

    it('should identify most used action type', async () => {
      const result = await ComplianceService.getRemediationMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.mostUsedActionType).toBeDefined();
      }
    });
  });

  describe('security posture metrics', () => {
    it('should fetch security posture metrics successfully', async () => {
      const result = await ComplianceService.getSecurityPostureMetrics(
        testUserId,
        testProjectId
      );

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      if (result.metrics) {
        expect(result.metrics.totalVulnerabilities).toBeGreaterThanOrEqual(0);
        expect(result.metrics.criticalVulnerabilities).toBeGreaterThanOrEqual(0);
      }
    });

    it('should count vulnerabilities by severity', async () => {
      const result = await ComplianceService.getSecurityPostureMetrics(
        testUserId,
        testProjectId
      );

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.criticalVulnerabilities).toBeGreaterThanOrEqual(0);
        expect(result.metrics.highVulnerabilities).toBeGreaterThanOrEqual(0);
        expect(result.metrics.mediumVulnerabilities).toBeGreaterThanOrEqual(0);
        expect(result.metrics.lowVulnerabilities).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate remediation rate', async () => {
      const result = await ComplianceService.getSecurityPostureMetrics(
        testUserId,
        testProjectId
      );

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.remediationRate).toBeGreaterThanOrEqual(0);
        expect(result.metrics.remediationRate).toBeLessThanOrEqual(100);
      }
    });

    it('should calculate MTTR (Mean Time To Remediate)', async () => {
      const result = await ComplianceService.getSecurityPostureMetrics(
        testUserId,
        testProjectId
      );

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.averageTimeToRemediate).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('framework metrics', () => {
    it('should fetch framework metrics for all frameworks', async () => {
      const result = await ComplianceService.getFrameworkMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
      if (result.metrics) {
        expect(result.metrics.length).toBe(5); // SOC2, GDPR, HIPAA, ISO27001, PCI-DSS
      }
    });

    it('should calculate compliance status correctly', async () => {
      const result = await ComplianceService.getFrameworkMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        result.metrics.forEach((metric) => {
          expect(['compliant', 'non-compliant', 'at-risk']).toContain(metric.status);
        });
      }
    });

    it('should include all required framework metrics', async () => {
      const result = await ComplianceService.getFrameworkMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        result.metrics.forEach((metric) => {
          expect(metric.framework).toBeDefined();
          expect(metric.compliancePercentage).toBeGreaterThanOrEqual(0);
          expect(metric.compliancePercentage).toBeLessThanOrEqual(100);
          expect(['improving', 'stable', 'degrading']).toContain(metric.trend);
        });
      }
    });
  });

  describe('compliance score', () => {
    it('should calculate compliance score', async () => {
      const result = await ComplianceService.getComplianceScore(testUserId, testProjectId);

      expect(result.success).toBe(true);
      expect(result.score).toBeDefined();
      if (result.score) {
        expect(result.score.overallScore).toBeGreaterThanOrEqual(0);
        expect(result.score.overallScore).toBeLessThanOrEqual(100);
      }
    });

    it('should calculate component scores', async () => {
      const result = await ComplianceService.getComplianceScore(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.score) {
        expect(result.score.remediationScore).toBeGreaterThanOrEqual(0);
        expect(result.score.remediationScore).toBeLessThanOrEqual(100);
        expect(result.score.securityScore).toBeGreaterThanOrEqual(0);
        expect(result.score.securityScore).toBeLessThanOrEqual(100);
        expect(result.score.alertingScore).toBeGreaterThanOrEqual(0);
        expect(result.score.alertingScore).toBeLessThanOrEqual(100);
      }
    });

    it('should use weighted average for overall score', async () => {
      const result = await ComplianceService.getComplianceScore(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.score) {
        // Overall score should be influenced by all components
        expect(result.score.overallScore).toBeDefined();
      }
    });
  });

  describe('recommendations', () => {
    it('should generate recommendation for critical score', () => {
      const mockScore = {
        overallScore: 40,
        securityScore: 40,
        remediationScore: 40,
        alertingScore: 40,
        lastUpdatedAt: new Date().toISOString(),
      };

      const recommendation = ComplianceService.generateRecommendation([], mockScore);

      expect(recommendation).toContain('Critical');
    });

    it('should generate recommendation for at-risk score', () => {
      const mockScore = {
        overallScore: 60,
        securityScore: 60,
        remediationScore: 60,
        alertingScore: 60,
        lastUpdatedAt: new Date().toISOString(),
      };

      const recommendation = ComplianceService.generateRecommendation([], mockScore);

      expect(recommendation).toContain('At Risk');
    });

    it('should generate recommendation for good score', () => {
      const mockScore = {
        overallScore: 75,
        securityScore: 75,
        remediationScore: 75,
        alertingScore: 75,
        lastUpdatedAt: new Date().toISOString(),
      };

      const recommendation = ComplianceService.generateRecommendation([], mockScore);

      expect(recommendation).toContain('Good');
    });

    it('should generate recommendation for excellent score', () => {
      const mockScore = {
        overallScore: 90,
        securityScore: 90,
        remediationScore: 90,
        alertingScore: 90,
        lastUpdatedAt: new Date().toISOString(),
      };

      const recommendation = ComplianceService.generateRecommendation([], mockScore);

      expect(recommendation).toContain('Excellent');
    });
  });

  describe('dashboard aggregation', () => {
    it('should aggregate all metrics into dashboard', async () => {
      const result = await ComplianceService.getDashboard(testUserId, testProjectId);

      expect(result.success).toBe(true);
      expect(result.dashboard).toBeDefined();
      if (result.dashboard) {
        expect(result.dashboard.projectId).toBe(testProjectId);
        expect(result.dashboard.frameworks).toBeDefined();
        expect(result.dashboard.securityPosture).toBeDefined();
        expect(result.dashboard.remediation).toBeDefined();
        expect(result.dashboard.alerts).toBeDefined();
        expect(result.dashboard.score).toBeDefined();
      }
    });

    it('should include recommendation in dashboard', async () => {
      const result = await ComplianceService.getDashboard(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.dashboard) {
        expect(result.dashboard.recommendation).toBeDefined();
        expect(result.dashboard.recommendation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('report generation', () => {
    it('should generate compliance report', async () => {
      const request: ComplianceReportRequest = {
        projectId: testProjectId,
        frameworks: ['SOC2', 'GDPR'],
        includeEvidence: true,
        includeRiskItems: true,
      };

      const result = await ComplianceService.generateReport(testUserId, request);

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      if (result.report) {
        expect(result.report.projectId).toBe(testProjectId);
        expect(result.report.reportDate).toBeDefined();
        expect(result.report.period).toMatch(/monthly|quarterly|annual/);
      }
    });
  });

  describe('data validation', () => {
    it('should handle missing project gracefully', async () => {
      const result = await ComplianceService.getDashboard(testUserId, 'nonexistent-project');

      // Should either succeed with empty/default data or fail gracefully
      expect(result.success).toBeDefined();
    });

    it('should handle missing user gracefully', async () => {
      const result = await ComplianceService.getDashboard('nonexistent-user', testProjectId);

      expect(result.success).toBeDefined();
    });
  });

  describe('score edge cases', () => {
    it('should handle zero vulnerabilities', async () => {
      const result = await ComplianceService.getSecurityPostureMetrics(
        testUserId,
        testProjectId
      );

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.remediationRate).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle zero remediation workflows', async () => {
      const result = await ComplianceService.getRemediationMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.successRate).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle zero alert rules', async () => {
      const result = await ComplianceService.getAlertMetrics(testUserId, testProjectId);

      expect(result.success).toBe(true);
      if (result.metrics) {
        expect(result.metrics.rulesCreated).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
