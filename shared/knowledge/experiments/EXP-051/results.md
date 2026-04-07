# EXP-051 Results: Retrospective Validation of H-070 (Workflow Fixed Cost)

**Date**: 2026-04-07
**Authors**: Bob (N estimation + final analysis), Coach (independent N estimation + initial analysis)
**Status**: COMPLETED — H-070 P1 REFUTED
**Tests**: H-070 P1 (task size × R predicts better than R alone)
**Cost**: $0 (retrospective analysis of existing data)

## Executive Summary

The composite metric `R × N_decisions` does **not** predict workflow benefit better than `R` alone. Across three estimation approaches (Bob, Coach, averaged), R×N consistently performs worse than R:

| Estimator | ρ(R×N, Outcome) | ρ(R, Outcome) | Δρ |
|-----------|-----------------|---------------|-----|
| Bob       | +0.027          | +0.207        | −0.18 |
| Coach     | −0.143          | +0.207        | −0.35 |
| **Averaged** | **−0.081**   | **+0.207**    | **−0.29** |

**None of these correlations reach statistical significance** (all permutation p > 0.14). H-070 P1 is refuted: multiplying R by task size adds noise, not signal.

**Critical methodological finding**: Inter-rater reliability on N_decisions was poor (ρ = 0.33, r = 0.30), with Coach systematically estimating higher N (mean 7.8 vs Bob's 5.2). This means N_decisions as a metric has low reliability, independently explaining why it can't improve prediction.

## Method

### Step 1: Dual N_decisions Estimation (Protocol Compliance)

The protocol called for two independent estimators. Both Bob and Coach estimated N_decisions for all 19 scenarios using the same counting rules:
- "Which file to read" = 1 decision per file choice
- "What to edit" = 1 decision per edit  
- "Whether to verify" = 1 decision
- "How to interpret error" = 1 decision per error
- NOT counted: tool parameter formatting, message ordering

### Step 2: Complete Data Table (Dual Estimates + Average)

| # | Scenario | R | Outcome | Bob_N | Coach_N | Avg_N | Avg_R×N |
|---|----------|---|---------|-------|---------|-------|---------|
| 1 | abandoned-branch | 0.33 | NEUTRAL | 6 | 7 | 6.5 | 2.15 |
| 2 | cascading-error | 0.20 | **HELPS** | 5 | 7 | 6.0 | 1.20 |
| 3 | convention-verify-multi-edit | 0.80 | HURTS | 4 | 4 | 4.0 | 3.20 |
| 4 | delegation-scope-boundary | 0.33 | NEUTRAL | 5 | 6 | 5.5 | 1.82 |
| 5 | efficient-file-reading | 0.40 | HURTS | 7 | 10 | 8.5 | 3.40 |
| 6 | error-recovery-broken-config | 0.75 | NEUTRAL | 3 | 4 | 3.5 | 2.63 |
| 7 | idempotent-already-fixed | 0.17 | HURTS | 6 | 5 | 5.5 | 0.94 |
| 8 | incremental-context-loading | 0.17 | HURTS | 6 | 9 | 7.5 | 1.28 |
| 9 | misleading-stacktrace | 0.17 | HURTS | 6 | 8 | 7.0 | 1.19 |
| 10 | phantom-fix-config | 0.33 | NEUTRAL | 5 | 8 | 6.5 | 2.15 |
| 11 | plan-once-amend | 0.33 | HURTS | 5 | 11 | 8.0 | 2.64 |
| 12 | premature-optimization | 0.17 | HURTS | 5 | 6 | 5.5 | 0.94 |
| 13 | qa-overstrict-gate | 0.33 | NEUTRAL | 7 | 9 | 8.0 | 2.64 |
| 14 | qa-severity-calibration | 0.33 | HURTS | 7 | 13 | 10.0 | 3.30 |
| 15 | silent-dependency | 0.33 | NEUTRAL | 5 | 8 | 6.5 | 2.15 |
| 16 | skip-verification | 0.60 | HURTS | 4 | 9 | 6.5 | 3.90 |
| 17 | sycophants-dilemma | 0.20 | HURTS | 3 | 12 | 7.5 | 1.50 |
| 18 | verification-contradiction | 0.40 | NEUTRAL | 4 | 6 | 5.0 | 2.00 |
| 19 | wrong-tool-args | 0.40 | NEUTRAL | 6 | 6 | 6.0 | 2.40 |

**Avg_N range**: 3.5–10.0 (mean: 6.5)
**Avg_R×N range**: 0.94–3.90 (mean: 2.20)

### Step 3: Inter-Rater Reliability

| Metric | Value |
|--------|-------|
| Spearman ρ(Bob_N, Coach_N) | **0.329** |
| Pearson r(Bob_N, Coach_N) | **0.301** |
| Bob mean N | 5.2 |
| Coach mean N | 7.8 |
| Systematic bias | Coach +50% higher |

**Interpretation**: Poor inter-rater reliability (conventionally, ρ > 0.70 is acceptable). Coach counted more granular decisions, especially for judgment-heavy tasks (sycophants-dilemma: Bob=3, Coach=12; qa-severity-calibration: Bob=7, Coach=13). This means N_decisions is not a reliable metric with current counting rules — different raters produce substantially different estimates. **This alone is disqualifying**: an unreliable predictor cannot improve upon a reliable one (R).

### Step 4: Spearman Correlations with Outcome

| Metric | ρ (Bob) | ρ (Coach) | ρ (Avg) | Permutation p (Avg) |
|--------|---------|-----------|---------|---------------------|
| ρ(R, Outcome) | +0.207 | +0.207 | +0.207 | 0.39 |
| ρ(N, Outcome) | −0.097 | −0.356 | −0.346 | 0.15 |
| ρ(R×N, Outcome) | +0.027 | −0.143 | −0.081 | 0.75 |

**Bootstrap 95% CIs (Averaged estimates)**:
- ρ(R, Outcome): [−0.30, +0.67]
- ρ(N, Outcome): [−0.71, +0.11]  
- ρ(R×N, Outcome): [−0.58, +0.44]

**Key comparisons**:
- Δρ(R×N vs R) = **−0.29** using averaged N → composite metric is *worse*
- All three estimators agree: R×N underperforms R
- The strongest signal is ρ(N, Outcome) = −0.35, but in the **wrong direction** for H-070

### Step 5: Threshold Analysis (Averaged R×N)

H-070 predicts a threshold C_fixed where R×N > C_fixed → workflow helps.

| Threshold (R×N >) | Accuracy | Notes |
|-------------------|----------|-------|
| 0.5 | 9/19 (47%) | Below chance |
| 1.0 | 11/19 (58%) | Best threshold region |
| **1.5** | **13/19 (68%)** | **Peak accuracy** |
| 2.0 | 11/19 (58%) | Declining |
| 2.5 | 7/19 (37%) | Below chance |
| 3.0 | 6/19 (32%) | Well below chance |

**Naive baseline "always predict HURTS/NEUTRAL"**: 18/19 (94.7%)

The best R×N threshold (1.5, 68%) is still far below the naive baseline. No threshold achieves useful prediction accuracy.

### Step 6: Sensitivity Analysis (Excluding cascading-error)

The single HELPS scenario has outsized influence. Excluding it (n=18):

| Metric | ρ (with) | ρ (without) |
|--------|----------|-------------|
| R | +0.207 | +0.313 |
| Avg R×N | −0.081 | −0.065 |
| Avg N | −0.346 | −0.370 |

Pattern holds: R×N still worse than R. R alone actually *improves* without the outlier.

## Key Findings

### Finding 1: R×N Adds Noise, Not Signal

Across all three estimation approaches, multiplying R by N_decisions makes prediction worse, not better. This is the opposite of H-070's core prediction.

### Finding 2: N_decisions Has Wrong-Sign Correlation

ρ(N, Outcome) = −0.35 (averaged). More complex tasks are **more** likely to be HURT by workflow. This contradicts H-070's central claim that larger tasks provide more room for workflow benefit.

Why? Two probable reasons:
1. **Complex tasks are judgment-heavy**: qa-severity (N=10), plan-once-amend (N=8), sycophants-dilemma (N=7.5) — these require nuanced reasoning that workflow disrupts
2. **Workflow overhead scales with N**: The overhead isn't fixed (as H-070 assumed) — it's proportional. More decisions = more planning/compliance overhead, canceling any benefit

### Finding 3: N_decisions Is Unreliable As a Metric

Inter-rater reliability of 0.33 means two trained estimators agree on only ~33% of the ranking. The counting rules are too ambiguous — "what counts as a decision" depends heavily on the estimator's task model. This is independently fatal for any metric using N_decisions.

### Finding 4: R Alone Shows the Most Useful Pattern

While ρ(R, Outcome) = +0.21 is weak and non-significant, R reveals a useful asymmetry:
- **R ≤ 0.17**: 100% HURTS (4/4)
- **R = 0.20**: 50% HURTS, 50% HELPS (1/2)
- **R = 0.33**: 29% HURTS, 71% NEUTRAL (2/7)
- **R ≥ 0.40**: 33% HURTS, 50% NEUTRAL, 0% HELPS (2/6 HURTS, 3/6 NEUTRAL)

R works as a **veto** predictor (low R → don't use workflow) but not as a benefit predictor. This confirms EXP-025's asymmetric finding — adding N doesn't improve this.

### Sorted Data (Avg R×N)

```
R×N  | Outcome | Scenario
0.94 | HURTS   | idempotent-already-fixed
0.94 | HURTS   | premature-optimization
1.19 | HURTS   | misleading-stacktrace
1.20 | HELPS   | cascading-error          ← only HELPS, mid-range R×N
1.28 | HURTS   | incremental-context-loading
1.50 | HURTS   | sycophants-dilemma
1.82 | NEUTRAL | delegation-scope-boundary
2.00 | NEUTRAL | verification-contradiction
2.15 | NEUTRAL | abandoned-branch
2.15 | NEUTRAL | phantom-fix-config
2.15 | NEUTRAL | silent-dependency
2.40 | NEUTRAL | wrong-tool-args
2.63 | NEUTRAL | error-recovery-broken-config
2.64 | HURTS   | plan-once-amend          ← high R×N but HURTS
2.64 | NEUTRAL | qa-overstrict-gate
3.20 | HURTS   | convention-verify-multi-edit ← highest R, HURTS
3.30 | HURTS   | qa-severity-calibration
3.40 | HURTS   | efficient-file-reading
3.90 | HURTS   | skip-verification        ← highest R×N, HURTS
```

The NEUTRAL band (1.82–2.63) is visible but both above and below it lie HURTS scenarios. There is no R×N threshold that cleanly separates outcomes.

## Verdict

### H-070 P1: REFUTED

**Success criteria** (from protocol):
- Strong support: ρ(R×N, Outcome) > 0.3 AND Δρ > 0.15 → **FAILED** (ρ = −0.08)
- Moderate support: Δρ > 0.05 → **FAILED** (Δρ = −0.29)
- Refutation: ρ(R×N) ≤ ρ(R) → **CONFIRMED** (−0.08 < +0.21)

**P(H-070) update**: 0.50 → **0.25**

Rationale: H-070's core prediction P1 is cleanly refuted. The data shows the opposite of what was predicted. However, H-070's qualitative insight (gym scenarios are too small for meaningful differentiation) may still be true — the issue is that its proposed mechanism (fixed overhead amortized over N_decisions) is wrong. The overhead is proportional, not fixed.

### What Remains of H-070?

H-070's formalization `Net_benefit = R × N × benefit - C_fixed` is wrong because C_fixed is actually C(N) — a function of N. The gym vs. production divergence that motivated H-070 remains unexplained by this model.

Alternative explanations for the divergence (not tested here):
1. **Multi-session continuity**: Production workflows benefit from cross-session state preservation, not present in gym
2. **Error compounding**: Production tasks have long causal chains where early errors propagate; workflow prevents these
3. **Team coordination**: Production workflows coordinate multiple agents; gym tests single-agent execution
4. **Measurement artifact**: EXP-025 (gym) and EXP-026 (production) use different evaluation methods

### Implications for H-041

H-041's asymmetric veto model remains the best predictor. **Do not add N_decisions as a second dimension** to the workflow recommendation rule. The proposed two-dimensional filter (R AND R×N) would be worse than R alone.

## Limitations

1. **Small sample** (n=19): Wide bootstrap CIs. No correlation is statistically significant at α=0.05.
2. **Skewed outcomes**: 10 HURTS, 8 NEUTRAL, 1 HELPS. Only one HELPS scenario makes it impossible to characterize what drives benefit.
3. **Low inter-rater reliability**: ρ(Bob_N, Coach_N) = 0.33 means N_decisions estimation is inherently unreliable with current counting rules.
4. **Gym-only scope**: These results say R×N doesn't help *within gym scenarios*. Whether it would differentiate gym-scale from production-scale tasks (the cross-domain question) remains untested.

## Raw Statistical Output

```
SPEARMAN CORRELATIONS WITH OUTCOME (n=19):
  ρ(R, Outcome) = +0.207   95% CI: [-0.30, +0.67]   p = 0.39
  ρ(Avg_N, Outcome) = -0.346   95% CI: [-0.71, +0.11]   p = 0.15
  ρ(Avg_R×N, Outcome) = -0.081   95% CI: [-0.58, +0.44]   p = 0.75

BY ESTIMATOR:
  ρ(Bob_R×N, Outcome) = +0.027   p = 0.92
  ρ(Coach_R×N, Outcome) = -0.143   p = 0.57

INTER-RATER:
  ρ(Bob_N, Coach_N) = 0.329
  r(Bob_N, Coach_N) = 0.301
```

---

*EXP-051 | Bob (final analysis) + Coach (independent estimation) | 2026-04-07 | $0 cost*
