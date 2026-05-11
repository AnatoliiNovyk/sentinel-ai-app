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

  it('falls back to default error when service response has no error text', async () => {
    mockGetDashboard.mockResolvedValue({
      success: false,
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
    });
  });

  it('falls back to default error when success=true but dashboard payload is missing', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: null,
      error: undefined,
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
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

  it('renders framework status badges for compliant / at-risk / non-compliant', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Frameworks')).toBeInTheDocument();
    });

    expect(screen.getByText('compliant')).toBeInTheDocument();
    expect(screen.getByText('at-risk')).toBeInTheDocument();
    expect(screen.getByText('non-compliant')).toBeInTheDocument();
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

  it('renders formatted metric values with expected units', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Dashboard')).toBeInTheDocument();
    });

    expect(screen.getAllByText('80.6%').length).toBeGreaterThan(0);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('37h')).toBeInTheDocument();
    expect(screen.getAllByText('512ms').length).toBeGreaterThan(0);
  });

  it('renders recommendation text in card', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Recommendation')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Focus on SOC2 controls to improve score.'),
    ).toBeInTheDocument();
  });

  it('renders component sub-scores (Remediation, Security, Alerting)', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Overall Compliance Score')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Remediation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Security').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alerting').length).toBeGreaterThan(0);
    // sub-score values from buildDashboard: 72, 68, 80
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('renders controls count (compliant/total) in frameworks table', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Frameworks')).toBeInTheDocument();
    });

    // SOC2: 17/20, GDPR: 10/18, HIPAA: 5/16
    expect(screen.getByText('17/20')).toBeInTheDocument();
    expect(screen.getByText('10/18')).toBeInTheDocument();
    expect(screen.getByText('5/16')).toBeInTheDocument();
  });

  it('renders 0% severity bars when vulnerability distribution total is zero', async () => {
    const zeroDashboard = buildDashboard(88);
    zeroDashboard.securityPosture.criticalVulnerabilities = 0;
    zeroDashboard.securityPosture.highVulnerabilities = 0;
    zeroDashboard.securityPosture.mediumVulnerabilities = 0;
    zeroDashboard.securityPosture.lowVulnerabilities = 0;
    zeroDashboard.securityPosture.totalVulnerabilities = 0;
    zeroDashboard.securityPosture.vulnerabilitiesClosed = 0;

    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: zeroDashboard,
    });

    const { container } = render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Vulnerability Distribution')).toBeInTheDocument();
    });

    const zeroWidthBars = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.classList.contains('h-2') && (el as HTMLDivElement).style.width === '0%',
    );
    expect(zeroWidthBars.length).toBeGreaterThanOrEqual(4);
  });

  it('renders alert rules metrics: rulesCreated, alertsGenerated, falsePositivesRate', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Alert Rules')).toBeInTheDocument();
    });

    expect(screen.getByText('Rules Created')).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Alerts Generated')).toBeInTheDocument();
    expect(screen.getAllByText('18').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('False Positives')).toBeInTheDocument();
    expect(screen.getByText('11%')).toBeInTheDocument();
  });

  it('renders progress bar with orange class for score 50-69', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(55),
    });

    const { container } = render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('55')).toBeInTheDocument();
    });

    const progressBar = container.querySelector('.h-2.rounded-full.bg-orange-600');
    expect(progressBar).toBeInTheDocument();
    expect((progressBar as HTMLElement).style.width).toBe('55%');
  });

  it('renders remediation summary section with successful and failed actions stats', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Remediation Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Successful Actions')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('Failed Actions')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('calls getDashboard with userId before projectId', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="proj-999" userId="usr-abc" />);

    await waitFor(() => {
      expect(mockGetDashboard).toHaveBeenCalled();
    });

    expect(mockGetDashboard).toHaveBeenCalledWith('usr-abc', 'proj-999');
  });

  it('renders green score card background classes for score >= 85', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(90),
    });

    const { container } = render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Overall Compliance Score')).toBeInTheDocument();
    });

    expect(container.querySelector('.bg-green-50.border-green-200')).toBeInTheDocument();
  });

  it('renders red score card background classes for score below 50', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(45),
    });

    const { container } = render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Overall Compliance Score')).toBeInTheDocument();
    });

    expect(container.querySelector('.bg-red-50.border-red-200')).toBeInTheDocument();
  });

  it('renders yellow score card background classes for score between 70 and 84', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(74),
    });

    const { container } = render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Overall Compliance Score')).toBeInTheDocument();
    });

    expect(container.querySelector('.bg-yellow-50.border-yellow-200')).toBeInTheDocument();
  });

  it('renders progress bar with red class for score below 50', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(45),
    });

    const { container } = render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('45')).toBeInTheDocument();
    });

    const progressBar = container.querySelector('.h-2.rounded-full.bg-red-600');
    expect(progressBar).toBeInTheDocument();
    expect((progressBar as HTMLElement).style.width).toBe('45%');
  });

  it('renders most used action type value in remediation summary', async () => {
    mockGetDashboard.mockResolvedValue({
      success: true,
      dashboard: buildDashboard(88),
    });

    render(<ComplianceTab projectId="project-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText('Remediation Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Most Used Action:')).toBeInTheDocument();
    expect(screen.getByText('disable_asset')).toBeInTheDocument();
  });
});
