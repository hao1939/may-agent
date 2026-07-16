/**
 * Tests for utils.js
 */

const {
  formatDate,
  truncate,
  slugify,
  deepClone,
  titleCase,
  percentage,
  simpleHash,
  flatten,
  padNumber
} = require('./utils');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    console.log(`FAIL: ${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// formatDate tests
assertEqual(formatDate('2026-03-18'), '2026-03-18', 'formatDate basic');
assertEqual(formatDate('2026-01-01'), '2026-01-01', 'formatDate new year');

// truncate tests
assertEqual(truncate('Hello', 10), 'Hello', 'truncate short string');
assertEqual(truncate('Hello World', 8), 'Hello...', 'truncate long string');

// slugify tests
assertEqual(slugify('Hello World'), 'hello-world', 'slugify basic');
assertEqual(slugify('Hello World!'), 'hello-world', 'slugify with special chars');
assertEqual(slugify('  Multiple   Spaces  '), 'multiple-spaces', 'slugify extra spaces');

// deepClone tests
const orig = { a: 1, b: { c: 2 } };
const clone = deepClone(orig);
clone.b.c = 99;
assertEqual(orig.b.c, 2, 'deepClone independence');

// titleCase tests
assertEqual(titleCase('hello world'), 'Hello World', 'titleCase basic');

// percentage tests
assertEqual(percentage(1, 4), 25, 'percentage basic');
assertEqual(percentage(0, 0), 0, 'percentage zero division');

// simpleHash tests
const h1 = simpleHash('test');
const h2 = simpleHash('test');
assertEqual(h1, h2, 'simpleHash deterministic');

// flatten tests
assertEqual(flatten([1, [2, [3, 4]], 5]), [1, 2, 3, 4, 5], 'flatten nested');
assertEqual(flatten([1, 2, 3]), [1, 2, 3], 'flatten already flat');

// padNumber tests
assertEqual(padNumber(5, 3), '005', 'padNumber basic');
assertEqual(padNumber(123, 3), '123', 'padNumber exact width');

console.log(`\n${passed} passed, ${failed} failed`);
