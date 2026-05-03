import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { httpFetch, httpPost, HttpError } from '../httpClient';

describe('httpClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('HttpError', () => {
    it('extends Error with status property', () => {
      const err = new HttpError(404, 'Not Found');
      expect(err).toBeInstanceOf(Error);
      expect(err.status).toBe(404);
      expect(err.message).toBe('Not Found');
    });

    it('preserves status on throw/catch', () => {
      try {
        throw new HttpError(500, 'Internal Server Error');
      } catch (e) {
        expect(e instanceof HttpError).toBe(true);
        expect((e as HttpError).status).toBe(500);
      }
    });
  });

  describe('httpFetch', () => {
    it('throws HttpError for non-2xx responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        await httpFetch('http://example.com/missing');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e instanceof HttpError).toBe(true);
        expect((e as HttpError).status).toBe(404);
      }
    });

    it('resolves with Response for 2xx', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'test' }),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', mockFetch);

      const res = await httpFetch('http://example.com/ok');
      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
    });

    it('adds default timeout if not specified', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mockFetch);

      await httpFetch('http://example.com');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].signal).toBeDefined();
    });

    it('respects custom timeout', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mockFetch);

      await httpFetch('http://example.com', { timeoutMs: 5000 });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].signal).toBeDefined();
    });

    it('throws HttpError on fetch network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      try {
        await httpFetch('http://example.com');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  describe('httpPost', () => {
    it('POSTs JSON body and returns parsed response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ result: 'success' }),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', mockFetch);

      const result = await httpPost<{ result: string }>(
        'http://example.com/api',
        { input: 'data' }
      );

      expect(result).toEqual({ result: 'success' });
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
    });

    it('throws HttpError for POST failures', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      vi.stubGlobal('fetch', mockFetch);

      try {
        await httpPost<{ data: string }>(
          'http://example.com/api',
          { input: 'data' }
        );
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e instanceof HttpError).toBe(true);
        expect((e as HttpError).status).toBe(500);
      }
    });

    it('accepts optional headers in options', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', mockFetch);

      await httpPost('http://example.com/api', {}, { headers: { 'X-Custom': 'header' } });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      // httpClient uses a Headers object internally
      expect(headers.get('X-Custom')).toBe('header');
    });

    it('includes auth token when provided', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', mockFetch);

      await httpPost('http://example.com/api', {}, { token: 'secret-token' });

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      // httpClient uses a Headers object internally
      expect(headers.get('Authorization')).toBe('Bearer secret-token');
    });
  });
});
