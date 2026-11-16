# Fix the Grade Pipeline

Our grade processing pipeline is crashing. When we run the tests, we get errors:

- `TypeError: Reduce of empty array with no initial value` when processing an empty grade list
- `NaN` values appearing in stats when grades have missing scores

Please fix the code so all tests pass. The relevant files are:

- `src/grade-pipeline.js` — The grade processing code (this is where the bugs are)
- `test/test-grades.js` — Tests to verify the fixes

Run `node test/test-grades.js` to see the failing tests, then fix the code.

**Do NOT modify the test file (test/test-grades.js).**
