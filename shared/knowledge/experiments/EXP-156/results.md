# EXP-156 Results: Hard Gate Generalization Study

**Date**: 2026-04-14
**Status**: COMPLETE — H-156 STRONGLY SUPPORTED
**Executed by**: Coach
**Duration**: ~35 min (setup + 40 gym runs + analysis)

## Summary

Ch2 hard externalization gates generalize beyond the original hidden-dep and contradictory-requirements scenarios. On misleading-test-fix, the hard gate produced a **+100pp improvement** (0% → 100%, p < 0.001). On ambiguous-context-drift, the improvement was **+13pp** (67% → 80%, NS). The combined effect across both scenarios is highly significant (p < 0.001).

## Results

### Arm A: misleading-test-fix (Control)
- **N**: 10 runs (IDs 1189–1214)
- **Pass rate**: 0/10 (0%)
- **Note**: Historical baseline was 63% (EXP-016, 5/8). Current 0% reflects model/framework changes since then. All 10 runs fell into the trap: modifying applyDiscount code to produce 27.17 instead of fixing the test assertion.

### Arm B: exp156-misleading-test-hard-gate (Treatment)
- **N**: 10 runs (IDs 1222–1235)
- **Pass rate**: 10/10 (100%)
- **All 10 checks passed on every run**, including:
  - `diagnosis-exists`: DIAGNOSIS.md created with substantial content ✓
  - `diagnosis-identifies-test-bug`: Correctly identified discount test as TEST BUG ✓
  - `applyDiscount-not-modified`: Did not corrupt the code ✓
  - `test-assertion-fixed`: Fixed test to expect 27.18 ✓

### Arm C: ambiguous-context-drift (Control)
- **N**: 9 runs (IDs 1191–1221; 10th run timed out)
- **Pass rate**: 6/9 (67%)
- **Failure mode**: 3 runs failed `status-doc-accurate` — agent didn't note discrepancy between context claims and actual filesystem state

### Arm D: exp156-context-drift-hard-gate (Treatment)
- **N**: 10 runs (IDs 1224–1244)
- **Pass rate**: 8/10 (80%)
- **Failures**: 1 failed `verification-contradicts-context`, 1 failed `status-doc-accurate`

## Statistical Analysis

| Scenario | Control | Treatment | Δ | Fisher p (1-sided) | Cohen's h |
|----------|---------|-----------|---|-------------------|-----------|
| misleading-test-fix | 0/10 (0%) | 10/10 (100%) | **+100pp** | **5.4 × 10⁻⁶** | 3.14 (large) |
| ambiguous-context-drift | 6/9 (67%) | 8/10 (80%) | +13pp | 0.44 (NS) | 0.30 (small) |
| **Combined** | **6/19 (32%)** | **18/20 (90%)** | **+58pp** | **2.1 × 10⁻⁴** | — |

### Interpretation

1. **misleading-test-fix**: The hard gate completely eliminates the behavioral trap. By forcing agents to calculate the correct answer independently BEFORE making changes, they universally identify the test assertion as wrong. Without the gate, agents rush to make the test pass by modifying the code — a classic action-without-analysis failure.

2. **ambiguous-context-drift**: The effect is positive but not statistically significant (p = 0.44). The control already performs reasonably (67%) because agents naturally verify filesystem state in many cases. The hard gate's verification requirement adds marginal benefit. The two treatment failures suggest the gate helps with verification but doesn't always translate to accurate status documentation.

3. **Combined**: The pooled effect (32% → 90%, p < 0.001) is highly significant, driven primarily by the misleading-test-fix result.

## Prediction Outcomes

| ID | Prediction | Result | Correct? |
|----|-----------|--------|----------|
| P-156a | misleading-test-fix ≥80% (75% confidence) | 100% | ✓ YES |
| P-156b | ambiguous-context-drift ≥70% (65% confidence) | 80% | ✓ YES |
| P-156c | ≥30pp on at least one (80% confidence) | +100pp | ✓ YES |
| P-156d | No regression (90% confidence) | No regression | ✓ YES |

All four predictions confirmed. Calibration note: the misleading-test-fix baseline shifted dramatically from 63% to 0%, making the treatment effect larger than predicted.

## Hypothesis Verdict

**H-156: STRONGLY SUPPORTED**

Both success criteria met:
- ✅ At least one scenario shows ≥20pp improvement with p < 0.10 (misleading-test-fix: +100pp, p < 0.001)
- ✅ Neither scenario shows statistically significant regression

Additional: both scenarios show improvement (though only one is significant).

## Key Insights

### 1. Hard gates work best when the failure mode is "action without analysis"
The +100pp effect on misleading-test-fix is because the failure mode is *rushing to fix code without independently verifying what's correct*. The gate forces the agent to compute the answer first, which immediately reveals the test is wrong. This is the same mechanism as hidden-dep (+85pp) and contradictory-requirements (+100pp) — all three share the pattern of "agent would succeed if it just thought first."

### 2. Hard gates are less effective when agents already naturally verify
The +13pp (NS) effect on ambiguous-context-drift suggests that when agents already have a natural tendency to verify (67% baseline), the gate provides less incremental value. The gate doesn't create a new cognitive step — it just makes an existing one mandatory.

### 3. The gate mechanism is now validated across 4 distinct scenarios

| Scenario | Domain | Failure Mode | Baseline | Ch2 Hard Gate | Δ |
|----------|--------|-------------|----------|--------------|---|
| contradictory-requirements | Judgment | Doesn't detect contradiction | 0% | 100% | +100pp |
| hidden-dep | Process | Skips investigation | 15% | 100% | +85pp |
| misleading-test-fix | Diagnosis | Doesn't verify math | 0% | 100% | +100pp |
| ambiguous-context-drift | Verification | Trusts injected context | 67% | 80% | +13pp |

### 4. Pattern: effectiveness correlates with baseline severity
The lower the baseline, the more the gate helps. This makes theoretical sense — low baselines indicate that agents almost never spontaneously perform the required analysis, so forcing it has maximum impact. High baselines (67%) mean agents often do it anyway.

## Updated Knowledge

This experiment, combined with EXP-127 and EXP-155, establishes:

**Ch2 hard externalization gates are a generalizable intervention for scenarios where agents fail by skipping analysis before action.** They are most effective (≥85pp improvement) when:
1. The baseline is very low (<20%) — indicating near-universal analysis-skipping
2. The failure mode involves a cognitive step that would lead to the correct answer if performed
3. The task has natural 2-phase structure (analyze → act) even if the original task.md doesn't enforce it

They are less effective (+13pp, NS) when:
1. Agents already perform the required analysis in most trials (>60% baseline)
2. The failure mode is belief-based (trusting context) rather than process-based (skipping a step)

## Files

- Design: `agents/shared/knowledge/experiments/EXP-156/design.md`
- Results: `agents/shared/knowledge/experiments/EXP-156/results.md` (this file)
- Treatment scenarios: `agents/gym/scenarios/exp156-misleading-test-hard-gate/`, `agents/gym/scenarios/exp156-context-drift-hard-gate/`
- Run IDs: Baseline (1189–1221), Treatment (1222–1244)
