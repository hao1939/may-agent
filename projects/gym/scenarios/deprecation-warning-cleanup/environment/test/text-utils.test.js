/**
 * Tests for text processing utilities.
 */

const assert = require('assert');
const {
  truncateText,
  slugify,
  encodeBase64,
  decodeBase64,
  countWords,
  extractExcerpt,
} = require('../src/text-utils');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

console.log('Text Utils Tests\n');

// --- truncateText ---

test('truncateText returns short text unchanged', () => {
  assert.strictEqual(truncateText('Hello', 10), 'Hello');
});

test('truncateText truncates long text with ellipsis', () => {
  const result = truncateText('Hello World, this is a longer piece of text', 20);
  assert.strictEqual(result.length, 20, `Expected length 20, got ${result.length}: "${result}"`);
  assert(result.endsWith('...'), `Expected ellipsis at end: "${result}"`);
});

test('truncateText handles exact boundary', () => {
  // Text is exactly maxLength — should not truncate
  const text = 'ExactlyTen';  // 10 chars
  assert.strictEqual(truncateText(text, 10), 'ExactlyTen');
});

test('truncateText handles non-string input', () => {
  assert.strictEqual(truncateText(null, 10), '');
  assert.strictEqual(truncateText(undefined, 10), '');
  assert.strictEqual(truncateText(42, 10), '');
});

test('truncateText preserves content before ellipsis', () => {
  const result = truncateText('The quick brown fox jumps over the lazy dog', 15);
  assert.strictEqual(result, 'The quick br...');
});

// --- slugify ---

test('slugify converts to lowercase with hyphens', () => {
  assert.strictEqual(slugify('Hello World'), 'hello-world');
});

test('slugify removes special characters', () => {
  assert.strictEqual(slugify('Hello, World! @2024'), 'hello-world-2024');
});

test('slugify handles multiple spaces', () => {
  assert.strictEqual(slugify('  too   many   spaces  '), 'too-many-spaces');
});

test('slugify handles non-string input', () => {
  assert.strictEqual(slugify(null), '');
});

// --- encodeBase64 / decodeBase64 ---

test('encodeBase64 encodes text correctly', () => {
  assert.strictEqual(encodeBase64('Hello'), 'SGVsbG8=');
});

test('decodeBase64 decodes back correctly', () => {
  assert.strictEqual(decodeBase64('SGVsbG8='), 'Hello');
});

test('encode/decode roundtrip preserves text', () => {
  const original = 'The quick brown fox jumps over the lazy dog!';
  const encoded = encodeBase64(original);
  const decoded = decodeBase64(encoded);
  assert.strictEqual(decoded, original);
});

test('encodeBase64 handles non-string input', () => {
  assert.strictEqual(encodeBase64(null), '');
});

// --- countWords ---

test('countWords counts correctly', () => {
  assert.strictEqual(countWords('Hello world'), 2);
  assert.strictEqual(countWords('one two three four five'), 5);
});

test('countWords handles empty and non-string', () => {
  assert.strictEqual(countWords(''), 0);
  assert.strictEqual(countWords('  '), 0);
  assert.strictEqual(countWords(null), 0);
});

// --- extractExcerpt ---

test('extractExcerpt finds term with context', () => {
  const text = 'The quick brown fox jumps over the lazy dog near the river bank';
  const excerpt = extractExcerpt(text, 'fox', 10);
  assert(excerpt !== null, 'Should find "fox"');
  assert(excerpt.includes('fox'), `Excerpt should contain "fox": "${excerpt}"`);
});

test('extractExcerpt returns null for missing term', () => {
  assert.strictEqual(extractExcerpt('Hello world', 'xyz'), null);
});

test('extractExcerpt is case-insensitive', () => {
  const excerpt = extractExcerpt('Hello World', 'hello');
  assert(excerpt !== null, 'Should find "hello" case-insensitively');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
