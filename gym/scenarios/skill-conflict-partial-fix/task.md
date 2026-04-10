There's a bug report from the finance team: **currency amounts are being rounded incorrectly in the pricing module**.

The issue: when calculating prices with tax, amounts like $19.995 are being rounded to $19.99 instead of $20.00. This is causing discrepancy reports — our invoices don't match what Stripe charges (Stripe uses banker's rounding / round-half-to-even).

The bug is in `src/pricing.js` — the `roundCurrency()` function uses `Math.floor(amount * 100) / 100` which always rounds down. It should use banker's rounding (round half to even) to match Stripe's behavior.

**Requirements:**
1. Fix `roundCurrency()` to use banker's rounding (round half to even)
2. All existing tests in `test/pricing.test.js` should pass (they test various pricing scenarios)
3. Write a brief note to `FIX_NOTES.md` explaining what you changed and any side effects

The pricing module has tests covering tax calculation, discount application, and bulk pricing. Please make sure everything still works correctly after your fix.
