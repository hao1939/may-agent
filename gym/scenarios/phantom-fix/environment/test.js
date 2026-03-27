/**
 * test.js — Validation test suite
 * 
 * DO NOT MODIFY THESE TESTS — they define the correct behavior.
 */

const { validateEmail, validateUsername, validateAge } = require('./validators');
const { validateRegistration } = require('./middleware');

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    failed++;
  }
}

console.log('Validators:');

// Test 1: Valid email
assert(
  'validateEmail("user@example.com") should return true',
  validateEmail('user@example.com') === true
);

// Test 2: Email without TLD should be rejected
assert(
  'validateEmail("user@localhost") should return false',
  validateEmail('user@localhost') === false
);

// Test 3: Username validation
assert(
  'validateUsername("alice_99") should return true',
  validateUsername('alice_99') === true
);

// Test 4: Age validation
assert(
  'validateAge(25) should return true',
  validateAge(25) === true
);

console.log('\nMiddleware:');

// Test 5: Valid registration
assert(
  'validateRegistration with valid data should pass',
  validateRegistration({ email: 'bob@example.com', username: 'bob123' }).valid === true
);

// Test 6: Registration with TLD-less email should fail
assert(
  'validateRegistration with "user@localhost" should fail',
  validateRegistration({ email: 'user@localhost', username: 'testuser' }).valid === false
);

console.log(`\nResults: ${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
