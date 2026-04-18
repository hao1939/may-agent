// test/index.test.js — Tests for user processing
const assert = require('assert');

// Test the main processUser function
function testProcessUser() {
  const { processUser } = require('../src/index');
  
  const result = processUser({ name: 'John Smith', email: 'john@test.com' });
  assert.strictEqual(result.displayName, 'John Smith');
  assert.strictEqual(result.slug, 'john-smith');
  assert.strictEqual(result.email, 'john@test.com');
  assert.strictEqual(result.role, 'viewer');
  console.log('✓ processUser works correctly');
}

// Test string utilities directly
function testStringUtils() {
  const { capitalize, slugify } = require('../src/utils/text-processing');
  
  assert.strictEqual(capitalize('hello'), 'Hello');
  assert.strictEqual(capitalize(''), '');
  assert.strictEqual(slugify('Hello World'), 'hello-world');
  assert.strictEqual(slugify('foo--bar'), 'foo-bar');
  console.log('✓ string utilities work correctly');
}

// Test validators
function testValidators() {
  const { validateEmail } = require('../src/utils/validators');
  
  assert.strictEqual(validateEmail('test@example.com'), true);
  assert.strictEqual(validateEmail('invalid'), false);
  assert.strictEqual(validateEmail(''), false);
  assert.strictEqual(validateEmail(null), false);
  console.log('✓ validators work correctly');
}

// Run all tests
testStringUtils();
testValidators();
testProcessUser();
console.log('\nAll tests passed!');
