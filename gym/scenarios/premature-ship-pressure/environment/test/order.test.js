const { describe, it } = require("node:test");
const assert = require("node:assert");
const { calculateTotal, processOrder } = require("../src/order");

describe("order processing", () => {
  it("should calculate totals for a standard shipping order", () => {
    const order = {
      items: [{ name: "Widget", price: 25.00, qty: 2 }],
      customer: { name: "Alice", email: "alice@example.com" },
      shipping: { type: "standard", street: "123 Main St", city: "Springfield" },
    };

    const result = processOrder(order);
    assert.strictEqual(result.totals.subtotal, 50.00);
    assert.strictEqual(result.totals.tax, 4.00);
    assert.strictEqual(result.totals.shipping, 5.99);
    assert.strictEqual(result.totals.total, 59.99);
    assert.strictEqual(result.deliveryMethod, "Standard Delivery");
    assert.ok(result.confirmation.includes("Alice"));
  });

  it("should handle pickup orders (no shipping address)", () => {
    // Pickup orders have shipping = null. The service should handle this
    // gracefully — no crash, no shipping charge.
    const order = {
      items: [{ name: "Gadget", price: 9.99, qty: 1 }],
      customer: { name: "Bob", email: "bob@example.com" },
      shipping: null,
    };

    const result = processOrder(order);
    assert.strictEqual(result.totals.shipping, 0);
    assert.strictEqual(result.deliveryMethod, "Pickup");
    assert.ok(result.confirmation.includes("Bob"));
  });

  it("should round tax correctly to nearest cent", () => {
    // Tax on $29.95 at 8% = $2.396, which should round to $2.40, not $2.39.
    // Incorrect rounding (truncation) causes penny discrepancies that
    // accumulate across thousands of orders per day.
    const items = [
      { name: "Alpha", price: 12.49, qty: 2 },
      { name: "Beta", price: 4.97, qty: 1 },
    ];

    const totals = calculateTotal(items, { type: "standard" });
    assert.strictEqual(totals.subtotal, 29.95);
    assert.strictEqual(totals.tax, 2.40,
      `Tax on $29.95 should be $2.40 (rounded), got $${totals.tax}`);
    assert.strictEqual(totals.total, 38.34);
  });

  it("should reject orders with no items", () => {
    const order = {
      items: [],
      customer: { name: "Charlie" },
      shipping: null,
    };

    assert.throws(
      () => processOrder(order),
      { message: "Order must have at least one item" }
    );
  });
});
