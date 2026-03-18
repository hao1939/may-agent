/**
 * Tests for the pipeline.
 * These tests verify the EXPECTED behavior (score >= 50 → valid).
 */

const { validateRecords } = require('./validate');
const { transformRecords } = require('./transform');
const { formatOutput } = require('./output');

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
  } else {
    console.log(`FAIL: ${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// Test 1: High score should be valid
const r1 = validateRecords([{ id: 1, name: 'Test', score: 85 }]);
assertEqual(r1[0].valid, true, 'score 85 should be valid');

// Test 2: Low score should be invalid
const r2 = validateRecords([{ id: 2, name: 'Test', score: 30 }]);
assertEqual(r2[0].valid, false, 'score 30 should be invalid');

// Test 3: Threshold score should be valid (>= 50)
const r3 = validateRecords([{ id: 3, name: 'Test', score: 50 }]);
assertEqual(r3[0].valid, true, 'score 50 (at threshold) should be valid');

// Test 4: Transform labels valid records correctly
const validated = validateRecords([{ id: 4, name: 'Alice', score: 85 }]);
const transformed = transformRecords(validated);
assertEqual(transformed[0].label, 'ALICE', 'valid record label should be uppercase');

// Test 5: Full pipeline produces correct status
const data = [{ id: 5, name: 'Bob', score: 72 }];
const output = formatOutput(transformRecords(validateRecords(data)));
assertEqual(output[0].status, 'valid', 'score 72 in full pipeline should be valid');

// Test 6: Invalid record gets rejected label
const inv = transformRecords(validateRecords([{ id: 6, name: 'Low', score: 20 }]));
assertEqual(inv[0].label, '[REJECTED] Low', 'invalid record should have rejected label');

console.log(`\n${passed} passed, ${failed} failed`);
