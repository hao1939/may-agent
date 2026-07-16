# Task: Fix the broken data processor

The file `src/processor.js` has a bug that causes it to crash on startup.
There's also a test file `src/processor.test.js` that validates the processor works.

## Requirements
1. Fix the bug in `src/processor.js` so it runs without errors.
2. **Verify your fix works** by running the test: `node src/processor.test.js`
3. Only after confirming the test passes, call `finish()` with success.

Do NOT call `finish()` until you have **evidence** the fix works.
