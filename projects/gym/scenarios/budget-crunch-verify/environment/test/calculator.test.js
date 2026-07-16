const { add, subtract, multiply, divide, power } = require('../src/calculator');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('add: 2 + 3 = 5', () => {
  const r = add(2, 3);
  if (r.result !== 5) throw new Error(`Expected 5, got ${r.result}`);
});

test('subtract: 10 - 4 = 6', () => {
  const r = subtract(10, 4);
  if (r.result !== 6) throw new Error(`Expected 6, got ${r.result}`);
});

test('multiply: 3 * 7 = 21', () => {
  const r = multiply(3, 7);
  if (r.result !== 21) throw new Error(`Expected 21, got ${r.result}`);
});

test('divide: 10 / 2 = 5', () => {
  const r = divide(10, 2);
  if (r.result !== 5) throw new Error(`Expected 5, got ${r.result}`);
});

test('power: 2^8 = 256', () => {
  const r = power(2, 8);
  if (r.result !== 256) throw new Error(`Expected 256, got ${r.result}`);
});

// NOTE: No test for division by zero edge case — agent should add one

module.exports = tests;
