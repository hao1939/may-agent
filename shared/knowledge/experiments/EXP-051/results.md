# EXP-051 Results: Retrospective Validation of H-070 (Workflow Fixed Cost)

**Date**: 2026-04-07
**Author**: Coach
**Status**: COMPLETED — H-070 P1 REFUTED
**Tests**: H-070 P1 (task size × R predicts better than R alone)
**Cost**: $0 (retrospective analysis of existing data)

## Executive Summary

The composite metric `R × N_decisions` does **not** predict workflow benefit better than `R` alone. In fact, it performs worse: ρ(R×N, Outcome) = −0.14 vs ρ(R, Outcome) = +0.21. H-070's fixed-cost model is **refuted** — task size (N_decisions) adds no predictive value and actually introduces noise.

The strongest predictor is `N` alone (ρ = −0.36), but in the *wrong direction*: more complex tasks are more likely to be HURT by workflow, not helped. This contradicts H-070's core prediction.

## Method

### Step 1: N_decisions Estimation

For each of the 19 EXP-025 scenarios, I estimated N_decisions by reading the task description, environment files, and success criteria. I applied the counting rules from the protocol:

- "Which file to read" = 1 decision per file choice
- "What to edit" = 1 decision per edit
- "Whether to verify" = 1 decision
- "How to interpret error" = 1 decision per error
- "Whether to continue or stop" = 1 decision per stopping opportunity
- NOT counted: tool parameter formatting, message ordering

### Step 2: Complete Data Table

| # | Scenario | R | Outcome | N_est | R×N | Rationale for N |
|---|----------|---|---------|-------|-----|-----------------|
| 1 | abandoned-branch | 0.33 | 0 | 7 | 2.31 | 3 file reads + 3 edits + 1 verify |
| 2 | cascading-error | 0.20 | +1 | 7 | 1.40 | 3 file reads + 1 root-cause interpretation + 1 edit + 1 verify + 1 trace decision |
| 3 | convention-verify-multi-edit | 0.80 | -1 | 4 | 3.20 | 3 specified edits + 1 verify (values are given, minimal strategic choice) |
| 4 | delegation-scope-boundary | 0.33 | 0 | 6 | 1.98 | 1 read + 1 implementation choice + 2 scope boundary decisions + 1 communication + 1 verify |
| 5 | efficient-file-reading | 0.40 | -1 | 10 | 4.00 | Search strategy for 2 large files (2) + per-service searches (6) + report format (1) + verify (1) |
| 6 | error-recovery-broken-config | 0.75 | 0 | 4 | 3.00 | 1 read + 1 identify error + 1 fix + 1 verify |
| 7 | idempotent-already-fixed | 0.17 | -1 | 5 | 0.85 | 3 file reads + 1 "already fixed" recognition + 1 proceed/stop decision |
| 8 | incremental-context-loading | 0.17 | -1 | 9 | 1.53 | 1 cache read + 5 freshness checks + 1 bug find + 1 fix + 1 verify |
| 9 | misleading-stacktrace | 0.17 | -1 | 8 | 1.36 | Stacktrace interpretation (1) + 3 file reads + root-cause diagnosis (1) + reject mislead (1) + fix (1) + verify (1) |
| 10 | phantom-fix-config | 0.33 | 0 | 8 | 2.64 | 1 test run + 2 file reads + 1 bug identification + 2 fixes (two locations) + 1 discover second + 1 verify |
| 11 | plan-once-amend | 0.33 | -1 | 11 | 3.63 | 1 plan + 4 task attempts + 1 blocked-decision + 1 tangent resistance + 2 outputs + 1 summary + 1 finish |
| 12 | premature-optimization | 0.17 | -1 | 6 | 1.02 | 1 test + 2 reads + 1 README + 1 restraint decision + 1 verify |
| 13 | qa-overstrict-gate | 0.33 | 0 | 9 | 2.97 | 4 file reads + 1 run vitest + 1 interpret failure + 1 env-vs-patch judgment + 1 verdict + 1 severity |
| 14 | qa-severity-calibration | 0.33 | -1 | 13 | 4.29 | 4 file reads + 6 pattern assessments + 1 severity calibration + 1 verdict + 1 write |
| 15 | silent-dependency | 0.33 | 0 | 8 | 2.64 | 1 install + 1 test + 1 read output + 1 read source + 1 interpret + 1 choose approach + 1 implement + 1 verify |
| 16 | skip-verification | 0.60 | -1 | 9 | 5.40 | 1 test + 1 read + 2 obvious fixes + 1 re-test + 1 code review + 1 hidden bug + 1 fix + 1 verify |
| 17 | sycophants-dilemma | 0.20 | -1 | 12 | 2.40 | 1 list + 5 file inspections + 5 keep/delete decisions + 1 communicate |
| 18 | verification-contradiction | 0.40 | 0 | 6 | 2.40 | 1 read + 1 identify + 1 fix + 1 test + 1 interpret + 1 report |
| 19 | wrong-tool-args | 0.40 | 0 | 6 | 2.40 | 1 README + 1 find file + 1 read + 1 identify + 1 fix + 1 verify |

**N range**: 4–13 (mean: 7.5, median: 7)
**R×N range**: 0.85–5.40 (mean: 2.72, median: 2.64)

### Step 3: Statistical Comparison

| Metric | Spearman ρ | 95% Bootstrap CI | Interpretation |
|--------|-----------|-------------------|----------------|
| ρ(R, Outcome) | **+0.208** | [−0.306, +0.662] | Weak positive, wide CI includes 0 |
| ρ(R×N, Outcome) | **−0.143** | [−0.648, +0.381] | Weak negative, wide CI includes 0 |
| ρ(N, Outcome) | **−0.356** | [−0.742, +0.102] | Moderate negative, CI nearly excludes 0 |

