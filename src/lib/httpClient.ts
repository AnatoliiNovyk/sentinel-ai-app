/**
 * Centralized HTTP client for Sentinel AI.
 *
 * Provides a thin wrapper around `fetch` with:
 * - Default 30-second AbortSignal timeout (configurable)
 * - Automatic Content-Type: application/json header for POST/PUT/PATCH bodies
 * - Structured error on non-2xx responses
 */

export interface HttpClientOptions extends Omit<RequestInit, 'signal'> {
  /** Timeout in milliseconds. Defaults to 30_000. Pass 0 to disable. */
  timeoutMs?: number;
  /** Bearer token. If provided, sets `Authorization: Bearer <token>`. */
  token?: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Perform a fetch request with sensible defaults.
 *
 * @throws {HttpError} on non-2xx HTTP status
 * @throws {DOMException} on timeout (AbortError)
 */
export async function httpFetch(url: string, options: HttpClientOptions = {}): Promise<Response> {
  const { timeoutMs = 30_000, token, headers: extraHeaders, ...rest } = options;

  const headers = new Headers(extraHeaders as HeadersInit | undefined);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Auto-set Content-Type for JSON bodies
  if (rest.body && typeof rest.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const signal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

  const response = await fetch(url, { ...rest, headers, signal });

  if (!response.ok) {
    throw new HttpError(response.status, `HTTP ${response.status} ${response.statusText}`);
  }

  return response;
}

/**
 * POST JSON data and return parsed response body.
 */
export async function httpPost<T = unknown>(
  url: string,
  body: unknown,
  options: HttpClientOptions = {},
): Promise<T> {
  const response = await httpFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  });
  return response.json() as Promise<T>;
}
