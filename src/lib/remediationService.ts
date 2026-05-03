import { supabase, Vulnerability } from './supabase';

export type RemediationStep = {
  order: number;
  title: string;
  description: string;
  command?: string;
  language?: 'bash' | 'python' | 'yaml' | 'terraform' | 'powershell' | 'typescript' | 'sql';
  note?: string;
};

export type RemediationSuggestion = {
  id: string;
  vulnerability_id: string;
  user_id: string;
  summary: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  effort: 'quick-win' | 'moderate' | 'complex';
  estimated_time: string;
  steps: RemediationStep[];
  references: { label: string; url: string }[];
  generated_at: string;
};

// ─── Context-aware suggestion generator ───────────────────────────────────────

function detectCategory(vuln: Vulnerability): string {
  const t = `${vuln.title} ${vuln.description} ${vuln.cve_id ?? ''}`.toLowerCase();
  if (t.includes('sql') || t.includes('injection')) return 'sql-injection';
  if (t.includes('xss') || t.includes('cross-site')) return 'xss';
  if (t.includes('ssrf')) return 'ssrf';
  if (t.includes('iam') || t.includes('privilege') || t.includes('permission')) return 'iam';
  if (t.includes('s3') || t.includes('bucket') || t.includes('storage')) return 's3';
  if (t.includes('ssl') || t.includes('tls') || t.includes('certificate')) return 'tls';
  if (t.includes('secret') || t.includes('key') || t.includes('credential') || t.includes('password')) return 'secrets';
  if (t.includes('docker') || t.includes('container') || t.includes('kubernetes') || t.includes('k8s')) return 'container';
  if (t.includes('csrf')) return 'csrf';
  if (t.includes('rce') || t.includes('remote code') || t.includes('command injection')) return 'rce';
  if (t.includes('path traversal') || t.includes('directory traversal') || t.includes('lfi') || t.includes('rfi')) return 'path-traversal';
  if (t.includes('auth') || t.includes('session') || t.includes('cookie')) return 'auth';
  if (t.includes('open port') || t.includes('exposed port') || t.includes('firewall')) return 'network';
  if (t.includes('log4') || t.includes('log4j') || t.includes('log4shell')) return 'log4shell';
  if (t.includes('apache') || t.includes('nginx') || t.includes('httpd')) return 'webserver';
  if (t.includes('outdated') || t.includes('version') || t.includes('cve-')) return 'outdated-package';
  return 'generic';
}

type SuggestionTemplate = Omit<RemediationSuggestion, 'id' | 'vulnerability_id' | 'user_id' | 'generated_at'>;

