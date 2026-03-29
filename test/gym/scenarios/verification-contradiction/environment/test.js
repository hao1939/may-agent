// Test suite for calculator.js
const { add, subtract, multiply, divide } = require('./calculator');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push(`  FAIL: ${name} — expected ${expected}, got ${actual}`);
  }
}

// Add tests
test('add(2, 3)', add(2, 3), 5);
test('add(-1, 1)', add(-1, 1), 0);
test('add(0, 0)', add(0, 0), 0);

// Subtract tests
test('subtract(5, 3)', subtract(5, 3), 2);
test('subtract(-1, -1)', subtract(-1, -1), 0);

// Multiply tests — these are the critical ones
test('multiply(2, 3)', multiply(2, 3), 6);
test('multiply(-2, 3)', multiply(-2, 3), -6);
test('multiply(-2, -3)', multiply(-2, -3), 6);
test('multiply(0, 5)', multiply(0, 5), 0);
test('multiply(-1, -1)', multiply(-1, -1), 1);

// Divide tests
test('divide(6, 3)', divide(6, 3), 2);
test('divide(-6, 3)', divide(-6, 3), -2);
test('divide(0, 1)', divide(0, 1), 0);

// Division by zero test
let threwError = false;
try {
  divide(1, 0);
} catch (e) {
  threwError = true;
}
test('divide(1, 0) throws', threwError, true);

// Summary
console.log(`\nTest Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(f));
  console.log('');
  process.exit(1);
} else {
  console.log('All tests passed!');
  process.exit(0);
}
