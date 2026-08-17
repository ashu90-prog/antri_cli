/**
 * ANTRI Security & Rate Limiting Engine
 * Protects against API exhaustion, denial of service, and automated abuse.
 */

export interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitConfig {
  maxTokens: number;
  refillRatePerMinute: number;
}

export class RateLimiter {
  private static buckets: Map<string, RateLimitBucket> = new Map();

  // Tiered Limits:
  private static readonly RULES: Record<string, RateLimitConfig> = {
    chat: { maxTokens: 25, refillRatePerMinute: 25 },
    tools: { maxTokens: 35, refillRatePerMinute: 35 },
    sandbox: { maxTokens: 15, refillRatePerMinute: 15 },
    sync: { maxTokens: 15, refillRatePerMinute: 15 },
    auth: { maxTokens: 10, refillRatePerMinute: 10 },
  };

  /**
   * Checks whether a request should be allowed or throttled
   * @param identifier User ID, IP, or session token
   * @param actionType 'chat' | 'tools' | 'sandbox' | 'sync' | 'auth'
   */
  public static checkLimit(
    identifier: string,
    actionType: 'chat' | 'tools' | 'sandbox' | 'sync' | 'auth' = 'chat'
  ): { allowed: boolean; remaining: number; retryAfterSeconds?: number } {
    const key = `${identifier}:${actionType}`;
    const rule = this.RULES[actionType] || this.RULES.chat;
    const now = Date.now();

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: rule.maxTokens, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsedMinutes = (now - bucket.lastRefill) / (60 * 1000);
    bucket.tokens = Math.min(rule.maxTokens, bucket.tokens + elapsedMinutes * rule.refillRatePerMinute);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    const missingTokens = 1 - bucket.tokens;
    const retryAfterSeconds = Math.ceil((missingTokens / rule.refillRatePerMinute) * 60);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  /**
   * Resets rate limits for a user (used for testing or admin override)
   */
  public static reset(identifier: string): void {
    for (const key of this.buckets.keys()) {
      if (key.startsWith(`${identifier}:`)) {
        this.buckets.delete(key);
      }
    }
  }
}
