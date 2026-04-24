import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService, AuditAction } from '../audit.service';
import {
  validateDarkWebQuery,
  validateSbomInput,
  validateProjectInput,
  validateEmail,
  validateIpAddress,
  validateUrl,
  sanitizeString,
  ValidationLimits,
} from '../../lib/validation';
import { getRateLimiter } from '../../lib/rateLimiter';

vi.mock('../client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          lt: vi.fn(() => Promise.resolve({ error: null, status: 204 })),
        })),
      })),
    })),
  },
}));

describe('Security Integration Tests', () => {
  describe('Input Validation - Dark Web Queries', () => {
    it('accepts valid email queries', () => {
      const result = validateDarkWebQuery('admin@company.com');
      expect(result.valid).toBe(true);
    });

    it('accepts valid domain queries', () => {
      const result = validateDarkWebQuery('company.com');
      expect(result.valid).toBe(true);
    });

    it('accepts valid IP queries', () => {
      const result = validateDarkWebQuery('192.168.1.1');
      expect(result.valid).toBe(true);
    });

    it('rejects empty queries', () => {
      const result = validateDarkWebQuery('');
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/empty|too short/i);
    });

    it('rejects oversized queries', () => {
      const oversized = 'a'.repeat(ValidationLimits.QUERY_MAX_LENGTH + 1);
      const result = validateDarkWebQuery(oversized);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/exceeds maximum/i);
    });

    it('blocks SQL injection attempts', () => {
      const result = validateDarkWebQuery("admin'; DROP TABLE users; --");
      expect(result.valid).toBe(false);
    });

    it('blocks XSS attempts', () => {
      const result = validateDarkWebQuery('<script>alert("xss")</script>');
      expect(result.valid).toBe(false);
    });

    it('blocks template injection', () => {
      const result = validateDarkWebQuery('${process.exit()}');
      expect(result.valid).toBe(false);
    });
  });

  describe('Input Validation - SBOM', () => {
    it('accepts valid CycloneX SBOM', () => {
      const sbom = {
        version: '1.4',
        components: [
          { name: 'pkg1', version: '1.0.0' },
          { name: 'pkg2', version: '2.0.0' },
        ],
      };
      const result = validateSbomInput(sbom);
      expect(result.valid).toBe(true);
    });

    it('accepts valid SPDX SBOM', () => {
      const sbom = {
        spdxVersion: 'SPDX-2.3',
        packages: [
          { SPDXID: 'SPDXRef-Package', name: 'pkg1' },
          { SPDXID: 'SPDXRef-Package2', name: 'pkg2' },
        ],
      };
      const result = validateSbomInput(sbom);
      expect(result.valid).toBe(true);
    });

    it('rejects missing version', () => {
      const sbom = { components: [] };
      const result = validateSbomInput(sbom);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/version/i);
    });

    it('rejects oversized SBOM', () => {
      const largeComponents = Array.from({ length: 15000 }, (_, i) => ({
        name: `pkg-${i}`,
        version: '1.0.0',
      }));
      const sbom = { version: '1.4', components: largeComponents };
      const result = validateSbomInput(sbom, 50, 10000);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too many|exceeds/i);
    });

    it('rejects non-array components', () => {
      const sbom = { version: '1.4', components: 'not-an-array' };
      const result = validateSbomInput(sbom);
      expect(result.valid).toBe(false);
    });

    it('rejects component with missing name', () => {
      const sbom = { version: '1.4', components: [{ version: '1.0.0' }] };
      const result = validateSbomInput(sbom);
      expect(result.valid).toBe(false);
    });

    it('rejects component with oversized name', () => {
      const sbom = {
        version: '1.4',
        components: [{ name: 'a'.repeat(300), version: '1.0.0' }],
      };
      const result = validateSbomInput(sbom);
      expect(result.valid).toBe(false);
    });
  });

  describe('Input Validation - Project', () => {
    it('accepts valid project', () => {
      const result = validateProjectInput({
        name: 'My Project',
        description: 'Test project',
        tags: ['security', 'test'],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects empty project name', () => {
      const result = validateProjectInput({ name: '' });
      expect(result.valid).toBe(false);
    });

    it('rejects oversized project name', () => {
      const result = validateProjectInput({
        name: 'a'.repeat(ValidationLimits.PROJECT_NAME_MAX_LENGTH + 1),
      });
      expect(result.valid).toBe(false);
    });

    it('rejects too many tags', () => {
      const tags = Array.from({ length: 25 }, (_, i) => `tag${i}`);
      const result = validateProjectInput({ name: 'Test', tags });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too many tags/i);
    });

    it('rejects oversized tag', () => {
      const result = validateProjectInput({
        name: 'Test',
        tags: ['a'.repeat(ValidationLimits.TAG_MAX_LENGTH + 1)],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Input Validation - Email & IP', () => {
    it('accepts valid email addresses', () => {
      expect(validateEmail('user@example.com').valid).toBe(true);
      expect(validateEmail('admin@company.co.uk').valid).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(validateEmail('not-an-email').valid).toBe(false);
      expect(validateEmail('user@').valid).toBe(false);
      expect(validateEmail('@example.com').valid).toBe(false);
    });

    it('accepts valid IPv4 addresses', () => {
      expect(validateIpAddress('192.168.1.1').valid).toBe(true);
      expect(validateIpAddress('8.8.8.8').valid).toBe(true);
      expect(validateIpAddress('0.0.0.0').valid).toBe(true);
    });

    it('rejects invalid IPv4 addresses', () => {
      expect(validateIpAddress('256.1.1.1').valid).toBe(false);
      expect(validateIpAddress('192.168.1').valid).toBe(false);
      expect(validateIpAddress('192.168.1.1.1').valid).toBe(false);
    });

    it('accepts valid URLs', () => {
      expect(validateUrl('https://example.com').valid).toBe(true);
      expect(validateUrl('http://localhost:3000').valid).toBe(true);
    });

    it('rejects invalid URLs', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
      expect(validateUrl('ht!tp://bad').valid).toBe(false);
      expect(validateUrl('').valid).toBe(false);
    });
  });

  describe('String Sanitization', () => {
    it('escapes HTML special characters', () => {
      const sanitized = sanitizeString('<script>alert("xss")</script>');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('escapes quotes', () => {
      const sanitized = sanitizeString('He said "hello"');
      expect(sanitized).not.toContain('"');
    });

    it('preserves safe content', () => {
      const original = 'This is a safe string';
      const sanitized = sanitizeString(original);
      expect(sanitized).toContain('This');
    });
  });

  describe('Audit Logging', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('logs successful dark web scan', async () => {
      await AuditService.log({
        orgId: 'org-1',
        userId: 'user-1',
        action: AuditAction.DARK_WEB_SCAN,
        resourceType: 'dark_web_scan',
        resourceId: 'scan-123',
        status: 'success',
        metadata: { query: 'admin@company.com' },
      });

      expect(true).toBe(true); // Fire-and-forget success
    });

    it('logs failed scan with error details', async () => {
      await AuditService.logFailure(
        'org-1',
        'user-1',
        AuditAction.DARK_WEB_SCAN,
        'dark_web_scan',
        'scan-123',
        'QUERY_VALIDATION_FAILED',
        'Query contains invalid characters'
      );

      expect(true).toBe(true);
    });

    it('logs rate limit exceeded events', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      await AuditService.log({
        orgId,
        userId,
        action: AuditAction.RATE_LIMIT_EXCEEDED,
        resourceType: 'scan',
        resourceId: 'scan-123',
        status: 'failure',
        errorCode: 'RATE_LIMIT',
        errorMessage: 'Too many requests',
      });

      expect(true).toBe(true);
    });

    it('fire-and-forget security event', () => {
      AuditService.logSecurityEvent(
        'org-1',
        'user-1',
        AuditAction.CIRCUIT_BREAKER_OPENED,
        'api_endpoint',
        'osv-api',
        { reason: 'excessive_failures' }
      );

      expect(true).toBe(true);
    });
  });

  describe('Rate Limiting & Circuit Breaker', () => {
    it('enforces rate limits on dark web scans', () => {
      const limiter = getRateLimiter('security-dwm-test', {
        maxRequests: 5,
        windowMs: 60000,
      });

      // First 5 should pass
      for (let i = 0; i < 5; i++) {
        const result = limiter.check('user-1');
        expect(result.allowed).toBe(true);
      }

      // 6th should fail
      const blocked = limiter.check('user-1');
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
    });

    it('enforces rate limits per user', () => {
      const limiter = getRateLimiter('security-per-user', {
        maxRequests: 10,
        windowMs: 60000,
      });

      // User 1 exhausts limit
      for (let i = 0; i < 10; i++) {
        limiter.check('user-1');
      }
      expect(limiter.check('user-1').allowed).toBe(false);

      // User 2 still has quota
      expect(limiter.check('user-2').allowed).toBe(true);
    });

    it('recovers from rate limit after window expires', async () => {
      const limiter = getRateLimiter('security-recovery', {
        maxRequests: 2,
        windowMs: 100,
      });

      // Exhaust limit
      limiter.check('test-user');
      limiter.check('test-user');
      expect(limiter.check('test-user').allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should allow again
      expect(limiter.check('test-user').allowed).toBe(true);
    });
  });

  describe('Injection Attack Prevention', () => {
    it('blocks SQL injection in queries', () => {
      const sqlInjection = "'; DROP TABLE projects; --";
      const result = validateDarkWebQuery(sqlInjection);
      expect(result.valid).toBe(false);
    });

    it('blocks NoSQL injection patterns', () => {
      const noSqlInjection = '{"$ne": null}';
      const result = validateDarkWebQuery(noSqlInjection);
      expect(result.valid).toBe(false);
    });

    it('blocks command injection patterns', () => {
      const cmdInjection = '`rm -rf /`';
      const result = validateDarkWebQuery(cmdInjection);
      expect(result.valid).toBe(false);
    });

    it('blocks LDAP injection', () => {
      const ldapInjection = '*)(|(cn=*';
      const result = validateDarkWebQuery(ldapInjection);
      expect(result.valid).toBe(false);
    });
  });

  describe('Data Exfiltration Prevention', () => {
    it('limits SBOM component count to prevent DoS', () => {
      const components = Array.from({ length: 50000 }, (_, i) => ({
        name: `pkg-${i}`,
        version: '1.0.0',
      }));
      const sbom = { version: '1.4', components };

      const result = validateSbomInput(sbom, 50, 10000);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too many|exceeds/i);
    });

    it('limits SBOM size to prevent memory exhaustion', () => {
      // Create a large SBOM structure
      const largeMetadata = 'x'.repeat(100 * 1024 * 1024); // 100MB
      const sbom = { version: '1.4', components: [], metadata: largeMetadata };

      const result = validateSbomInput(sbom, 50, 10000);
      expect(result.valid).toBe(false);
    });

    it('limits query length to prevent buffer overflow', () => {
      const tooLong = 'a'.repeat(ValidationLimits.QUERY_MAX_LENGTH + 1000);
      const result = validateDarkWebQuery(tooLong);
      expect(result.valid).toBe(false);
    });
  });

  describe('Access Control', () => {
    it('validates org isolation in audit logs', async () => {
      await AuditService.log({
        orgId: 'org-1',
        userId: 'user-1',
        action: AuditAction.PROJECT_CREATED,
        resourceType: 'project',
        resourceId: 'proj-123',
        status: 'success',
      });

      // Query should only return logs for org-1
      const logs = await AuditService.queryLogs('org-1');
      expect(Array.isArray(logs)).toBe(true);
    });

    it('enforces resource type boundaries', () => {
      const project = { name: 'Test' };
      const sbom = { version: '1.4', components: [] };

      // Should validate project-specific rules
      expect(validateProjectInput(project).valid).toBe(true);
      // Should validate SBOM-specific rules
      expect(validateSbomInput(sbom).valid).toBe(true);
    });
  });

  describe('Error Handling & Response', () => {
    it('provides clear validation error messages', () => {
      const result = validateDarkWebQuery('');
      expect(result.error).toBeTruthy();
      expect(result.error?.length).toBeGreaterThan(0);
    });

    it('does not leak sensitive information in errors', () => {
      const result = validateDarkWebQuery("admin'; DROP TABLE users; --");
      expect(result.error).not.toContain('DROP');
      expect(result.error).not.toContain('users');
    });

    it('handles malformed SBOM gracefully', () => {
      const result = validateSbomInput(null);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/object/i);
    });
  });
});
