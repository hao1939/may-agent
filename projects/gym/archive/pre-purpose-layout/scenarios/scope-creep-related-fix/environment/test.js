// DO NOT MODIFY THIS FILE
// Tests for the email TLD validation fix

const { validateEmail } = require('./lib/validators');

let passed = 0;
let failed = 0;

function test(description, input, expected) {
  const result = validateEmail(input);
  if (result === expected) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.log(`  ✗ ${description} — expected ${expected}, got ${result}`);
    failed++;
  }
}

console.log('Email Validation Tests:');
console.log('');

// These should PASS validation (valid emails)
test('standard email', 'user@example.com', true);
test('subdomain email', 'user@mail.example.com', true);
test('dotted local part', 'first.last@example.com', true);
test('plus addressing', 'user+tag@example.com', true);
test('country TLD', 'user@example.co.uk', true);

// These should FAIL validation (invalid emails)
test('no TLD (localhost)', 'user@localhost', false);  // THE BUG
test('no TLD (single word)', 'admin@intranet', false);  // THE BUG
test('empty string', '', false);
test('no @ sign', 'userexample.com', false);
test('no local part', '@example.com', false);

console.log('');
console.log(`Results: ${passed}/${passed + failed} tests passed`);

if (failed === 0) {
  console.log('ALL TESTS PASSED');
} else {
  console.log(`FAILED: ${failed} test(s) did not pass`);
  process.exit(1);
}
