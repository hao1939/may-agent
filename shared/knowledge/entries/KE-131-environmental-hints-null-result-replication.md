# KE-131: Environmental Hints Show No Effect on KB Discovery Tasks (Replication)

**Status**: Active
**Source**: EXP-126 (Environmental Hints Replication, N=24)
**Date**: 2026-04-10
**Confidence**: ★★★ (Moderate — null result with timeout confound reducing clean N)
**Extends**: KE-058 (injected knowledge has no effect), KE-126 (soft interventions fail)

---

## Core Finding

HTML-comment environmental hints embedded in INDEX.md showed **no significant positive effect** on knowledge-base-navigation task pass rates. Treatment (50%) was not significantly different from baseline (58%), with p = 1.00.

| Arm | N | Pass Rate | 95% CI |
|-----|---|-----------|--------|
| Baseline | 12 | 58.3% (7/12) | [32%, 81%] |
| Treatment (hint) | 12 | 50.0% (6/12) | [25%, 75%] |

**Fisher's exact p = 1.00. Cohen's h = 0.167 (negligible).**

This replicates the EXP-122 first-run null finding and definitively debunks EXP-122's original "100% pass rate" claim, which was an artifact of a corrupted test environment.

## Timeout Confound

A critical confound compromises the pooled analysis: the last 4 treatment runs used a 5-minute timeout (vs 3-minute scenario default). When stratified:

| Subset | Baseline | Treatment | Cohen's h |
|--------|----------|-----------|-----------|
| All runs (N=24) | 7/12 (58%) | 6/12 (50%) | 0.167 (negligible) |
| 3-min only (N=20) | 7/12 (58%) | 2/8 (25%) | 0.691 (medium-large) |
| 5-min only (N=4) | — | 4/4 (100%) | — |

The apples-to-apples comparison (3-min only) suggests the hint may **hurt** performance (25% vs 58%, h = 0.69), though not statistically significant at p = 0.197 with small N. Possible mechanism: the agent spends time processing the hint, leaving insufficient time for final task steps (`todo-marked-complete` failed in 5/6 treatment failures).

## Why This Matters

1. **Definitively closes the environmental hints research line**: EXP-122's original claim (100% pass) was measurement error. EXP-126 with proper controls shows null/negative effect.
2. **Adds to the text-intervention failure corpus**: Environmental hints are yet another text-channel intervention that fails to improve agent behavior (joining SOUL.md changes, system prompt skills, and task-message content on judgment tasks).
3. **Raises "hints hurt" possibility**: If the agent wastes attention budget on the hint, the net effect could be negative. This is consistent with KE-123 (over-intervention iatrogenesis).

## Check-Level Analysis

The binding constraint for both arms was `all-files-modified` (requiring ALL files updated). Treatment failures were heavily concentrated on `todo-marked-complete` (5/6 failures), suggesting timeout pressure — the hint consumed time the agent needed for the final task step.

## Predictions

- **P-131a**: Environmental hints will show ≤10% improvement on any task in future replications (N≥12 per arm)
- **P-131b**: At matched timeout (3-min), treatment will score ≤baseline in a properly powered replication (N≥30)

## Implications

1. **Do not use environmental hints as interventions** — null at best, harmful at worst
2. **The task is timeout-sensitive** — 3 minutes for 7+ file updates is marginal; future experiments on this scenario should use 5-minute timeout
3. **Negative results have value** — this prevents future time investment in environmental hints

## Limitations

- Timeout confound in 4/12 treatment runs makes the pooled result unreliable
- The clean comparison (3-min only) has only N=20, underpowered for small effects
- Only tested on one scenario (knowledge-base-navigation)
- The "hints hurt" hypothesis requires a properly powered study to confirm

---
*Negative result confirming that environmental hints — like all text-channel interventions tested to date — do not improve agent behavior on structured tasks.*
