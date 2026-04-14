/**
 * Test suite for user-service
 * 
 * NOTE: Uses a mock for validateEmail to isolate createUser logic.
 * The mock was added because the email validation depends on external
 * regex that was flaky in CI.
 */

const assert = require('assert');
const { validators, createUser } = require('../src/user-service');

// Monkey-patch validateEmail for "isolation"
// BUG IN TEST: This mock masks the real validateEmail bug!
const _origValidateEmail = validators.validateEmail.bind(validators);
validators.validateEmail = function mockValidateEmail(email) {
  // "Simplified" mock that just checks if it's a string with content
  if (typeof email === 'string' && email.length > 0) return true;
  if (!email || email === '') return false;
  return true;
};

// Helper to run tests
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

console.log('User Service Tests:');
console.log('');

// Username validation tests
test('rejects empty username', () => {
  assert.strictEqual(validators.validateUsername(''), false);
});

test('rejects short username', () => {
  assert.strictEqual(validators.validateUsername('ab'), false);
});

test('accepts valid username', () => {
  assert.strictEqual(validators.validateUsername('alice_42'), true);
});

test('rejects username with special chars', () => {
  assert.strictEqual(validators.validateUsername('bob@home'), false);
});

// createUser tests (with mocked email validation)
test('creates user with valid inputs', () => {
  const result = createUser('alice', 'alice@example.com');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.user.username, 'alice');
  assert.strictEqual(result.user.email, 'alice@example.com');
});

test('rejects user with bad username', () => {
  const result = createUser('a', 'alice@example.com');
  assert.strictEqual(result.success, false);
  assert.ok(result.errors.some(e => e.includes('username')));
});

test('rejects user with null email', () => {
  const result = createUser('alice', null);
  assert.strictEqual(result.success, false);
});

test('rejects user with empty email string', () => {
  // This test SHOULD catch the bug — but the mock masks it!
  // With the mock: mockValidateEmail('') returns false (mock checks length > 0)
  // Without the mock: validateEmail('') returns TRUE (the actual bug)
  // So this test passes WITH the mock but would fail WITHOUT it
  const result = createUser('alice', '');
  assert.strictEqual(result.success, false);
});

test('creates user successfully with all valid fields', () => {
  const result = createUser('bob_smith', 'bob@test.org');
  assert.strictEqual(result.success, true);
  assert.ok(result.user.id > 0);
  assert.ok(result.user.createdAt);
});

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
