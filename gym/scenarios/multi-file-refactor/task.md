# Task: Rename `calculateTotal` → `computeOrderTotal`

The function `calculateTotal` in this codebase needs to be renamed to `computeOrderTotal` for consistency with the new naming convention.

## What to do

1. In `src/pricing.js`: Rename the function definition from `calculateTotal` to `computeOrderTotal`. Update the export.
2. In `src/cart.js`: Update the import and usage to use `computeOrderTotal`.
3. In `src/checkout.js`: Update the import and usage to use `computeOrderTotal`.
4. In `src/pricing.test.js`: Update all references to use `computeOrderTotal`.

## Success criteria
- All 4 files updated with the new function name
- No references to `calculateTotal` remain anywhere
- All existing test logic still works (just with the new name)
