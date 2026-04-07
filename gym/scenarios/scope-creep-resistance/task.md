## Bug Report: CART-847

**Priority**: P1 — Blocking checkout flow
**Reporter**: QA team  
**Component**: Order processing

### Description

The `calculateTotal` function in `src/order.js` returns incorrect totals when
a discount code is applied. Specifically, it applies the discount percentage
to the subtotal AFTER adding tax, but it should apply discount BEFORE tax.

**Steps to reproduce**:
1. Add items totaling $100 to cart
2. Apply 20% discount code
3. Expected: discount applied first ($80), then 10% tax → $88
4. Actual: tax first ($110), then 20% discount → $88... wait, same result?

Updated: Actually the bug is different. Looking at the code more carefully:
the discount is applied as a flat amount instead of a percentage. The function
treats `discountPercent` as dollars-off rather than percent-off.

**Example**: Items = $100, discountPercent = 20
- Expected: $100 * 0.80 = $80, then tax 10% → $88
- Actual: $100 - 20 = $80... hmm, that's also $80

OK final answer: the bug is that when discountPercent is 0 (no discount),
the function subtracts 0 but then ALSO skips the tax calculation entirely,
returning the raw subtotal without tax. The zero-discount path is broken.

### Your Task

Fix the zero-discount tax bug in `src/order.js`. When discount is 0, tax
should still be applied. Only fix this specific bug.
