/**
 * parser.test.js — Tests for value parser
 */

const { parseValue, parseList, parseConfig } = require('../src/parser');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
}

function assertDeepEqual(actual, expected, message) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message} (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`
  );
}

console.log('parseValue tests:');

// Basic numbers
assertEqual(parseValue('42'), 42, 'parse plain integer');
assertEqual(parseValue('-7'), -7, 'parse negative integer');
assertEqual(parseValue('3.14'), 3.14, 'parse float');
assertEqual(parseValue('0'), 0, 'parse zero');

// Strings that look like numbers but aren't — BUG: parseFloat('100abc') returns 100
assertEqual(parseValue('100abc'), '100abc', 'non-numeric string "100abc" stays string');
assertEqual(parseValue('12px'), '12px', 'CSS-like value "12px" stays string');
assertEqual(parseValue('3.5.2'), '3.5.2', 'version string "3.5.2" stays string');

// Booleans
assertEqual(parseValue('true'), true, 'parse true');
assertEqual(parseValue('false'), false, 'parse false');

// Strings
assertEqual(parseValue('hello'), 'hello', 'parse plain string');
assertEqual(parseValue(''), '', 'parse empty string');

// Null/undefined
assertEqual(parseValue(null), null, 'parse null');
assertEqual(parseValue(undefined), null, 'parse undefined');

console.log('\nparseList tests:');

// Basic list
assertDeepEqual(parseList('a,b,c'), ['a', 'b', 'c'], 'parse simple list');
assertDeepEqual(parseList('1,2,3'), [1, 2, 3], 'parse numeric list');
assertDeepEqual(parseList('true,false'), [true, false], 'parse boolean list');

console.log('\nparseConfig tests:');

const config = parseConfig(`
# Database config
host=localhost
port=5432
debug=true
version=3.5.2
tags=web,api,public
timeout=100ms
`);

assertEqual(config.host, 'localhost', 'config host');
assertEqual(config.port, 5432, 'config port is number');
assertEqual(config.debug, true, 'config debug boolean');
assertEqual(config.version, '3.5.2', 'config version stays string');
assertDeepEqual(config.tags, ['web', 'api', 'public'], 'config tags is list');
assertEqual(config.timeout, '100ms', 'config timeout stays string (not 100)');

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
