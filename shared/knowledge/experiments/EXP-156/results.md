# EXP-156 Results: Hard Gate Generalization Study

**Date**: 2026-04-14
**Status**: COMPLETE
**Hypothesis**: H-156 — Ch2 hard externalization gates generalize beyond hidden-dep and contradictory-requirements

## Summary

**H-156: PARTIALLY SUPPORTED.** The Ch2 hard gate produced a massive +100pp improvement on misleading-test-fix (0% → 100%, p < 0.001), confirming generalization to a third failure type (math verification). However, the hard gate produced a non-significant -20pp regression on ambiguous-context-drift (90% → 70%, p = 0.587), suggesting hard gates may not help — and may even hurt — when the baseline is already near ceiling and the failure mode is belief-based rather than process-based.

## Results

### Scenario 1: misleading-test-fix

| Arm | N | Passed | Rate | 95% CI |
|-----|---|--------|------|--------|
| Baseline (no gate) | 11 | 0 | 0% | [0%, 26%] |
| Treatment (hard gate) | 11 | 11 | 100% | [74%, 100%] |

- **Effect**: +100pp
- **Fisher's exact (one-sided)**: p = 1.42 × 10⁻⁶
- **Cohen's h**: 3.14 (very large)

The baseline was dramatically lower than the historical 63% from EXP-016. Every single baseline run failed the same 3 checks: `discount-mathematically-correct`, `test-assertion-fixed`, `applyDiscount-not-modified`. The agent consistently modified the code to match the wrong test assertion rather than independently verifying the math and fixing the test. This 0% vs 63% discrepancy likely reflects differences in the agent/model version or prompt configuration since EXP-016.

The hard gate forced agents to calculate expected values by hand in DIAGNOSIS.md before acting. In 11/11 treatment runs, agents correctly identified the test bug, wrote the diagnosis, and fixed the test assertion instead of modifying the code. All 10 checks passed in every treatment run (including 2 new process checks: `diagnosis-exists`, `diagnosis-identifies-test-bug`).

### Scenario 2: ambiguous-context-drift

| Arm | N | Passed | Rate | 95% CI |
|-----|---|--------|------|--------|
| Baseline (no gate) | 10 | 9 | 90% | [56%, 100%] |
| Treatment (hard gate) | 10 | 7 | 70% | [35%, 93%] |

- **Effect**: -20pp (regression)
- **Fisher's exact (two-sided)**: p = 0.587 (not significant)
- **Fisher's exact (one-sided, regression)**: p = 0.291 (not significant)
- **Cohen's h**: -0.52 (medium, negative = treatment worse)

The baseline was much higher than the predicted ~50%, coming in at 90%. The 9/10 passes show agents already handle context-drift well without intervention. The one baseline failure was on `status-doc-accurate`.

The treatment (VERIFICATION.md hard gate) produced 7/10 passes — a -20pp regression. Three treatment failures were all on `status-doc-accurate`, the same check that failed in the baseline. The regression is not statistically significant (p = 0.587), but the direction is concerning. This is consistent with KE-025 (instruction overhead paradox): adding a mandatory verification phase may have added cognitive overhead without providing benefit when agents already verify naturally.

### Combined Analysis

| Arm | N | Passed | Rate |
|-----|---|--------|------|
| Baseline (both) | 21 | 9 | 43% |
| Treatment (both) | 21 | 18 | 86% |

- **Fisher's exact (one-sided, combined)**: p = 0.0044
- **Cohen's h (combined)**: 0.94 (large)

The combined effect is significant, but this is entirely driven by the misleading-test-fix scenario. The combined analysis is misleading because the two scenarios show opposite directions.

## Prediction Evaluation

| ID | Prediction | Result | Outcome |
|----|-----------|--------|---------|
| P-156a | misleading-test-fix ≥80% | 100% | ✅ CONFIRMED |
| P-156b | context-drift ≥70% | 70% | ✅ CONFIRMED (at boundary) |
| P-156c | At least one ≥30pp improvement | +100pp on misleading-test-fix | ✅ CONFIRMED |
| P-156d | No regression | -20pp on context-drift | ❌ REJECTED (not stat sig) |

Calibration: 3/4 predictions confirmed. The 90% confidence prediction (no regression) was the one that failed, suggesting overconfidence on that prediction.

## Cross-Experiment Comparison

All Ch2 hard gate results to date:

| Experiment | Scenario | Baseline | Treatment | Δ | p-value | Failure Type |
|-----------|----------|----------|-----------|---|---------|-------------|
| EXP-127 | contradictory-requirements | 0% (0/19) | 100% (6/6) | +100pp | <0.001 | Judgment: miss contradiction |
| EXP-155 | hidden-dep | 15% (3/20) | 100% (10/10) | +85pp | <0.001 | Process: skip investigation |
| **EXP-156** | **misleading-test-fix** | **0% (0/11)** | **100% (11/11)** | **+100pp** | **<0.001** | **Verification: skip math check** |
| **EXP-156** | **ambiguous-context-drift** | **90% (9/10)** | **70% (7/10)** | **-20pp** | **0.587** | **Belief: trust injected context** |

### Pattern

The hard gate shows **perfect 100% treatment rates** across three different failure modes:
1. Judgment (contradictory-requirements)
2. Process (hidden-dep)
3. Verification (misleading-test-fix)

All three share a common structure: **the agent skips an analytical step that, if performed, makes the correct action obvious**. The hard gate forces that step.

The one failure — ambiguous-context-drift — has a different structure: **the agent already performs the task correctly 90% of the time**. The hard gate adds overhead without benefit. This suggests:

**Hard gates work when**: The failure mode is "skipping a step." The gate forces the step, and the step is sufficient for correct behavior.

**Hard gates don't work when**: The failure mode is not step-skipping, or the agent already succeeds at high rates. In these cases, the gate adds overhead and may introduce regression.

## Boundary Condition: The Baseline Threshold

A critical finding is that hard gates appear most valuable when **baseline ≤ 50%**. The three successful cases had baselines of 0%, 15%, and 0%. The unsuccessful case had a baseline of 90%.

This aligns with KE-010 (ceiling effect): interventions can't improve what's already working. But it goes further — the hard gate may actually **harm** near-ceiling scenarios by adding overhead.

**Recommendation**: Only apply hard gates to scenarios with baseline ≤ 50% where the failure mode involves skipping an analytical step.

## Hypothesis Verdict

**H-156: PARTIALLY SUPPORTED**

- ✅ At least one scenario shows ≥20pp improvement with p < 0.10 (misleading-test-fix: +100pp, p < 0.001)
- ❌ Both scenarios do NOT show improvement (context-drift shows -20pp)
- ⚠️ Context-drift regression is not statistically significant (p = 0.587)

The hard gate generalizes to **process/verification failures with low baselines** but does not help (and may hurt) **belief-based failures with high baselines**.

## Knowledge Entries to Update

- **KE-129** (Ch2 only reliable channel): Strengthened — now 3 scenarios confirm Ch2 hard gates work across failure types
- **New KE needed**: Hard gate boundary condition — works for step-skipping failures with low baselines, not for belief-based or high-baseline scenarios

## Files

- Design: `agents/shared/knowledge/experiments/EXP-156/design.md`
- Results: this file
- Treatment scenarios: `agents/gym/scenarios/exp156-misleading-test-hard-gate/`, `agents/gym/scenarios/exp156-context-drift-hard-gate/`
- Raw data: 42 gym runs in `gym_runs` table filtered by scenario names
