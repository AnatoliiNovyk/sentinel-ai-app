/**
 * Compliance Dashboard Component
 * Phase 5, Batch 3: Compliance Dashboard
 * Displays compliance metrics, frameworks, and recommendations
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, Shield, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ComplianceService } from '../api/compliance.service';
import { ComplianceDashboard, ComplianceMetric } from '../api/types.compliance';

interface ComplianceDashboardProps {
  projectId: string;
  userId: string;
}

interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export const ComplianceTab: React.FC<ComplianceDashboardProps> = ({
  projectId,
  userId,
}: ComplianceDashboardProps) => {
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState<LoadingState>({ isLoading: true });

  useEffect(() => {
    loadDashboard();
    // Refresh every 5 minutes
    const interval = setInterval(loadDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, userId]);

  const loadDashboard = async () => {
    try {
      setLoading({ isLoading: true });
      const { success, dashboard: data, error } = await ComplianceService.getDashboard(
        userId,
        projectId
      );

      if (success && data) {
        setDashboard(data);
        setLoading({ isLoading: false });
      } else {
        setLoading({ isLoading: false, error: error || 'Failed to load dashboard' });
      }
    } catch (err: any) {
      setLoading({ isLoading: false, error: err.message });
    }
  };

  if (loading.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading compliance data...</div>
      </div>
    );
  }

  if (loading.error || !dashboard) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
        <AlertCircle className="inline mr-2" />
        {loading.error || 'Failed to load compliance dashboard'}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Compliance Dashboard</h2>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Overall Score Card */}
      <ScoreCard score={dashboard.score} />

      {/* Recommendation */}
      <RecommendationCard recommendation={dashboard.recommendation} />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Alert Metrics */}
        <MetricCard
          title="Alert Rules"
          icon={<AlertCircle className="w-6 h-6 text-blue-600" />}
          stats={[
            { label: 'Rules Created', value: dashboard.alerts.rulesCreated },
            { label: 'Alerts Generated', value: dashboard.alerts.alertsGenerated },
            { label: 'False Positives', value: `${dashboard.alerts.falsePositivesRate}%` },
          ]}
        />

        {/* Remediation Metrics */}
        <MetricCard
          title="Remediation"
          icon={<Shield className="w-6 h-6 text-green-600" />}
          stats={[
            { label: 'Workflows', value: dashboard.remediation.workflowsCreated },
            { label: 'Success Rate', value: `${dashboard.remediation.successRate.toFixed(1)}%` },
            { label: 'Avg Execution', value: `${dashboard.remediation.averageExecutionTime}ms` },
          ]}
        />

        {/* Security Posture */}
        <MetricCard
          title="Security Posture"
          icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
          stats={[
            {
              label: 'Vulnerabilities',
              value: dashboard.securityPosture.totalVulnerabilities,
            },
            {
              label: 'Remediation Rate',
              value: `${dashboard.securityPosture.remediationRate.toFixed(1)}%`,
            },
            {
              label: 'Avg MTTR',
              value: `${dashboard.securityPosture.averageTimeToRemediate}h`,
            },
          ]}
        />
      </div>

      {/* Compliance Frameworks */}
      <FrameworksTable frameworks={dashboard.frameworks} />

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vulnerability Distribution */}
        <SeverityDistribution metrics={dashboard.securityPosture} />

        {/* Remediation Breakdown */}
        <RemediationBreakdown metrics={dashboard.remediation} />
      </div>
    </div>
  );
};

