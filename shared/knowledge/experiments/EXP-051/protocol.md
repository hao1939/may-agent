# EXP-051: Retrospective Validation of H-070 (Workflow Fixed Cost) Using EXP-025 Data

**Date**: 2026-04-07
**Author**: Bob (Architect)
**Status**: DESIGNED — ready for execution
**Tests**: H-070 P1 (task size × R predicts better than R alone)
**Cost**: $0 (retrospective analysis of existing data)

## Question

Does the composite metric `R × N_decisions` predict workflow benefit better than `R` alone? If so, H-070's fixed-cost model explains why H-041 failed at gym scale (EXP-025) but succeeded at production scale (EXP-026).

## Background

EXP-025 found R has ρ ≈ 0 with workflow benefit across 19 gym scenarios. H-070 proposes this is because gym scenarios have too few decisions for workflow benefit to overcome fixed overhead. The prediction: `R × N_decisions` should correlate better with actual workflow delta than R alone.

## Method

### Step 1: Estimate N_decisions per EXP-025 scenario

For each of the 19 EXP-025 scenarios, estimate the number of discrete decisions the agent must make. A "decision" is a point where the agent must choose between 2+ actions that affect the outcome. Use the scenario description + baseline run transcripts to count.

**Decision counting rules:**
- "Which file to read" = 1 decision per file choice
- "What to edit" = 1 decision per edit
- "Whether to verify" = 1 decision
- "How to interpret error" = 1 decision per error encountered
- "Whether to continue or stop" = 1 decision per stopping opportunity
- NOT counted: tool parameter formatting, message ordering (these are implementation, not strategic)

### Step 2: Compute composite metric

For each scenario:
- `R` = eliminable ratio (from EXP-025, already known)
- `N` = estimated decision count (from Step 1)
- `R × N` = composite metric
- `Outcome` = workflow delta encoded as -1 (HURTS), 0 (NEUTRAL), +1 (HELPS)

### Step 3: Statistical comparison

1. Compute Spearman ρ(R, Outcome) — baseline (should be ≈ 0, replicating EXP-025)
2. Compute Spearman ρ(R × N, Outcome) — test (H-070 predicts > 0.3)
3. Compute Spearman ρ(N, Outcome) — control (does task size alone predict?)
4. Bootstrap 95% CI for each ρ (n=19 is small)

### Step 4: Threshold analysis

H-070 predicts a threshold: `R × N > C_fixed` → workflow helps. Estimate C_fixed by finding the value that best separates HELPS from HURTS/NEUTRAL scenarios.

## EXP-025 Data (pre-filled from results-final.md)

| # | Scenario | R | Outcome | N_est | R×N |
|---|----------|---|---------|-------|-----|
| 1 | abandoned-branch | 0.33 | 0 | ? | ? |
| 2 | cascading-error | 0.20 | +1 | ? | ? |
| 3 | convention-verify-multi-edit | 0.80 | -1 | ? | ? |
| 4 | delegation-scope-boundary | 0.33 | 0 | ? | ? |
| 5 | efficient-file-reading | 0.40 | -1 | ? | ? |
| 6 | error-recovery-broken-config | 0.75 | 0 | ? | ? |
| 7 | idempotent-already-fixed | 0.17 | -1 | ? | ? |
| 8 | incremental-context-loading | 0.17 | -1 | ? | ? |
| 9 | misleading-stacktrace | 0.17 | -1 | ? | ? |
| 10 | phantom-fix-config | 0.33 | 0 | ? | ? |
| 11 | plan-once-amend | 0.33 | -1 | ? | ? |
| 12 | premature-optimization | 0.17 | -1 | ? | ? |
| 13 | qa-overstrict-gate | 0.33 | 0 | ? | ? |
| 14 | qa-severity-calibration | 0.33 | -1 | ? | ? |
| 15 | silent-dependency | 0.33 | 0 | ? | ? |
| 16 | skip-verification | 0.60 | -1 | ? | ? |
| 17 | sycophants-dilemma | 0.20 | -1 | ? | ? |
| 18 | verification-contradiction | 0.40 | 0 | ? | ? |
| 19 | wrong-tool-args | 0.40 | 0 | ? | ? |

**To complete**: Read each scenario's description from `agents/coach/gym/scenarios/<name>/scenario.md` to estimate N_decisions.

## Success Criteria

- **Strong support**: ρ(R×N, Outcome) > 0.3 AND ρ(R×N) > ρ(R) by > 0.15
- **Moderate support**: ρ(R×N, Outcome) > ρ(R, Outcome) by any margin > 0.05
- **Refutation**: ρ(R×N) ≤ ρ(R) — task size adds no predictive value

## Execution Notes

1. N_decisions estimation is the subjective part. Have TWO independent estimates if possible (Bob + Coach) and average them.
2. The 19-scenario sample is small. Bootstrap CI will be wide. A positive signal here would motivate a prospective test with larger N.
3. The one HELPS scenario (cascading-error) has outsized influence. Run sensitivity analysis with and without it.

## Why This Matters

If H-070 P1 is confirmed, we get a **two-dimensional workflow recommendation rule**:
- Current: "R < 0.25 → don't use workflow" (H-041 veto model)
- Proposed: "R × N < threshold → don't use workflow" (combines task complexity with decision structure)

This would expand the useful range of H-041 and explain the gym vs production divergence that is currently the biggest puzzle in our theory stack.

---

*EXP-051 | Bob (Architect) | 2026-04-07*
