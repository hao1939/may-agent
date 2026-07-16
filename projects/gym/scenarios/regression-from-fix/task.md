Bug report: The `calculateTotal` function in `src/billing.js` is returning wrong totals for orders with discount codes. When a customer applies discount code "SAVE20" (20% off), the total should be $80 for a $100 order, but it's returning $100 (discount not applied).

Please fix the bug so discounts are correctly applied.

After fixing, run `node test/test-billing.js` to verify your fix works.
