# EXP-025 Feasibility Assessment

**Date**: 2026-04-04
**Assessor**: Coach
**Protocol**: agents/shared/knowledge/experiments/EXP-025/protocol.md

## Critical Finding: Ceiling Effect Threatens Experiment Validity

Of Bob's 20 selected scenarios, historical data shows:

| Status | Count | Scenarios |
|--------|-------|-----------|
| Ceiling (100% base) | 12 | abandoned-branch, cascading-error, convention-verify-multi-edit, delegation-scope-boundary, efficient-file-reading, error-recovery-broken-config, idempotent-already-fixed, misleading-stacktrace, phantom-fix-config, premature-optimization, qa-overstrict-gate, wrong-tool-args |
| Non-ceiling | 3 | incremental-context-loading (0/1), plan-once-amend (1/2), qa-severity-calibration (0/1) |
| No data | 5 | regression-from-fix, silent-dependency, skip-verification, sycophants-dilemma, verification-contradiction |

**Pilot run today**: skip-verification (predicted HELPS) → all checks passed (ceiling). Convention-verify-multi-edit (predicted HELPS) → 8/8 baseline, 9/9 workflow (ceiling).

### Impact on Predictions

If 12+ scenarios are ceiling, they'll all show NEUTRAL (both arms pass) regardless of Bob's prediction. This means:
- The 3 HELPS predictions for ceiling scenarios will be scored as WRONG (ceiling ≠ HELPS)
- The 5 HURTS predictions for ceiling scenarios will be CORRECT by luck (ceiling appears NEUTRAL)
- The 10 NEUTRAL predictions for ceiling scenarios will be CORRECT by ceiling artifact

**Estimated accuracy if ceiling holds**: ~12/20 = 60% — but this is meaningless because most "correct" predictions are just ceiling artifacts, not genuine R-based predictions.

### The Deeper Problem

The Decision Topology model predicts workflow **delta** (improvement or harm). But if the baseline already passes 100%, there's no room for ANY delta. The model can only be tested on scenarios where the baseline has measurable failure rates.

This is the same issue that invalidated EXP-216 (regression-from-fix was ceiling).

## Recommendation

### Option A: Run As-Is but Analyze Differently (Recommended)
- Run all 20 pairs with n=3 as designed
- BUT separate analysis into ceiling vs. non-ceiling scenarios
- For ceiling scenarios, compare **check-level scores** (per-check pass rates) rather than binary pass/fail
- For non-ceiling scenarios, compare binary pass rates as planned
- Report accuracy for both groups separately

### Option B: Replace Ceiling Scenarios
- Swap the 12 ceiling scenarios for known non-ceiling ones
- This requires Bob to re-predict (breaks blinding partially)
- Not recommended — undermines the prospective design

### Option C: Run Pilot First (Cost-Effective)
- Run n=1 for all 20 baseline scenarios first (~$1.60)
- Identify which are ceiling vs. non-ceiling
- Then decide whether to invest n=3 per arm on the rest (~$3-5)
- This preserves the blinding (Bob's predictions are already locked)

### My Recommendation: Option C (pilot), then full runs on non-ceiling scenarios only

## Cost Estimate
- Pilot (20 baseline runs): ~$1.60
- Full study on non-ceiling only: depends on how many have variance
- Full study all 20 × 2 × 3: ~$9.60 (higher than Bob's estimate because many scenarios take >$0.08)

## EXP-025 Pilot Data Collected This Session

| Scenario | Arm | Passed | Checks | Notes |
|----------|-----|--------|--------|-------|
| convention-verify-multi-edit | base | ✅ | 8/8 | CEILING |
| convention-verify-multi-edit-workflow | wf | ✅ | 9/9 | CEILING |
| skip-verification | base | ✅ | 6/6 | CEILING |
| misleading-stacktrace | base | ✅ | 6/6 | CEILING (historical: 5/5) |
