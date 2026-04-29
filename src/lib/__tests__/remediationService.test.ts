import { describe, expect, it, vi, beforeEach } from 'vitest';
import { generateRemediation, getSavedRemediation, clearRemediationCache } from '../remediationService';
import type { Vulnerability } from '../supabase';

// Use real jsdom localStorage — vi.stubGlobal('localStorage') doesn't work reliably
// with jsdom since localStorage is a non-configurable property.

// ── Mock crypto.randomUUID ────────────────────────────────────────────────────
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-001' });

// ── Mock supabase (vi.hoisted to avoid TDZ) ──────────────────────────────────
const { mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockFrom = vi.fn(() => ({
    upsert: mockUpsert,
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) })),
    })),
  }));
  return { mockUpsert, mockFrom };
});

vi.mock('../supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../supabase')>();
  return {
    ...actual,
    supabase: { from: mockFrom },
  };
});

// Helper to build a minimal Vulnerability
function makeVuln(overrides: Partial<Vulnerability> = {}): Vulnerability {
  return {
    id: 'vuln-1',
    scan_id: 'scan-1',
    project_id: 'proj-1',
    title: 'Generic issue',
    description: 'A problem',
    severity: 'medium',
    status: 'open',
    cve_id: null,
    cvss_score: null,
    affected_component: null,
    remediation: null,
    evidence: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    triaged_at: null,
    triaged_by: null,
    triage_note: null,
    sla_breached_at: null,
    sla_warned_at: null,
    ...overrides,
  } as unknown as Vulnerability;
}

describe('generateRemediation — category detection via title', () => {
  beforeEach(() => {
    localStorage.clear();
    mockUpsert.mockClear();
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-001' });
  });

  it('detects sql-injection from title', async () => {
    const vuln = makeVuln({ title: 'SQL injection in login form', description: '' });
    const result = await generateRemediation(vuln, 'user-1');
    expect(result.summary).toMatch(/parameterize|sql/i);
    expect(result.priority).toBe('immediate');
  });

  it('detects xss from title', async () => {
    const vuln = makeVuln({ id: 'vuln-xss', title: 'Reflected XSS vulnerability', description: '' });
    const result = await generateRemediation(vuln, 'user-1');
    expect(result.summary).toMatch(/xss|sanitiz|content.security|escape/i);
  });

  it('detects rce from title', async () => {
    // 'rce' template IS in TEMPLATES; log4shell is not (falls back to generic)
    const vuln = makeVuln({ id: 'vuln-rce', title: 'Remote code execution via eval', description: '' });
    const result = await generateRemediation(vuln, 'user-1');
    expect(result.summary).toMatch(/rce|remote code|command injection|command exec/i);
    expect(result.priority).toBe('immediate');
  });

  it('falls back to generic template for unknown category', async () => {
    const vuln = makeVuln({ id: 'vuln-generic', title: 'Unknown weird problem', description: 'something unusual' });
    const result = await generateRemediation(vuln, 'user-1');
    expect(result).toHaveProperty('steps');
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('returns cached result on second call (no extra supabase call)', async () => {
    const vuln = makeVuln({ id: 'vuln-cached', title: 'SQL injection' });
    await generateRemediation(vuln, 'user-1');
    const beforeCount = mockUpsert.mock.calls.length;
    await generateRemediation(vuln, 'user-1');
    // Should not call upsert again for cached
    expect(mockUpsert.mock.calls.length).toBe(beforeCount);
  });

  it('result has required fields: id, vulnerability_id, user_id, generated_at, steps, references', async () => {
    const vuln = makeVuln({ id: 'vuln-fields' });
    const result = await generateRemediation(vuln, 'user-1');
    expect(result).toHaveProperty('id');
    expect(result.vulnerability_id).toBe('vuln-fields');
    expect(result.user_id).toBe('user-1');
    expect(result).toHaveProperty('generated_at');
    expect(Array.isArray(result.steps)).toBe(true);
    expect(Array.isArray(result.references)).toBe(true);
  });
});

describe('clearRemediationCache', () => {
  beforeEach(() => localStorage.clear());

  it('removes specific vulnerability from cache', async () => {
    const vuln = makeVuln({ id: 'vuln-clear' });
    await generateRemediation(vuln, 'user-1');
    clearRemediationCache('vuln-clear');
    // Cache should be empty for that id → getSavedRemediation returns null (no DB data)
    const saved = await getSavedRemediation('vuln-clear');
    expect(saved).toBeNull();
  });

  it('clears entire cache when called without argument', async () => {
    const v1 = makeVuln({ id: 'vuln-c1', title: 'sql injection' });
    const v2 = makeVuln({ id: 'vuln-c2', title: 'xss problem' });
    await generateRemediation(v1, 'user-1');
    await generateRemediation(v2, 'user-1');
    clearRemediationCache();
    // The service uses 'sentinel_remediation_cache' as key
    expect(localStorage.getItem('sentinel_remediation_cache')).toBeNull();
  });
});
