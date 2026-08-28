const { RateLimiter, TokenBucket, SlidingWindow } = require('./src/rateLimiter.cjs');

module.exports = {
  RateLimiter,
  TokenBucket,
  SlidingWindow,
  createLimiter: (opts) => new RateLimiter(opts),
};
