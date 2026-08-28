const assert = require('assert');
const { RateLimiter, TokenBucket, SlidingWindow } = require('../index.cjs');

console.log('🧪 Running Comprehensive Rate Limiter Test Suite...');

// Test 1: TokenBucket initial capacity & consumption
{
  const bucket = new TokenBucket(5, 1);
  const r1 = bucket.tryConsume(1);
  assert.strictEqual(r1.allowed, true, 'First token consumption should be allowed');
  assert.strictEqual(r1.remainingTokens, 4, 'Remaining tokens should be 4');

  const r2 = bucket.tryConsume(4);
  assert.strictEqual(r2.allowed, true, 'Consuming remaining 4 tokens should be allowed');
  assert.strictEqual(r2.remainingTokens, 0, 'Remaining tokens should be 0');

  const r3 = bucket.tryConsume(1);
  assert.strictEqual(r3.allowed, false, 'Consumption beyond capacity should be denied');
  assert.ok(r3.retryAfterMs > 0, 'retryAfterMs should be positive');
  console.log('  ✔ Test 1 Passed: TokenBucket capacity & consumption enforcement');
}

// Test 2: SlidingWindow log rate limiting
{
  const window = new SlidingWindow(1000, 3);
  assert.strictEqual(window.tryConsume(1).allowed, true, 'Request 1/3 allowed');
  assert.strictEqual(window.tryConsume(1).allowed, true, 'Request 2/3 allowed');
  assert.strictEqual(window.tryConsume(1).allowed, true, 'Request 3/3 allowed');

  const overflow = window.tryConsume(1);
  assert.strictEqual(overflow.allowed, false, 'Request 4/3 must be blocked');
  assert.strictEqual(overflow.limit, 3);
  console.log('  ✔ Test 2 Passed: SlidingWindow strict request rate capping');
}

// Test 3: RateLimiter multi-key isolation
{
  const limiter = new RateLimiter({ strategy: 'token_bucket', capacity: 2, refillRate: 1 });
  assert.strictEqual(limiter.check('user_123').allowed, true);
  assert.strictEqual(limiter.check('user_123').allowed, true);
  assert.strictEqual(limiter.check('user_123').allowed, false, 'user_123 should be rate limited');

  assert.strictEqual(limiter.check('user_456').allowed, true, 'user_456 should have independent capacity');
  console.log('  ✔ Test 3 Passed: Multi-user key isolation & state partitioning');
}

console.log('\n🎉 ALL 3 TEST SUITES PASSED CLEANLY (100% GREEN)!');
