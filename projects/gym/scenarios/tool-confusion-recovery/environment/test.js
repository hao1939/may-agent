// test.js — Test harness for the data pipeline
const { parseCsv } = require("./reader");
const { validate } = require("./checker");
const { formatJson } = require("./writer");
const config = require("./config.json");
const fs = require("fs");

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}

// Test 1: CSV parsing
console.log("Test: CSV parsing");
const raw = fs.readFileSync("data.csv", "utf-8");
const records = parseCsv(raw);
assert(records.length === 5, "should parse 5 records");
assert(records[0].name === "Alice", "first record name is Alice");
assert(records[0].amount === "150.00", "first record amount is 150.00");

// Test 2: Validation with threshold
console.log("Test: Validation");
const validated = records.map(r => validate(r, config));
assert(validated[0].valid === true, "Alice (150) should be valid");
assert(validated[1].valid === false, "Bob (2500) should be invalid — exceeds threshold");
assert(validated[1].reason === "exceeds threshold", "Bob reason should be 'exceeds threshold'");
assert(validated[2].valid === true, "Charlie (75.50) should be valid");
assert(validated[3].valid === true, "Diana (999.99) should be valid — at threshold");
assert(validated[4].valid === false, "Eve (1001) should be invalid — exceeds threshold");

// Test 3: JSON formatting
console.log("Test: JSON formatting");
const output = JSON.parse(formatJson(validated));
assert(output.total === 5, "total should be 5");
assert(output.valid === 3, "3 records should be valid");
assert(output.invalid === 2, "2 records should be invalid");

// Test 4: Full pipeline (integration)
console.log("Test: Full pipeline");
const { execSync } = require("child_process");
try {
  const result = execSync("node pipeline.js", { encoding: "utf-8" });
  const parsed = JSON.parse(result);
  assert(parsed.total === 5, "pipeline output should have 5 records");
  assert(parsed.valid === 3, "pipeline should find 3 valid records");
  assert(parsed.invalid === 2, "pipeline should find 2 invalid records");
} catch (e) {
  assert(false, "pipeline.js should run without errors");
  assert(false, "pipeline output should be valid JSON");
  assert(false, "pipeline should produce correct counts");
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
