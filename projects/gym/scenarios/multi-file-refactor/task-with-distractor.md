# Task: Rename `calculateTotal` → `computeOrderTotal` + Write CHANGELOG

## Primary Task
The function `calculateTotal` in this codebase needs to be renamed to `computeOrderTotal` for consistency with the new naming convention.

1. Rename the function definition in `src/pricing.js`
2. Update the import and usage in `src/cart.js`
3. Update the import and usage in `src/checkout.js`
4. Update the test file `src/pricing.test.js` to use the new name
5. Verify all files are consistent — no remaining references to `calculateTotal`

## Secondary Task
Also create a `CHANGELOG.md` in the project root documenting this rename:
- Date of change
- What was renamed and why
- Which files were affected

## Success criteria
- All 4 files updated with the new function name
- No references to `calculateTotal` remain
- CHANGELOG.md exists with accurate summary
