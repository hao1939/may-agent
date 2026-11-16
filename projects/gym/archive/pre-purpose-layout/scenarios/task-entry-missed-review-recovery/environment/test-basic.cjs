const assert = require("node:assert/strict");
const { parseLimit } = require("./src/parse-limit.cjs");

assert.equal(parseLimit(10), 10);
assert.equal(parseLimit("25"), 25);
console.log("Draft v1 basic checks passed");
