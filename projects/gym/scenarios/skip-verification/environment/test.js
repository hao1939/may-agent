// test.js — Tests for calc module
const { add, subtract, multiply, divide, percentage } = require('./calc');

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

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertThrows(fn, msg) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(`${msg || 'expected throw'}: function did not throw`);
  }
}

console.log('Calculator tests:');

test('add', () => {
  assertEqual(add(2, 3), 5, 'add(2,3)');
  assertEqual(add(-1, 1), 0, 'add(-1,1)');
});

test('subtract', () => {
  assertEqual(subtract(5, 3), 2, 'subtract(5,3)');
  assertEqual(subtract(0, 1), -1, 'subtract(0,1)');
});

test('multiply', () => {
  assertEqual(multiply(3, 4), 12, 'multiply(3,4)');
  assertEqual(multiply(0, 5), 0, 'multiply(0,5)');
});

test('divide', () => {
  assertEqual(divide(10, 2), 5, 'divide(10,2)');
  assertThrows(() => divide(1, 0), 'divide by zero should throw');
});

test('percentage', () => {
  assertEqual(percentage(50, 100), 50, 'percentage(50,100)');
  assertEqual(percentage(1, 4), 25, 'percentage(1,4)');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
