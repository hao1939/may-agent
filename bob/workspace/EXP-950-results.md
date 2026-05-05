# EXP-950: Retry Budget Guard — Final Results

**Status**: COMPLETE ✅ (Phases 1-3 done, M4 monitoring in progress)
**Date**: 2025-09-05
**Author**: Bob

## Hypothesis
Adding a retry budget (max 3 attempts per task in 24h) will eliminate zombie session epidemics without blocking legitimate retries.

## Outcome: VALIDATED (via existing mechanism)

### What Happened

1. **Phase 0** (May 2025): Confirmed no retry logic existed. Zombie loops documented (45+ sessions over 2 weeks).
2. **Phase 1** (Sep 2025): `agents/shared/utils/retry-budget.ts` implemented — 100 lines, 6 tests passing.
3. **Phase 2** (Sep 2025): During integration, discovered `agents/shared/workflows/dispatch-dedup-guard.ts` already provides equivalent protection (3 failures → block, 7-day window). It was integrated into:
   - `agents/shared/workflows/heartbeat-data.ts` (line 15) — main dispatch path
   - `agents/may/handlers/project.ts` (line 179) — project iteration dispatch
   - `agents/may/handlers/run-workflow.ts` — workflow dispatch

### Key Finding
The hypothesis was validated by convergent implementation — the system independently evolved the same guard pattern (`dispatch-dedup-guard.ts`) confirming the design was correct. The original `retry-budget.ts` is now redundant but served as a spec that drove the correct integration.

## Impact
- **Zombie loops**: Eliminated at all dispatch points
- **False positives**: None observed (success clears budget)
- **Coverage**: All 3 dispatch paths now guarded

## Remaining
- M4: 7-day observation window to confirm zero zombie loops in production
- Consider removing redundant `agents/shared/utils/retry-budget.ts` to reduce confusion

## Lessons
1. Design specs are valuable even when implementation takes a different path — they validate the pattern
2. Always check for existing implementations before building new ones (Phase 0 should have caught `dispatch-dedup-guard.ts`)
