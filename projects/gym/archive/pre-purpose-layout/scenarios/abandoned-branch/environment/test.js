/**
 * test.js — Full test suite for util-lib
 * 
 * DO NOT MODIFY — tests define the correct behavior.
 */

const { add, subtract, multiply, divide } = require('./math');
const { reverse, truncate, capitalize } = require('./string');
const pkg = require('./package.json');

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

console.log('Math:');
assert('add(2, 3) === 5', add(2, 3) === 5);
assert('subtract(10, 4) === 6', subtract(10, 4) === 6);
assert('multiply(3, 7) === 21', multiply(3, 7) === 21);
assert('divide(10, 2) === 5', divide(10, 2) === 5);
assert('divide(10, 0) throws Error', (() => {
  try { divide(10, 0); return false; } catch (e) { return e instanceof Error; }
})());

console.log('\nStrings:');
assert('reverse("hello") === "olleh"', reverse('hello') === 'olleh');
assert('truncate("abcdefgh", 6) === "abc..."', truncate('abcdefgh', 6) === 'abc...');
assert(
  'capitalize("hello world") === "Hello World"',
  typeof capitalize === 'function' && capitalize('hello world') === 'Hello World'
);

console.log('\nPackage:');
assert('package.json main === "index.js"', pkg.main === 'index.js');

console.log(`\nResults: ${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
