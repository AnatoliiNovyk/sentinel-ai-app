import { describe, expect, it, vi, beforeEach } from 'vitest';
import { callAiGateway } from '../aiGateway';

// ── generateAIResponse mock ───────────────────────────────────────────────────
vi.mock('../aiMock', () => ({
  generateAIResponse: vi.fn((prompt: string) => `Mock response for: ${prompt}`),
}));

// ── Env vars ──────────────────────────────────────────────────────────────────
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

// ── fetch mock ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();

describe('callAiGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('successful edge function response', () => {
    it('returns content and provider from edge function', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'AI says hello', provider: 'gemini-1.5-pro' }),
      });

      const result = await callAiGateway([{ role: 'user', content: 'hello' }]);

      expect(result.content).toBe('AI says hello');
      expect(result.provider).toBe('gemini-1.5-pro');
      expect(result.isMock).toBe(false);
    });

    it('sets isMock to false when provider is not "mock"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'Response', provider: 'anthropic' }),
      });

      const result = await callAiGateway([{ role: 'user', content: 'test' }]);

      expect(result.isMock).toBe(false);
    });

    it('sets isMock to true when edge function returns provider "mock"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'Mock content', provider: 'mock' }),
      });

      const result = await callAiGateway([{ role: 'user', content: 'test' }]);

      expect(result.isMock).toBe(true);
      expect(result.provider).toBe('mock');
    });

    it('calls fetch with POST method and correct headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'ok', provider: 'openai' }),
      });

      await callAiGateway([{ role: 'user', content: 'ping' }]);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/functions/v1/ai-gateway');
      expect(options.method).toBe('POST');
      const headers = options.headers instanceof Headers
        ? options.headers
        : new Headers(options.headers as Record<string, string>);
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('sends messages in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'ok', provider: 'openai' }),
      });

      const messages = [
        { role: 'user' as const, content: 'What is 2+2?' },
        { role: 'assistant' as const, content: '4' },
      ];

      await callAiGateway(messages);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as { messages: unknown };
      expect(body.messages).toEqual(messages);
    });

    it('defaults missing provider to "mock"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'response without provider' }),
      });

      const result = await callAiGateway([{ role: 'user', content: 'test' }]);

      expect(result.provider).toBe('mock');
      expect(result.isMock).toBe(true);
    });
  });

  describe('fallback to local mock', () => {
    it('falls back to local mock when edge function returns non-OK status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      });

      const result = await callAiGateway([{ role: 'user', content: 'hello' }]);

      expect(result.provider).toBe('mock');
      expect(result.isMock).toBe(true);
      expect(result.content).toContain('Mock response for: hello');
    });

    it('falls back to local mock when fetch throws (network error)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await callAiGateway([{ role: 'user', content: 'network test' }]);

      expect(result.provider).toBe('mock');
      expect(result.isMock).toBe(true);
    });

    it('uses last user message content for mock fallback', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));

      const result = await callAiGateway([
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'last user message' },
      ]);

      expect(result.content).toContain('last user message');
    });

    it('handles empty messages array gracefully in fallback', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'));

      const result = await callAiGateway([]);

      expect(result.provider).toBe('mock');
      expect(result.isMock).toBe(true);
    });
  });
});
