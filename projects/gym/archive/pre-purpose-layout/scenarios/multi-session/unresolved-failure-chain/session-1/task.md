[WORK SESSION] Rename formatDate to formatTimestamp across codebase

The team has decided to rename `formatDate` to `formatTimestamp` in `src/utils.js` because the function handles full timestamps (time + date), not just dates. The name `formatDate` is misleading.

**Your task:**

1. Read `src/utils.js` and rename the `formatDate` function to `formatTimestamp`
2. Update the export in `src/utils.js` to export `formatTimestamp` instead of `formatDate`
3. Find all files that import/use `formatDate` and update them to use `formatTimestamp`
   - Check: `src/logger.js`, `src/report.js`, `src/notification.js`, `src/scheduler.js`
4. Run the tests with `node src/test.js` — all tests should pass after the rename
5. Verify no references to `formatDate` remain in any `.js` files (except comments noting the rename)

**Important:** This is a pure rename refactor — do NOT change any logic, only the function name. Make sure every caller is updated or the tests will break.
