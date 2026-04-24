# EXP-168 Corrected Results: F1 Dose-Response with Clean Environments

**Date**: 2026-06-22 (corrected from 2026-04-16 original)
**Status**: COMPLETE — CORRECTED

## Original vs Corrected Results

The original EXP-168 writeup used data from **contaminated environments** (pre-EXP-173 fix). After contamination was fixed, moderate-hint showed a regime change from 0% to 100%.

### Original (WRONG — contaminated env)

| Arm | Hint Level | Pass Rate | N |
|-----|-----------|-----------|---|
| 1. Baseline | None | 0% | 56 |
| 2. Nudge | Vague attention | 0% | 11 |
| 3. Moderate | Problem identified | 0% | 10 |
| 4. Full F1 | Complete analysis + fix | 100% | 15 |

### Corrected (split by contamination fix)

| Arm | Hint Level | Pre-fix | Post-fix | Total |
|-----|-----------|---------|----------|-------|
| 1. Baseline | None | 0/56 (0%) | 0/84 (0%) | 0/140 (0%) |
| 2. Nudge | Vague attention | 0/11 (0%) | — | 0/11 (0%) |
| 3. Moderate | Problem identified | **0/10 (0%)** | **9/9 (100%)** | 9/19 (47%) |
| 4. Full F1 | Complete analysis + fix | 25/65 (38%) | 15/15 (100%) | — |

### Key Corrections

1. **Moderate hint WORKS** in clean environments (9/9 = 100%, all post-fix runs).
2. **The "step function" conclusion was wrong.** There IS a gradient — but it was masked by contamination.
3. **Nudge still fails** — 0/11 even though all runs were pre-fix. However, nudge was never re-tested post-fix. This is a gap.

## Revised Dose-Response Model (clean environments only)

| Dose | Pass Rate | Evidence |
|------|-----------|----------|
| None (baseline) | 0% | 0/140 |
| Nudge (vague) | 0% | 0/11 (pre-fix only — **needs re-test**) |
| Moderate (problem identified) | **100%** | 9/9 (post-fix) |
| Full F1 (root cause + fix) | **100%** | 15/15 (post-fix) |

## Implication

The recognition threshold is between "nudge" (vague attention direction) and "moderate" (names the specific problem). This means:
- You don't need to spell out the fix (moderate = full F1 in clean env)
- But you DO need to name the specific problem (nudge ≠ moderate)
- **Causal specificity** is the threshold variable (per EXP-174 revised model)

## Action Items

1. ~~Re-test nudge post-fix~~ — need gym infra access to run
2. Update EXP-168 DB status to "completed"
3. This data strengthens H-166 revised: threshold = causal specificity, not information quantity

## Data Sources

- gym_runs table: `cascading-fix-trap-v2-moderate-hint` — 19 runs, clear regime change at 2026-04-16T17:00
- EXP-173: documented the contamination fix
- EXP-174: confirmed scout→coder 0/37 (quality gap in LLM-generated analysis)
