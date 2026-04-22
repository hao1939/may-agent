# EXP-201: Results

**Status**: COMPLETE
**Date**: 2025-06-22
**Scenario**: cascading-fix-trap-v2-exp200-remask (10 trials)

## Summary

Verification remasking (H-185) applied to cascading-fix-trap-v2 produced **0/10 passes (0%)**, a regression from the EXP-195 baseline of 1/10 (10%). The remask intervention did not help agents discover the pipeline-order bug; all 10 trials failed on exactly `pipeline-order-fixed`.

## Per-Trial Results

| Trial | Result | Failed Checks | Duration |
|-------|--------|---------------|----------|
| 1 | ❌ FAIL | pipeline-order-fixed | 207ms |
| 2 | ❌ FAIL | pipeline-order-fixed | 208ms |
| 3 | ❌ FAIL | pipeline-order-fixed | 210ms |
| 4 | ❌ FAIL | pipeline-order-fixed | 209ms |
| 5 | ❌ FAIL | pipeline-order-fixed | 211ms |
| 6 | ❌ FAIL | pipeline-order-fixed | 222ms |
| 7 | ❌ FAIL | pipeline-order-fixed | 204ms |
| 8 | ❌ FAIL | pipeline-order-fixed | 212ms |
| 9 | ❌ FAIL | pipeline-order-fixed | 208ms |
| 10 | ❌ FAIL | pipeline-order-fixed | 211ms |

**Pass rate: 0/10 (0%)** — 95% CI: 0–30.8% (Wilson)

## Baseline Comparison

| Experiment | Intervention | N | Pass Rate | Δ vs Baseline |
|------------|-------------|---|-----------|---------------|
| EXP-195 Arm A (baseline) | None | 10 | 1/10 (10%) | — |
| **EXP-201** | **Verification remask** | **10** | **0/10 (0%)** | **-10pp** |

## Analysis

The remask intervention targets verification gravity wells (FM-3.3) — agents re-checking the same work with contaminated assumptions. However, on cascading-fix-trap-v2, the failure mode is **discovery blindness** (H-181: relational bug blindness), not verification loops. The agent never discovers the pipeline-order bug in the first place, so resetting verification context provides no benefit.

All trials passed every other check (all-tests-pass, grade-threshold-fixed, test-not-modified, data-not-modified, policy-not-modified, no-hardcoded-values, penalties-not-hacked) — the sole blocker remains pipeline-order-fixed.

## Conclusion

**FALSIFIED** for this scenario. Verification remasking does not address the cascading-fix-trap-v2 failure mode. The bottleneck is bug discovery (H-181), not verification quality (H-185/FM-3.3). H-185 may still apply to scenarios where verification loops are the dominant failure mode (e.g., compound-edit-verification), but it is not a general-purpose fix.

## Followups

- Test H-185 on compound-edit-verification where FM-3.3 is more clearly the dominant failure mode
- Continue H-181 relational-bug-recognition work (EXP-195 Arm B showed 40% with direct hint)
