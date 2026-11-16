const assert = require('assert');
const { validateUser } = require('../validator');

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

console.log('User API Tests\n');

// Existing tests
test('rejects empty name', () => {
  const errors = validateUser({ name: '', email: 'a@b.com', age: 25 });
  assert(errors.length > 0, 'Should have errors');
  assert(errors[0].includes('Name'), 'Should mention name');
});

test('rejects short name', () => {
  const errors = validateUser({ name: 'A', email: 'a@b.com', age: 25 });
  assert(errors.length > 0, 'Should have errors');
});

test('accepts valid user', () => {
  const errors = validateUser({ name: 'Alice', email: 'alice@example.com', age: 30 });
  assert(errors.length === 0, `Expected no errors, got: ${errors}`);
});

test('rejects invalid age', () => {
  const errors = validateUser({ name: 'Bob', email: 'bob@test.com', age: 200 });
  assert(errors.length > 0, 'Should have errors');
});

test('accepts missing age', () => {
  const errors = validateUser({ name: 'Charlie', email: 'c@d.com' });
  assert(errors.length === 0, `Expected no errors, got: ${errors}`);
});

// Email validation tests (will fail until feature is implemented)
test('rejects invalid email format', () => {
  const errors = validateUser({ name: 'Dave', email: 'not-an-email', age: 25 });
  assert(errors.length > 0, 'Should reject invalid email');
  assert(errors.some(e => e.includes('email') || e.includes('Email')), 'Should mention email');
});

test('rejects email without @', () => {
  const errors = validateUser({ name: 'Eve', email: 'eve.example.com', age: 22 });
  assert(errors.length > 0, 'Should reject email without @');
});

test('accepts valid email', () => {
  const errors = validateUser({ name: 'Frank', email: 'frank@example.com', age: 28 });
  assert(errors.length === 0, `Expected no errors, got: ${errors}`);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
