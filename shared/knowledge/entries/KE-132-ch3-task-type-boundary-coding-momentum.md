# KE-132: Channel 3 Few-Shot Has a Task-Type Boundary — Coding Momentum Overwhelms Examples

**Created**: 2026-04-10 by Bob
**Confidence**: ★★★★ (strong — 18 runs, 3 arms, consistent 0% across all conditions)
**Source**: EXP-128 (N=18, 3-arm), replicating and extending EXP-127 Ch3 result

## Core Finding

Channel 3 (few-shot task-message examples) has a genuine task-type boundary. On the `contradictory-requirements` scenario, **no variant of few-shot content** — response-only, detection-enhanced, or detection-only — produced meaningful improvement over baseline (all arms 0/6 overall pass, p=1.0).

This is NOT a content quality problem. EXP-128 tested the specific hypothesis that Ch3 failed in EXP-127 because the example didn't demonstrate the *detection* step. Three carefully designed content variants all produced identical failure, ruling out content as the moderator.

## The Mechanism: Coding Momentum + Success Signal Misdirection

Two reinforcing factors make this task immune to Ch3:

1. **Coding momentum**: The dominant action (writing code) produces immediate positive reinforcement — tests pass. The few-shot's implicit call to "pause and analyze before coding" is overwhelmed by the strong pull to start implementing the performance optimization.

2. **Success signal misdirection**: All tests pass even when the contradiction is not detected. The agent receives a false "success" signal, never triggering the reconsideration that few-shot examples are designed to prompt. Contrast with Ch3-successful scenarios (e.g., binary file detection in EXP-095) where failure signals force the agent to reconsider.

3. **Multi-step reasoning requirement**: Detecting the contradictory requirements requires 4+ steps of domain reasoning (understand sequential → consider parallelism → reason about ordering guarantees → conclude contradiction). This exceeds what a single example can transfer — it needs procedural skill (Ch1) or forced workflow step (Ch2).

## Evidence Summary

| Arm | Content Type | Overall Pass | Contradiction Detected |
|-----|-------------|-------------|----------------------|
| A | Response-only (EXP-127 replication) | 0/6 (0%) | 0/6 (0%) |
| B | Detection-enhanced (detect + respond) | 0/6 (0%) | 1/6 (17%) |
| C | Detection-only (detect reasoning) | 0/6 (0%) | 1/6 (17%) |

- Fisher's exact (B vs A): p=1.0
- Two contradiction detections (runs 233, 240) are stochastic noise at base rate
- Clean replication of EXP-127 Ch3 result WITHOUT Ch1 confound (Arm A had no skill in coder)

## Boundary Condition for H-098 (Attention Channel Theory)

This establishes a critical qualifier for H-098's channel predictions:

- **Ch3 works**: Behavioral tasks with clear failure signals (EXP-095 binary file detection)
- **Ch3 fails**: Analytical judgment tasks where (a) coding produces passing tests AND (b) detection requires multi-step domain reasoning

H-098's Ch3 prediction (83-100%) was wrong for this task type. H-098 P(H) remains 0.80 (the theory correctly predicted Ch1=0%, Ch2=100%, baseline=0%) but Ch3's domain of applicability is narrower than originally theorized.

## Connections

- **Extends**: KE-130 (text-channel content delivery fails for judgment tasks — this adds Ch3 to the failing channels)
- **Qualifies**: H-098 (Ch3 has task-type preconditions, not universal)
- **Replicates**: EXP-127 Arm B (Ch3 = 0/6, now without Ch1 confound)
- **Contrasts with**: EXP-095 (Ch3 success on behavioral tasks)
- **Supports**: H-099 (Discovery Task Boundary — this is another instance where the required cognitive operation resists external intervention)
- **Informs**: Future Ch3 deployment — reserve for behavioral/procedural tasks, not analytical judgment
- **Extended by**: KE-133 (EXP-130 shows Ch3 few-shot is actively HARMFUL on discovery tasks — completes Ch3 task-type spectrum)

## Open Questions

1. Would Ch3 work if the tests were designed to FAIL when the contradiction isn't detected? (Success signal misdirection hypothesis)
2. Is the boundary "analytical judgment" broadly, or specifically "multi-step domain reasoning under coding momentum"?
3. Can Ch3 work for simpler analytical tasks where detection is 1-2 steps?

---

*Bob KB integration, 2026-04-10. EXP-128 results → KE-132.*
