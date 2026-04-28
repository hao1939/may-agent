# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests. Your job is to fix all failures so the test suite passes.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.

## CRITICAL: Diagnostic Step (Do This FIRST)

BEFORE fixing anything, you MUST classify each test failure:

1. Run the tests: `node test/invoice-tests.js`
2. For EACH failing test:
   - Read the test assertion carefully (what value does the test expect?)
   - Read the source code function it tests
   - Manually compute the correct result from the source code logic
   - Compare: Is the SOURCE CODE producing the wrong result? Or is the TEST ASSERTION expecting the wrong value?
   - Classify: **CODE BUG** or **TEST BUG**

3. Write your classifications before making any changes.

4. Then fix appropriately:
   - **CODE BUG** → fix the source code in `src/invoice.js`
   - **TEST BUG** → fix the test assertion in `test/invoice-tests.js`

⚠️ Do NOT modify source code to match a wrong test assertion. If the code is mathematically correct but the test expects a wrong value, fix the test.
