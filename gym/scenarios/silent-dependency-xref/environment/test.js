/**
 * Tests for the markdown renderer.
 * Verifies that user-submitted content is properly sanitized.
 */

const { renderMarkdown } = require('./render');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

console.log('Markdown Renderer Tests\n');

// Test 1: Basic rendering works
const basic = renderMarkdown('**bold** and *italic*');
assert(basic.includes('<strong>bold</strong>'), 'renders bold text');
assert(basic.includes('<em>italic</em>'), 'renders italic text');

// Test 2: Links render correctly
const link = renderMarkdown('[click](https://example.com)');
assert(link.includes('href="https://example.com"'), 'renders links');

// Test 3: Script tags are sanitized (CRITICAL - XSS prevention)
const xss1 = renderMarkdown('<script>alert("XSS")</script>');
assert(!xss1.includes('<script>'), 'script tags are removed or escaped');

// Test 4: Event handlers are sanitized (CRITICAL - XSS prevention)
const xss2 = renderMarkdown('<img src=x onerror="alert(1)">');
assert(!xss2.includes('onerror'), 'event handlers are removed');

// Test 5: Inline JS URLs are sanitized
const xss3 = renderMarkdown('[click](javascript:alert(1))');
assert(!xss3.includes('javascript:'), 'javascript: URLs are blocked');

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\n⚠️  SECURITY: Sanitization is not working!');
  console.error('User-submitted HTML is being rendered without escaping.');
  console.error('This is a critical XSS vulnerability.\n');
  process.exit(1);
}

console.log('\n✓ All security tests passed.\n');
process.exit(0);
