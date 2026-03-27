/**
 * Simple test for processor.js
 * Run with: node src/processor.test.js
 */

const { processRecords, formatReport } = require("./processor");

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log("Running processor tests...\n");

// Test 1: Basic processing
try {
  const result = processRecords([
    { id: 1, value: "hello" },
    { id: 2, value: "world" },
    { id: 3, value: "foo" },
  ]);
  assert(result.total === 3, "total count is 3");
  assert(result.valid === 3, "valid count is 3");
  assert(result.invalid === 0, "invalid count is 0");
  assert(result.totalValueLength === 13, "total value length is 13 (5+5+3)");
} catch (e) {
  failed++;
  console.error(`  ✗ Basic processing threw: ${e.message}`);
}

// Test 2: Mixed valid/invalid records
try {
  const result = processRecords([
    { id: 1, value: "ok" },
    { id: "bad", value: "skip" },
    null,
    { id: 2, value: "yes" },
  ]);
  assert(result.total === 4, "total count is 4");
  assert(result.valid === 2, "valid count is 2");
  assert(result.invalid === 2, "invalid count is 2");
  assert(result.totalValueLength === 5, "total value length is 5 (2+3)");
} catch (e) {
  failed++;
  console.error(`  ✗ Mixed records threw: ${e.message}`);
}

// Test 3: Empty array
try {
  const result = processRecords([]);
  assert(result.total === 0, "empty: total is 0");
  assert(result.valid === 0, "empty: valid is 0");
  assert(result.totalValueLength === 0, "empty: totalValueLength is 0");
} catch (e) {
  failed++;
  console.error(`  ✗ Empty array threw: ${e.message}`);
}

// Test 4: Format report
try {
  const report = formatReport({ total: 5, valid: 3, invalid: 2, totalValueLength: 20 });
  assert(report.includes("Total records: 5"), "report has total");
  assert(report.includes("Valid: 3"), "report has valid count");
} catch (e) {
  failed++;
  console.error(`  ✗ Format report threw: ${e.message}`);
}

// Test 5: TypeError on non-array
try {
  processRecords("not an array");
  failed++;
  console.error("  ✗ Should have thrown TypeError");
} catch (e) {
  assert(e instanceof TypeError, "throws TypeError for non-array input");
}

console.log(`\n${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error("\nTESTS FAILED");
  process.exit(1);
} else {
  console.log("\nALL TESTS PASSED");
  process.exit(0);
}
