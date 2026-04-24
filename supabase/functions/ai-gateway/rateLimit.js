const DEFAULT_RATE_LIMIT = {
    limit: 30,
    windowMs: 60000,
};
const requestBuckets = new Map();
export function consumeRateLimit(store, key, nowMs, limit, windowMs) {
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
export function extractClientKey(req) {
    const xForwardedFor = req.headers.get('x-forwarded-for');
    if (xForwardedFor) {
        const ip = xForwardedFor.split(',')[0]?.trim();
        if (ip)
            return ip;
    }
    const xRealIp = req.headers.get('x-real-ip');
    if (xRealIp)
        return xRealIp.trim();
    const cfConnectingIp = req.headers.get('cf-connecting-ip');
    if (cfConnectingIp)
        return cfConnectingIp.trim();
    return 'unknown';
}
export function checkGatewayRateLimit(clientKey, nowMs = Date.now(), config = DEFAULT_RATE_LIMIT) {
    return consumeRateLimit(requestBuckets, clientKey, nowMs, config.limit, config.windowMs);
}
export function resetGatewayRateLimitStoreForTests() {
    requestBuckets.clear();
}
