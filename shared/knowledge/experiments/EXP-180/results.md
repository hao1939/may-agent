# EXP-180: Dead Ends Memory — Results

**Date**: 2026-04-18
**Status**: FALSIFIED
**Experimenter**: coach

---

## Results Summary

| Scenario | Arm A (baseline) | Arm B (dead_ends.md) | Δ |
|----------|:-:|:-:|:-:|
| stale-approach-fixation | 0/5 (0%) | 0/5 (0%) | 0pp |
| stale-error-misdiagnosis-v2 | 0/5 (0%) | 0/5 (0%) | 0pp |
| cascading-fix-trap-v2 | 0/5 (0%) | 0/5 (0%) | 0pp |
| **TOTAL** | **0/15 (0%)** | **0/15 (0%)** | **0pp** |

## Analysis

### Key Finding: Floor Effect — Scenarios Too Hard

Both arms scored 0% across all 30 trials. The dead_ends.md intervention cannot be evaluated because the baseline pass rate is 0% — there is no room to measure improvement. This is a **floor effect**.

These scenarios are evidently too difficult for the coder agent to pass within the 10-minute timeout, regardless of context injection. The original design estimated baselines of 30-60%, which was incorrect.

### Decision

**H-180a: FALSIFIED (inconclusive due to floor effect)**

The experiment cannot confirm or deny the hypothesis because the scenarios produce 0% baselines. The dead-ends file may or may not help — we simply cannot tell from these scenarios.

Per the decision rule: <5pp improvement on all 3 scenarios → FALSIFIED. However, this is more accurately "INCONCLUSIVE — floor effect" since the null result tells us nothing about the intervention's efficacy.

### Recommendations

1. **Find scenarios with 30-60% baseline pass rates** before re-running this experiment. Use `scripts/gym-batch.sh --run-all --agent coder --trials 3` to survey scenario difficulty.
2. **Consider easier scenario variants** — many of these scenarios have `-v2`, `-v3`, `-moderate` variants that may have higher baselines.
3. **Alternative approach**: Instead of context.md injection (passive, KE-011 warns these are ignored), test dead-ends as an active recall injection into the task prompt itself.

## Connection to KE-011

This result is consistent with **KE-011** (knowledge files are passive — agents skip them in oneshot mode). The dead_ends.md was injected into context.md, which is passive context. The agent may not have attended to it. A stronger test would inject the dead-ends content directly into the task prompt or use workflow enforcement.

## Raw Data

- Arm A batches: `batch_1776504300_f4d02be8`, `batch_1776504549_a797b735`, `batch_1776504927_8ec5d1dd`
- Arm B batches: `batch_1776505295_53b9e8ac`, `batch_1776505591_f9eadbbf`, `batch_1776505983_af324fd3`
- All trials returned `passed: false` with `agent_status: "success"` (agent thought it succeeded but failed criteria checks)
- cascading-fix-trap-v2 typical failure: passes most criteria but fails `pipeline-order-fixed` (the core product requirement)

---

*EXP-180 | FALSIFIED (floor effect) | 0/30 total trials passed | 2026-04-18*
