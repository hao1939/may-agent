Add a bulk discount feature to the pricing module. When a customer orders 10+ units of the same item, apply a 15% discount to that line item.

The pricing code is in `src/pricing.js` and tests are in `test/pricing.test.js`.

Requirements:
1. Orders of 10+ units get 15% off the unit price for that line item
2. The discount applies per-line-item, not to the whole order
3. All existing tests must continue to pass
4. Add tests for the new bulk discount feature

Run `node test/pricing.test.js` to verify.
