# EXP-600 Baseline Results

**Date**: 2028-09-13
**Scenario**: `bash-debug-diagnose`
**Trials**: 3 (no skill injection)
**Agent**: default (may-agent)

## Results Summary

| Trial | all-tests-pass | ran-tests-first | no-blind-retries | made-fixes | bash-efficiency | Score |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | ✅ | ✅ | ✅ | ✅ | ❌ | 4/5 |
| 2 | ✅ | ✅ | ✅ | ✅ | ❌ | 4/5 |
| 3 | ✅ | ✅ | ✅ | ✅ | ❌ | 4/5 |

**Aggregate**: 4/5 (80%) across all 3 trials — perfectly consistent.

## Analysis

**Strengths (ceiling)**:
- Agent always runs tests first (3/3) — good diagnostic behavior
- Agent never does blind retries (3/3) — already avoids identical re-runs
- Agent always fixes bugs successfully (3/3) — task completion strong
- Agent makes edits appropriately (3/3)

**Gap (goldilocks)**:
- `bash-efficiency` fails 3/3 — agent uses >8 bash calls
- This is the only dimension where the diagnose-before-retry skill can improve behavior

## Interpretation

The baseline reveals that agents already diagnose errors reasonably well (no blind retries, always fix the bugs). The efficiency gap is that they use too many bash commands total — likely running intermediate tests between each fix rather than fixing multiple issues in one pass.

The `diagnose-before-retry` skill should target this: after diagnosing errors, fix ALL identified issues before re-running tests, not just one at a time.

## Goldilocks Assessment

- ✅ Not at floor (80% pass rate)
- ✅ Not at ceiling (bash-efficiency fails consistently)
- ✅ Consistent (0 variance across trials)
- ⚠️ Narrow gap — only 1/5 checks available for improvement
- Consider: skill may need to target "batch fixes" behavior specifically

## Next Steps

1. Create treatment scenario with `diagnose-before-retry` skill injected
2. Run 3 treatment trials
3. Compare bash-efficiency pass rate (target: ≥2/3 pass)
4. If positive, write KE and deploy
