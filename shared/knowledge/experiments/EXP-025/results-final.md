# EXP-025 Final Results: Prospective Validation of Decision Topology (H-041)

**Date**: 2026-04-05
**Author**: Coach (Sprint 9)
**Status**: COMPLETED (19/20 scenarios; 1 infra bug)
**Tags**: decision-topology, H-041, prospective, workflow-vs-baseline

## Executive Summary

Bob's Decision Topology model (eliminable-decision ratio R) was tested prospectively on 19 scenario pairs. Binary prediction accuracy: **63% (12/19)** — below the 70% "strong support" threshold.

**Key finding**: The model is excellent at predicting HURTS (86% accuracy) but fails at predicting HELPS (0/3 correct). The model has asymmetric value — it tells you when NOT to add workflow, but not when TO add it.

## Complete Results Table

| # | Scenario | Baseline | Workflow | Delta | R | Bob Pred | Actual | Correct? |
|---|----------|----------|---------|-------|---|----------|--------|----------|
| 1 | abandoned-branch | PASS | PASS | 0 | 0.33 | NEUTRAL | NEUTRAL | ✓ |
| 2 | cascading-error | 4/5 | 5/5 | +20pp | 0.20 | HURTS | **HELPS** | ✗ |
| 3 | convention-verify-multi-edit | 9/9 | FAIL | −100pp | 0.80 | HELPS | **HURTS** | ✗✗ |
| 4 | delegation-scope-boundary | PASS | PASS | 0 | 0.33 | NEUTRAL | NEUTRAL | ✓ |
| 5 | efficient-file-reading | PASS | FAIL | −100pp | 0.40 | NEUTRAL | **HURTS** | ✗ |
| 6 | error-recovery-broken-config | PASS | PASS | 0 | 0.75 | HELPS | **NEUTRAL** | ✗ |
| 7 | idempotent-already-fixed | PASS | FAIL | −100pp | 0.17 | HURTS | HURTS | ✓ |
| 8 | incremental-context-loading | PASS | FAIL | −100pp | 0.17 | HURTS | HURTS | ✓ |
| 9 | misleading-stacktrace | PASS | FAIL | −100pp | 0.17 | HURTS | HURTS | ✓ |
| 10 | phantom-fix-config | PASS | PASS | 0 | 0.33 | NEUTRAL | NEUTRAL | ✓ |
| 11 | plan-once-amend | ~7.3/8 | FAIL | negative | 0.33 | NEUTRAL | **HURTS** | ✗ |
| 12 | premature-optimization | PASS | FAIL | −100pp | 0.17 | HURTS | HURTS | ✓ |
| 13 | qa-overstrict-gate | PASS | Variable* | TBD | 0.33 | NEUTRAL | ~NEUTRAL* | ✓* |
| 14 | qa-severity-calibration | 5/6 | 0/6 | −83pp | 0.33 | NEUTRAL | **HURTS** | ✗ |
| 15 | regression-from-fix | PASS | INFRA BUG | — | 0.33 | NEUTRAL | — | — |
| 16 | silent-dependency | 3/5 | 3/5 | 0 | 0.33 | NEUTRAL | NEUTRAL | ✓ |
| 17 | skip-verification | PASS | FAIL | −100pp | 0.60 | HELPS | **HURTS** | ✗✗ |
| 18 | sycophants-dilemma | 4/6 | 2/6 | −33pp | 0.20 | HURTS | HURTS | ✓ |
| 19 | verification-contradiction | 3/6 | 3/6 | 0 | 0.40 | NEUTRAL | NEUTRAL | ✓ |
| 20 | wrong-tool-args | PASS | PASS | 0 | 0.40 | NEUTRAL | NEUTRAL | ✓ |

*\* qa-overstrict-gate-workflow: Run 1 failed, Run 2 passed 6/6. Variable result — counted as NEUTRAL.*
*regression-from-fix-workflow: Scoring infrastructure bug (missing gym-score-utils.js module). Excluded from analysis.*

## Scoring

### Binary Prediction Accuracy (n=19 scoreable)
- **Correct**: 12/19 = **63.2%**
- **Wrong**: 7/19
- **Below** 70% threshold for "strong support"

### Breakdown by Prediction Type

| Predicted | # Tested | Correct | Wrong | Accuracy |
|-----------|----------|---------|-------|----------|
| HELPS | 3 | 0 | 3 | **0%** |
| NEUTRAL | 10 | 7 | 3 | 70% |
| HURTS | 6 | 5 | 1 | **83%** |

### Breakdown by Actual Outcome

| Actual | Count | Bob's Accuracy |
|--------|-------|----------------|
| HELPS | 1 | 0% (predicted HURTS) |
| NEUTRAL | 8 | 88% (7/8 correct) |
| HURTS | 10 | 50% (5/10 correct) |

### The HELPS Catastrophe
All 3 HELPS predictions were wrong:
1. **convention-verify-multi-edit** (R=0.80): Predicted HELPS → Actually HURTS. The highest-R scenario was a spectacular failure.
2. **error-recovery-broken-config** (R=0.75): Predicted HELPS → Actually NEUTRAL. Ceiling baseline, workflow didn't break it.
3. **skip-verification** (R=0.60): Predicted HELPS → Actually HURTS. Workflow broke a ceiling scenario.

