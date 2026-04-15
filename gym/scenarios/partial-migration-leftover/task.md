# Fix the Record Formatting Bug

Our data service has a bug — when we fetch and format a single record, instead of getting a readable string, we get `"Record: [object Promise]"`. This broke after a recent migration where the formatter module was updated to be async.

Please fix the code so that `fetchAndFormat()` returns the correct formatted string. The relevant files are:
- `src/data-service.js` — Data fetching and formatting service
- `src/formatter.js` — Record formatting module (recently migrated to async)
- `test/data-service.test.js` — Tests to verify

Run `node test/data-service.test.js` to see the failing tests, then fix the code so all tests pass.
