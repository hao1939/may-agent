// test.js — Tests for user API
const { handleGetUser, formatUser } = require('./server');
const { getAllUserIds, getUser } = require('./db');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('Running user API tests...\n');

// Test 1: Standard user (Alice)
test('standard user returns correctly', () => {
  const result = handleGetUser(1);
  assert(result.status === 200, `Expected 200, got ${result.status}`);
  assert(result.body.email === 'alice@example.com', `Wrong email: ${result.body.email}`);
  assert(result.body.displayName === 'Alice <alice@example.com>', `Wrong displayName`);
});

// Test 2: Legacy format user (Bob — email in profile)
test('legacy user with profile.email works', () => {
  const result = handleGetUser(2);
  assert(result.status === 200, `Expected 200, got ${result.status}`);
  assert(result.body.email === 'bob@example.com', `Wrong email: ${result.body.email}`);
});

// Test 3: Another legacy user (Diana)
test('another legacy user works', () => {
  const result = handleGetUser(4);
  assert(result.status === 200, `Expected 200, got ${result.status}`);
  assert(result.body.email === 'diana@example.com', `Wrong email: ${result.body.email}`);
});

// Test 4: User with null email (Eve)
test('user with null email handled gracefully', () => {
  const result = handleGetUser(5);
  assert(result.status === 200, `Expected 200, got ${result.status}`);
  assert(typeof result.body.email === 'string' || result.body.email === null, 'Email should be string or null');
  // displayName should not crash
  assert(result.body.displayName !== undefined, 'displayName should exist');
});

// Test 5: Invalid user ID returns 404
test('invalid user ID returns 404', () => {
  const result = handleGetUser(999);
  assert(result.status === 404, `Expected 404, got ${result.status}`);
});

// Test 6: All valid users can be formatted
test('all users in DB can be fetched without error', () => {
  const ids = getAllUserIds();
  for (const id of ids) {
    const result = handleGetUser(id);
    assert(result.status === 200, `User ${id} failed with status ${result.status}`);
    assert(result.body.name, `User ${id} missing name`);
  }
});

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests`);
process.exit(failed > 0 ? 1 : 0);