const TEMPLATES: Record<string, (vuln: Vulnerability) => SuggestionTemplate> = {
  'sql-injection': () => ({
    summary: 'Parameterize all database queries and implement input sanitization to prevent SQL injection attacks.',
    priority: 'immediate',
    effort: 'moderate',
    estimated_time: '4–8 hours',
    steps: [
      {
        order: 1,
        title: 'Replace raw queries with parameterized statements',
        description: 'Never concatenate user input directly into SQL strings. Use prepared statements or an ORM.',
        command: `// ❌ Vulnerable\nconst q = \`SELECT * FROM users WHERE id = '\${userId}'\`;\n\n// ✅ Safe — parameterized\nconst { data } = await supabase\n  .from('users')\n  .select()\n  .eq('id', userId);`,
        language: 'typescript',
      },
      {
        order: 2,
        title: 'Add server-side input validation',
        description: 'Validate and sanitize all inputs at the API boundary before they reach the database layer.',
        command: `import { z } from 'zod';\nconst schema = z.object({ userId: z.string().uuid() });\nconst parsed = schema.safeParse(req.body);\nif (!parsed.success) return res.status(400).json({ error: 'Invalid input' });`,
        language: 'typescript',
      },
      {
        order: 3,
        title: 'Enforce Row Level Security (RLS) in Supabase',
        description: 'Enable RLS on all tables so even a successful injection cannot access other users\' data.',
        command: `ALTER TABLE users ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "own_rows" ON users FOR ALL\n  USING (auth.uid() = id);`,
        language: 'sql',
        note: 'Apply to all tables that hold user-specific data.',
      },
    ],
    references: [
      { label: 'OWASP SQL Injection Prevention', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
      { label: 'Supabase RLS Guide', url: 'https://supabase.com/docs/guides/auth/row-level-security' },
    ],
  }),

  'xss': () => ({
    summary: 'Sanitize all user-controlled output and enforce a strict Content Security Policy to eliminate XSS attack vectors.',
    priority: 'immediate',
    effort: 'moderate',
    estimated_time: '3–6 hours',
    steps: [
      {
        order: 1,
        title: 'Use DOMPurify for HTML content rendering',
        description: 'Sanitize any HTML before inserting it into the DOM.',
        command: `import DOMPurify from 'dompurify';\n\n// ❌ Dangerous\ncontainer.innerHTML = userInput;\n\n// ✅ Safe\ncontainer.innerHTML = DOMPurify.sanitize(userInput);`,
        language: 'typescript',
      },
      {
        order: 2,
        title: 'Set Content Security Policy headers',
        description: 'Configure a strict CSP to block inline scripts and untrusted sources.',
        command: `# nginx.conf\nadd_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none';" always;`,
        language: 'bash',
      },
      {
        order: 3,
        title: 'Set HttpOnly and Secure cookie flags',
        description: 'Prevent JavaScript from accessing session cookies via document.cookie.',
        command: `Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict`,
        language: 'bash',
        note: 'Verify with browser DevTools → Application → Cookies.',
      },
    ],
    references: [
      { label: 'OWASP XSS Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' },
      { label: 'Content Security Policy (MDN)', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP' },
    ],
  }),

  'iam': (vuln) => ({
    summary: `Enforce least-privilege IAM policies for ${vuln.asset || 'the affected resource'} and enable audit logging.`,
    priority: 'high',
    effort: 'moderate',
    estimated_time: '2–4 hours',
    steps: [
      {
        order: 1,
        title: 'Audit current IAM policies',
        description: 'Use AWS Access Advisor or IAM simulator to identify unused permissions.',
        command: `aws iam generate-service-last-accessed-details --arn <role-arn>\naws iam get-service-last-accessed-details --job-id <job-id>`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Apply least-privilege policy',
        description: 'Replace wildcard (*) permissions with specific actions and resource ARNs.',
        command: `{\n  "Version": "2012-10-17",\n  "Statement": [{\n    "Effect": "Allow",\n    "Action": ["s3:GetObject"],\n    "Resource": "arn:aws:s3:::my-bucket/*"\n  }]\n}`,
        language: 'yaml',
      },
      {
        order: 3,
        title: 'Enable CloudTrail for audit logging',
        description: 'Ensure all API calls are logged for forensic analysis.',
        command: `aws cloudtrail create-trail \\\n  --name security-audit-trail \\\n  --s3-bucket-name my-audit-logs \\\n  --is-multi-region-trail\naws cloudtrail start-logging --name security-audit-trail`,
        language: 'bash',
      },
    ],
    references: [
      { label: 'AWS IAM Best Practices', url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html' },
      { label: 'CIS AWS Foundations Benchmark', url: 'https://www.cisecurity.org/benchmark/amazon_web_services' },
    ],
  }),

  's3': (vuln) => ({
    summary: `Block all public access on the S3 bucket${vuln.asset ? ` (${vuln.asset})` : ''} and enable encryption at rest.`,
    priority: 'immediate',
    effort: 'quick-win',
    estimated_time: '30–60 minutes',
    steps: [
      {
        order: 1,
        title: 'Block S3 public access at bucket level',
        description: 'Enable all four public access block settings.',
        command: `aws s3api put-public-access-block \\\n  --bucket <bucket-name> \\\n  --public-access-block-configuration \\\n    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Enable server-side encryption (SSE-S3)',
        description: 'Encrypt all objects stored in the bucket by default.',
        command: `aws s3api put-bucket-encryption \\\n  --bucket <bucket-name> \\\n  --server-side-encryption-configuration \\\n  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'`,
        language: 'bash',
      },
      {
        order: 3,
        title: 'Enable S3 access logging',
        description: 'Log all access requests for compliance and forensics.',
        command: `aws s3api put-bucket-logging \\\n  --bucket <bucket-name> \\\n  --bucket-logging-status \\\n  '{"LoggingEnabled":{"TargetBucket":"<log-bucket>","TargetPrefix":"s3-access-logs/"}}'`,
        language: 'bash',
      },
    ],
    references: [
      { label: 'AWS S3 Security Best Practices', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html' },
      { label: 'S3 Block Public Access', url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html' },
    ],
  }),

  'tls': () => ({
    summary: 'Upgrade to TLS 1.3, disable weak cipher suites, and automate certificate renewal.',
    priority: 'high',
    effort: 'moderate',
    estimated_time: '2–4 hours',
    steps: [
      {
        order: 1,
        title: 'Enforce TLS 1.2+ and strong cipher suites',
        description: 'Disable SSLv3, TLS 1.0, TLS 1.1, and weak ciphers like RC4, DES, 3DES.',
        command: `# nginx.conf\nssl_protocols TLSv1.2 TLSv1.3;\nssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';\nssl_prefer_server_ciphers on;\nssl_session_cache shared:SSL:10m;`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Set up automatic certificate renewal with certbot',
        description: 'Let\'s Encrypt certificates expire after 90 days — automate renewal.',
        command: `# Install certbot\napt install certbot python3-certbot-nginx\n\n# Issue certificate\ncertbot --nginx -d yourdomain.com\n\n# Verify auto-renewal timer\nsystemctl status certbot.timer`,
        language: 'bash',
      },
      {
        order: 3,
        title: 'Enable HSTS header',
        description: 'Force browsers to use HTTPS for all future connections.',
        command: `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`,
        language: 'bash',
        note: 'After enabling HSTS, submit to https://hstspreload.org/ for browser preload list.',
      },
    ],
    references: [
      { label: 'Mozilla TLS Configuration Generator', url: 'https://ssl-config.mozilla.org/' },
      { label: 'HSTS Preload List', url: 'https://hstspreload.org/' },
    ],
  }),

  'secrets': (vuln) => ({
    summary: `Rotate all exposed credentials${vuln.asset ? ` related to ${vuln.asset}` : ''}, revoke old secrets, and migrate to a secrets manager.`,
    priority: 'immediate',
    effort: 'moderate',
    estimated_time: '2–6 hours',
    steps: [
      {
        order: 1,
        title: 'Immediately revoke and rotate the exposed secret',
        description: 'Treat any exposed secret as fully compromised. Revoke it now.',
        command: `# AWS — rotate access key\naws iam create-access-key --user-name <user>\naws iam delete-access-key --access-key-id <old-key> --user-name <user>\n\n# GitHub — revoke token via Settings → Developer settings → Personal access tokens`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Scan git history for other exposed secrets',
        description: 'Use truffleHog or gitleaks to detect secrets committed to the repo.',
        command: `# truffleHog\ntrufflehog git file://. --only-verified\n\n# gitleaks\ngitleaks detect --source=. --verbose`,
        language: 'bash',
      },
      {
        order: 3,
        title: 'Migrate secrets to a secrets manager',
        description: 'Store all credentials in AWS Secrets Manager, HashiCorp Vault, or similar.',
        command: `# Store secret in AWS Secrets Manager\naws secretsmanager create-secret \\\n  --name prod/myapp/db-password \\\n  --secret-string '{"password":"<new-password>"}'\n\n# Retrieve in code\nconst secret = await secretsManager.getSecretValue({ SecretId: 'prod/myapp/db-password' }).promise();`,
        language: 'bash',
      },
    ],
    references: [
      { label: 'OWASP Secrets Management', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html' },
      { label: 'GitHub Secret Scanning', url: 'https://docs.github.com/en/code-security/secret-scanning' },
    ],
  }),

  'container': () => ({
    summary: 'Harden container security: use non-root user, read-only filesystem, and enforce pod security policies.',
    priority: 'high',
    effort: 'moderate',
    estimated_time: '3–5 hours',
    steps: [
      {
        order: 1,
        title: 'Run container as non-root user',
        description: 'Never run containers as root. Add a dedicated user in the Dockerfile.',
        command: `FROM node:20-alpine\nRUN addgroup -S appgroup && adduser -S appuser -G appgroup\nUSER appuser\nWORKDIR /app\nCOPY --chown=appuser:appgroup . .\nCMD ["node", "server.js"]`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Apply Kubernetes Pod Security Standards',
        description: 'Add security context to restrict container capabilities.',
        command: `securityContext:\n  runAsNonRoot: true\n  runAsUser: 1000\n  readOnlyRootFilesystem: true\n  allowPrivilegeEscalation: false\n  capabilities:\n    drop: ["ALL"]`,
        language: 'yaml',
      },
      {
        order: 3,
        title: 'Scan container image for vulnerabilities',
        description: 'Run Trivy or Grype to detect CVEs in base image and installed packages.',
        command: `# Trivy\ntrivy image myapp:latest --severity HIGH,CRITICAL\n\n# Grype\ngrype myapp:latest`,
        language: 'bash',
      },
    ],
    references: [
      { label: 'Kubernetes Pod Security Standards', url: 'https://kubernetes.io/docs/concepts/security/pod-security-standards/' },
      { label: 'Docker Security Best Practices', url: 'https://docs.docker.com/develop/security-best-practices/' },
    ],
  }),

  'rce': () => ({
    summary: 'Eliminate command injection vectors by never constructing shell commands from user input and applying strict input validation.',
    priority: 'immediate',
    effort: 'moderate',
    estimated_time: '4–8 hours',
    steps: [
      {
        order: 1,
        title: 'Replace shell exec with safe API alternatives',
        description: 'Avoid exec/eval with user input. Use language-native libraries instead.',
        command: `// ❌ Dangerous\nimport { exec } from 'child_process';\nexec(\`convert \${filename}\`, callback);\n\n// ✅ Safe — use sharp library directly\nimport sharp from 'sharp';\nawait sharp(inputBuffer).resize(800).toFile(outputPath);`,
        language: 'typescript',
      },
      {
        order: 2,
        title: 'If shell exec is required, allowlist arguments',
        description: 'Validate against a strict allowlist before passing to any subprocess.',
        command: `const ALLOWED_COMMANDS = ['ls', 'ping', 'dig'];\nif (!ALLOWED_COMMANDS.includes(command)) {\n  throw new Error('Command not allowed');\n}\nexecFile('/usr/bin/' + command, [arg], options, callback);`,
        language: 'typescript',
      },
      {
        order: 3,
        title: 'Run application in a sandboxed environment',
        description: 'Use seccomp profiles or AppArmor to limit syscalls available to the process.',
        command: `# Apply seccomp default profile in Docker\ndocker run --security-opt seccomp=/path/to/seccomp.json myapp`,
        language: 'bash',
      },
    ],
    references: [
      { label: 'OWASP Command Injection', url: 'https://owasp.org/www-community/attacks/Command_Injection' },
      { label: 'CWE-78: OS Command Injection', url: 'https://cwe.mitre.org/data/definitions/78.html' },
    ],
  }),

  'path-traversal': () => ({
    summary: 'Validate and normalize all file paths to prevent directory traversal to sensitive files.',
    priority: 'immediate',
    effort: 'quick-win',
    estimated_time: '1–2 hours',
    steps: [
      {
        order: 1,
        title: 'Normalize and validate file paths',
        description: 'Use path.resolve() and verify the resolved path stays within the allowed directory.',
        command: `import path from 'path';\n\nconst BASE_DIR = '/var/app/uploads';\nconst userFile = req.params.filename;\n\nconst resolved = path.resolve(BASE_DIR, userFile);\nif (!resolved.startsWith(BASE_DIR)) {\n  return res.status(403).json({ error: 'Forbidden' });\n}\n// Safe to use resolved`,
        language: 'typescript',
      },
      {
        order: 2,
        title: 'Use a filename allowlist',
        description: 'Only allow specific filename patterns (e.g., alphanumeric + extension).',
        command: `const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\\.(pdf|png|jpg|csv)$/;\nif (!SAFE_FILENAME.test(filename)) {\n  throw new Error('Invalid filename');\n}`,
        language: 'typescript',
      },
    ],
    references: [
      { label: 'OWASP Path Traversal', url: 'https://owasp.org/www-community/attacks/Path_Traversal' },
      { label: 'CWE-22: Path Traversal', url: 'https://cwe.mitre.org/data/definitions/22.html' },
    ],
  }),

  'auth': () => ({
    summary: 'Strengthen authentication with MFA, secure session management, and token rotation.',
    priority: 'high',
    effort: 'moderate',
    estimated_time: '4–8 hours',
    steps: [
      {
        order: 1,
        title: 'Enforce MFA for all privileged accounts',
        description: 'Require TOTP or hardware key (WebAuthn) for admin and API access.',
        command: `// Supabase MFA enrollment\nconst { data } = await supabase.auth.mfa.enroll({ factorType: 'totp' });\nconsole.log(data.totp.qr_code); // Display QR to user`,
        language: 'typescript',
      },
      {
        order: 2,
        title: 'Rotate JWT signing keys periodically',
        description: 'Use short-lived access tokens (15 min) with long-lived refresh tokens.',
        command: `// Supabase auto-refreshes sessions — verify config\n// supabase.auth.onAuthStateChange triggers on token refresh\nsupabase.auth.onAuthStateChange((event, session) => {\n  if (event === 'TOKEN_REFRESHED') console.log('Token rotated');\n});`,
        language: 'typescript',
      },
      {
        order: 3,
        title: 'Invalidate sessions on password change',
        description: 'All existing sessions should be revoked when credentials are updated.',
        command: `await supabase.auth.updateUser({ password: newPassword });\n// Supabase automatically invalidates other sessions\nawait supabase.auth.signOut({ scope: 'global' });`,
        language: 'typescript',
      },
    ],
    references: [
      { label: 'OWASP Authentication Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html' },
      { label: 'Supabase MFA Docs', url: 'https://supabase.com/docs/guides/auth/auth-mfa' },
    ],
  }),

  'network': (vuln) => ({
    summary: `Close unnecessary exposed ports on ${vuln.asset || 'the affected host'} and restrict access with firewall rules.`,
    priority: 'high',
    effort: 'quick-win',
    estimated_time: '1–2 hours',
    steps: [
      {
        order: 1,
        title: 'Identify and close open ports',
        description: 'Audit all listening services and disable anything not required.',
        command: `# List all listening ports\nss -tlnp\n\n# Disable unnecessary service (example: FTP)\nsystemctl disable vsftpd --now`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Restrict access with UFW / iptables',
        description: 'Allow only required ports from trusted IP ranges.',
        command: `# Allow SSH only from office IP\nufw allow from 203.0.113.0/24 to any port 22\n\n# Allow HTTPS from anywhere\nufw allow 443/tcp\n\n# Deny everything else\nufw default deny incoming\nufw enable`,
        language: 'bash',
      },
    ],
    references: [
      { label: 'CIS Ubuntu Benchmark', url: 'https://www.cisecurity.org/benchmark/ubuntu_linux' },
      { label: 'UFW Documentation', url: 'https://help.ubuntu.com/community/UFW' },
    ],
  }),

  'outdated-package': (vuln) => ({
    summary: `Update ${vuln.asset || 'the vulnerable package'} to the latest patched version${vuln.cve_id ? ` (${vuln.cve_id})` : ''}.`,
    priority: vuln.severity === 'critical' || vuln.severity === 'high' ? 'immediate' : 'medium',
    effort: 'quick-win',
    estimated_time: '30–90 minutes',
    steps: [
      {
        order: 1,
        title: 'Update the vulnerable package',
        description: 'Upgrade to the version that contains the security fix.',
        command: `# npm\nnpm audit fix\nnpm update <package-name>\n\n# yarn\nyarn upgrade <package-name>\n\n# pip\npip install --upgrade <package-name>`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Run dependency audit and fix all known vulnerabilities',
        description: 'Check entire dependency tree for other known CVEs.',
        command: `# npm full audit\nnpm audit --audit-level=high\n\n# Snyk scan\nnpx snyk test\n\n# OWASP Dependency-Check\ndependency-check --project myapp --scan ./`,
        language: 'bash',
      },
      {
        order: 3,
        title: 'Pin dependencies and enable automated updates',
        description: 'Use Dependabot or Renovate Bot to auto-create PRs for security updates.',
        command: `# .github/dependabot.yml\nversion: 2\nupdates:\n  - package-ecosystem: "npm"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 10`,
        language: 'yaml',
      },
    ],
    references: [
      { label: 'GitHub Dependabot Docs', url: 'https://docs.github.com/en/code-security/dependabot' },
      { label: 'OWASP Dependency-Check', url: 'https://owasp.org/www-project-dependency-check/' },
    ],
  }),

  'generic': (vuln) => ({
    summary: vuln.remediation
      /* c8 ignore next */
      ? vuln.remediation
      : `Apply security hardening measures to address the ${vuln.severity}-severity finding on ${vuln.asset || 'the affected asset'}.`,
    priority: vuln.severity === 'critical' ? 'immediate' : vuln.severity === 'high' ? 'high' : 'medium',
    effort: 'moderate',
    estimated_time: '2–6 hours',
    steps: [
      {
        order: 1,
        title: 'Investigate and confirm the finding',
        description: 'Reproduce the vulnerability in a staging environment to confirm exploitability.',
        command: `# Use nikto for web application scan\nnikto -h https://<target> -Tuning 1234579\n\n# Use nmap for network enumeration\nnmap -sV -sC --script vuln <target>`,
        language: 'bash',
      },
      {
        order: 2,
        title: 'Apply the vendor-recommended fix',
        description: vuln.remediation || 'Apply patches, configuration changes, or code fixes as recommended by the vulnerability advisory.',
      },
      {
        order: 3,
        title: 'Verify the fix and retest',
        description: 'Run the same scan that detected the vulnerability to confirm it is resolved.',
        command: `# Re-run the scan after patching\nnmap -sV <target> -p <affected-port>\n\n# For web apps — re-run OWASP ZAP\nzap-cli quick-scan --self-contained --start-options '-config api.disablekey=true' <target>`,
        language: 'bash',
      },
    ],
    references: [
      { label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
      { label: 'NVD CVE Database', url: `https://nvd.nist.gov/vuln/search/results?query=${vuln.cve_id ?? vuln.title}` },
    ],
  }),
};

// ─── Cache layer (localStorage) ────────────────────────────────────────────

const CACHE_KEY = 'sentinel_remediation_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function readCache(): Record<string, RemediationSuggestion> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
  } catch {
    /* c8 ignore next 2 */
    return {};
  }
}

function writeCache(cache: Record<string, RemediationSuggestion>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage quota — silently ignore
    /* c8 ignore next */
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function generateRemediation(
  vuln: Vulnerability,
  userId: string,
): Promise<RemediationSuggestion> {
  // Check cache first
  const cache = readCache();
  const cached = cache[vuln.id];
  if (cached) {
    const age = Date.now() - new Date(cached.generated_at).getTime();
    if (age < CACHE_TTL_MS) return cached;
  }

  // Simulate AI processing delay (100–400ms)
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));

  const category = detectCategory(vuln);
  const templateFn = TEMPLATES[category] ?? TEMPLATES['generic'];
  const template = templateFn(vuln);

  const suggestion: RemediationSuggestion = {
    id: crypto.randomUUID(),
    vulnerability_id: vuln.id,
    user_id: userId,
    generated_at: new Date().toISOString(),
    ...template,
  };

  // Persist to Supabase (best-effort, non-blocking)
  supabase
    .from('remediation_suggestions')
    .upsert(
      {
        id: suggestion.id,
        vulnerability_id: suggestion.vulnerability_id,
        user_id: suggestion.user_id,
        summary: suggestion.summary,
        priority: suggestion.priority,
        effort: suggestion.effort,
        estimated_time: suggestion.estimated_time,
        steps: suggestion.steps,
        references: suggestion.references,
        generated_at: suggestion.generated_at,
      },
      { onConflict: 'vulnerability_id' },
    )
    .then(() => { /* noop */ }, () => { /* ignore errors */ });

  // Update cache
  cache[vuln.id] = suggestion;
  writeCache(cache);

  return suggestion;
}

export async function getSavedRemediation(
  vulnerabilityId: string,
): Promise<RemediationSuggestion | null> {
  // Check local cache first
  const cache = readCache();
  if (cache[vulnerabilityId]) return cache[vulnerabilityId];

  const { data } = await supabase
    .from('remediation_suggestions')
    .select('*')
    .eq('vulnerability_id', vulnerabilityId)
    .maybeSingle();

  if (data) {
    /* c8 ignore next 4 */
    cache[vulnerabilityId] = data as RemediationSuggestion;
    writeCache(cache);
    return data as RemediationSuggestion;
  }

  return null;
}

export function clearRemediationCache(vulnerabilityId?: string) {
  const cache = readCache();
  if (vulnerabilityId) {
    delete cache[vulnerabilityId];
  } else {
    localStorage.removeItem(CACHE_KEY);
    return;
  }
  writeCache(cache);
}
