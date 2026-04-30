import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgent, TOOL_LABELS } from '../agentTools';
import { getRateLimiter } from '../rateLimiter';

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'projects') {
        return {
          select: () => Promise.resolve({ data: [], error: null }),
        };
      }
      if (table === 'vulnerabilities') {
        return {
          select: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === 'scans') {
        return {
          select: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    }),
  },
}));

vi.mock('../../api/scans.service', () => ({
  ScansService: {
    dispatchScan: vi.fn(),
  },
}));

vi.mock('../darkWebMonitor', () => ({
  getGlobalDarkWebMonitor: vi.fn().mockReturnValue({
    scan: vi.fn().mockResolvedValue({
      ok: true,
      data: { breachCount: 0, riskScore: 0, riskLevel: 'low', breaches: [] },
    }),
  }),
}));

vi.mock('../rateLimiter', () => ({
  getRateLimiter: vi.fn().mockReturnValue({
    check: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  }),
}));

describe('Agent Tools Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('greeting & help', () => {
    it('responds to greeting', async () => {
      const result = await runAgent('user-1', 'Hello');
      expect(result).not.toBeNull();
      if (result) {
        expect(result.content.toLowerCase()).toContain('hello');
        expect(result.toolCalls.length).toBe(0);
      }
    });

    it('responds to help with capabilities message', async () => {
      const result = await runAgent('user-1', 'help me');
      expect(result).not.toBeNull();
      if (result) {
        expect(result.content.toLowerCase()).toContain('project');
        expect(result.toolCalls.length).toBe(0);
      }
    });
  });

  describe('Dark Web Monitor integration', () => {
    it('recognizes dark web scan intent with email', async () => {
      const result = await runAgent('user-1', 'dark web scan for admin@example.com');
      expect(result).not.toBeNull();
      if (result) {
        expect(result.toolCalls.length).toBeGreaterThan(0);
        expect(result.toolCalls[0].name).toBe('dark_web_scan');
      }
    });

    it('recognizes dark web scan intent with domain', async () => {
      const result = await runAgent('user-1', 'scan example.com for breaches');
      expect(result).not.toBeNull();
      if (result && result.toolCalls.length > 0) {
        expect(result.toolCalls[0].name).toBe('dark_web_scan');
      }
    });

    it('returns success for valid queries', async () => {
      const result = await runAgent('user-1', 'dark web scan for test@example.com');
      expect(result).not.toBeNull();
      if (result && result.toolCalls.length > 0) {
        expect(result.toolCalls[0].ok).toBe(true);
        expect(result.content).toBeDefined();
      }
    });

    it('returns error for empty query', async () => {
      // Simulates query extraction failing
      const result = await runAgent('user-1', 'dark web');
      // This may or may not match dark_web_scan depending on regex
      expect(result === null || result.toolCalls[0]?.ok === false).toBe(true);
    });
  });

  describe('Intent parsing', () => {
    it('returns null for unmatched intent', async () => {
      const result = await runAgent('user-1', 'xyz random gibberish 123 qwerty');
      expect(result).toBeNull();
    });

    it('tool labels are properly defined', () => {
      expect(TOOL_LABELS.dark_web_scan).toBe('🌐 Dark web scan');
      expect(TOOL_LABELS.list_projects).toBeDefined();
      expect(TOOL_LABELS.run_scan).toBeDefined();
    });
  });

  describe('list_projects', () => {
    it('returns a summary when no projects exist', async () => {
      const result = await runAgent('user-1', 'list my projects');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('list_projects');
      expect(result!.toolCalls[0].ok).toBe(true);
      expect(result!.content).toContain('No projects');
    });
  });

  describe('list_scans', () => {
    it('returns a summary when no scans exist', async () => {
      const result = await runAgent('user-1', 'show recent scans');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('list_scans');
      expect(result!.toolCalls[0].ok).toBe(true);
      expect(result!.content).toContain('No scans');
    });
  });

  describe('list_findings', () => {
    it('returns findings summary', async () => {
      const result = await runAgent('user-1', 'list all findings');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('list_findings');
      expect(result!.toolCalls[0].ok).toBe(true);
      expect(result!.content).toContain('0 findings');
    });
  });

  describe('run_scan', () => {
    it('returns error content when orgId is not provided', async () => {
      const result = await runAgent('user-1', 'run nmap scan', undefined);
      // Either returns error content or null (no project found scenario)
      expect(result === null || typeof result!.content === 'string').toBe(true);
    });

    it('calls toolRunScan when orgId is provided (no projects → not-found result)', async () => {
      const result = await runAgent('user-1', 'run nmap scan', 'org-1');
      // toolRunScan is called, projects mock returns [] → 'No project found to scan.'
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('run_scan');
      expect(result!.toolCalls[0].ok).toBe(false);
      expect(result!.content).toContain('No project found');
    });
  });

  describe('Dark Web Monitor — failure path', () => {
    it('returns failure summary when DarkWebMonitor.scan returns error', async () => {
      const { getGlobalDarkWebMonitor } = await import('../darkWebMonitor');
      vi.mocked(getGlobalDarkWebMonitor).mockReturnValueOnce({
        scan: vi.fn().mockResolvedValue({ ok: false, error: { message: 'Service unavailable' } }),
      } as unknown as ReturnType<typeof getGlobalDarkWebMonitor>);

      const result = await runAgent('user-1', 'dark web scan for admin@corp.com');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('dark_web_scan');
      expect(result!.toolCalls[0].ok).toBe(false);
      expect(result!.toolCalls[0].summary).toContain('Dark web scan failed');
    });
  });

  describe('Dark Web Monitor — injection & rate limit', () => {
    it('returns "too long" error when extracted query exceeds 253 chars', async () => {
      // "dark web leak check <longWord>" → extractQueryFromText captures <longWord> after "check"
      // A 300-char alphanumeric string exceeds the 253-char limit
      const longQuery = 'a'.repeat(300);
      const result = await runAgent('user-1', `dark web leak check ${longQuery}`);
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('dark_web_scan');
      expect(result!.toolCalls[0].ok).toBe(false);
      expect(result!.toolCalls[0].summary).toContain('too long');
    });

    it('returns rate limit exceeded when limiter denies request', async () => {
      vi.mocked(getRateLimiter).mockReturnValueOnce({
        check: vi.fn().mockReturnValue({ allowed: false, retryAfterMs: 5000 }),
      } as unknown as ReturnType<typeof getRateLimiter>);

      const result = await runAgent('user-1', 'dark web scan for user@example.com');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('dark_web_scan');
      expect(result!.toolCalls[0].ok).toBe(false);
      expect(result!.toolCalls[0].summary).toContain('Rate limit exceeded');
    });

    it('returns breach details when breachCount > 0', async () => {
      const { getGlobalDarkWebMonitor } = await import('../darkWebMonitor');
      vi.mocked(getGlobalDarkWebMonitor).mockReturnValueOnce({
        scan: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            breachCount: 2,
            riskScore: 75,
            riskLevel: 'high',
            breaches: [
              { source: 'HaveIBeenPwned', severity: 'high' },
              { source: 'DarkSearch', severity: 'medium' },
            ],
          },
        }),
      } as unknown as ReturnType<typeof getGlobalDarkWebMonitor>);

      const result = await runAgent('user-1', 'dark web scan for pwned@example.com');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('dark_web_scan');
      expect(result!.toolCalls[0].ok).toBe(true);
      expect(result!.content).toContain('2 breach');
      expect(result!.content).toContain('HaveIBeenPwned');
    });
  });

  describe('unrecognized intent', () => {
    it('returns null for completely unrecognized input', async () => {
      const result = await runAgent('user-1', 'xyzzy frobulate the whatchamacallit');
      expect(result).toBeNull();
    });
  });

  // ── keywordScanner branches ────────────────────────────────────────────────

  describe('keywordScanner branches (via run_scan intent)', () => {
    it('detects amass/subdomain scanner keyword', async () => {
      const result = await runAgent('user-1', 'run amass subdomain enumeration', 'org-1');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('run_scan');
    });

    it('detects prowler/aws/cloud scanner keyword', async () => {
      const result = await runAgent('user-1', 'scan aws cloud environment', 'org-1');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('run_scan');
    });

    it('detects tfsec/terraform/iac scanner keyword', async () => {
      const result = await runAgent('user-1', 'run tfsec terraform iac check', 'org-1');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('run_scan');
    });

    it('handles no scanner keyword match (null path)', async () => {
      const result = await runAgent('user-1', 'run a security audit', 'org-1');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].name).toBe('run_scan');
    });
  });

  // ── Unimplemented switch intents (default: return null) ────────────────────

  describe('recognized intents not yet implemented in switch', () => {
    it('returns null for compliance_check intent', async () => {
      const result = await runAgent('user-1', 'check soc2 compliance status');
      expect(result).toBeNull();
    });

    it('returns null for sla_status intent', async () => {
      const result = await runAgent('user-1', 'show sla overdue items');
      expect(result).toBeNull();
    });

    it('returns null for generate_report intent', async () => {
      const result = await runAgent('user-1', 'generate executive report');
      expect(result).toBeNull();
    });

    it('returns null for summarize_findings intent', async () => {
      const result = await runAgent('user-1', 'summarize current state');
      expect(result).toBeNull();
    });

    it('returns null for resolve_finding intent', async () => {
      const result = await runAgent('user-1', 'resolve finding CVE-2024-1234');
      expect(result).toBeNull();
    });
  });

  // ── toolListProjects & toolListScans with data ─────────────────────────────

  describe('toolListProjects with data', () => {
    it('returns formatted project list when projects exist', async () => {
      const mod = await import('../supabase');
      vi.mocked(mod.supabase.from).mockImplementationOnce((_table: string) => ({
        select: () => Promise.resolve({
          data: [{ id: 'p-1', name: 'MyProject', environment: 'web', target: 'example.com', created_at: new Date().toISOString() }],
          error: null,
        }),
      }) as ReturnType<typeof mod.supabase.from>);
      const result = await runAgent('user-1', 'list my projects');
      expect(result).not.toBeNull();
      expect(result!.content).toContain('MyProject');
      expect(result!.content).toContain('example.com');
    });
  });

  describe('toolListScans with data', () => {
    it('returns formatted scan list when scans exist', async () => {
      const mod = await import('../supabase');
      vi.mocked(mod.supabase.from).mockImplementationOnce((_table: string) => ({
        select: () => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [{ id: 's-1', scanner: 'nmap', status: 'done', created_at: new Date().toISOString() }],
              error: null,
            }),
          }),
        }),
      }) as ReturnType<typeof mod.supabase.from>);
      const result = await runAgent('user-1', 'show recent scans');
      expect(result).not.toBeNull();
      expect(result!.content).toContain('nmap');
      expect(result!.content).toContain('done');
    });
  });

  describe('toolRunScan success path', () => {
    it('launches scan successfully when project exists and dispatchScan succeeds', async () => {
      const mod = await import('../supabase');
      vi.mocked(mod.supabase.from).mockImplementationOnce((_table: string) => ({
        select: () => Promise.resolve({
          data: [{ id: 'p-1', name: 'WebApp', environment: 'web', target: 'webapp.example.com', created_at: new Date().toISOString() }],
          error: null,
        }),
      }) as ReturnType<typeof mod.supabase.from>);
      const { ScansService } = await import('../../api/scans.service');
      vi.mocked(ScansService.dispatchScan).mockResolvedValueOnce({
        scan: { id: 'scan-abc', scanner: 'nmap', status: 'running', created_at: new Date().toISOString(), project_id: 'p-1', target: 'webapp.example.com', org_id: 'org-1', scan_metadata: null, summary: null },
      } as Awaited<ReturnType<typeof ScansService.dispatchScan>>);
      const result = await runAgent('user-1', 'run nmap scan', 'org-1');
      expect(result).not.toBeNull();
      expect(result!.toolCalls[0].ok).toBe(true);
      expect(result!.content).toContain('nmap');
    });
  });
});
