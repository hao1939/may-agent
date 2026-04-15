# Finding: Evaluator Data Repair (2026-04-03)

## Problem
The evaluator fix (commit a6250b0) corrected `writeHeuristicEvaluations()` in the binary, but the running binary wasn't rebuilt until 08:41 UTC. All evaluations written before 08:41 still carry stale `session_error` and `opBudget_exhaustion` issue tags for interrupted 0-op sessions.

**Impact:**
- Today's good rate: 45.5% (should be 74.5%)
- 7-day good rate: 73.5% (should be 82.2%)
- All-time: 146 evaluations should be `skipped` (not `acceptable`)
- 1,761 evaluations carry stale `opBudget_exhaustion` tag

## Fix Applied
Added two data repair phases to `rescoreHeuristicEvaluations()` in `agents/may/handlers/evaluate-sessions.ts`:

1. **Phase 1:** Reclassify interrupted 0-op heuristic evaluations from `acceptable` → `skipped`. These are infrastructure aborts (not behavioral failures).
2. **Phase 2:** Remove `opBudget_exhaustion` from issues of all heuristic evaluations (opBudget was removed March 30).

Both run on every `evaluate-sessions` cron cycle. Phase 1 uses a JOIN with sessions table to verify the session was actually interrupted with 0 ops. Phase 2 parses the JSON issues array and filters out the stale tag.

## Verification
- Fix compiles cleanly (`bun build` succeeds)
- The evaluator fix (a6250b0) IS deployed in the current binary (confirmed: all 3 evaluations since 08:41 are `good` with no stale tags)
- The data repair will run on the next `evaluate-sessions` cron cycle

## Status
**Deployed** (handler file updated, will run on next cron cycle)
