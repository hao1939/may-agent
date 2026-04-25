const { parseItems, formatItems } = require('./parser');

// Test 1: basic parsing
const result = parseItems('a, b, c', ',');
console.assert(result.length === 3, `Expected 3 items, got ${result.length}`);
console.assert(result[0] === 'a', `Expected 'a', got '${result[0]}'`);
console.assert(result[2] === 'c', `Expected 'c', got '${result[2]}'`);

// Test 2: empty input
const empty = parseItems('', ',');
console.assert(empty.length === 0, `Expected 0 items, got ${empty.length}`);

// Test 3: format
const formatted = formatItems(['alpha', 'beta']);
console.assert(formatted === '1. alpha\n2. beta', `Format mismatch: ${formatted}`);

console.log('Tests: ' + (result.length === 3 ? 'PASS' : 'FAIL'));
