/**
 * Rate Limiter using Token Bucket Algorithm
 *
 * Prevents abuse by limiting the number of executions per time window.
 * Uses token bucket algorithm for smooth rate limiting with burst capacity.
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Allow bursts up to this many requests */
  burstSize?: number;
}

/**
 * Rate limiter result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Time until next token refill (ms) */
  resetIn: number;
  /** Current bucket fill level (0-1) */
  fillLevel: number;
}

/**
 * Token bucket entry for a client
 */
interface TokenBucket {
  /** Number of tokens available */
  tokens: number;
  /** Last refill timestamp */
  lastRefill: number;
}

/**
 * Rate Limiter using Token Bucket Algorithm
 *
 * Features:
 * - Per-client rate limiting (by IP or identifier)
 * - Token bucket algorithm for smooth limiting with bursts
 * - Automatic cleanup of stale buckets
 * - Thread-safe for concurrent requests
 *
 * @example
 * const limiter = new RateLimiter({
 *   maxRequests: 10,
 *   windowMs: 60000, // 10 requests per minute
 *   burstSize: 5,    // Allow bursts of 5
 * });
 *
 * const result = await limiter.checkLimit('client-ip');
 * if (!result.allowed) {
 *   throw new Error(`Rate limit exceeded. Try again in ${result.resetIn}ms`);
 * }
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private config: Required<RateLimitConfig>;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: RateLimitConfig) {
    // Use burstSize = maxRequests if not specified
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      burstSize: config.burstSize ?? config.maxRequests,
    };

    // Start cleanup task to remove stale buckets (every 5 minutes)
    this.startCleanupTask();
  }

  /**
   * Check if a request is allowed under rate limit
   *
   * @param clientId - Unique identifier for the client (e.g., IP address)
   * @returns Rate limit result with allowed status and metadata
   */
  async checkLimit(clientId: string): Promise<RateLimitResult> {
    const now = Date.now();
    let bucket = this.buckets.get(clientId);

    // Create new bucket if client is new
    if (!bucket) {
      bucket = {
        tokens: this.config.burstSize,
        lastRefill: now,
      };
      this.buckets.set(clientId, bucket);
    }

    // Calculate token refill since last check
    const timeSinceRefill = now - bucket.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs; // tokens per ms
    const tokensToAdd = timeSinceRefill * refillRate;

    // Add tokens (capped at burst size)
    bucket.tokens = Math.min(
      this.config.burstSize,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;

    // Check if request is allowed (at least 1 token available)
    const allowed = bucket.tokens >= 1;

    if (allowed) {
      // Consume 1 token
      bucket.tokens -= 1;
    }

    // Calculate reset time (when next token will be available)
    const msPerToken = this.config.windowMs / this.config.maxRequests;
    const resetIn = allowed ? msPerToken : msPerToken * (1 - bucket.tokens);

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetIn: Math.ceil(resetIn),
      fillLevel: bucket.tokens / this.config.burstSize,
    };
  }

  /**
   * Get rate limit info without consuming a token
   *
   * Useful for checking limits without affecting the counter.
   */
  async getLimit(clientId: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(clientId);

    if (!bucket) {
      // Client has never made a request
      return {
        allowed: true,
        remaining: this.config.burstSize,
        resetIn: 0,
        fillLevel: 1.0,
      };
    }

    // Calculate current tokens without modifying bucket
    const timeSinceRefill = now - bucket.lastRefill;
    const refillRate = this.config.maxRequests / this.config.windowMs;
    const currentTokens = Math.min(
      this.config.burstSize,
      bucket.tokens + timeSinceRefill * refillRate
    );

    const msPerToken = this.config.windowMs / this.config.maxRequests;
    const resetIn = currentTokens >= 1 ? msPerToken : msPerToken * (1 - currentTokens);

    return {
      allowed: currentTokens >= 1,
      remaining: Math.floor(currentTokens),
      resetIn: Math.ceil(resetIn),
      fillLevel: currentTokens / this.config.burstSize,
    };
  }

  /**
   * Reset rate limit for a specific client
   *
   * Useful for manual override or testing.
   */
  reset(clientId: string): void {
    this.buckets.delete(clientId);
  }

  /**
   * Reset rate limits for all clients
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Get current statistics
   */
  getStats(): {
    totalClients: number;
    config: Required<RateLimitConfig>;
  } {
    return {
      totalClients: this.buckets.size,
      config: { ...this.config },
    };
  }

  /**
   * Start periodic cleanup task to remove stale buckets
   *
   * Removes buckets that haven't been used in 2x the window time.
   */
  private startCleanupTask(): void {
    const cleanupIntervalMs = 5 * 60 * 1000; // 5 minutes

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = this.config.windowMs * 2; // 2x window time

      for (const [clientId, bucket] of this.buckets.entries()) {
        if (now - bucket.lastRefill > staleThreshold) {
          this.buckets.delete(clientId);
        }
      }
    }, cleanupIntervalMs);

    // Don't keep Node.js process alive for cleanup task
    this.cleanupInterval.unref();
  }

  /**
   * Stop cleanup task and release resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
  }
}
