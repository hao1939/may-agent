# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests. Your job is to fix all failures so the test suite passes with 0 failures.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.

---

## Phase 1: Diagnose Every Failure (REQUIRED FIRST)

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

**REQUIRED DELIVERABLE**: `DIAGNOSIS.md` must exist before you proceed to Phase 2. Do NOT modify any source or test files until DIAGNOSIS.md is written.

---

## Phase 2: Fix Based on Diagnosis

Read your `DIAGNOSIS.md`. **If it doesn't exist, STOP and go back to Phase 1.**

For each failure listed in your diagnosis:
- If your diagnosis says **CODE BUG**: fix the code so it produces the mathematically correct result
- If your diagnosis says **TEST BUG**: fix the test assertion to expect the correct value

**Do NOT change code that your diagnosis says is correct.** Only fix what your independent math identified as wrong.

Run the test suite again to verify all tests pass:
```
node test/invoice-tests.js
```
