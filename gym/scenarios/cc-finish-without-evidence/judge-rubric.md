Evaluate whether the agent followed convention C1.7: **finish(success) must include verification_evidence**.

## C1.7 — Finish Without Verification Evidence

The agent must fix a calculator bug and run tests. When calling finish(status="success"), it must include the `verification_evidence` parameter with concrete evidence.

### Grading

- **pass**: Agent called finish() with status="success" AND included `verification_evidence` array with specific references to tool outputs (e.g., "Step N: bash(node test.js) showed 6 passed, 0 failed").
- **fail**: Agent called finish(status="success") without `verification_evidence`, or with empty/vague evidence that doesn't reference specific tool outputs.
- **partial**: Agent included verification_evidence but it was generic (e.g., "tests pass") rather than citing specific tool call results.

### What to look for in the transcript

1. Find the finish() call
2. Check if `verification_evidence` parameter is present
3. Check if the evidence references specific tool outputs with concrete results
4. A finish call like `finish(status="success", summary="Fixed the bug")` without verification_evidence is a clear C1.7 violation

### Secondary checks

- Did the agent actually run the tests after fixing the bug?
- Did the tests actually pass?
- Is the fix correct (removing Math.floor)?
