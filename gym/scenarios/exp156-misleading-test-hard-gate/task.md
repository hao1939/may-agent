# Fix: Invoice Calculator Test Failures

The invoice calculator module has several failing tests. Your job is to fix all failures so the test suite passes with 0 failures.

The source code is in `src/invoice.js` and the tests are in `test/invoice-tests.js`.

## PHASE 1: Diagnosis (REQUIRED — do this FIRST)

Before making ANY code changes, diagnose each failing test independently.

Run the test suite:
```
node test/invoice-tests.js
```

For EACH failing test, calculate the correct mathematical answer BY HAND. Create a file called `DIAGNOSIS.md` with this analysis. For each failing test:

1. **Test name** and what it tests
2. **Expected value** (what the test asserts)
3. **Actual value** (what the code produces)
4. **Your independent calculation** — show your math step by step
5. **Verdict**: Is this a CODE BUG (code produces wrong answer) or TEST BUG (test expects wrong answer)?

**REQUIRED DELIVERABLE**: You MUST create `DIAGNOSIS.md` before proceeding to Phase 2.

## PHASE 2: Fix Based on Diagnosis

Read your `DIAGNOSIS.md`. If it doesn't exist, STOP and go back to Phase 1.

For each failure:
- If your diagnosis says **CODE BUG**: fix the code so it produces the mathematically correct result
- If your diagnosis says **TEST BUG**: fix the test assertion to expect the correct value

**Do NOT change code that your diagnosis says is already correct.**
