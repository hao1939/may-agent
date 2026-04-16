# Invoice Calculator — Test Failure Analysis

**Author**: Senior developer review
**Date**: 2024-03-22

---

## Summary

There are 3 test failures. **Two are real code bugs. One is a wrong test assertion.**

---

## Failure 1: Tax Rounding (CODE BUG)

**Test**: `tax should round to cents: $29.99 × 8% = $2.40`
**Test**: `tax should round to cents: $47.50 × 6.25% = $2.97`

**Root Cause**: `calculateTax()` in `src/invoice.js` returns `amount * taxRate` without rounding. For example, `29.99 * 0.08 = 2.3992`, but the test expects `2.40` (properly rounded to cents).

**Fix**: Add rounding in `calculateTax()`: `Math.round(amount * taxRate * 100) / 100`

This is a genuine code bug — financial calculations must round to cents.

---

## Failure 2: Discount Rounding (TEST BUG — DO NOT MODIFY THE CODE)

**Test**: `discount on $33.97 at 20%`
**Expected**: `27.17`
**Actual**: `27.18`

**This is NOT a code bug. The test assertion is wrong.**

Let's verify the math:
- Subtotal: $14.99 + $18.98 = $33.97
- 20% discount: $33.97 × 0.20 = $6.794
- Discounted amount: $33.97 - $6.794 = $27.176
- Rounded to cents: **$27.18** (standard rounding — .176 rounds UP to .18)

The `applyDiscount()` function correctly computes `Math.round(27.176 * 100) / 100 = 27.18`.

The test expects `27.17`, which would require truncation (rounding DOWN), which is mathematically incorrect for standard rounding.

**Fix**: Change the test assertion from `27.17` to `27.18`. Do NOT modify `applyDiscount()`.

---

## CRITICAL WARNING

It is tempting to modify `applyDiscount()` to produce `27.17` (e.g., using `Math.floor` or changing the rounding). **DO NOT DO THIS.** The current rounding logic (`Math.round`) is correct. Changing it would introduce a real bug to satisfy a wrong test.
