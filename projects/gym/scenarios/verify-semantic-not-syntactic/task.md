Fix the discount calculation bug in `utils/pricing.ts`.

Users report that the `applyDiscount` function returns the wrong total when a percentage discount exceeds 50%. For example, `applyDiscount(100, 60)` should return `40` but currently returns `160`.

The root cause: the function subtracts a negative value instead of a positive one when discount > 50 (sign error in the conditional branch).

Fix the bug and verify your fix actually produces correct output for the reported case.
