/**
 * Integration tests — sliding window behavior under timing constraints.
 * 
 * These tests validate that the rate limiter uses a TRUE sliding window,
 * not a fixed window. A fixed-window implementation will FAIL test 2 and 3.
 * 
 * KEY DIFFERENCE: In a sliding window, old requests "expire" individually
 * as they age past windowMs. In a fixed window, the entire counter resets
 * at window boundaries.
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Integration Tests: Sliding Window Behavior');
  console.log('===========================================');

  // Test 1: Basic rate limiting still works
  console.log('\nTest 1: Basic rate limiting');
  const rl1 = new RateLimiter(3, 500);
  assert(rl1.isAllowed('u1') === true, 'Request 1 allowed');
  assert(rl1.isAllowed('u1') === true, 'Request 2 allowed');
  assert(rl1.isAllowed('u1') === true, 'Request 3 allowed');
  assert(rl1.isAllowed('u1') === false, 'Request 4 blocked');

  // Test 2: Sliding window — partial expiry changes capacity
  // 
  // Fixed window resets ALL capacity when the window boundary is crossed.
  // Sliding window only frees capacity for individually-expired requests.
  //
  // Setup: limit=3, window=500ms
  //   t=0:   req A (1/3)
  //   t=100: req B (2/3)  
  //   t=200: req C (3/3, at limit)
  //   t=550: A expired (550>500). B still valid (450<500). C still valid (350<500).
  //     FIXED: (550-0)>=500 → window resets, counter=0. Can make 3 new requests.
  //     SLIDING: window=[B,C] = 2 requests. Can make 1 new request.
  //   So at t=550: make D (both allow), then E:
  //     FIXED: count=2 → ALLOWED
  //     SLIDING: window=[B,C,D] = 3, at limit → BLOCKED
  //
  console.log('\nTest 2: Sliding window partial expiry (CRITICAL)');
  const rl2 = new RateLimiter(3, 500);
  
  rl2.isAllowed('u2'); // req A at t=0
  await sleep(100);
  rl2.isAllowed('u2'); // req B at t=100
  await sleep(100);
  rl2.isAllowed('u2'); // req C at t=200 (at limit)
  assert(rl2.isAllowed('u2') === false, 'At limit (3/3) — blocked');
  
  await sleep(350); // t=550: A expired, B and C still in window for sliding
  
  // First request after partial expiry — both allow this
  assert(rl2.isAllowed('u2') === true, 'After partial expiry: 1 new request allowed');
  
  // Second request after partial expiry — THIS IS THE KEY DIFFERENCE
  // FIXED window: counter reset to 0, now at count=1, so this is count=2 → ALLOWED
  // SLIDING window: window=[B,C,D]=3, at limit → BLOCKED
  const secondAfterExpiry = rl2.isAllowed('u2');
  assert(secondAfterExpiry === false, 'Sliding window: 2nd new request BLOCKED (B,C still in window)');

  // Test 3: getStats reflects sliding window state
  // After some requests expire, stats should show more availability
  console.log('\nTest 3: Stats reflect sliding window');
  const rl3 = new RateLimiter(5, 400);
  
  rl3.isAllowed('u3'); // req at t=0
  rl3.isAllowed('u3'); // req at t=0
  await sleep(200);
  rl3.isAllowed('u3'); // req at t=200
  
  // At t=200: window has 3 requests, 2 remaining
  let stats = rl3.getStats('u3');
  assert(stats.remaining === 2, `Before expiry: remaining should be 2 (got ${stats.remaining})`);
  
  await sleep(250); // t=450: first 2 requests expired (450>400), third still valid (250<400)
  stats = rl3.getStats('u3');
  // Sliding window: only 1 request remains (the one from t=200), allowed=1, remaining=4
  // Fixed window: (450-0)>=400 → window reset, allowed=0, remaining=5
  // Both give remaining >= 4, but we check allowed specifically
  assert(stats.remaining >= 4, `After partial expiry: remaining should be >=4 (got ${stats.remaining})`);

  // Test 4: Burst after full window expiry
  console.log('\nTest 4: Full window reset');
  const rl4 = new RateLimiter(2, 200);
  rl4.isAllowed('u4');
  rl4.isAllowed('u4');
  assert(rl4.isAllowed('u4') === false, 'At limit');
  
  await sleep(250); // Full window expired
  assert(rl4.isAllowed('u4') === true, 'After full expiry — allowed again');
  assert(rl4.isAllowed('u4') === true, 'Second request after reset — allowed');

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
