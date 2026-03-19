/**
 * Basic auth tests. The security test (plaintext check) needs to be added.
 */
const { createUser, authenticate, getUser, _getStore } = require('../src/auth.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    // Reset store between tests
    _getStore().clear();
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('Auth Tests:');

test('createUser succeeds', () => {
  const result = createUser('alice', 'password123');
  assert(result.success, 'Should succeed');
});

test('createUser rejects duplicates', () => {
  createUser('alice', 'password123');
  const result = createUser('alice', 'other');
  assert(!result.success, 'Should fail for duplicate');
});

test('authenticate succeeds with correct password', () => {
  createUser('bob', 'secret');
  const result = authenticate('bob', 'secret');
  assert(result.success, 'Should authenticate');
});

test('authenticate fails with wrong password', () => {
  createUser('bob', 'secret');
  const result = authenticate('bob', 'wrong');
  assert(!result.success, 'Should fail');
});

test('getUser returns user info', () => {
  createUser('carol', 'pass');
  const user = getUser('carol');
  assert(user !== null, 'Should find user');
  assert(user.username === 'carol', 'Should have correct username');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
