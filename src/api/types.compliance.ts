/**
 * Compliance Types
 * Phase 5, Batch 3: Compliance Dashboard
 * Tracking frameworks: SOC2, GDPR, HIPAA, ISO27001
 */

export type ComplianceFramework = 'SOC2' | 'GDPR' | 'HIPAA' | 'ISO27001' | 'PCI-DSS';

export type ComplianceStatus = 'compliant' | 'non-compliant' | 'at-risk' | 'unknown';

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string; // e.g., "SOC2-CC6.1"
  name: string;
  description: string;
  category: string; // e.g., "Risk Management", "Change Management"
  status: ComplianceStatus;
  lastAssessedAt?: string;
  dueDate?: string;
  evidence?: string[];
}

export interface ComplianceMetric {
  framework: ComplianceFramework;
  status: ComplianceStatus;
  controlsTotal: number;
  controlsCompliant: number;
  controlsNonCompliant: number;
  controlsAtRisk: number;
  compliancePercentage: number; // 0-100
  trend: 'improving' | 'stable' | 'degrading';
  trendPercentage: number; // Change from last period
  lastUpdatedAt: string;
}

export interface SecurityPostureMetric {
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  mediumVulnerabilities: number;
  lowVulnerabilities: number;
  vulnerabilitiesClosed: number;
  averageTimeToRemediate: number; // hours
  remediationRate: number; // 0-100
  trendPercentage: number; // MTTR improvement
}

export interface RemediationMetric {
  workflowsCreated: number;
  workflowsExecuted: number;
  actionsExecuted: number;
  successfulActions: number;
  failedActions: number;
  averageExecutionTime: number; // ms
  successRate: number; // 0-100
  mostUsedActionType: string;
}

export interface AlertMetric {
  rulesCreated: number;
  rulesTriggered: number;
  alertsGenerated: number;
  falsePositivesRate: number; // 0-100
  averageAlertResolutionTime: number; // hours
  highestSeverityLevel: string;
}

export interface ComplianceScore {
  overallScore: number; // 0-100
  securityScore: number; // 0-100
  remediationScore: number; // 0-100 (based on remediation rate)
  alertingScore: number; // 0-100 (based on alert coverage)
  lastUpdatedAt: string;
  scoreHistory?: {
    date: string;
    score: number;
  }[];
}

export interface ComplianceDashboard {
  projectId: string;
  frameworks: ComplianceMetric[];
  securityPosture: SecurityPostureMetric;
  remediation: RemediationMetric;
  alerts: AlertMetric;
  score: ComplianceScore;
  recommendation: string; // e.g., "Focus on SOC2 CC6.1 to improve compliance by 5%"
  generatedAt: string;
}

export interface ComplianceRiskItem {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  evidenceGap: string; // What's missing for compliance
  remediationSteps: string[];
  estimatedEffort: 'low' | 'medium' | 'high'; // Story points estimate
  priority: number; // 1-10
  assignedTo?: string;
  dueDate?: string;
}

export interface ComplianceTrendData {
  date: string;
  soc2: number;
  gdpr: number;
  hipaa: number;
  iso27001: number;
  overallScore: number;
}

export interface ComplianceReportRequest {
  projectId: string;
  frameworks: ComplianceFramework[];
  includeEvidence?: boolean;
  includeRiskItems?: boolean;
  includeTrends?: boolean;
}

export interface ComplianceReport {
  projectId: string;
  reportDate: string;
  period: 'monthly' | 'quarterly' | 'annual';
  executiveSummary: string;
  frameworks: ComplianceMetric[];
  riskItems: ComplianceRiskItem[];
  recommendations: string[];
  scoreHistory: ComplianceTrendData[];
  generatedBy?: string;
}
