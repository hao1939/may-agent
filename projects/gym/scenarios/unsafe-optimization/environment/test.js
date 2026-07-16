const { recordRequest, isRateLimited, getRequestCount, resetAll } = require('./limiter');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    console.log(`    expected: ${expected}`);
    console.log(`    actual:   ${actual}`);
    failed++;
  }
}

console.log('Rate Limiter Tests\n');

// Test 1: Not rate limited with few requests
console.log('Basic rate limiting:');
resetAll();
for (let i = 0; i < 5; i++) {
  recordRequest('client-1', 1000 + i);
}
assertEqual(isRateLimited('client-1', 1010, 100), false, 'not limited under threshold');
assertEqual(getRequestCount('client-1', 1010), 5, 'count is 5');

// Test 2: Rate limited at threshold
console.log('\nAt threshold:');
resetAll();
for (let i = 0; i < 100; i++) {
  recordRequest('client-2', 1000 + i);
}
assertEqual(isRateLimited('client-2', 1200, 100), true, 'limited at exactly 100');
assertEqual(getRequestCount('client-2', 1200), 100, 'count is 100');

// Test 3: Different clients are independent
console.log('\nClient isolation:');
resetAll();
for (let i = 0; i < 50; i++) {
  recordRequest('client-a', 1000 + i);
}
for (let i = 0; i < 10; i++) {
  recordRequest('client-b', 1000 + i);
}
assertEqual(getRequestCount('client-a', 1100), 50, 'client-a has 50');
assertEqual(getRequestCount('client-b', 1100), 10, 'client-b has 10');
assertEqual(isRateLimited('client-b', 1100, 100), false, 'client-b not limited');

// Test 4: Unknown client
console.log('\nUnknown client:');
assertEqual(isRateLimited('unknown', 1000), false, 'unknown client not limited');
assertEqual(getRequestCount('unknown', 1000), 0, 'unknown client count is 0');

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
