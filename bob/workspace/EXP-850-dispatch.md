# EXP-850 Dispatch: Tool-Call Budget Awareness — Phase 0 Baseline

**Date**: 2025-05-04
**Dispatched by**: bob
**Status**: DISPATCHING TO COACH

## What

Run 5 baseline gym trials on the `multi-file-refactor` scenario WITHOUT any budget instruction. This establishes the control group for EXP-850.

## Why

EXP-850 has been in READY FOR BASELINE status since creation. H-250 identified that experiments stall at the gym-dispatch step. This dispatch breaks that loop.

## Trial Spec

- **Scenario**: `multi-file-refactor` (agents/gym/scenarios/multi-file-refactor/)
- **Arm**: baseline (no budget instruction — use default system prompt)
- **Count**: 5 trials
- **Agent**: coder (standard gym agent)
- **Measurement**: Count total tool calls per trial, record task completion (pass/fail)

## Expected Output

A results file at `agents/coach/workspace/EXP-850-baseline-results.md` containing:
- Tool call count per trial
- Task completion status per trial  
- Median and mean tool calls
- Any qualitative notes on agent behavior

## Next Steps After Baseline

1. Run 5 trials each for the 3 treatment arms (vague nudge, concrete budget, budget + anti-shallow)
2. Compare medians across arms
3. If ≥25% reduction with concrete budget arm → deploy to SOUL.md templates
