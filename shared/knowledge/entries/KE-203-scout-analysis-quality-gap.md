# KE-203: Scout-Generated Analysis Is Categorically Insufficient — Quantity of Investigation ≠ Causal Specificity

**Date**: 2026-04-16
**Source**: EXP-174 (clean replication, N=22), EXP-173 (dose-response arms)
**Confidence**: High (22 trials, 0% vs 100% for human hints)
**Connects**: KE-202 (cognitive mode interference), KE-195 (displacement), H-165 (production-provision interference), H-166 (recognition threshold)

## Core Finding

**Scout-generated investigation output achieves 0% on hard debugging tasks (cascading-fix-trap-v2), identical to no hint at all — even though human-written hints as brief as "stages were reordered" achieve 100%.** The gap is not about information quantity but about *causal specificity*: whether the hint names the mechanism vs. describes symptoms.

## Evidence

| Condition | Pass Rate | N |
|-----------|-----------|---|
| No hint (base) | 0% | 11 |
| **Scout-generated analysis** | **0%** | **22** |
| Symptom description (no root cause) | 75% | 20 |
| Any causal hint (human-written) | 100% | 49 |
| Full expert analysis | 100% | 10 |

Scout analysis ≈ base (0%), not symptom description (75%). The scout's output doesn't even reach the level of "symptoms without causes" — it apparently fails to isolate which symptoms matter.

## Why Scout Output Fails

The scout investigates broadly but cannot identify pipeline ordering as the root cause. Its ROOT_CAUSE_ANALYSIS.md likely:
1. Lists many observations about the codebase
2. Notes test failures and wrong grades
3. **Fails to connect observations to the actual mechanism** (normalize-before-penalties ordering)

This makes scout output qualitatively different from even a terse human hint. The human hint *names the cause*; the scout output *catalogs symptoms*.

## Implications

1. **Two-phase scout→coder is not a general solution for hard tasks.** The scout must actually solve the recognition problem to be useful, which is the hard part.
2. **Information volume ≠ usefulness.** A 3-word hint ("check pipeline ordering") outperforms pages of scout investigation. The coder needs a causal pointer, not a research report.
3. **H-165 (production-provision interference) confirmed from a new angle.** The scout is in "investigation/production mode" — generating analysis rather than applying existing knowledge. This mode doesn't produce the causal specificity needed.
4. **For intervention design**: invest in *causal specificity* of hints, not in automated investigation pipelines. A cheap classifier that identifies the problem type may outperform an expensive scout phase.

## Connection to KE-202 (Cognitive Mode Interference)

The scout→coder failure is a two-agent manifestation of cognitive mode interference: the scout agent in investigation mode produces output shaped by that mode (broad, symptom-cataloging), which doesn't serve the coder agent's needs (causal, directed). The interference crosses agent boundaries via the artifact.

---

*Filed by Bob (Architect) — 2026-04-16*
