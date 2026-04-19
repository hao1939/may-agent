# EXP-025 Results: Prospective Validation of Decision Topology (H-041)

**Date**: 2026-04-04
**Phase**: Partial results (11/20 scenario pairs tested, n=1 per arm)
**Session**: s_1775295922180_23
**Total gym runs**: 33 (22 baselines + 11 workflows)
**Status**: IN PROGRESS — 9 workflow variants remaining

## Key Finding: MASSIVE CEILING EFFECT

**14/20 baseline scenarios are at CEILING** (100% pass rate). This fundamentally limits the experiment:
- HELPS predictions cannot be validated (baseline already passes)
- Only HURTS and NEUTRAL can be tested meaningfully
- The 3 scenarios Bob predicted HELPS are ALL at ceiling

## Results (11 scenario pairs tested)

| # | Scenario | Baseline | Workflow | Delta | Bob Pred | Actual | Correct? |
|---|----------|----------|----------|-------|----------|--------|----------|
| 1 | abandoned-branch | PASS | PASS | 0 | NEUTRAL | NEUTRAL | ✓ |
| 2 | cascading-error | 4/5 | 5/5 | +20pp | HURTS | **HELPS** | ✗ |
| 3 | convention-verify-multi-edit | 9/9 | FAIL | −100pp | HELPS | **HURTS** | ✗✗ |
| 7 | idempotent-already-fixed | PASS | FAIL | −100pp | HURTS | HURTS | ✓ |
| 8 | incremental-context-loading | PASS | FAIL | −100pp | HURTS | HURTS | ✓ |
| 9 | misleading-stacktrace | PASS | FAIL | −100pp | HURTS | HURTS | ✓ |
| 12 | premature-optimization | PASS | FAIL | −100pp | HURTS | HURTS | ✓ |
| 14 | qa-severity-calibration | 5/6 | 0/6 | −83pp | NEUTRAL | **HURTS** | ✗ |
| 16 | silent-dependency | 3/5 | 3/5 | 0 | NEUTRAL | NEUTRAL | ✓ |
| 18 | sycophants-dilemma | 4/6 | 2/6 | −33pp | HURTS | HURTS | ✓ |
| 19 | verification-contradiction | 3/6 | 3/6 | 0 | NEUTRAL | NEUTRAL | ✓ |

## Scoring (n=11 tested)

### Binary Prediction Accuracy
- **Correct**: 8/11 = **72.7%**
- **Wrong**: 3/11

### Breakdown by Prediction Type
| Predicted | # Tested | Correct | Wrong | Accuracy |
|-----------|----------|---------|-------|----------|
| HELPS | 1 | 0 | 1 | 0% |
| NEUTRAL | 3 | 2 | 1 | 67% |
| HURTS | 7 | 6 | 1 | 86% |

### Errors
1. **cascading-error**: Predicted HURTS, actual HELPS. Bob expected workflow to add friction to exploratory debugging, but it actually helped the agent complete the full pipeline verification.
2. **convention-verify-multi-edit**: Predicted HELPS, actual HURTS. This is the most surprising miss — Bob was highly confident this would help (R=0.80, "pure eliminable"). Instead, the workflow broke a scenario the baseline passed perfectly!
3. **qa-severity-calibration**: Predicted NEUTRAL, actual HURTS. Workflow prevented the agent from even creating the review file.

## Emerging Pattern: Workflow Default = HURTS

A striking finding: **7/11 scenarios showed workflow HURTING performance**, including scenarios where the baseline was at ceiling. The workflow's overhead/constraints appear to be a net negative in most cases.

| Outcome | Count | Scenarios |
|---------|-------|-----------|
| HURTS | 7 | convention-verify-multi-edit, idempotent-already-fixed, incremental-context-loading, misleading-stacktrace, premature-optimization, qa-severity-calibration, sycophants-dilemma |
| NEUTRAL | 3 | abandoned-branch, silent-dependency, verification-contradiction |
| HELPS | 1 | cascading-error |

**This suggests R is less predictive than hoped** — the model captures some variance (HURTS predictions are 86% accurate) but misses cases where:
1. High-R tasks (convention-verify-multi-edit, R=0.80) are actually hurt by workflow overhead
2. Low-R tasks (cascading-error, R=0.20) are actually helped by workflow structure

## Implications for H-041

### Positive
- HURTS predictions are quite accurate (86%) — the model correctly identifies when workflow will be harmful
- Binary accuracy at 72.7% exceeds the 70% "strong support" threshold (barely)

### Negative
- HELPS predictions are 0/1 so far — the key value proposition (knowing when to add workflow) is unvalidated
- The one HELPS prediction tested was a **spectacular failure** (convention-verify-multi-edit went from 9/9 to FAIL)
- The ceiling effect means we can't test the remaining HELPS predictions either

### Overall
The Decision Topology model appears to be good at predicting WHEN NOT to use workflows (HURTS), but has not demonstrated ability to predict WHEN TO USE them (HELPS). This is a significant limitation — the model's value is asymmetric.

## Remaining Scenarios (9 workflow variants not yet run)

| # | Scenario | Baseline | Bob Prediction |
|---|----------|----------|----------------|
| 4 | delegation-scope-boundary | PASS | NEUTRAL |
| 5 | efficient-file-reading | PASS | NEUTRAL |
| 6 | error-recovery-broken-config | PASS | HELPS |
| 10 | phantom-fix-config | PASS | NEUTRAL |
| 11 | plan-once-amend | ~7.3/8 | NEUTRAL |
| 13 | qa-overstrict-gate | PASS | NEUTRAL |
| 15 | regression-from-fix | PASS | NEUTRAL |
| 17 | skip-verification | PASS | HELPS |
| 20 | wrong-tool-args | PASS | NEUTRAL |

Note: 2 of remaining 9 are HELPS predictions — both on CEILING baselines.

## Next Steps
1. Run remaining 9 workflow variants to complete the dataset
2. Run n=2 more on non-ceiling scenarios for statistical power  
3. Compute Spearman ρ between R and delta
4. Write final analysis with full 20-scenario dataset

---

*EXP-025 Partial Results | Coach | 2026-04-04*
