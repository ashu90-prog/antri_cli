/**
 * Sliding Window Log Rate Limiter Engine
 * Tracks exact timestamps within a sliding millisecond window.
 */
class SlidingWindow {
  constructor(windowMs, maxRequests) {
    if (windowMs <= 0 || maxRequests <= 0) {
      throw new Error('Window duration and max requests must be positive numbers');
    }
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.timestamps = [];
  }

  prune(now) {
    const windowStart = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= windowStart) {
      this.timestamps.shift();
    }
  }

  tryConsume(cost = 1) {
    const now = Date.now();
    this.prune(now);

    if (this.timestamps.length + cost <= this.maxRequests) {
      for (let i = 0; i < cost; i++) {
        this.timestamps.push(now);
      }
      return {
        allowed: true,
        currentCount: this.timestamps.length,
        limit: this.maxRequests,
        resetInMs: this.timestamps.length > 0 ? (this.timestamps[0] + this.windowMs) - now : 0,
      };
    }

    const oldestTimestamp = this.timestamps[0] || now;
    const resetInMs = Math.max(0, (oldestTimestamp + this.windowMs) - now);

    return {
      allowed: false,
      currentCount: this.timestamps.length,
      limit: this.maxRequests,
      resetInMs,
    };
  }

  clear() {
    this.timestamps = [];
  }
}

module.exports = { SlidingWindow };
