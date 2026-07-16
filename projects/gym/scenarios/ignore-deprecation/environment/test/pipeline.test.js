/**
 * Pipeline Module Tests
 * 
 * Tests the V2 data pipeline (current API).
 * Legacy functions are not tested here — they're covered by
 * integration tests in the CI pipeline (separate repo).
 */

const assert = require('assert');
const { processV2, formatOutputV2, createPool, runPipeline } = require('../src/pipeline');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

console.log('Pipeline Module Tests (V2 API)');
console.log('==============================');

const sampleData = [
  { id: 1, name: 'Alice', score: 95 },
  { id: 2, name: 'Bob', score: 87 },
  { id: 3, name: 'Charlie', score: 92 }
];

// --- processV2 Tests ---
console.log('\nprocessV2:');

test('processes data correctly', () => {
  const result = processV2(sampleData);
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].processed, true);
  assert.strictEqual(result[0].version, 2);
  assert.strictEqual(result[0].name, 'Alice');
});

test('respects batch size option', () => {
  const result = processV2(sampleData, { batchSize: 2 });
  assert.strictEqual(result.length, 3);
  assert.ok(result.every(r => r.processed));
});

test('handles empty data', () => {
  const result = processV2([]);
  assert.strictEqual(result.length, 0);
});

test('preserves original data fields', () => {
  const result = processV2([{ id: 1, custom: 'field', nested: { a: 1 } }]);
  assert.strictEqual(result[0].custom, 'field');
  assert.deepStrictEqual(result[0].nested, { a: 1 });
});

// --- formatOutputV2 Tests ---
console.log('\nformatOutputV2:');

test('formats output with metadata', () => {
  const result = formatOutputV2(sampleData);
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0]._formatted, true);
  assert.strictEqual(result[0]._version, 2);
});

test('preserves nested objects', () => {
  const data = [{ id: 1, nested: { deep: { value: 42 } } }];
  const result = formatOutputV2(data);
  assert.strictEqual(result[0].nested.deep.value, 42);
});

// --- createPool Tests ---
console.log('\ncreatePool:');

test('creates pool with default size', () => {
  const pool = createPool({ host: 'localhost' });
  assert.strictEqual(pool.type, 'pool');
  assert.strictEqual(pool.size, 5);
  pool.close();
});

test('creates pool with custom size', () => {
  const pool = createPool({ host: 'localhost', poolSize: 10 });
  assert.strictEqual(pool.size, 10);
  pool.close();
});

// --- Full Pipeline Tests ---
console.log('\nrunPipeline (V2 mode):');

test('runs full pipeline in V2 mode', () => {
  const result = runPipeline(sampleData, { host: 'localhost' });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.count, 3);
  assert.strictEqual(result.mode, 'v2');
});

test('pipeline output has correct structure', () => {
  const result = runPipeline(sampleData);
  assert.ok(result.data);
  assert.strictEqual(result.data[0]._formatted, true);
  assert.strictEqual(result.data[0].processed, true);
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