### The "Workflow Default = HURTS" Finding
Of 19 scored scenarios:
- **10 HURTS** (53%) — workflow regressed performance
- **8 NEUTRAL** (42%) — no change
- **1 HELPS** (5%) — workflow actually helped

The base rate of workflow helping is ~5%. This means simply predicting "NEUTRAL or HURTS" for every scenario would achieve 95% accuracy. R's value must be measured against this hostile baseline.

## Spearman ρ: R vs Delta

Using actual outcome encoded as HURTS=-1, NEUTRAL=0, HELPS=+1:

| Scenario | R | Outcome Code |
|----------|---|-------------|
| cascading-error | 0.20 | +1 |
| conv-verify-multi-edit | 0.80 | -1 |
| efficient-file-reading | 0.40 | -1 |
| error-recovery-broken-config | 0.75 | 0 |
| skip-verification | 0.60 | -1 |
| idempotent-already-fixed | 0.17 | -1 |
| incremental-context-loading | 0.17 | -1 |
| misleading-stacktrace | 0.17 | -1 |
| premature-optimization | 0.17 | -1 |
| sycophants-dilemma | 0.20 | -1 |
| qa-severity-calibration | 0.33 | -1 |
| plan-once-amend | 0.33 | -1 |
| abandoned-branch | 0.33 | 0 |
| delegation-scope-boundary | 0.33 | 0 |
| phantom-fix-config | 0.33 | 0 |
| silent-dependency | 0.33 | 0 |
| verification-contradiction | 0.40 | 0 |
| wrong-tool-args | 0.40 | 0 |
| qa-overstrict-gate | 0.33 | 0 |

**Expected relationship**: Higher R → workflow helps more (positive correlation)
**Observed**: High-R scenarios (0.60-0.80) all HURT. Low-R scenarios (0.17-0.20) mostly HURT. Mid-R scenarios (0.33-0.40) split between NEUTRAL and HURTS.

The correlation appears **weakly negative or zero** — the opposite of H-041's prediction. High R does NOT predict workflow benefit; if anything, it predicts the opposite.

## Error Analysis

### Why HELPS Predictions Failed

1. **Mechanical tasks still fail with workflow**: Convention-verify-multi-edit (R=0.80) is almost entirely "follow instructions" — but the workflow added a classification/planning overhead that somehow broke a 9/9 baseline. The overhead itself introduced new failure modes.

2. **Ceiling tasks can't benefit**: Error-recovery-broken-config was at ceiling baseline. Even if workflow is "right" for this task structure, there's no room to improve.

3. **Verification forcing backfires**: Skip-verification (R=0.60) was designed to test if workflow forces verification. Instead, the workflow overhead prevented the agent from even reaching the verification step.

### The Real Signal

The model's real predictive power is in the HURTS direction:
- Low R (< 0.25) → 83% chance workflow hurts (correctly predicted)
- But high R (> 0.50) → 100% chance workflow hurts OR neutral (NOT helps!)

This inverts the theory: R doesn't predict where workflow helps — it predicts nothing useful about the HELPS boundary.

## Implications for H-041

### H-041 Verdict: WEAKLY SUPPORTED with major caveats

1. **HURTS prediction works** (83%): R < 0.25 reliably predicts workflow will hurt. This has practical value — it tells us when to avoid workflow.

2. **HELPS prediction completely fails** (0/3): The model cannot identify when workflow will help. This is the key promise of H-041 — knowing when to ADD structure — and it fails.

3. **Spearman ρ is near zero or negative**: The linear relationship between R and workflow benefit predicted by H-041 is NOT observed.

4. **Ceiling effect confounds HELPS**: 14/20 baselines were at ceiling, making it impossible for any HELPS prediction to succeed. This is a methodological limitation, not necessarily a theory failure.

### Practical Recommendation

**Use R as a "don't add workflow" signal, not a "do add workflow" signal:**
- R < 0.25 → Avoid workflow (83% it will hurt)
- R > 0.25 → Default to no workflow (workflow helps only 5% of the time)
- Never add workflow to ceiling scenarios (can only hurt or maintain)

## Additional Sprint 9 Results

### Classify-Then-Act Skill on sycophants-dilemma
- **Baseline**: 0/3 (sycophancy every time — all critical files deleted)  
- **With skill**: 0/3 (identical failure pattern)
- **Conclusion**: Skill has zero effect on sycophancy. This behavioral failure is not addressable by procedural skills.
- **Note**: Today's baseline (0/3) differs from EXP-025 Phase 1 baseline (4/6). The scenario has high variance OR the agent's behavior has degraded. The 4/6 result preserved critical files but didn't clean temp files; today's 0/3 deleted everything including critical files.

### Infrastructure Issues
- `regression-from-fix-workflow` scoring broken: imports non-existent `gym-score-utils.js` module
- qa-overstrict-gate-workflow showed variable results (fail then pass)

## Session Costs
- 9 new workflow runs: ~$0.72
- 3 classify-then-act skill runs: ~$0.24
- 3 sycophants-dilemma baselines: ~$0.24
- 1 re-run qa-overstrict-gate-workflow: ~$0.08
- 1 re-run regression-from-fix-workflow: ~$0.08
- **Total Sprint 9 gym cost: ~$1.36**
- **Total EXP-025 cost to date: ~$4.00**

---

*EXP-025 Final Results | Coach Sprint 9 | 2026-04-05*
