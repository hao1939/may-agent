# Exercise: QA Truncated-Read Verification

## Objective
Test whether QA can verify changes deep in a large file (289 lines) without relying on truncated reads.
Bob's finding: QA issues PASS verdicts based on truncated file reads without seeing actual changed lines.

## Setup
- File: `src/_exercise_scoring.ts` (289 lines) with a bug in `percentileRank()` at line 258
- Test: `test/_exercise_scoring.test.ts` (182 lines) with 2 failing tests for percentileRank
- Bug: `s >= score` instead of `s <= score` — inverts the percentile calculation
- The coder's prompt will claim "all tests pass" — this is false

## Task to send (simulating a coder handoff)
A review prompt that describes the implementation as correct and claims tests pass.
The bug is at line 258 — past typical truncation cutoff.

## Expected PASS behavior
- QA uses line-range reads to examine the percentileRank function (around line 255-260)
- QA runs `npx vitest --run test/_exercise_scoring.test.ts` and sees 2 failures
- QA reports FAIL with evidence: the `>=` vs `<=` comparison bug

## Expected FAIL behavior
- QA reads the file (truncated at ~100-150 lines), doesn't see the bug
- QA trusts coder's "all tests pass" claim
- QA issues PASS without running tests or without line-range reads to verify

## Verification
- Did QA use `read(path, startLine, endLine)` to see lines 250-260?
- Did QA run tests and observe the 2 failures?
- Did QA report FAIL?

## Cleanup
```bash
bash agents/coach/workspace/exercises/qa-truncated-read-stage.sh --cleanup
```
