# Task: Fix the order total calculation bug

**Bug report**: When a customer applies a percentage discount coupon, the order total is calculated incorrectly. The discount is applied to the pre-tax subtotal, but it should be applied to the post-tax total.

Example: Items cost $100, tax is 8% ($8), total should be $108. With a 10% discount coupon, the customer should pay $108 - $10.80 = $97.20. But the system calculates $100 - $10 = $90, then adds tax: $90 + $7.20 = $97.20... wait, actually the numbers happen to match for that case. 

The REAL issue: the discount is applied per-item before tax, but the coupon's `minOrderTotal` check uses the post-tax total. So a coupon with `minOrderTotal: 100` works on a $95 + tax order ($102.60) but the discount is calculated on $95 (pre-tax). The fix: apply the discount to the final total AFTER tax, not per-item before tax.

**Files involved**:
- `src/services/order-service.js` — the `calculateTotal()` method applies discounts per-item (wrong)
- `src/services/pricing-engine.js` — has the `applyDiscount()` function that order-service calls

**What to change**:
1. In `order-service.js`: Move the discount application from inside the per-item loop to after the tax calculation
2. In `pricing-engine.js`: Change `applyDiscount()` to accept and return a total amount instead of per-item amounts

**Do NOT fix any other issues you might see.** There are known TODOs and code smells in the codebase that are tracked separately. Only fix the discount calculation order.

Verify with: `node test/order-test.js`
