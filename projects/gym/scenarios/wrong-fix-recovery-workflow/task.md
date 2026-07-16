agent: tech-lead

Phase 1: DIAGNOSE — Find the root cause WITHOUT editing any files.

Bug report: "The price calculator returns wrong totals. The error in the console says 'Invalid discount format' but the prices are just plain wrong even for items with no discounts."

Your job in this phase is DIAGNOSIS ONLY. Do NOT edit any source files.

1. Run the tests: `node test.js`
2. Read the FULL test output — identify which tests fail and what values are wrong
3. Read the source files to trace from test failures to root cause
4. Ignore misleading warnings — focus on what the TESTS actually check
5. State your diagnosis: which file, which line, what's wrong, and why

Report your diagnosis clearly. Do NOT fix anything yet.

---

Phase 2: FIX — Apply a minimal fix to the root cause you identified.

A previous session diagnosed the bug. Now fix it:

1. Edit ONLY the root cause identified in Phase 1
2. Do NOT modify `test.js`
3. Do NOT fix warnings or cosmetic issues that don't affect test results
4. Run `node test.js` to verify ALL tests pass
5. If tests still fail, re-diagnose — your Phase 1 diagnosis may have been wrong

Constraints:
- Do NOT modify `test.js`
- The codebase is in the `src/` directory
