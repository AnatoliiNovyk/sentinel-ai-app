/**
 * Sprint 6: AI Security Copilot
 * Generates context-aware remediation code using an LLM API.
 * In a real production setup, this would call an Edge Function that securely holds the API key.
 * For this implementation, we use a mock AI engine to demonstrate the functionality,
 * which can be swapped out for a real OpenAI/Anthropic/Gemini call.
 */

export type AiRemediationRequest = {
  title: string;
  description: string;
  severity: string;
  asset: string;
  cve_id: string;
  remediation_type: string;
};

export type AiRemediationResponse = {
  explanation: string;
  code: string;
  language: string;
};

export async function generateAiRemediation(req: AiRemediationRequest): Promise<AiRemediationResponse> {
  // Simulate network delay for AI processing
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Determine the fix type based on the request content
  const title = req.title.toLowerCase();
  
  if (req.remediation_type === 'terraform' || title.includes('s3') || title.includes('ec2')) {
    return {
      explanation: `I've analyzed the vulnerability **${req.title}** on \`${req.asset}\`.\nThis typically occurs when cloud resources are provisioned without explicitly enforcing security controls. The following Terraform code will enforce the necessary policies.`,
      code: `resource "aws_s3_bucket_public_access_block" "remediation" {
  bucket = aws_s3_bucket.example.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}`,
      language: 'hcl',
    };
  }

  if (req.remediation_type === 'kubernetes' || title.includes('pod') || title.includes('container')) {
    return {
      explanation: `The vulnerability **${req.title}** on \`${req.asset}\` indicates insecure pod defaults. \nI've generated a Kubernetes SecurityContext patch that you can apply to drop unnecessary capabilities and prevent privilege escalation.`,
      code: `apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      runAsNonRoot: true
      capabilities:
        drop:
          - ALL`,
      language: 'yaml',
    };
  }

  if (title.includes('ssh') || title.includes('port 22')) {
    return {
      explanation: `SSH exposure on \`${req.asset}\` is highly critical. \nThe following bash script will modify your SSH daemon configuration to disable password authentication and restart the service safely.`,
      code: `#!/bin/bash
# AI-Generated SSH Remediation
sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/g' /etc/ssh/sshd_config
sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin no/g' /etc/ssh/sshd_config
systemctl restart sshd
echo "SSH secured."`,
      language: 'bash',
    };
  }

  // Generic fallback
  return {
    explanation: `Based on the finding **${req.title}** (${req.cve_id || 'Unknown CVE'}) for asset \`${req.asset}\`, immediate patching is required. \nPlease run the following commands to update the affected packages to their secure versions.`,
    code: `# AI-Generated Fallback Patch
apt-get update && apt-get upgrade -y
# or for alpine: apk upgrade
# Review dependencies before applying in production.`,
    language: 'bash',
  };
}
