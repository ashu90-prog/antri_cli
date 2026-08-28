/**
 * Token Bucket Rate Limiter Engine
 * Manages burst capacity and deterministic token replenishment.
 */
class TokenBucket {
  constructor(capacity, refillRatePerSecond) {
    if (capacity <= 0 || refillRatePerSecond <= 0) {
      throw new Error('Capacity and refill rate must be positive numbers');
    }
    this.capacity = capacity;
    this.refillRate = refillRatePerSecond;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRate;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  tryConsume(tokensToConsume = 1) {
    this.refill();

    if (this.tokens >= tokensToConsume) {
      this.tokens -= tokensToConsume;
      return {
        allowed: true,
        remainingTokens: Math.floor(this.tokens),
        retryAfterMs: 0,
      };
    }

    const deficit = tokensToConsume - this.tokens;
    const retryAfterMs = Math.ceil((deficit / this.refillRate) * 1000);

    return {
      allowed: false,
      remainingTokens: Math.floor(this.tokens),
      retryAfterMs,
    };
  }

  reset() {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}

module.exports = { TokenBucket };
