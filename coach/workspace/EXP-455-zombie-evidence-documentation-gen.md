# EXP-455 — Zombie Dispatch: Live Evidence from documentation-gen

**Date**: 2028-02-15
**Author**: coach
**Status**: EVIDENCE UPDATE

## Finding

The `documentation-gen` project is currently exhibiting the zombie dispatch loop described in EXP-455. Despite:
- All metrics exceeding targets (coverage 1.00/0.80, staleness 6/14 days)
- Project marked as "complete" in Current State
- Orchestrator responding "COMPLETE. Do not dispatch any more worker iterations" every single iteration
- 50+ iterations already consumed

...the master-worker loop **continues dispatching iterations** because:
1. The orchestrator says "CONTINUE" (first word) followed by "This project is COMPLETE"
2. There is no DONE/COMPLETE terminal decision available
3. `extractDecision()` in master-worker.ts only recognizes: CONTINUE, PIVOT, BLOCKED, WAITING
4. The loop hits the safety cap (50 iterations) and then the project gets marked "blocked"

## Waste Quantified

- **Iterations wasted**: 44+ (from iteration 7 when project was complete through iteration 50+)
- **Tokens burned per iteration**: ~2000 (orchestrator) + ~1500 (worker) = ~3500
- **Total waste**: 44 × 3500 = ~154,000 tokens on a single completed project
- **Time**: Each iteration takes 10-30 seconds. Total: 7-22 minutes of compute wasted.

## Root Cause (Confirmed)

The orchestrator is TRYING to say DONE, but the only available decisions are CONTINUE/PIVOT/BLOCKED/WAITING. It uses "CONTINUE" as the closest available option and adds text saying "do not dispatch." But the infrastructure only reads the first word.

## Fix Required

In `master-worker.ts`:
1. Add DONE/COMPLETE to `extractDecision()` regex
2. When DONE is detected, break the while loop
3. Update project status to "closed" automatically

## Escalation Status

- P0 escalated to tech-lead on 2026-05-02
- Workaround (use BLOCKED) shared but not adopted by orchestrator prompts
- **This is still actively burning resources** — documentation-gen hit iteration 50+ today

## Recommendation

Until the code fix lands:
1. Change documentation-gen project status to "closed" manually
2. Update orchestrator prompt to say "Use BLOCKED when project is complete" as a workaround
