import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComplianceTab } from '../ComplianceTab';
import type { ComplianceDashboard } from '../../api/types.compliance';

const { mockGetDashboard } = vi.hoisted(() => ({
  mockGetDashboard: vi.fn(),
}));

vi.mock('../../api/compliance.service', () => ({
  ComplianceService: {
    getDashboard: mockGetDashboard,
  },
}));

const buildDashboard = (overallScore: number): ComplianceDashboard => ({
  projectId: 'project-1',
  generatedAt: new Date().toISOString(),
  recommendation: 'Focus on SOC2 controls to improve score.',
  score: {
    overallScore,
    remediationScore: 72,
    securityScore: 68,
    alertingScore: 80,
    lastUpdatedAt: new Date().toISOString(),
  },
  alerts: {
    rulesCreated: 12,
    rulesTriggered: 7,
    alertsGenerated: 18,
    falsePositivesRate: 11,
    averageAlertResolutionTime: 4,
    highestSeverityLevel: 'critical',
  },
  remediation: {
    workflowsCreated: 8,
    workflowsExecuted: 15,
    actionsExecuted: 31,
    successfulActions: 25,
    failedActions: 6,
    averageExecutionTime: 512,
    successRate: 80.6,
    mostUsedActionType: 'disable_asset',
  },
  securityPosture: {
    totalVulnerabilities: 42,
    criticalVulnerabilities: 4,
    highVulnerabilities: 10,
    mediumVulnerabilities: 16,
    lowVulnerabilities: 12,
    vulnerabilitiesClosed: 21,
    averageTimeToRemediate: 37,
    remediationRate: 50,
    trendPercentage: 9,
  },
  frameworks: [
    {
      framework: 'SOC2',
      status: 'compliant',
      controlsTotal: 20,
      controlsCompliant: 17,
      controlsNonCompliant: 2,
      controlsAtRisk: 1,
      compliancePercentage: 85,
      trend: 'improving',
      trendPercentage: 5,
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      framework: 'GDPR',
      status: 'at-risk',
      controlsTotal: 18,
      controlsCompliant: 10,
      controlsNonCompliant: 4,
      controlsAtRisk: 4,
      compliancePercentage: 56,
      trend: 'degrading',
      trendPercentage: 3,
      lastUpdatedAt: new Date().toISOString(),
    },
    {
      framework: 'HIPAA',
      status: 'non-compliant',
      controlsTotal: 16,
      controlsCompliant: 5,
      controlsNonCompliant: 8,
      controlsAtRisk: 3,
      compliancePercentage: 31,
      trend: 'stable',
      trendPercentage: 0,
      lastUpdatedAt: new Date().toISOString(),
    },
  ],
});

describe('ComplianceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state before dashboard resolves', () => {
    mockGetDashboard.mockReturnValue(new Promise(() => {}));

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    expect(screen.getByText('Loading compliance data...')).toBeInTheDocument();
  });

  it('renders error from service when success=false', async () => {
    mockGetDashboard.mockResolvedValue({
      success: false,
      error: 'Dashboard fetch failed',
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard fetch failed')).toBeInTheDocument();
    });
  });

  it('renders thrown error message when service throws', async () => {
    mockGetDashboard.mockRejectedValue(new Error('Network exploded'));

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Network exploded')).toBeInTheDocument();
    });
  });

  it('renders dashboard details and framework trends', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Overall Compliance Score')).toBeInTheDocument();
    expect(screen.getByText('Recommendation')).toBeInTheDocument();
    expect(screen.getByText('Compliance Frameworks')).toBeInTheDocument();

    expect(screen.getByText('SOC2')).toBeInTheDocument();
    expect(screen.getByText('GDPR')).toBeInTheDocument();
    expect(screen.getByText('HIPAA')).toBeInTheDocument();

    expect(screen.getByText('+5%')).toBeInTheDocument();
    expect(screen.getByText('-3%')).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('refresh button triggers loadDashboard again', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(72),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Dashboard')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockGetDashboard).toHaveBeenCalledTimes(2);
    });
  });

  it('covers score color branches for >=85, >=70, >=50, and <50', async () => {
    for (const score of [90, 74, 55, 45]) {
      mockGetDashboard.mockResolvedValueOnce({
        success: true,
        dashboard: buildDashboard(score),
      });

      const { unmount } = render(<ComplianceTab projectId="project-1" userId="user-1" />);
      await waitFor(() => {
        expect(screen.getByText('Overall Compliance Score')).toBeInTheDocument();
      });
      expect(screen.getByText(String(score))).toBeInTheDocument();
      unmount();
    }
  });
});