interface ScoreCardProps {
  score: any;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ score }) => {
  const getScoreColor = (scoreValue: number) => {
    if (scoreValue >= 85) return 'text-green-600';
    if (scoreValue >= 70) return 'text-yellow-600';
    if (scoreValue >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (scoreValue: number) => {
    if (scoreValue >= 85) return 'bg-green-50 border-green-200';
    if (scoreValue >= 70) return 'bg-yellow-50 border-yellow-200';
    if (scoreValue >= 50) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className={`border rounded-lg p-6 ${getScoreBgColor(score.overallScore)}`}>
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-gray-700 font-semibold mb-2">Overall Compliance Score</h3>
          <div className={`text-5xl font-bold ${getScoreColor(score.overallScore)}`}>
            {score.overallScore}
            <span className="text-2xl ml-2">/100</span>
          </div>
        </div>

        {/* Component Scores */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">{score.remediationScore}</div>
            <div className="text-xs text-gray-600">Remediation</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">{score.securityScore}</div>
            <div className="text-xs text-gray-600">Security</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-purple-600">{score.alertingScore}</div>
            <div className="text-xs text-gray-600">Alerting</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="w-full bg-gray-300 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              score.overallScore >= 85
                ? 'bg-green-600'
                : score.overallScore >= 70
                  ? 'bg-yellow-600'
                  : score.overallScore >= 50
                    ? 'bg-orange-600'
                    : 'bg-red-600'
            }`}
            style={{ width: `${score.overallScore}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

interface RecommendationCardProps {
  recommendation: string;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
        <div>
          <h4 className="font-semibold text-blue-900">Recommendation</h4>
          <p className="text-blue-800 mt-1">{recommendation}</p>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  stats: Array<{ label: string; value: string | number }>;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, icon, stats }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>

      <div className="space-y-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{stat.label}</span>
            <span className="font-semibold text-gray-900">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface FrameworksTableProps {
  frameworks: ComplianceMetric[];
}

const FrameworksTable: React.FC<FrameworksTableProps> = ({ frameworks }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Compliance Frameworks</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4 font-semibold">Framework</th>
              <th className="text-left py-2 px-4 font-semibold">Status</th>
              <th className="text-left py-2 px-4 font-semibold">Compliance %</th>
              <th className="text-left py-2 px-4 font-semibold">Controls</th>
              <th className="text-left py-2 px-4 font-semibold">Trend</th>
            </tr>
          </thead>
          <tbody>
            {frameworks.map((fw) => (
              <tr key={fw.framework} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-semibold">{fw.framework}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      fw.status === 'compliant'
                        ? 'bg-green-100 text-green-800'
                        : fw.status === 'at-risk'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {fw.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{ width: `${fw.compliancePercentage}%` }}
                      ></div>
                    </div>
                    <span className="font-semibold">{fw.compliancePercentage.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {fw.controlsCompliant}/{fw.controlsTotal}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1">
                    {fw.trend === 'improving' && (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-green-600">+{fw.trendPercentage}%</span>
                      </>
                    )}
                    {fw.trend === 'degrading' && (
                      <>
                        <TrendingUp className="w-4 h-4 text-red-600 transform rotate-180" />
                        <span className="text-red-600">-{fw.trendPercentage}%</span>
                      </>
                    )}
                    {fw.trend === 'stable' && <span className="text-gray-500">Stable</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface SeverityDistributionProps {
  metrics: any;
}

const SeverityDistribution: React.FC<SeverityDistributionProps> = ({ metrics }) => {
  const total =
    metrics.criticalVulnerabilities +
    metrics.highVulnerabilities +
    metrics.mediumVulnerabilities +
    metrics.lowVulnerabilities;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Vulnerability Distribution</h3>

      <div className="space-y-3">
        <VulnSeverityBar
          label="Critical"
          count={metrics.criticalVulnerabilities}
          total={total}
          color="bg-red-600"
        />
        <VulnSeverityBar
          label="High"
          count={metrics.highVulnerabilities}
          total={total}
          color="bg-orange-600"
        />
        <VulnSeverityBar
          label="Medium"
          count={metrics.mediumVulnerabilities}
          total={total}
          color="bg-yellow-600"
        />
        <VulnSeverityBar
          label="Low"
          count={metrics.lowVulnerabilities}
          total={total}
          color="bg-blue-600"
        />
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between">
          <span className="text-gray-600">Total</span>
          <span className="font-semibold">{total}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Closed</span>
          <span className="font-semibold">{metrics.vulnerabilitiesClosed}</span>
        </div>
      </div>
    </div>
  );
};

interface VulnSeverityBarProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

const VulnSeverityBar: React.FC<VulnSeverityBarProps> = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-semibold">{count}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};

interface RemediationBreakdownProps {
  metrics: any;
}

const RemediationBreakdown: React.FC<RemediationBreakdownProps> = ({ metrics }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="font-semibold text-gray-900 mb-4">Remediation Summary</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-gray-600">Successful Actions</span>
          </div>
          <span className="font-semibold">{metrics.successfulActions}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-gray-600">Failed Actions</span>
          </div>
          <span className="font-semibold">{metrics.failedActions}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-gray-600">Avg Execution Time</span>
          </div>
          <span className="font-semibold">{metrics.averageExecutionTime}ms</span>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm text-gray-600">Success Rate</span>
            <span className="text-sm font-semibold">{metrics.successRate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-green-600"
              style={{ width: `${metrics.successRate}%` }}
            ></div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <p>Most Used Action: <span className="font-semibold">{metrics.mostUsedActionType}</span></p>
        </div>
      </div>
    </div>
  );
};
