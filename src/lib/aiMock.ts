export function generateAIResponse(prompt: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes('aws') || lower.includes('cloud')) {
    return `I'll initiate a cloud security assessment for your AWS environment. Here's my plan:

1. **Reconnaissance**: Use Prowler and CloudSploit to enumerate IAM policies, S3 buckets, security groups.
2. **IaC Analysis**: Run tfsec and Checkov against your Terraform modules to catch misconfigurations.
3. **Compliance Mapping**: Cross-reference findings against CIS AWS Foundations Benchmark and SOC2 controls.
4. **Prioritization**: Group findings by MITRE ATT&CK cloud tactics and severity.

Estimated duration: 12-18 minutes. Shall I proceed with a read-only scan using your configured credentials?`;
  }

  if (lower.includes('scan') || lower.includes('pentest') || lower.includes('audit')) {
    return `Understood. I'll orchestrate a multi-stage external audit using the following toolkit:

- **Amass** for subdomain enumeration
- **Masscan** for high-speed port discovery
- **Nmap** for service and version fingerprinting
- **OpenVAS** for vulnerability correlation against CVE databases

I'll normalize all outputs into a unified findings format and map each risk to MITRE ATT&CK tactics. Would you like me to include an executive summary for leadership?`;
  }

  if (lower.includes('report')) {
    return `I can generate two report tiers from the latest scan data:

- **Executive Summary** (1-2 pages): Business risk language, KPIs, compliance posture.
- **Technical Deep Dive**: Per-finding remediation, CVE references, proof-of-concept commands, ready-to-apply Terraform/Kubernetes patches.

Which tier should I produce first?`;
  }

  return `I'm Sentinel, your AI security auditor. I can orchestrate external, cloud, IaC, and vulnerability scans, map findings to MITRE ATT&CK and CIS Controls, and generate executive or technical reports with ready-to-apply remediation code.

Try asking: *"Scan my AWS account for SOC2 compliance"* or *"Run an external attack surface audit on example.com"*.`;
}
