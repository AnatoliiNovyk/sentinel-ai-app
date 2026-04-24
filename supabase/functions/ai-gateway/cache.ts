/**
 * In-memory response cache with TTL (Time To Live).
 * Used for expensive operations like kill-chain generation.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStore<T> {
  [key: string]: CacheEntry<T>;
}

/**
 * Simple in-memory cache implementation.
 * @param ttlMs - Time to live in milliseconds
 */
export class MemoryCache<T> {
  private store: CacheStore<T> = {};
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  /**
   * Set a value in the cache.
   */
  set(key: string, value: T): void {
    this.store[key] = {
      value,
      expiresAt: Date.now() + this.ttlMs,
    };
  }

  /**
   * Get a value from the cache.
   * Returns null if not found or expired.
   */
  get(key: string): T | null {
    const entry = this.store[key];
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      delete this.store[key];
      return null;
    }

    return entry.value;
  }

  /**
   * Clear all expired entries (cleanup).
   */
  cleanup(): void {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].expiresAt < now) {
        delete this.store[key];
      }
    }
  }

  /**
   * Get cache size.
   */
  size(): number {
    return Object.keys(this.store).length;
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.store = {};
  }
}

/**
 * Generate a cache key from vulnerability data.
 * Simple hash based on serialized vulnerabilities.
 */
export function generateKillChainCacheKey(project: string, vulnerabilities: unknown[]): string {
  const serialized = JSON.stringify({
    project,
    vulnCount: vulnerabilities.length,
    vulnIds: vulnerabilities
      .map((v: unknown) => {
        const vuln = v as Record<string, unknown> | null;
        return (vuln?.id || vuln?.title) as string;
      })
      .sort(),
  });
  // Simple hash: convert to base64
  return `killchain-${btoa(serialized)}`;
}

/**
 * For testing: reset cache state.
 */
export function resetCacheForTests(): void {
  // Cache is instance-based, so this is mainly for reference
}
