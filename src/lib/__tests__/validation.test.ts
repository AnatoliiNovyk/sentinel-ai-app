/**
 * Unit tests for src/lib/validation.ts
 * Covers security-critical input validation: injection, XSS, LDAP, size limits.
 */
import { describe, it, expect } from 'vitest';
import {
  validateDarkWebQuery,
  validateSbomInput,
  validateProjectInput,
  validateAiPrompt,
  validateApiKey,
  validateEmail,
  validateIpAddress,
  ValidationLimits,
} from '../validation';

// ─── validateDarkWebQuery ─────────────────────────────────────────────────────

describe('validateDarkWebQuery', () => {
  it('accepts a valid query', () => {
    expect(validateDarkWebQuery('domain.com leaked credentials').valid).toBe(true);
  });

  it('rejects empty string', () => {
    const r = validateDarkWebQuery('');
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('rejects null-like input', () => {
    // @ts-expect-error testing runtime guard
    expect(validateDarkWebQuery(null).valid).toBe(false);
    // @ts-expect-error testing runtime guard
    expect(validateDarkWebQuery(undefined).valid).toBe(false);
  });

  it('rejects query exceeding max length', () => {
    const long = 'a'.repeat(ValidationLimits.QUERY_MAX_LENGTH + 1);
    const r = validateDarkWebQuery(long);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('exceeds maximum length');
  });

  it('accepts query at exactly max length', () => {
    const exact = 'a'.repeat(ValidationLimits.QUERY_MAX_LENGTH);
    expect(validateDarkWebQuery(exact).valid).toBe(true);
  });

  it('rejects SQL injection — single quote', () => {
    expect(validateDarkWebQuery("' OR 1=1--").valid).toBe(false);
  });

  it('rejects SQL injection — double quote', () => {
    expect(validateDarkWebQuery('admin"--').valid).toBe(false);
  });

  it('rejects SQL injection — semicolon', () => {
    expect(validateDarkWebQuery('DROP TABLE; users').valid).toBe(false);
  });

  it('rejects template injection — backtick', () => {
    expect(validateDarkWebQuery('`rm -rf /`').valid).toBe(false);
  });

  it('rejects template injection — ${...}', () => {
    expect(validateDarkWebQuery('${process.env}').valid).toBe(false);
  });

  it('rejects XSS — <script tag', () => {
    expect(validateDarkWebQuery('<script>alert(1)</script>').valid).toBe(false);
  });

  it('rejects XSS — javascript: protocol', () => {
    expect(validateDarkWebQuery('javascript:alert(1)').valid).toBe(false);
  });

  it('rejects LDAP injection — *) pattern', () => {
    expect(validateDarkWebQuery('admin*)').valid).toBe(false);
  });

  it('rejects LDAP injection — |( pattern', () => {
    expect(validateDarkWebQuery('|(uid=*)').valid).toBe(false);
  });

  it('rejects LDAP — escaped paren', () => {
    expect(validateDarkWebQuery('\\(admin\\)').valid).toBe(false);
  });
});

// ─── validateSbomInput ────────────────────────────────────────────────────────

describe('validateSbomInput', () => {
  const validSbom = { version: '1.0', components: [{ name: 'lodash', version: '4.17.21' }] };

  it('accepts valid SBOM with components', () => {
    expect(validateSbomInput(validSbom).valid).toBe(true);
  });

  it('accepts SBOM with spdxVersion field', () => {
    expect(validateSbomInput({ spdxVersion: 'SPDX-2.3', packages: [{ name: 'react' }] }).valid).toBe(true);
  });

  it('rejects null input', () => {
    expect(validateSbomInput(null).valid).toBe(false);
  });

  it('rejects string input', () => {
    expect(validateSbomInput('not-an-object').valid).toBe(false);
  });

  it('rejects SBOM missing version information', () => {
    const r = validateSbomInput({ components: [] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('version');
  });

  it('rejects SBOM with too many components', () => {
    const tooMany = Array.from({ length: 10001 }, (_, i) => ({ name: `pkg-${i}` }));
    const r = validateSbomInput({ version: '1', components: tooMany }, 50, 10000);
    expect(r.valid).toBe(false);
    expect(r.error).toContain('too many components');
  });

  it('rejects component missing name', () => {
    const r = validateSbomInput({ version: '1', components: [{ version: '1.0.0' }] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('missing name');
  });

  it('rejects component with name > 255 chars', () => {
    const r = validateSbomInput({
      version: '1',
      components: [{ name: 'x'.repeat(256) }],
    });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('exceeds 255 characters');
  });

  it('accepts exactly 10000 components (boundary)', () => {
    const components = Array.from({ length: 10000 }, (_, i) => ({ name: `p-${i}` }));
    expect(validateSbomInput({ version: '1', components }, 50, 10000).valid).toBe(true);
  });
});

// ─── validateProjectInput ─────────────────────────────────────────────────────

describe('validateProjectInput', () => {
  it('accepts minimal valid project', () => {
    expect(validateProjectInput({ name: 'My Project' }).valid).toBe(true);
  });

  it('accepts project with all fields', () => {
    expect(validateProjectInput({
      name: 'Proj',
      description: 'Some description',
      tags: ['web', 'api'],
    }).valid).toBe(true);
  });

  it('rejects missing name', () => {
    expect(validateProjectInput({}).valid).toBe(false);
  });

  it('rejects whitespace-only name', () => {
    const r = validateProjectInput({ name: '   ' });
    expect(r.valid).toBe(false);
  });

  it('rejects name exceeding max length', () => {
    const r = validateProjectInput({ name: 'a'.repeat(256) });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('exceeds maximum length');
  });

  it('rejects description exceeding max length', () => {
    const r = validateProjectInput({ name: 'Proj', description: 'x'.repeat(5001) });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('exceeds maximum length');
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const r = validateProjectInput({ name: 'Proj', tags });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Too many tags');
  });

  it('rejects tag exceeding max length', () => {
    const r = validateProjectInput({ name: 'Proj', tags: ['a'.repeat(51)] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('exceeds maximum length');
  });

  it('rejects non-string tag', () => {
    // @ts-expect-error testing runtime guard
    const r = validateProjectInput({ name: 'Proj', tags: [123] });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('Tag must be a string');
  });

  it('rejects non-array tags', () => {
    // @ts-expect-error testing runtime guard
    const r = validateProjectInput({ name: 'Proj', tags: 'not-array' });
    expect(r.valid).toBe(false);
  });
});

// ─── validateAiPrompt ────────────────────────────────────────────────────────

describe('validateAiPrompt', () => {
  it('accepts a normal prompt', () => {
    expect(validateAiPrompt('Scan my network for vulnerabilities').valid).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateAiPrompt('').valid).toBe(false);
  });

  it('rejects whitespace-only prompt', () => {
    expect(validateAiPrompt('   ').valid).toBe(false);
  });

  it('rejects prompt exceeding max length', () => {
    const r = validateAiPrompt('a'.repeat(ValidationLimits.AI_PROMPT_MAX_LENGTH + 1));
    expect(r.valid).toBe(false);
    expect(r.error).toContain('exceeds maximum length');
  });

  it('accepts prompt at exactly max length', () => {
    expect(validateAiPrompt('a'.repeat(ValidationLimits.AI_PROMPT_MAX_LENGTH)).valid).toBe(true);
  });
});

// ─── validateApiKey ───────────────────────────────────────────────────────────

describe('validateApiKey', () => {
  it('accepts a valid 32-char alphanumeric key', () => {
    expect(validateApiKey('abcdefghijklmnopqrstuvwxyz123456').valid).toBe(true);
  });

  it('accepts key with underscores and hyphens', () => {
    expect(validateApiKey('my-api_key-with-dashes_here_1234').valid).toBe(true);
  });

  it('rejects key with spaces', () => {
    expect(validateApiKey('abc def ghi jkl mno pqr stu vwx').valid).toBe(false);
  });

  it('rejects key shorter than 20 chars', () => {
    expect(validateApiKey('short').valid).toBe(false);
  });

  it('rejects empty key', () => {
    expect(validateApiKey('').valid).toBe(false);
  });

  it('rejects key with special chars', () => {
    expect(validateApiKey('abc!@#$%^&*()def_ghijklmnopqrst').valid).toBe(false);
  });
});

// ─── validateEmail ────────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(validateEmail('admin@mail.company.org').valid).toBe(true);
  });

  it('rejects email without @', () => {
    expect(validateEmail('notanemail.com').valid).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmail('user@').valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmail('').valid).toBe(false);
  });

  it('rejects email exceeding 254 chars', () => {
    // 243 + '@example.com'(12) = 255 chars > 254 limit
    const long = 'a'.repeat(243) + '@example.com';
    expect(validateEmail(long).valid).toBe(false);
  });
});

// ─── validateIpAddress ───────────────────────────────────────────────────────

describe('validateIpAddress', () => {
  it('accepts valid IPv4', () => {
    expect(validateIpAddress('192.168.1.1').valid).toBe(true);
  });

  it('accepts IPv4 boundary — 0.0.0.0', () => {
    expect(validateIpAddress('0.0.0.0').valid).toBe(true);
  });

  it('accepts IPv4 boundary — 255.255.255.255', () => {
    expect(validateIpAddress('255.255.255.255').valid).toBe(true);
  });

  it('rejects IPv4 with octet > 255', () => {
    expect(validateIpAddress('999.1.1.1').valid).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateIpAddress('').valid).toBe(false);
  });

  it('rejects plain hostname', () => {
    expect(validateIpAddress('not-an-ip').valid).toBe(false);
  });
});
