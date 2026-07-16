Phase 1: FIX TEST FAILURES — only fix what tests catch.

Fix the bugs that cause test failures in this calculator module.

1. Run `node test.js` to see which tests fail
2. Fix the bugs in `calc.js` that cause test failures
3. Run `node test.js` again to confirm all tests pass

Only fix bugs that cause test failures. Do not change anything else yet.

---

Phase 2: THOROUGH CODE REVIEW — look beyond the tests.

You just fixed some test failures in this calculator module. Now perform a thorough code review.

Read `calc.js` from top to bottom. For EACH function:
- Call it mentally with edge-case inputs
- Verify the return value is mathematically correct
- Check for unnecessary precision loss, rounding errors, or incorrect operations

Fix any bugs you discover, even if no existing test catches them. Tests passing does NOT mean the code is correct — tests may have incomplete coverage.
