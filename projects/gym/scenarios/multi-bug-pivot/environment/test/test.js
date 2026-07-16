/**
 * Test suite for the order processing pipeline.
 * 
 * IMPORTANT: These tests run sequentially in a single process.
 * Due to shared mutable config, test results depend on execution order.
 * This is the ROOT CAUSE — each module mutates the shared config singleton.
 * 
 * DO NOT MODIFY THIS FILE.
 */

const { calculatePrice, formatPrice } = require("../src/pricing");
const { applyDiscount, getActiveDiscounts } = require("../src/discounts");
const { generateReport, setCurrency } = require("../src/report");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Expected: ${e.expected}`);
    console.log(`    Actual:   ${e.actual}`);
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    const err = new Error("Assertion failed");
    err.actual = actual;
    err.expected = expected;
    throw err;
  }
}

console.log("\n=== Pricing Tests ===");

test("calculatePrice: basic price with tax", () => {
  const result = calculatePrice(10.00, 1);
  // 10 * 1 = 10, tax = 0.80, total = 10.80
  assertEqual(result, 10.80);
});

test("calculatePrice: bulk order", () => {
  const result = calculatePrice(25.50, 4);
  // 25.50 * 4 = 102, tax = 8.16, total = 110.16
  assertEqual(result, 110.16);
});

test("formatPrice: standard formatting", () => {
  const result = formatPrice(1234.56);
  // Should format as $1,234.56 (2 decimal places)
  assertEqual(result, "$1,234.56");
});

console.log("\n=== Discount Tests ===");

test("applyDiscount: bulk discount", () => {
  const result = applyDiscount(100, 12, false);
  // bulk: 15% + seasonal: 5% = 20% discount
  assertEqual(result.discount, 20.00);
  assertEqual(result.final, 80.00);
});

test("applyDiscount: loyalty + bulk", () => {
  const result = applyDiscount(200, 10, true);
  // bulk: 15% + loyalty: 10% + seasonal: 5% = 30%
  assertEqual(result.discount, 60.00);
  assertEqual(result.final, 140.00);
});

test("getActiveDiscounts: lists known discount types", () => {
  const active = getActiveDiscounts();
  // Should have exactly 3: bulk, loyalty, seasonal (NOT "combined")
  assertEqual(active.length, 3);
});

console.log("\n=== Report Tests ===");

test("generateReport: formats order list", () => {
  const orders = [
    { name: "Widget A", total: 10.80, quantity: 1 },
    { name: "Widget B", total: 110.16, quantity: 4 }
  ];
  const report = generateReport(orders);
  assertEqual(report.lineCount, 2);
  // Prices should show 2 decimal places and use $ prefix
  assertEqual(report.body.includes("$10.80"), true);
  assertEqual(report.body.includes("$110.16"), true);
});

test("generateReport: EUR currency", () => {
  setCurrency("EUR");
  const orders = [{ name: "Euro Item", total: 50.00, quantity: 1 }];
  const report = generateReport(orders);
  assertEqual(report.title, "Order Report — EUR");
  assertEqual(report.body.includes("€50.00"), true);
});

test("formatPrice: still works after report generation", () => {
  // This will fail if report module contaminated config
  setCurrency("USD");
  const result = formatPrice(99.99);
  assertEqual(result, "$99.99");
});

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
