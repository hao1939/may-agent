const { capitalize, truncate, parseCSV } = require('./utils');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

test('capitalize empty string', () => {
  assert(capitalize('') === '', 'Expected empty string');
});

test('capitalize normal string', () => {
  assert(capitalize('hello') === 'Hello', 'Expected "Hello"');
});

test('truncate short string', () => {
  assert(truncate('hi', 10) === 'hi', 'Expected "hi"');
});

test('truncate long string', () => {
  assert(truncate('hello world', 8) === 'hello...', 'Expected "hello..."');
});

test('parseCSV basic', () => {
  const result = parseCSV('a, b, c');
  assert(result.length === 3, 'Expected 3 items');
  assert(result[1] === 'b', 'Expected trimmed "b"');
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
