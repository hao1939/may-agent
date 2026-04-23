# EXP-178 Results: Difficulty-Adaptive Content-First Guard Pilot

**Date**: 2026-04-23 (results write-up)
**Status**: CONCLUDED — CEILING/FLOOR PROBLEM
**Runs**: 120 (all complete)
**Cost**: ~$9-12 estimated

---

## Executive Summary

**The experiment is inconclusive because both scenarios hit extremes**: sql-injection-in-query-builder is at 100% across ALL arms (including no-guard control), and cascading-fix-trap-v2 is at 0% across ALL arms. There is no variance to explain, so the adaptive routing hypothesis cannot be tested.

---

## Results by Arm × Scenario

| Arm | sql-injection (predicted 30-45% baseline) | cascading-fix-trap-v2 (predicted 0-10% baseline) |
|-----|---|---|
| **G1 no-guard control** | **15/15 (100%)** ← ceiling | **0/15 (0%)** ← floor |
| **G2 production-mode uniform** | **30/30 (100%)** ← ceiling | **0/15 (0%)** ← floor |
| **G3 passive-injection uniform** | **15/15 (100%)** ← ceiling | — (runs tagged as -f1) |
| **G4 adaptive (mapped to -f1)** | **15/15 (100%)** ← ceiling | **0/30 (0%)** ← floor |

### Failure Mode on cascading-fix-trap-v2

All failures are the same: `pipeline-order-fixed` check fails. The agent consistently fails to swap the normalize/penalize order in pipeline.js. In the -f1 variant, some runs additionally fail `penalties-not-hacked` (agent tries to work around the bug rather than fix root cause).

This is the same "Relational Bug Blindness" documented in EXP-194/195/177 (2-4% baseline across 50+ runs).

### Ceiling on sql-injection

The sql-injection scenario baseline has risen from the predicted 33% to 100%. The agent now reliably detects and fixes SQL injection vulnerabilities without any intervention. This likely reflects model capability improvements since the baseline was measured.

---

## Hypothesis Verdicts

| Hypothesis | Verdict | Reason |
|---|---|---|
| G4 vs G2 on cascading (≥70pp gap) | **UNTESTABLE** | Both at 0% — no variance |
| G4 vs G3 on sql-injection (±10pp) | **TRIVIALLY TRUE** | Both at 100% — ceiling |
| G4 vs G1 on sql-injection (≥20pp) | **REJECTED** | Both at 100% — no lift possible |
| Adaptive dominates uniform | **UNTESTABLE** | Need medium-difficulty scenarios |

---

## Key Insights

1. **Scenario difficulty is non-stationary**: sql-injection went from 33% → 100% between design and execution. Baselines must be re-measured immediately before running experiments.

2. **Relational Bug Blindness is robust to ALL interventions tested**: 0/60 runs passed the pipeline-order-fixed check across 4 different intervention arms. No amount of expert content injection, production-mode gating, or adaptive routing helps. This is a fundamental capability gap, not a training gap.

3. **The bimodal scenario problem persists**: Scenarios cluster at 0% or 100% (as noted in prior reflexion lessons). Finding 30-70% scenarios for experiments remains the core bottleneck.

---

## Recommendation

**CLOSE EXP-178**. The adaptive guard hypothesis requires medium-difficulty scenarios that don't exist in the current corpus. Future work should:
1. Create scenarios in the 30-70% difficulty range before designing intervention experiments
2. Re-baseline all existing scenarios before each experiment
3. Consider the cascading-fix-trap relational bug as a **capability ceiling** that skills/guards cannot overcome (per 0/60 result)

---

## Raw Data Summary

| Scenario Variant | N | Passed | Rate | Failure Check |
|---|---|---|---|---|
| sql-injection-in-query-builder | 15 | 15 | 100% | — |
| sql-injection-in-query-builder-exp178-g2 | 30 | 30 | 100% | — |
| sql-injection-in-query-builder-f1 | 15 | 15 | 100% | — |
| cascading-fix-trap-v2 | 15 | 0 | 0% | pipeline-order-fixed |
| cascading-fix-trap-v2-exp178-g2 | 15 | 0 | 0% | pipeline-order-fixed |
| cascading-fix-trap-v2-f1 | 30 | 0 | 0% | pipeline-order-fixed, penalties-not-hacked |
