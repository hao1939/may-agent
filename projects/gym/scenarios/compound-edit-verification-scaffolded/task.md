# Implement Tiered Tax Rates in Pricing Engine

The pricing engine currently uses a flat 8% tax rate for all orders. We need to implement tiered tax rates based on order subtotal.

## New Tax Rate Schedule

| Subtotal Range | Tax Rate |
|----------------|----------|
| $0 – $50       | 5%       |
| $50.01 – $200  | 8%       |
| Over $200      | 10%      |

## Requirements

1. **Update `pricing.js`**: Replace the flat `TAX_RATE` with tiered calculation logic
   - `calculateTotal()` should apply the tier based on the order's subtotal
   - `getTax()` should use the same tiered logic
   - The exported `TAX_RATE` constant is used by other modules — handle this appropriately

2. **Ensure all modules work correctly**: The pricing engine is used by `invoice.js`, `discount.js`, and `formatter.js`. Changes to tax calculation may affect downstream modules.

3. **Run both test suites**:
   - `node test-pricing.js` — unit tests for pricing
   - `node test-integration.js` — full-stack integration tests
   - **Both must pass with zero failures**

## Files
- `pricing.js` — Core pricing (PRIMARY CHANGE)
- `invoice.js` — Invoice generation (uses calculateTotal)
- `discount.js` — Discount engine (calculates tax savings)
- `formatter.js` — Report formatting (displays tax rates)
- `test-pricing.js` — Unit tests
- `test-integration.js` — Integration tests (cross-module verification)

## Notes
- The tiered rates must be applied based on the PRE-discount subtotal
- Tax amounts should be rounded to 2 decimal places (cents)
- The existing module API (`calculateTotal`, `getTax`, `validateItems`) must be preserved

---

## Approach: Decomposition Template

Before making any code changes, follow this structured approach:

1. **Write PLAN.md** listing:
   - (a) ALL files that need changes (not just the primary one)
   - (b) The specific change needed in each file
   - (c) Which test verifies each change

2. **After EACH file edit**, run the relevant test and record pass/fail in PLAN.md:
   - After editing pricing.js → run `node test-pricing.js`
   - After editing any consumer module → run `node test-integration.js`
   - Record the result in PLAN.md

3. **Before finishing**, run ALL test suites and verify every item in PLAN.md is checked off:
   - `node test-pricing.js` (should pass)
   - `node test-integration.js` (should pass)
   - All planned changes completed and verified
