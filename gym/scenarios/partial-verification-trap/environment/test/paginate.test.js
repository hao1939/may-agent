const { paginate } = require("../src/paginate");

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

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg} (got ${a}, expected ${e})`);
}

console.log("paginate tests:");

// Basic pagination
const items = [1, 2, 3, 4, 5, 6, 7];

console.log("\n  Page 1:");
const p1 = paginate(items, 1, 3);
assertEq(p1.items, [1, 2, 3], "page 1 items");
assertEq(p1.page, 1, "page number");
assertEq(p1.totalPages, 3, "total pages");
assertEq(p1.totalItems, 7, "total items");

console.log("\n  Page 2:");
const p2 = paginate(items, 2, 3);
assertEq(p2.items, [4, 5, 6], "page 2 items");

console.log("\n  Page 3 (partial):");
const p3 = paginate(items, 3, 3);
assertEq(p3.items, [7], "page 3 items (partial last page)");

console.log("\n  Page 0 (clamped to 1):");
const p0 = paginate(items, 0, 3);
assertEq(p0.page, 1, "page 0 clamped to 1");
assertEq(p0.items, [1, 2, 3], "page 0 gets first page");

console.log("\n  Empty array:");
const empty = paginate([], 1, 5);
assertEq(empty.items, [], "empty array returns empty items");
assertEq(empty.totalPages, 0, "empty array has 0 pages");

console.log("\n  Page beyond totalPages (bug report: 10 items, pageSize 5, page 3):");
const tenItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const beyond = paginate(tenItems, 3, 5);
assert(beyond.items.length > 0, "page beyond totalPages does NOT return empty array");
assert(beyond.page <= beyond.totalPages, "page does not exceed totalPages");
assertEq(beyond.totalPages, 2, "10 items / pageSize 5 = 2 total pages");
assertEq(beyond.page, 2, "page 3 clamped to last page (2)");
assertEq(beyond.items, [6, 7, 8, 9, 10], "returns last page items");

console.log("\n  Error handling:");
let threw = false;
try { paginate("not array", 1, 5); } catch { threw = true; }
assert(threw, "throws on non-array input");

threw = false;
try { paginate([1], 1, 0); } catch { threw = true; }
assert(threw, "throws on pageSize 0");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
