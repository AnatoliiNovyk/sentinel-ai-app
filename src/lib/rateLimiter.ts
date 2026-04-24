/**
 * Rate Limiter & Circuit Breaker
 *
 * Rate Limiter: Sliding window algorithm limiting requests per time window.
 *   - Per-key limiting (e.g., per user ID, IP, API route)
 *   - Configurable window size and max requests
 *   - Returns remaining quota and reset time
 *
 * Circuit Breaker: Prevents cascading failures by tracking error rates.
 *   - Three states: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
 *   - Configurable failure threshold and recovery timeout
 *   - Automatic recovery with probe requests
 */

// ─── Rate Limiter ────────────────────────────────────────────────────────

export interface RateLimitConfig {
  maxRequests: number;   // max requests allowed per window
  windowMs: number;      // window duration in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;    // requests left in current window
  resetAt: number;      // epoch ms when window resets
  retryAfterMs: number; // ms to wait before retrying (0 if allowed)
}

interface WindowEntry {
  timestamps: number[];
  windowStart: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, WindowEntry>();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    if (config.maxRequests <= 0) throw new Error('maxRequests must be > 0');
    if (config.windowMs <= 0) throw new Error('windowMs must be > 0');
    this.config = config;
  }

  /**
   * Check and record a request for the given key.
   * Returns whether the request is allowed and remaining quota.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let entry = this.windows.get(key);
    if (!entry) {
      entry = { timestamps: [], windowStart: now };
      this.windows.set(key, entry);
    }

    // Evict timestamps outside the current sliding window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    const count = entry.timestamps.length;
    const remaining = Math.max(0, this.config.maxRequests - count);

    if (count >= this.config.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const resetAt = oldestInWindow + this.config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: Math.max(0, resetAt - now),
      };
    }

    entry.timestamps.push(now);
    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt: now + this.config.windowMs,
      retryAfterMs: 0,
    };
  }

  /** Reset state for a specific key */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /** Reset all keys */
  resetAll(): void {
    this.windows.clear();
  }

  /** Returns current request count within window for a key (does not record) */
  getCount(key: string): number {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const entry = this.windows.get(key);
    if (!entry) return 0;
    return entry.timestamps.filter((ts) => ts > windowStart).length;
  }

  getConfig(): Readonly<RateLimitConfig> {
    return { ...this.config };
  }
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;   // failures needed to open the circuit
  successThreshold: number;   // successes in HALF_OPEN to close again
  timeout: number;            // ms to stay OPEN before moving to HALF_OPEN
  volumeThreshold?: number;   // min requests before tripping (default: 1)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalRequests: number;
  lastFailureAt: number | null;
  nextAttemptAt: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private totalRequests = 0;
  private lastFailureAt: number | null = null;
  private openedAt: number | null = null;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    if (config.failureThreshold <= 0) throw new Error('failureThreshold must be > 0');
    if (config.successThreshold <= 0) throw new Error('successThreshold must be > 0');
    if (config.timeout <= 0) throw new Error('timeout must be > 0');
    this.config = {
      volumeThreshold: 1,
      ...config,
    };
  }

  /**
   * Execute a function protected by the circuit breaker.
   * Throws CircuitOpenError if the circuit is OPEN and timeout hasn't elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests += 1;
    this.checkTransition();

    if (this.state === 'OPEN') {
      throw new CircuitOpenError(
        `Circuit is OPEN. Next attempt allowed at ${new Date(this.openedAt! + this.config.timeout).toISOString()}`,
        this.getNextAttemptAt(),
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private checkTransition(): void {
    if (this.state === 'OPEN' && this.openedAt !== null) {
      if (Date.now() >= this.openedAt + this.config.timeout) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      }
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        this.openedAt = null;
      }
    }
  }

  private onFailure(): void {
    this.lastFailureAt = Date.now();
    this.failures += 1;
    if (
      this.state !== 'OPEN' &&
      this.totalRequests >= this.config.volumeThreshold &&
      this.failures >= this.config.failureThreshold
    ) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.successes = 0;
    }
  }

  private getNextAttemptAt(): number | null {
    if (this.state !== 'OPEN' || this.openedAt === null) return null;
    return this.openedAt + this.config.timeout;
  }

  getState(): CircuitState {
    this.checkTransition(); // Lazy state update
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    this.checkTransition();
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalRequests: this.totalRequests,
      lastFailureAt: this.lastFailureAt,
      nextAttemptAt: this.getNextAttemptAt(),
    };
  }

  /** Manually reset the circuit to CLOSED state */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.openedAt = null;
    this.lastFailureAt = null;
    this.totalRequests = 0;
  }

  /** Force open the circuit (e.g., for maintenance) */
  forceOpen(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
  }
}

export class CircuitOpenError extends Error {
  constructor(
    message: string,
    public readonly nextAttemptAt: number | null,
  ) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ─── Global Instances ────────────────────────────────────────────────────

const rateLimiters = new Map<string, RateLimiter>();
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getRateLimiter(name: string, config?: RateLimitConfig): RateLimiter {
  if (!rateLimiters.has(name)) {
    if (!config) throw new Error(`RateLimiter "${name}" not found. Provide config to create.`);
    rateLimiters.set(name, new RateLimiter(config));
  }
  return rateLimiters.get(name)!;
}

export function getCircuitBreaker(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    if (!config) throw new Error(`CircuitBreaker "${name}" not found. Provide config to create.`);
    circuitBreakers.set(name, new CircuitBreaker(config));
  }
  return circuitBreakers.get(name)!;
}

export function resetAllRateLimiters(): void {
  rateLimiters.clear();
}

export function resetAllCircuitBreakers(): void {
  circuitBreakers.clear();
}
