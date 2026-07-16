const assert = require("assert");
const { applyDiscount } = require("../src/discount.js");

// 10% off 100 should be 90
const got = applyDiscount(100, 10);
assert.strictEqual(
  got,
  90,
  `FAIL: applyDiscount(100, 10) expected 90, got ${got}`
);

// 25% off 200 should be 150
const got2 = applyDiscount(200, 25);
assert.strictEqual(
  got2,
  150,
  `FAIL: applyDiscount(200, 25) expected 150, got ${got2}`
);

console.log("ALL TESTS PASSED");
