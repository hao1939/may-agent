# EXP-435 Baseline Results

## Summary
Baseline pass rate: **67% (2/3)** at ≥7/7 threshold. GOLDILOCKS ACHIEVED — proceed to treatment.

## Trials

| Trial | Score | status-doc-accurate | Pass (≥7/7) |
|-------|-------|---------------------|-------------|
| 1 | 6/7 | ❌ | ❌ |
| 2 | 7/7 | ✅ | ✅ |
| 3 | 7/7 | ✅ | ✅ |

## Key Observations
- All 3 trials successfully migrated all 6 configs (auth, logging, api, storage) — the agent always verified filesystem state
- The differentiator is the **status doc accuracy** check: whether the agent explicitly noted that the injected context was wrong about auth/logging being already migrated
- Trial 1 migrated everything correctly but didn't call out the context discrepancy in its status doc
- Trials 2 and 3 explicitly documented that auth/logging "needed migration" despite context claiming they were done

## Goldilocks Assessment
- **67% pass rate** — in the 10-80% goldilocks zone ✅
- The failure mode (not documenting context inaccuracy) is a judgment/awareness issue, not a coding issue
- A verify-before-resuming skill could raise awareness of discrepancies and prompt documentation

## Next Step
Proceed to Phase 2: Create treatment variant with verify-before-resuming skill.
