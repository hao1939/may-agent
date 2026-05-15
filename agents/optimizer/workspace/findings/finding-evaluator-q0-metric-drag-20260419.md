# Finding: quality_preserved Metric Drag — Root Cause Analysis

**Date**: 2026-04-19
**Metric**: `optimizer.quality-preserved` — current 0.896, target 0.9, threshold 0.85
**Status**: ACTIONABLE

## Summary

The `optimizer.quality-preserved` metric (0.896) is 0.004 below its 0.9 target. The drag comes from 24 sessions scoring q<0.5 in the 7d window (out of 713 total). Removing these would raise the average to 0.920.

Five of those 24 score q=0 with issue "evaluator did not score this agent" — a known bug in `src/lib/evaluator.ts` where the LLM evaluator fails to match agent names to parsed scores. The other 19 low-quality sessions (q=0.1-0.48) reflect genuine low-quality optimizer work.

## Key Data

| Slice | Count | Avg Quality |
|---|---|---|
| All 7d optimizer (skippedByJs=0) | 713 | 0.896 |
| Excluding q<0.5 | 689 | 0.920 |
| q=0 sessions (eval bug) | 5 | 0.000 |
| q=0.1-0.48 sessions | 19 | ~0.25 |

### The "evaluator bug" q=0 sessions

These 5 sessions have real work (opCount 5-29) but scored q=0 because the evaluator LLM output didn't match the agent name lookup in `src/lib/evaluator.ts:640-665`. The fallback assigns q=0, which is wrong — it's a scoring failure, not a quality failure.

### Separate concern: 3,436 evaluator q=0 evals

There are 3,436 evaluations where `agent='evaluator'` and `quality=0`. These do NOT affect `optimizer.quality-preserved` (which filters `s.agent='optimizer'`). They're a separate issue.

## Root Cause

In `src/lib/evaluator.ts` lines 604-665: when the LLM evaluator's output doesn't contain a matching key for a child session (neither `"agent (session s_xxx)"` nor plain `"agent"`), the code falls back to q=0 with verdict "needs_improvement". This is a **scoring gap**, not a quality signal.

The metric query (`source_query` in metrics table) includes these false-zero scores without filtering.

## Recommendations

### R1: Filter scoring-failure sessions from the metric query (IMMEDIATE — can do now)

**File**: `.state/may.db` — `metrics` table, row `optimizer.quality-preserved`
**Change**: Update `source_query` to exclude evaluations where `issues LIKE '%evaluator did not score%'`:

```sql
SELECT AVG(e.quality) AS val
FROM evaluations e JOIN sessions s ON e.sessionId = s.sessionId
WHERE s.agent='optimizer'
  AND e.skippedByJs=0
  AND e.quality IS NOT NULL
  AND e.createdAt > (strftime('%s','now')*1000 - 604800000)
  AND e.issues NOT LIKE '%evaluator did not score%'
```

**Impact**: Removes 5 false-zero scores. Estimated new avg: ~0.902 (crosses 0.9 target).
**Risk**: Low — we're excluding known-broken scores, not hiding real quality issues.

### R2: Fix the evaluator fallback to avoid q=0 for unmatched agents (MEDIUM-TERM)

**File**: `src/lib/evaluator.ts` lines 640, 665
**Change**: Instead of defaulting to `quality: 0`, use `quality: null` or skip inserting an evaluation entirely. This prevents false zeros from entering the DB.
**Impact**: Prevents future false-zero contamination across ALL agent metrics, not just optimizer's.
**Risk**: Medium — needs careful handling of null quality in downstream queries.

### R3: Re-evaluate the 5 affected sessions (OPTIONAL)

**Sessions**: s_1776398460719_312, s_1776238297515_65, s_1776189136274_287, s_1776400252340_326, s_1776234666559_35
**Change**: Dispatch evaluator to re-score these sessions individually.
**Impact**: Replaces false zeros with real scores.
**Risk**: Low but low ROI — only 5 sessions.

## Priority

R1 is immediately actionable and crosses the 0.9 target. R2 is the proper fix but requires code change + testing.
