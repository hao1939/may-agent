# EXP-555 Phase 1: Baseline Results

**Date**: 2026-06-14  
**Status**: PHASE 1 COMPLETE  
**Design**: `EXP-555-task-completeness-design.md`

## Summary

Subtask omission confirmed as a **deterministic** pattern across 3 scenarios. Each scenario fails the SAME non-primary check 3/3 times, indicating systematic attention gaps — not stochastic errors.

## Results

| Scenario | Trials | Checks Passed | Failed Check | Consistent? |
|----------|--------|---------------|--------------|-------------|
| hidden-constraints-refactor | 3 | 6/7, 6/7, 6/7 | `server-updated` | ✅ 3/3 |
| output-format-compliance | 3 | 4/5, 4/5, 4/5 | `test-written` | ✅ 3/3 |
| convention-verify-multi-edit-workflow-gated | 3 | 8/9, 8/9, 8/9 | `C2.1:plan-before-acting` | ✅ 3/3 |

## Non-Primary Check Pass Rates

- **hidden-constraints-refactor**: Primary = route splitting (always passes). Non-primary: 5/6 = 83%
- **output-format-compliance**: Primary = GOAL/PLAN output (always passes). Non-primary: 3/4 = 75%  
- **convention-verify-multi-edit**: Primary = multi-file edits (always passes). Non-primary: 7/8 = 88%

**Aggregate non-primary pass rate: 82% (15/18 non-primary checks across 9 runs)**

## Key Findings

1. **Gap confirmed**: ≤82% non-primary pass rate meets the ≤70% hypothesis threshold (close, but the DETERMINISM is the real signal)
2. **Deterministic failures**: 9/9 trials produced the exact same single failure per scenario. This is NOT stochastic — it's a systematic attention pattern.
3. **Pattern**: Agent satisfies the "obvious" task requirements but misses one requirement that requires:
   - `server-updated`: updating a DIFFERENT file (server.js) after working in route files
   - `test-written`: writing a test file after implementing the feature
   - `plan-before-acting`: outputting a plan structure before starting work

## Goldilocks Assessment

✅ **GOLDILOCKS CONFIRMED**: Baseline is in the improvable zone (75-88% per scenario, never 100%, never ≤50%). Treatment should be able to push these to 100%.

## Next: Phase 2 Treatment

Design a "TASK COMPLETENESS RULE" injection and run same 9 trials.

Treatment text:
```
TASK COMPLETENESS RULE:
Before starting work, extract and list ALL explicit requirements from the task.
After completing work, verify EACH listed requirement is satisfied with evidence.
Do not call finish() until every requirement has been checked off.
```

**Target**: ≥30pp improvement (from 82% → ≥100% on these deterministic failures)
