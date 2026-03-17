// test.js — Parser tests
const { parse } = require('./parse');

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
    throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('Parser tests:');

test('valid integer', () => {
  assertEqual(parse("42"), 42, 'parse("42")');
});

test('valid float', () => {
  assertEqual(parse("3.14"), 3.14, 'parse("3.14")');
});

test('empty string', () => {
  assertEqual(parse(""), null, 'parse("")');
});

test('non-string', () => {
  assertEqual(parse(123), null, 'parse(123)');
});

test('mixed string rejected', () => {
  assertEqual(parse("123abc"), null, 'parse("123abc")');
});

test('leading spaces ok', () => {
  assertEqual(parse("  42  "), 42, 'parse("  42  ")');
});

test('pure text rejected', () => {
  assertEqual(parse("hello"), null, 'parse("hello")');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
