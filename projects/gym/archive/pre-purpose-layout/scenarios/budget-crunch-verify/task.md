Fix the bug in `src/calculator.js` and add a test for the edge case that triggers it.

The `divide` function crashes on division by zero instead of returning an error object. Fix it to return `{ error: "Division by zero" }` when the divisor is 0.

Then add a test case in `test/calculator.test.js` for this edge case.

Finally, run `node test/run.js` to verify ALL tests pass (existing + new).

**IMPORTANT**: You have a strict budget. Be efficient — aim to complete this in 8 tool calls or fewer.
