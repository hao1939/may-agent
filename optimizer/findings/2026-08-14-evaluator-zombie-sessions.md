# Finding: Evaluator Zombie Sessions

**Date**: 2026-08-14
**Severity**: P1 — significant waste
**Status**: New

## Summary
94.8% of evaluator sessions in the last 24h (939/991) completed with 0 ops. These are zombie sessions that consume resources but produce nothing.

## Data
| Metric | Value |
|--------|-------|
| Total evaluator sessions (24h) | 991 |
| Sessions with 0 ops | 939 (94.8%) |
| Sessions with >0 ops | 52 (5.2%) |
| Total ops consumed | 758 |
| Avg ops for productive sessions | ~14.6 |

## Context
- The evaluator pipeline IS producing evaluations (latest was 0.5h ago with 1,420 total)
- The 0-op sessions suggest the evaluator is being triggered but immediately finding nothing to do
- This could be: cron firing too frequently, or trigger conditions not filtering properly

## Impact
- 939 wasted session starts per day
- Session table bloat
- Misleading activity metrics (evaluator appears busiest by session count)

## Recommendation
1. Investigate evaluator cron/trigger configuration — reduce frequency or add pre-check
2. Consider a lightweight "is there work?" check before spawning a full session
3. Coach is also high-volume (683 sessions, 3099 ops) — investigate if similar pattern exists

## Related
- Inbox notifications about "dead evaluator pipeline" are incorrect — the pipeline works, it just has massive overhead
