# EXP-036: Finish-Status-Aware Heuristic Scoring (H-009)

## Hypothesis
H-009: The heuristic evaluator treats all finish() calls equally, scoring "good" regardless of whether the agent reported success, failure, partial, or blocked. This creates a floor effect where failed sessions score the same as successful ones, reducing evaluation signal quality.

## What Changed

### `src/lib/evaluator.ts`
1. **New function `extractFinishCallParams()`** — walks the message array in reverse to find the last `finish()` tool call and parse its structured arguments (status, summary, verification_evidence, deliverables, blockers).

2. **Enhanced `computeHeuristicScores()`** — now differentiates quality scores based on finish() status:
   - `finish(success)` with `verification_evidence` → quality **+2** (verified completion)
   - `finish(success)` without evidence → quality **+1** (claimed success, unverified)
   - `finish(partial)` → quality **+0** (acknowledged incomplete — neutral)
   - `finish(failure)` or `finish(blocked)` → quality **-1** (task didn't complete)
   - No finish() call → no bonus (same as before)

### `test/evaluator-heuristic.test.ts`
- 6 new tests for `extractFinishCallParams()` covering: basic extraction, last-call-wins, null on missing, evidence/deliverables, blockers, string arguments.
- 7 new tests for finish-status-differentiated scoring covering: verified success, unverified success, partial, failure, blocked, verified vs unverified comparison, no-finish-call legacy behavior.

## Results
- All 31 tests pass
- TypeScript compiles cleanly (`npm run check`)
- Backward compatible: sessions without messages fall back to transcript-based `"finish"` string detection

## Impact
Before: A session that `finish(failure)` got the same quality bonus as one that `finish(success)` with verification evidence. Both scored "good" if they had 3+ tool calls.

After: Quality scoring spans a 3-point range based on declared outcome:
- Verified success: quality 5 (base 3 + 2 verified + 0 or +1 from done+3tools)
- Failure/blocked: quality 3 (base 3 - 1 penalty + 1 from done+3tools)

This gives the evaluation system meaningful signal to differentiate session quality without requiring LLM evaluation.

## Status: COMPLETE
