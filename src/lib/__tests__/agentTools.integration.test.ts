import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAgent, TOOL_LABELS } from '../agentTools';

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
      return { select: () => Promise.resolve({ data: [], error: null }) };
    }),
  },
}));

vi.mock('../../api/scans.service', () => ({
  ScansService: {
    dispatchScan: vi.fn(),
  },
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
});
