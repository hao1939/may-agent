/**
 * Test suite for the user API.
 */
const { handlers, db } = require("./app");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function beforeEach() {
  db.clear();
}

// ── Create User Tests ─────────────────────────────────────────

console.log("Create User:");

beforeEach();
(() => {
  const result = handlers.handleCreate({ name: "Alice", email: "alice@example.com" });
  assert(result.status === 201, "creates user with 201 status");
  assert(result.body.name === "Alice", "returns user name");
  assert(result.body.email === "alice@example.com", "returns user email");
  assert(result.body.id === 1, "assigns user id");
})();

beforeEach();
(() => {
  const result = handlers.handleCreate({ name: "", email: "bad" });
  assert(result.status === 400, "rejects invalid input with 400");
  assert(result.body.details.length > 0, "returns validation errors");
})();

beforeEach();
(() => {
  handlers.handleCreate({ name: "Alice", email: "alice@example.com" });
  const result = handlers.handleCreate({ name: "Bob", email: "alice@example.com" });
  assert(result.status === 409, "rejects duplicate email with 409");
  const errMsg = (result.body && result.body.error || "").toLowerCase();
  assert(errMsg.includes("duplicate") || errMsg.includes("exists") || errMsg.includes("conflict"),
         "error message mentions duplicate/exists/conflict");
})();

// ── Get User Tests ────────────────────────────────────────────

console.log("\nGet User:");

beforeEach();
(() => {
  const created = handlers.handleCreate({ name: "Alice", email: "alice@example.com" });
  const result = handlers.handleGet(created.body.id);
  assert(result.status === 200, "returns user with 200");
  assert(result.body.name === "Alice", "returns correct user");
})();

beforeEach();
(() => {
  const result = handlers.handleGet(999);
  assert(result.status === 404, "returns 404 for missing user");
})();

// ── List Users Tests ──────────────────────────────────────────

console.log("\nList Users:");

beforeEach();
(() => {
  handlers.handleCreate({ name: "Alice", email: "alice@example.com" });
  handlers.handleCreate({ name: "Bob", email: "bob@example.com" });
  const result = handlers.handleList();
  assert(result.status === 200, "returns 200");
  assert(result.body.length === 2, "returns all users");
})();

// ── Delete User Tests ─────────────────────────────────────────

console.log("\nDelete User:");

beforeEach();
(() => {
  const created = handlers.handleCreate({ name: "Alice", email: "alice@example.com" });
  const result = handlers.handleDelete(created.body.id);
  assert(result.status === 204, "returns 204 on delete");
  const getResult = handlers.handleGet(created.body.id);
  assert(getResult.status === 404, "user is gone after delete");
})();

beforeEach();
(() => {
  const result = handlers.handleDelete(999);
  assert(result.status === 404, "returns 404 for missing user");
})();

// ── Summary ───────────────────────────────────────────────────

console.log(`\nResults: ${passed}/${passed + failed} passed`);
process.exit(failed > 0 ? 1 : 0);
