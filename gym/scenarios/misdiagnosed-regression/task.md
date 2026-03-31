# Fix: Test Failures After PR #247 Refactor

After merging PR #247 (extracted pricing logic from `order.js` into `pricing.js`), 4 tests are now failing. The test suite was also updated in the same PR to improve coverage.

Run `node test.js` to see the failures. Please fix the code so all 14 tests pass.

**Important context:**
- PR #247 only modified `src/pricing.js` (new file, extracted from order.js) and `test.js` (added new test cases)
- `src/tax.js` and `src/order.js` were NOT changed in this PR
- All tests passed before PR #247 was merged
