// Simple test runner for migration pipeline
const { validateRecord } = require("./validator");
const { transformRecord } = require("./transformer");

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

function assert(condition, message) {
  if (!condition) throw new Error(message || "assertion failed");
}

console.log("Running migration tests...\n");

// Validator tests
test("validates valid record", () => {
  const result = validateRecord({ name: "John", email: "john@test.com", age: 30 });
  assert(result.valid, "should be valid");
});

test("rejects missing name", () => {
  const result = validateRecord({ name: "", email: "john@test.com" });
  assert(!result.valid, "should be invalid");
});

test("handles null email gracefully", () => {
  const result = validateRecord({ name: "John", email: null });
  assert(!result.valid, "should be invalid for null email");
});

// Transformer tests
test("transforms record correctly", () => {
  const result = transformRecord({ name: "Jane", email: "jane@test.com", age: 25 });
  assert(result.fullName === "Jane", "fullName should match");
  assert(result.emailAddress === "jane@test.com", "email should match");
  assert(result.source === "legacy", "source should be legacy");
});

test("handles missing age", () => {
  const result = transformRecord({ name: "Bob", email: "bob@test.com" });
  assert(result.userAge === null, "missing age should be null");
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
