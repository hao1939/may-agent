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

## ⚠️ MANDATORY VERIFICATION PROTOCOL

You MUST complete these verification checkpoints. Do not skip any step.

### STOP-GATE 1: Before first edit
- [ ] Read ALL files in the working directory
- [ ] List every file that imports from or references `pricing.js`
- [ ] Write this dependency list to `VERIFICATION.md`

### STOP-GATE 2: After editing pricing.js
- [ ] Run `node test-pricing.js` and paste output
- [ ] Run `node test-integration.js` and paste output
- [ ] For EACH failing test: identify which file/function is broken

### STOP-GATE 3: After editing each consumer file
- [ ] Re-run `node test-integration.js` after EACH consumer file edit
- [ ] Verify the specific failures from Gate 2 are now resolved

### STOP-GATE 4: Final verification
- [ ] Run `node test-pricing.js` — must show 0 failed
- [ ] Run `node test-integration.js` — must show 0 failed
- [ ] Read back every modified file and verify changes look correct
- [ ] Update `VERIFICATION.md` with final status of each file
