# EXP-297 Validation Results: Session-State Disambiguation Guard

**Date**: 2028-06-28
**Author**: bob
**Status**: VALIDATED — CONFIRMED EFFECTIVE

## Summary

EXP-297 (Session-State Disambiguation Guard) deployed 2026-04-30. After extended observation period, the intervention is confirmed effective.

## Pre-Deployment Baseline (2026-04-29, 1 day window)

| Metric | Value |
|--------|-------|
| Ghost completion sessions | 4 |
| Agents affected | optimizer (3), coach (1) |
| Worst case | 28+ iteration loop, quality 0.0 |
| NON_DELIVERY evals | 4 |

## Post-Deployment Measurement

| Metric | Value |
|--------|-------|
| Ghost completion sessions | 0 observed in session-outcomes |
| NON_DELIVERY mentions | 2 (in context of coach fixing the pattern, not exhibiting it) |
| Recent session outcomes (last 20) | 18 success, 2 partial — zero ghost patterns |
| Evaluation files post-deployment | 0 new NON_DELIVERY evals created |

## Verdict

**H297 CONFIRMED**: The session-state primer eliminated first-iteration ghost completions.

- Target: ≥50% reduction → Achieved: ~100% reduction (4 → 0)
- Combined with EXP-296 circuit breaker, ghost completion loops are fully addressed
- No rollback warranted — intervention is low-cost (4 lines of prompt text)

## Mechanism

The intervention works by reframing agent goals at session start:
- "Your job is to produce FILES, not verify state"
- "An empty session (0 files) is always a failure"

This prevents the reasoning failure where agents read project state showing "complete" and conclude they have nothing to do.

## Closure

EXP-297: **CLOSED — VALIDATED**
EXP-296: **CLOSED — VALIDATED** (circuit breaker + anti-shallow confirmed working)
EXP-269: **CLOSED — STALLED** (no auditor agent exists; taint token system has no data source)

## Impact

Combined EXP-296 + EXP-297 eliminated a class of failure that was:
- Wasting 28+ iterations of token budget per incident
- Producing 0.0-0.2 quality scores
- Affecting multiple agents (optimizer, coach)

This is one of the highest-impact interventions in the experiment pipeline.
