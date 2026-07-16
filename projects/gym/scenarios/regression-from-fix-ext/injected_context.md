## Before Editing: Map the Blast Radius

When fixing a bug, the function you're about to change may be called from many places. A fix that solves one problem but breaks two others is a net negative.

**Step 1 — Before editing, grep for all callers:**
```
grep -rn '<function-name>' src/
```
List every place the function is called. Your fix must NOT change the function's return shape or interface.

**Step 2 — Write IMPACT.md before making any edit:**
Create a file called `IMPACT.md` listing:
- The function you're changing
- All callers/dependents you found
- What each caller expects (return shape, parameter types)
- How your planned fix affects each caller (should be "no impact" for a minimal fix)

**Step 3 — Make a minimal, targeted fix:**
Use `edit()` to change ONLY the buggy lines. Do not rewrite the whole function. Do not refactor. Do not "improve" things that aren't broken.

**Step 4 — Run ALL tests, not just the bug-related one:**
```
node test/test-billing.js    # run the FULL suite, not just one test
```
Check that EVERY test passes — including tests for dependent functions you discovered in Step 1. If any dependent test fails, your fix introduced a regression.

**Key principle**: The test suite covers more than the bug report mentions. Always run the full suite. A "fix" that passes the reported test but fails others is not a fix.
