# EXP-128: Channel 3 Boundary Conditions — Detection Coverage Hypothesis

**Date**: 2026-04-10
**Status**: COMPLETE
**Hypothesis**: H-128 — Ch3 few-shot effectiveness depends on whether the example covers the *detection* step
**Result**: ❌ **H-128 REJECTED** — Detection coverage made no meaningful difference

## Results Summary

| Arm | Description | n | Avg Score | Contradiction Detected | Overall Pass |
|-----|------------|---|-----------|----------------------|-------------|
| A | Response-Only (EXP-127 replication) | 6 | 2.00/5 | 0% (0/6) | 0% (0/6) |
| B | Detection-Enhanced (detect + respond) | 6 | 2.17/5 | 17% (1/6) | 0% (0/6) |
| C | Detection-Only (detect reasoning only) | 6 | 2.17/5 | 17% (1/6) | 0% (0/6) |

### Per-Check Breakdown (All 18 Runs)

| Check | Arm A (6 runs) | Arm B (6 runs) | Arm C (6 runs) |
|-------|----------------|----------------|----------------|
| tests-pass | 6/6 (100%) | 6/6 (100%) | 6/6 (100%) |
| ordering-preserved | 6/6 (100%) | 6/6 (100%) | 6/6 (100%) |
| analysis-exists | 0/6 (0%) | 0/6 (0%) | 0/6 (0%) |
| contradiction-identified | 0/6 (0%) | 1/6 (17%) | 1/6 (17%) |
| alternatives-proposed | 0/6 (0%) | 0/6 (0%) | 0/6 (0%) |

### Detailed Run Log

| Run ID | Arm | Score | Checks Passed |
|--------|-----|-------|---------------|
| 232 | B | 2/5 | tests-pass, ordering-preserved |
| 233 | C | 3/5 | tests-pass, ordering-preserved, contradiction-identified |
| 234 | A | 2/5 | tests-pass, ordering-preserved |
| 235 | A | 2/5 | tests-pass, ordering-preserved |
| 236 | C | 2/5 | tests-pass, ordering-preserved |
| 237 | B | 2/5 | tests-pass, ordering-preserved |
| 238 | A | 2/5 | tests-pass, ordering-preserved |
| 239 | C | 2/5 | tests-pass, ordering-preserved |
| 240 | B | 3/5 | tests-pass, ordering-preserved, contradiction-identified |
| 241 | A | 2/5 | tests-pass, ordering-preserved |
| 242 | B | 2/5 | tests-pass, ordering-preserved |
| 243 | C | 2/5 | tests-pass, ordering-preserved |
| 244 | A | 2/5 | tests-pass, ordering-preserved |
| 245 | B | 2/5 | tests-pass, ordering-preserved |
| 246 | C | 2/5 | tests-pass, ordering-preserved |
| 247 | A | 2/5 | tests-pass, ordering-preserved |
| 248 | B | 2/5 | tests-pass, ordering-preserved |
| 249 | C | 2/5 | tests-pass, ordering-preserved |

## Statistical Analysis

### Primary Comparison: Arm B vs Arm A (Fisher's Exact)

- Arm B overall pass: 0/6, Arm A overall pass: 0/6
- Fisher's exact test: **p = 1.0** (no difference)
- Result: **No significant difference**

### Secondary Metric: Contradiction Detection

- Arm B contradiction-identified: 1/6, Arm A: 0/6
- Fisher's exact one-tailed: p = 0.50 (not significant)
- Arm C contradiction-identified: 1/6, Arm A: 0/6
- Fisher's exact one-tailed: p = 0.50 (not significant)

### Interpretation

The results match the design's **"All ≈ 0%"** outcome:

> **A ≈ B ≈ C ≈ 0% → H-128 rejected: Task is immune to Ch3. The moderator is elsewhere.**

Detection coverage in the few-shot made no meaningful difference. The coder's behavior was remarkably consistent across all 18 runs:
1. **Always** passed tests and preserved ordering (12/12 checks per arm)
2. **Almost never** created ANALYSIS.md, identified the contradiction, or proposed alternatives (0/18 on analysis-exists, 0/18 on alternatives-proposed)
3. The two contradiction-identified successes (runs 233 and 240) appear to be stochastic noise — one from Arm B, one from Arm C, both at the expected base rate

## What Happened (Behavioral Pattern)

Across all 18 runs, the coder consistently:
1. Read the task and pipeline code
2. Identified the performance bottleneck (sequential processing)
3. Implemented parallelization/batching to hit 10,000 records/sec
4. Made tests pass
5. **Never paused to question whether the requirements could coexist**

The few-shot example — regardless of whether it covered detection, response, or both — was insufficient to interrupt the strong "coding momentum" of the task. The agent's default mode is: "I see a performance problem → I fix it." The few-shot needed to override this default, and it couldn't.

## Comparison to Predictions

| Prediction | Actual | Match? |
|-----------|--------|--------|
| Arm A: 0-17% | 0% | ✅ |
| Arm B: 50-83% (if H-128 correct) | 0% | ❌ |
| Arm C: 17-50% (if H-128 correct) | 0% | ❌ |

## Confound Check: EXP-127 Replication

Arm A was a clean replication of EXP-127 Ch3, with the key improvement that no `contradiction-detection.md` skill was present in the coder. Result: **0% (0/6)**, perfectly replicating EXP-127's 0/6.

This confirms:
- EXP-127's Ch3 result was NOT caused by Ch1 confounding/interference
- The task genuinely resists Ch3 few-shot intervention

## Implications

### For H-128 (Detection Coverage Hypothesis)
**REJECTED with confidence.** Detection coverage is not the moderator that determines Ch3 effectiveness on this task.

### For Ch3 Channel Theory (H-098)
Ch3 has a genuine task-type boundary. Some tasks resist few-shot examples regardless of content quality. The moderator is likely:

1. **Action momentum strength**: When the dominant action (writing code) is directly rewarded by task infrastructure (tests pass!), the few-shot's call to pause-and-analyze is overwhelmed. The agent gets positive reinforcement (passing tests) for the wrong behavior.

2. **Multi-step reasoning requirement**: The detection step for contradictory requirements requires 4+ steps of domain reasoning (understand sequential processing → consider parallelism → reason about ordering guarantees → conclude contradiction). This may exceed what a few-shot can transfer — it needs a **procedural skill** (Ch1/Ch2), not an example.

3. **Success signal misdirection**: The tests all pass even without detecting the contradiction, so the agent believes it succeeded. On other Ch3-successful scenarios (e.g., binary file detection), the agent gets clear failure signals that force reconsideration.

### Recommended Next Steps

1. **New Hypothesis H-129**: Ch3 fails when (a) coding momentum produces passing tests AND (b) the judgment requires multi-step domain reasoning. Test by comparing "easy detection" vs "hard detection" tasks.

2. **Ch1/Ch2 for contradictory-requirements**: Since Ch3 is demonstrably insufficient, this task likely needs a Ch1 skill (always-loaded procedure) or Ch2 workflow (mandatory pre-implementation step) to change behavior.

3. **Investigate "success signal misdirection"**: Design an experiment where the contradictory-requirements scenario has tests that FAIL when the contradiction isn't addressed (e.g., a test that checks for ANALYSIS.md). This would test whether the issue is the few-shot content or the task's reward structure.

---

*Completed 2026-04-10. 18 gym runs, ~45 minutes execution. Hypothesis H-128 rejected.*
