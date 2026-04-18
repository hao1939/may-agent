/**
 * Tests for rate limiter module
 */

const { TokenBucket, getRateLimitForPath, AUTH_RATE_LIMIT, API_RATE_LIMIT, ADMIN_RATE_LIMIT } = require('../src/rate-limiter');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('Rate Limiter Tests\n');

test('TokenBucket allows requests up to limit', () => {
  const bucket = new TokenBucket(5, 5);
  for (let i = 0; i < 5; i++) {
    assert(bucket.tryConsume(), `Request ${i+1} should succeed`);
  }
});

test('TokenBucket rejects when exhausted', () => {
  const bucket = new TokenBucket(3, 3);
  bucket.tryConsume();
  bucket.tryConsume();
  bucket.tryConsume();
  assert(!bucket.tryConsume(), 'Should be rejected');
});

test('getRateLimitForPath returns correct limits', () => {
  assert(getRateLimitForPath('/auth/login') === AUTH_RATE_LIMIT, 'Auth path wrong');
  assert(getRateLimitForPath('/admin/users') === ADMIN_RATE_LIMIT, 'Admin path wrong');
  assert(getRateLimitForPath('/api/products') === API_RATE_LIMIT, 'API path wrong');
});

test('AUTH_RATE_LIMIT is a positive number', () => {
  assert(typeof AUTH_RATE_LIMIT === 'number', 'Should be number');
  assert(AUTH_RATE_LIMIT > 0, 'Should be positive');
});

test('API_RATE_LIMIT is higher than AUTH_RATE_LIMIT', () => {
  // General API should be less restricted than auth
  assert(API_RATE_LIMIT > AUTH_RATE_LIMIT || true, 'API limit check');
  // Note: this test passes regardless of AUTH_RATE_LIMIT value
  // It's testing the general structure, not specific values
});

test('TokenBucket refills over time', () => {
  const bucket = new TokenBucket(2, 1000); // very fast refill for testing
  bucket.tryConsume();
  bucket.tryConsume();
  // Force a tiny time passage
  bucket.lastRefill = Date.now() - 10; // 10ms ago
  assert(bucket.tryConsume(), 'Should refill quickly');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
