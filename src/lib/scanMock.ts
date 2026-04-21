import { supabase } from './supabase';
import { recomputeProjectRiskScore } from './riskScore';

type FindingTpl = {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cve_id: string;
  mitre_tactic: string;
  cis_control: string;
  asset: string;
  remediation: string;
  remediation_code?: string;
  remediation_type?: 'terraform' | 'bash' | 'kubernetes' | 'manual' | 'aws-cli';
};

const SCANNER_FINDINGS: Record<string, FindingTpl[]> = {
  nmap: [
    {
      title: 'SSH exposed with password authentication',
      description: 'Port 22 open to 0.0.0.0/0 accepting password auth.',
      severity: 'high',
      cve_id: '',
      mitre_tactic: 'Initial Access',
      cis_control: 'CIS 4.5',
      asset: 'bastion.example.com:22',
      remediation: 'Disable PasswordAuthentication in sshd_config and restrict source CIDR.',
      remediation_type: 'bash',
      remediation_code: 'sed -i "s/^PasswordAuthentication yes/PasswordAuthentication no/" /etc/ssh/sshd_config && systemctl restart sshd'
    },
    {
      title: 'Outdated nginx version detected',
      description: 'Server responds with nginx/1.18.0, vulnerable to CVE-2021-23017.',
      severity: 'medium',
      cve_id: 'CVE-2021-23017',
      mitre_tactic: 'Exploitation',
      cis_control: 'CIS 7.1',
      asset: 'www.example.com:443',
      remediation: 'Upgrade nginx to 1.20.1 or later.',
      remediation_type: 'bash',
      remediation_code: 'apt-get update && apt-get install --only-upgrade nginx'
    },
  ],
  prowler: [
    {
      title: 'S3 bucket publicly readable',
      description: 'Bucket "app-assets" allows public-read ACL.',
      severity: 'critical',
      cve_id: '',
      mitre_tactic: 'Exfiltration',
      cis_control: 'CIS AWS 2.1.5',
      asset: 's3://app-assets',
      remediation: 'Apply BlockPublicAccess at account level and tighten bucket policy.',
      remediation_type: 'aws-cli',
      remediation_code: 'aws s3api put-public-access-block --bucket app-assets --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"'
    },
    {
      title: 'Root account used in last 30 days',
      description: 'CloudTrail shows root account activity.',
      severity: 'high',
      cve_id: '',
      mitre_tactic: 'Privilege Escalation',
      cis_control: 'CIS AWS 1.7',
      asset: 'aws::iam::root',
      remediation: 'Rotate root credentials, remove access keys, enforce MFA.',
      remediation_type: 'manual',
    },
    {
      title: 'IAM user without MFA',
      description: '3 IAM users without MFA enabled.',
      severity: 'medium',
      cve_id: '',
      mitre_tactic: 'Credential Access',
      cis_control: 'CIS AWS 1.10',
      asset: 'aws::iam::users',
      remediation: 'Enforce MFA policy for all console users.',
      remediation_type: 'aws-cli',
      remediation_code: 'aws iam create-virtual-mfa-device --virtual-mfa-device-name <user_name> --outfile /tmp/qrcode.png --bootstrap-method QRCodePNG'
    },
  ],
  tfsec: [
    {
      title: 'Security group allows ingress from 0.0.0.0/0',
      description: 'aws_security_group.web allows 0.0.0.0/0 on port 0-65535.',
      severity: 'high',
      cve_id: '',
      mitre_tactic: 'Lateral Movement',
      cis_control: 'CIS AWS 5.2',
      asset: 'aws_security_group.web',
      remediation: 'Restrict CIDR to known management IPs.',
      remediation_type: 'terraform',
      remediation_code: 'resource "aws_security_group_rule" "allow_mgmt" {\n  type              = "ingress"\n  from_port         = 0\n  to_port           = 65535\n  protocol          = "tcp"\n  cidr_blocks       = ["10.0.0.0/8"]\n  security_group_id = aws_security_group.web.id\n}'
    },
    {
      title: 'RDS instance without encryption at rest',
      description: 'aws_db_instance.primary has storage_encrypted = false.',
      severity: 'high',
      cve_id: '',
      mitre_tactic: 'Collection',
      cis_control: 'CIS AWS 2.3.1',
      asset: 'aws_db_instance.primary',
      remediation: 'Set storage_encrypted = true and re-provision.',
      remediation_type: 'terraform',
      remediation_code: 'resource "aws_db_instance" "primary" {\n  # ... existing config\n  storage_encrypted = true\n}'
    },
  ],
  amass: [
    {
      title: 'Forgotten subdomain pointing to decommissioned resource',
      description: 'staging-old.example.com resolves to unclaimed S3 bucket.',
      severity: 'critical',
      cve_id: '',
      mitre_tactic: 'Initial Access',
      cis_control: 'CIS 13.6',
      asset: 'staging-old.example.com',
      remediation: 'Remove dangling DNS record or reclaim S3 bucket.',
      remediation_type: 'manual',
    },
  ],
};

