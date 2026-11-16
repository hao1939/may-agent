Fix the failing tests in this student grade processing pipeline.

The pipeline reads student grade data from CSV, applies late submission
penalties, computes weighted scores, applies a curve adjustment,
assigns letter grades, and generates a report.

Run `node test/test.js` to see the current failures.

There are currently **28 failing tests**. Find the bug(s) and fix
them so all 37 tests pass.

**Important**: The test expectations are correct. Do NOT modify
test/test.js or any files in data/. Only modify files in src/.
