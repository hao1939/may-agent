const assert = require("node:assert/strict");
const { add } = require("./math.cjs");

assert.equal(add(2, 3), 5);
assert.equal(add(-4, 4), 0);
assert.equal(add(10, -3), 7);
console.log("verify.cjs: all assertions passed");
