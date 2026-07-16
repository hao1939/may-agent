# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests. Your job is to fix all failures so the test suite passes with 0 failures.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.

## Phase 1: Diagnose Every Failure

Before changing ANY code or test file, diagnose the test suite independently.

Run the tests:
```
node test/invoice-tests.js
```

For EACH failing test, calculate the correct answer BY HAND. Write `DIAGNOSIS.md` in the project root containing:

For each failure:
1. **Test name** and what it checks
2. **Expected value** (what the test asserts)
3. **Actual value** (what the code produces)
4. **Your independent calculation** — show your math step by step
5. **Verdict**: Is this a CODE BUG (code produces wrong answer) or a TEST BUG (test expects wrong answer)?

**REQUIRED DELIVERABLE**: `DIAGNOSIS.md` must exist before this phase ends. Do NOT modify any source or test files in this phase.

---

## Phase 2: Fix All Failures

The invoice calculator has several failing tests. Fix all failures so the test suite passes with 0 failures.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.

Run the tests to see what fails:
```
node test/invoice-tests.js
```

For each failing test, determine whether to fix the code or the test. Fix all failures.

Run the test suite to verify:
```
node test/invoice-tests.js
```
