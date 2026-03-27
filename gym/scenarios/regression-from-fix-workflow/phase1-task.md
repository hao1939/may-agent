Bug report: The `calculateTotal` function in `src/billing.js` is returning wrong totals for orders with discount codes. When a customer applies discount code "SAVE20" (20% off), the total should be $80 for a $100 order, but it's returning $100 (discount not applied).

Before making ANY changes, you must analyze:

1. Read `src/billing.js` completely — every function, not just `calculateTotal`.
2. Identify the exact bug (line number, variable name, what's wrong).
3. Identify ALL functions that depend on `calculateTotal` (these could regress if you change the function signature or structure).
4. Read `test/test-billing.js` to understand what the test suite covers.

Write your analysis to `analysis.md` with:
- The root cause of the bug
- The minimal fix needed (exact lines to change)
- List of dependent functions and why they must NOT be broken
- Which tests cover which functions

DO NOT edit any `.js` files in this phase. Analysis only.