export async function runMockScan(userId: string, projectId: string, scanner: string) {
  // 1. Fetch project context for "grounded" simulation
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
  
  const { data: scan } = await supabase
    .from('scans')
    .insert({
      user_id: userId,
      project_id: projectId,
      scanner,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (!scan || !project) return null;

  // Simulate variable execution time (1s to 4s)
  const duration = Math.floor(Math.random() * 3000) + 1000;
  await new Promise((r) => setTimeout(r, duration));

  let findings = [...(SCANNER_FINDINGS[scanner] ?? SCANNER_FINDINGS.nmap)];
  
  // Intelligence: If production, add more critical findings or change asset labels
  if (project.environment === 'production' || project.name.toLowerCase().includes('prod')) {
    findings = findings.map(f => ({
      ...f,
      severity: f.severity === 'high' ? 'critical' : f.severity,
      asset: f.asset.replace('example.com', project.target || 'prod.internal')
    }));
  } else {
    findings = findings.map(f => ({
      ...f,
      asset: f.asset.replace('example.com', project.target || 'dev.local')
    }));
  }

  // Randomly subset findings to avoid identical results every time
  const subsetCount = Math.max(1, Math.floor(Math.random() * findings.length) + 1);
  const selectedFindings = findings.sort(() => 0.5 - Math.random()).slice(0, subsetCount);

  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

  for (const f of selectedFindings) {
    summary[f.severity]++;
    await supabase.from('vulnerabilities').insert({
      scan_id: scan.id,
      user_id: userId,
      ...f,
    });
  }

  await supabase
    .from('scans')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      severity_summary: summary,
    })
    .eq('id', scan.id);

  const topSeverity: 'critical' | 'warning' | 'success' =
    summary.critical > 0 ? 'critical' : (summary.high > 0 ? 'warning' : 'success');

  const parts: string[] = [];
  if (summary.critical) parts.push(`${summary.critical} critical`);
  if (summary.high) parts.push(`${summary.high} high`);
  if (summary.medium) parts.push(`${summary.medium} medium`);
  if (summary.low) parts.push(`${summary.low} low`);
  const bodyStr = parts.length ? `Findings: ${parts.join(', ')}.` : 'No findings detected.';

  await recomputeProjectRiskScore(projectId);

  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'scan_completed',
    title: `${scanner} scan completed`,
    body: bodyStr,
    link: 'scans',
    severity: topSeverity,
    metadata: { scan_id: scan.id, project_id: projectId, scanner, summary },
  });

  return scan.id;
}


export const AVAILABLE_SCANNERS: { id: string; label: string; description: string; category?: string; cloud?: string }[] = [
  // Network
  { id: 'nmap',         label: 'Nmap',            description: 'External port and service discovery',            category: 'network' },
  { id: 'amass',        label: 'Amass',           description: 'Subdomain enumeration & DNS intelligence',       category: 'network' },
  { id: 'nuclei',       label: 'Nuclei',          description: 'Fast web vulnerability scanner (OWASP)',         category: 'web' },
  // IaC
  { id: 'tfsec',        label: 'tfsec',           description: 'Terraform IaC static analysis',                  category: 'iac' },
  { id: 'checkov',      label: 'Checkov',         description: 'Multi-cloud IaC policy scanner',                 category: 'iac' },
  // Cloud – AWS
  { id: 'prowler',      label: 'Prowler (AWS)',    description: 'AWS cloud security posture & CIS benchmarks',   category: 'cloud', cloud: 'aws' },
  // Cloud – GCP
  { id: 'gcp-scc',      label: 'GCP SCC',         description: 'GCP Security Command Center findings import',    category: 'cloud', cloud: 'gcp' },
  // Cloud – Azure
  { id: 'azure-defender', label: 'Azure Defender', description: 'Microsoft Defender for Cloud recommendations',  category: 'cloud', cloud: 'azure' },
  // Containers & Kubernetes
  { id: 'trivy',        label: 'Trivy',           description: 'Container image & filesystem vulnerability scan', category: 'container' },
  { id: 'kube-bench',   label: 'kube-bench',      description: 'Kubernetes CIS Benchmark compliance check',      category: 'kubernetes' },
  // Mobile
  { id: 'mobsf',        label: 'MobSF',           description: 'Mobile App Security Framework (APK/IPA)',        category: 'mobile' },
];
