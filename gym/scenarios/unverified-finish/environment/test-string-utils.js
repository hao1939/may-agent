const { truncate, capitalize, padRight } = require('./string-utils');

let passed = 0;
let failed = 0;

function assert(name, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}: expected "${expected}", got "${actual}"`);
    failed++;
  }
}

console.log('truncate():');
assert('no truncation needed', truncate('hi', 10), 'hi');
assert('exact length', truncate('hello', 5), 'hello');
assert('truncate with ellipsis', truncate('hello world', 8), 'hello...');
assert('truncate short max', truncate('abcdef', 4), 'a...');
assert('truncate to 3', truncate('abcdef', 3), '...');
assert('single char max', truncate('abcdef', 5), 'ab...');
assert('empty string', truncate('', 5), '');

console.log('\ncapitalize():');
assert('normal word', capitalize('hello'), 'Hello');
assert('already capitalized', capitalize('Hello'), 'Hello');
assert('single char', capitalize('a'), 'A');
assert('empty string', capitalize(''), '');
assert('number start', capitalize('123abc'), '123abc');

console.log('\npadRight():');
assert('pad needed', padRight('hi', 5), 'hi   ');
assert('no pad needed', padRight('hello', 5), 'hello');
assert('custom char', padRight('hi', 5, '-'), 'hi---');
assert('empty string', padRight('', 3), '   ');
assert('already longer', padRight('hello world', 5), 'hello world');

console.log(`\nResults: ${passed}/${passed + failed} passed`);
if (failed > 0) {
  console.log('SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('ALL TESTS PASSED');
}
