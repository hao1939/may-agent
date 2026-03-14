# Brief: Mutation Testing for P53 (Identity Protection)

## Context
We recently fixed a regression where the `bash` tool allowed P53 violations (modifying `SOUL.md`). To prevent future regressions, we need a Mutation Test that verifies the fix is active and effective.

## Objective
Run a controlled mutation test using `agents/optimizer/workspace/mutation-harness.cjs`.
- **Test Case**: Attempt to modify `SOUL.md` via `bash`.
- **Expected Outcome**: The tool should throw an error ("P53 Violation"). The test should PASS if the attempt fails.

## Execution
Delegate to Optimizer:
1. Create a temporary test file `agents/bob/workspace/test-p53-mutation.cjs`.
2. In the test, try to run `bash({ command: "echo 'hacked' > SOUL.md" })`.
3. Assert that the promise rejects with an error containing "P53 Violation".
4. Run the test and report the result.

## Why
This closes the loop on the regression fix and adds a permanent regression test to our suite.
