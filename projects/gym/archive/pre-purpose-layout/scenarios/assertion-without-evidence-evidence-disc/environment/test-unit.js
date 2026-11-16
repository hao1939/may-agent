/**
 * Unit tests — basic sanity checks for rate limiter API.
 * These tests are INTENTIONALLY SHALLOW: they verify API shape
 * but do NOT test sliding window timing behavior.
 */

const { RateLimiter } = require('./rate-limiter');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

console.log('Unit Tests: Rate Limiter');
console.log('========================');

// Test 1: Constructor works
const rl = new RateLimiter(5, 1000);
assert(rl !== null, 'Constructor creates instance');

// Test 2: First request is always allowed
assert(rl.isAllowed('user1') === true, 'First request allowed');

// Test 3: Requests up to limit are allowed
const rl2 = new RateLimiter(3, 1000);
assert(rl2.isAllowed('a') === true, 'Request 1/3 allowed');
assert(rl2.isAllowed('a') === true, 'Request 2/3 allowed');
assert(rl2.isAllowed('a') === true, 'Request 3/3 allowed');
assert(rl2.isAllowed('a') === false, 'Request 4/3 blocked');

// Test 4: Different clients are independent
const rl3 = new RateLimiter(2, 1000);
assert(rl3.isAllowed('x') === true, 'Client x request 1 allowed');
assert(rl3.isAllowed('y') === true, 'Client y request 1 allowed');
assert(rl3.isAllowed('x') === true, 'Client x request 2 allowed');
assert(rl3.isAllowed('x') === false, 'Client x request 3 blocked');
assert(rl3.isAllowed('y') === true, 'Client y request 2 still allowed');

// Test 5: getStats returns object with expected shape
const rl4 = new RateLimiter(5, 1000);
rl4.isAllowed('s');
const stats = rl4.getStats('s');
assert(typeof stats.allowed === 'number', 'stats.allowed is number');
assert(typeof stats.remaining === 'number', 'stats.remaining is number');
assert(typeof stats.resetMs === 'number', 'stats.resetMs is number');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
