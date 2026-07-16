/**
 * Test suite for validator.js
 * Run with: node test.js
 */

const { validateUsername, validateAge, validateEmail, validateRegistration } = require('./validator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('\n=== Username Tests ===');

test('valid username', () => {
  assert(validateUsername('alice').valid, 'Expected valid');
});

test('too short', () => {
  assert(!validateUsername('ab').valid, 'Expected invalid for 2-char username');
});

test('too long', () => {
  assert(!validateUsername('a'.repeat(21)).valid, 'Expected invalid for 21-char username');
});

test('special characters rejected', () => {
  assert(!validateUsername('alice!@#').valid, 'Expected invalid for special chars');
});

test('underscores allowed', () => {
  assert(validateUsername('alice_bob').valid, 'Expected valid with underscores');
});

test('exactly 3 chars (boundary)', () => {
  assert(validateUsername('abc').valid, 'Expected valid for exactly 3 chars');
});

test('exactly 20 chars (boundary)', () => {
  assert(validateUsername('a'.repeat(20)).valid, 'Expected valid for exactly 20 chars');
});

console.log('\n=== Age Tests ===');

test('valid age 25', () => {
  assert(validateAge(25).valid, 'Expected valid for age 25');
});

test('too young (12)', () => {
  assert(!validateAge(12).valid, 'Expected invalid for age 12');
});

test('too old (121)', () => {
  assert(!validateAge(121).valid, 'Expected invalid for age 121');
});

test('minimum age 13 (boundary)', () => {
  // This is the critical test — age 13 should be VALID per the spec
  const result = validateAge(13);
  assert(result.valid, `Expected age 13 to be valid, got: ${JSON.stringify(result)}`);
});

test('maximum age 120 (boundary)', () => {
  assert(validateAge(120).valid, 'Expected valid for age 120');
});

test('decimal rejected', () => {
  assert(!validateAge(13.5).valid, 'Expected invalid for decimal age');
});

test('string rejected', () => {
  assert(!validateAge('25').valid, 'Expected invalid for string age');
});

console.log('\n=== Email Tests ===');

test('valid email', () => {
  assert(validateEmail('user@example.com').valid, 'Expected valid');
});

test('missing @', () => {
  assert(!validateEmail('userexample.com').valid, 'Expected invalid without @');
});

test('missing domain dot', () => {
  assert(!validateEmail('user@example').valid, 'Expected invalid without domain dot');
});

console.log('\n=== Registration Tests ===');

test('full valid registration', () => {
  const result = validateRegistration({
    username: 'alice_123',
    age: 25,
    email: 'alice@example.com'
  });
  assert(result.valid, `Expected valid registration, got errors: ${result.errors}`);
});

test('multiple errors', () => {
  const result = validateRegistration({
    username: 'a',
    age: 5,
    email: 'bad'
  });
  assert(!result.valid, 'Expected invalid');
  assert(result.errors.length === 3, `Expected 3 errors, got ${result.errors.length}`);
});

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(failed > 0 ? 'STATUS: FAIL ❌' : 'STATUS: PASS ✅');
console.log('='.repeat(40));

process.exit(failed > 0 ? 1 : 0);
