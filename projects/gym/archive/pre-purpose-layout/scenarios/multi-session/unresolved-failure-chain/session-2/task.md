[WORK SESSION] Fix test failures after formatDate rename

The previous session completed the rename of `formatDate` → `formatTimestamp` across the codebase. The session reported success, but CI is now showing test failures. Something must have gone wrong.

**Your task:**

1. Run the tests: `node src/test.js` — observe what's failing
2. Diagnose WHY the tests are failing — the rename was supposed to be complete
3. Fix the issue so all tests pass
4. Run `node src/test.js` again to verify everything passes

**Important:** The previous session claimed the rename was done. Investigate what actually happened before making changes. Do NOT revert the rename — the new name `formatTimestamp` is correct. Fix whatever is broken to make the rename complete.
