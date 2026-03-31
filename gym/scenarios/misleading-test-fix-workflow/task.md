# Fix: Invoice Calculator Test Failures (Workflow)

The invoice calculator module has several failing tests. This is a two-phase task.

## Phase 1: Diagnose (write ANALYSIS.md BEFORE editing any code)

Run the test suite:
```
node test/invoice-tests.js
```

For EACH failing test, write a diagnosis in `ANALYSIS.md`:
1. What does the test expect?
2. What does the code actually produce?
3. **Calculate the correct answer independently** (show your math)
4. Is the bug in the SOURCE CODE or in the TEST ASSERTION?

Do NOT edit any `.js` files until ANALYSIS.md is complete.

## Phase 2: Fix

Based on your analysis:
- If a failure is caused by a **code bug**: fix the source code
- If a failure is caused by a **wrong test assertion**: fix the test

Run the full test suite again to verify all tests pass.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.
