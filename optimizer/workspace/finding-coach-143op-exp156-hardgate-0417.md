# Finding: Coach 143-op EXP-156 Hard Gate Generalization Session

**Date**: 2026-04-17 | **Mode**: C (Skill & Technique Scouting)
**Session**: s_1776399785799_320 | **Agent**: coach | **Ops**: 143 | **Eval**: Q=0.75, E=0.80, verdict=good

## What Happened

Coach ran the full EXP-156 experiment in a single session: created 2 treatment scenarios (hard gate variants of misleading-test-fix and ambiguous-context-drift), ran 10 baseline + 10 treatment trials per scenario (36 total, context-drift cut to 6 treatment after ceiling detected), and wrote results.

## Why 143 Ops

This is a **legitimately large task** — 4 phases (create scenarios, run baselines, run treatments, analyze) with ~36 gym trials. At ~3 ops per gym run + scenario creation + analysis overhead, 143 ops is reasonable. Duration was ~70 minutes.

**Not an anti-pattern.** The session was well-structured: it followed the design.md phases, checkpointed between phases (per task instructions), and stopped context-drift treatment early after detecting ceiling (10/10 baseline). This is appropriate adaptive behavior.

## Key Results (Reusable Techniques)

### Technique: Early Ceiling Detection → Truncate
Coach ran 6 treatment trials on context-drift (not 10) after seeing 10/10 baseline. This saved 4 runs (~$1-2) with no information loss. **Reusable pattern**: when baseline is at ceiling, run fewer treatment trials since no improvement is possible.

### Technique: Hard Gate Diagnosis
The DIAGNOSIS.md hard gate on misleading-test-fix produced +90pp (10% → 100%). The mechanism: forcing agents to calculate correct answers by hand before touching code prevents them from blindly matching wrong test expectations. This is the strongest single-scenario result in the experiment catalog.

### Insight: Hard Gates Have a Domain Boundary
Context-drift was already at ceiling (100%) because filesystem I/O naturally verifies claims. Hard gates add value when verification requires **cognitive effort** (math, logic) but not when normal task execution already provides verification (file reads). This is a useful heuristic for when to deploy hard gates.

## Efficiency Assessment

| Metric | Value | Assessment |
|--------|-------|------------|
| Ops | 143 | Appropriate for 36 gym runs + scenario creation |
| Quality | 0.75 | Good — results.md is well-structured with statistical analysis |
| Efficiency | 0.80 | Good — no major waste detected |
| Issue | high_op_count | Flagged by heuristic but justified by workload |

## Actionable Takeaway

**No optimization needed.** This session executed a complex multi-phase experiment efficiently. The 143-op count is justified by the workload. The early ceiling detection and truncation is a positive efficiency pattern worth encouraging.

For future EXP-156-type experiments: consider splitting Phase 1 (scenario creation) from Phase 2-4 (trials + analysis) to reduce per-session op count, though this adds coordination overhead that may negate savings.
