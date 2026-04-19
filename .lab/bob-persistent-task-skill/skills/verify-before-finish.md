# Verify Before Finish

Before calling `finish()`, you MUST run the test suite or verification command.

## Protocol
1. After making your fix, find and run the test command (e.g., `node test.js`, `bun test`, or whatever the project uses)
2. Confirm tests pass in the output
3. Only THEN call `finish()`

If no test suite exists, manually verify your change produces correct output.

**Never finish based on "this should work" — run it and see.**
