type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  limit: 30,
  windowMs: 60_000,
};

const requestBuckets = new Map<string, number[]>();

export function consumeRateLimit(
  store: Map<string, number[]>,
  key: string,
  nowMs: number,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const windowStart = nowMs - windowMs;
  const previous = store.get(key) ?? [];
  const recent = previous.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= limit) {
    const oldest = recent[0];
    const retryMs = Math.max(1, windowMs - (nowMs - oldest));
    store.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryMs / 1000),
    };
  }

  recent.push(nowMs);
  store.set(key, recent);
  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function extractClientKey(req: Request): string {
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ip = xForwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  return 'unknown';
}

export function checkGatewayRateLimit(
  clientKey: string,
  nowMs = Date.now(),
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): { allowed: boolean; retryAfterSeconds: number } {
  return consumeRateLimit(requestBuckets, clientKey, nowMs, config.limit, config.windowMs);
}

export function resetGatewayRateLimitStoreForTests(): void {
  requestBuckets.clear();
}