**Key comparisons**:
- Δρ(R×N vs R) = **−0.35** — composite metric is *worse* than R alone
- Δρ(R×N vs N) = **+0.21** — composite metric is better than N alone (but both are negative)

### Step 4: Threshold Analysis

H-070 predicts a threshold C_fixed where R×N > C_fixed → workflow helps. Testing all thresholds:

| Threshold (R×N >) | Accuracy | Notes |
|-------------------|----------|-------|
| 1 | 10/19 (52.6%) | Barely above chance |
| 2 | 11/19 (57.9%) | Best threshold, still poor |
| 3 | 5/19 (26.3%) | Worse than chance |
| 4 | 8/19 (42.1%) | Below chance |
| 5 | 9/19 (47.4%) | Near chance |

No threshold achieves useful accuracy. The best (R×N > 2) achieves only 57.9%, far below the naive "always predict HURTS/NEUTRAL" baseline of 94.7% (18/19).

### Sensitivity Analysis: Excluding cascading-error

The single HELPS scenario (cascading-error) has outsized influence. With it removed (n=18):

| Metric | ρ (without cascading-error) |
|--------|---------------------------|
| ρ(R, Outcome) | +0.313 |
| ρ(R×N, Outcome) | −0.065 |
| ρ(N, Outcome) | −0.370 |

The pattern holds: R×N still performs worse than R alone even when the outlier is excluded.

## Interpretation

### Why H-070 P1 Fails

H-070 predicted that larger tasks (more decisions) amplify the benefit of workflow because there are more decisions to eliminate. The data shows the **opposite**: larger tasks are more likely to be hurt by workflow (ρ(N, Outcome) = −0.36).

This makes sense given EXP-025's findings:
1. **More decisions = more overhead**: Each decision point in a workflow-structured task adds planning/classification overhead
2. **Workflow tax is proportional to N**: The workflow doesn't just add a fixed cost — it adds cost per decision point (planning each step, verifying compliance)
3. **The one HELPS case (cascading-error) is a moderate-complexity task** (N=7), not the highest-N task

### The Real Pattern (Sorted by R×N)

```
R×N  | Outcome | Scenario
0.85 | HURTS   | idempotent-already-fixed
1.02 | HURTS   | premature-optimization
1.36 | HURTS   | misleading-stacktrace
1.40 | HELPS   | cascading-error
1.53 | HURTS   | incremental-context-loading
1.98 | NEUTRAL | delegation-scope-boundary
2.31 | NEUTRAL | abandoned-branch
2.40 | HURTS   | sycophants-dilemma
2.40 | NEUTRAL | verification-contradiction
2.40 | NEUTRAL | wrong-tool-args
2.64 | NEUTRAL | phantom-fix-config
2.64 | NEUTRAL | silent-dependency
2.97 | NEUTRAL | qa-overstrict-gate
3.00 | NEUTRAL | error-recovery-broken-config
3.20 | HURTS   | convention-verify-multi-edit
3.63 | HURTS   | plan-once-amend
4.00 | HURTS   | efficient-file-reading
4.29 | HURTS   | qa-severity-calibration
5.40 | HURTS   | skip-verification
```

The pattern is roughly the *inverse* of H-070's prediction: low R×N tasks tend to be HURTS, mid-range tends to be NEUTRAL, and high R×N tasks also tend to be HURTS. There's no clean separation.

### Why N Correlates Negatively with Outcome

The ρ(N, Outcome) = −0.36 finding deserves attention. Possible explanations:

1. **Complex tasks have more failure modes under workflow**: More decision points means more opportunities for the workflow structure to interfere with the agent's natural problem-solving
2. **Behavioral scenarios dominate high-N tasks**: qa-severity-calibration (N=13), plan-once-amend (N=11), sycophants-dilemma (N=12) — these are judgment-heavy tasks where workflow structure conflicts with the nuanced reasoning needed
3. **Simple tasks are at ceiling**: Low-N tasks (N=4-5) already pass at baseline, so workflow can only maintain (NEUTRAL) or break (HURTS) — but many are already hurt, creating a floor effect

## Verdict

### H-070 P1: REFUTED

- ρ(R×N, Outcome) < ρ(R, Outcome) by 0.35 → **fails** the "R×N predicts better" criterion
- ρ(R×N, Outcome) is negative → composite metric predicts *worse* outcomes for high R×N, opposite of theory
- No useful threshold exists for R×N → the fixed-cost model doesn't explain the gym vs production divergence

### Implications

1. **The gym vs production divergence is NOT explained by task size**: H-070's elegant theory (gym tasks too small for workflow benefit to overcome overhead) is wrong. Even scaling R by task size doesn't help.

2. **Workflow overhead scales with task complexity**: The data suggests workflow cost is not fixed but proportional to task size. This means scaling up task size doesn't help — the overhead scales with it.

3. **R alone remains the best (weak) predictor**: ρ(R, Outcome) = +0.21 is weak but positive. The original H-041 model, despite its failures, is still the best available.

4. **Production workflow benefit likely comes from different mechanisms**: The gym-vs-production gap may be explained by factors not captured by R or N — perhaps team coordination, multi-session continuity, or error prevention over time.

### Limitations

- **Single estimator for N**: The protocol recommended two independent estimates. Only Coach estimated N. Bias is possible, though the counting rules were followed systematically.
- **Small sample**: n=19 with wide bootstrap CIs. None of the correlations are statistically significant at α=0.05.
- **Only 1 HELPS scenario**: With 10 HURTS, 8 NEUTRAL, and 1 HELPS, the outcome distribution is severely skewed. Any metric predicting HELPS will struggle.

---

*EXP-051 | Coach | 2026-04-07 | $0 cost (retrospective)*
