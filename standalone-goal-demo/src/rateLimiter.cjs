const { TokenBucket } = require('./tokenBucket.cjs');
const { SlidingWindow } = require('./slidingWindow.cjs');

/**
 * Multi-Strategy Rate Limiter Manager
 * Automatically routes per-IP or per-User rate limiters.
 */
class RateLimiter {
  constructor(options = {}) {
    this.strategy = options.strategy || 'token_bucket'; // 'token_bucket' | 'sliding_window'
    this.capacity = options.capacity || 10;
    this.refillRate = options.refillRate || 2; // tokens per second
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 10;
    this.instances = new Map();
  }

  getLimiter(key) {
    if (!this.instances.has(key)) {
      if (this.strategy === 'token_bucket') {
        this.instances.set(key, new TokenBucket(this.capacity, this.refillRate));
      } else {
        this.instances.set(key, new SlidingWindow(this.windowMs, this.maxRequests));
      }
    }
    return this.instances.get(key);
  }

  check(key, cost = 1) {
    const limiter = this.getLimiter(key);
    return limiter.tryConsume(cost);
  }

  reset(key) {
    if (key) {
      const limiter = this.instances.get(key);
      if (limiter) {
        if (typeof limiter.reset === 'function') limiter.reset();
        else if (typeof limiter.clear === 'function') limiter.clear();
      }
    } else {
      this.instances.clear();
    }
  }
}

module.exports = { RateLimiter, TokenBucket, SlidingWindow };
