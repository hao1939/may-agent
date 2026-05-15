# Proposal: Add `evaluations.last-llm-eval-age-h` metric (eval-coverage gauge)

**Date:** 2026-05-07
**Author:** arc
**Priority:** P0
**Lane:** `agents/shared/metrics-snapshot.ts` (dev/may)
**Connects:** KE-783 recommendation #2, KE-455 family, KE-756 (heartbeat-coverage retuning)

## Problem

The eval-poller LLM lane has been silently disabled since 2026-05-06 14:45Z (KE-783). Last `evaluations` row with `evaluatedByHeuristic=0` is from **2026-05-06 11:23Z** — currently 16h ago and growing. **Every existing surface signal looks healthy:**

- `handler.completed-count`: green, eval-poller fires every 30 min
- `handler.heartbeat-coverage`: 4/4, target met
- `handler.success-rate`: 1.0
- `session.error-rate-6h`: 0.027

The system has no metric that answers *"is the deep-eval pipeline producing fresh LLM judgments?"* That is the canonical signal Coach and Optimizer downstream consume; today it's stale and nothing alerts.

## Proposed metric

```
id:        eval.llm-coverage-lag-h
name:      LLM evaluation lag (hours since last LLM-judged session)
mode:      gauge
direction: lower-is-better
target:    1
threshold: 4   # alert when no LLM eval in 4h
owner:     evaluator   # by-default; consumer is may/dev for the fix
query:     SELECT (strftime('%s','now') - MAX(createdAt)/1000) / 3600.0
           FROM evaluations
           WHERE evaluatedByHeuristic = 0
```

Adjacent companion gauge (cheap, small):

```
id:        eval.heuristic-share-24h
name:      Share of evaluations that were heuristic-only (24h)
mode:      gauge
direction: lower-is-better      # we want some LLM coverage
target:    0.7
threshold: 0.95                 # alert if 95%+ heuristic
query:     SELECT 1.0 * SUM(evaluatedByHeuristic) / COUNT(*)
           FROM evaluations
           WHERE createdAt > strftime('%s','now')*1000 - 86400000
```

## Why this metric, not coverage-count

KE-783 considered "coverage count" (sessions evaluated / sessions completed). That number stays high because the heuristic lane keeps firing — and that's exactly the signal that fooled everyone for 10+ hours. The right shape is **lag of the LLM-specific lane**, which is monotonic in a stall: it can only grow, and it grows in real-time the moment the lane breaks.

Predicted detection: had this gauge existed at 14:45Z 2026-05-06, it would have crossed the 4h threshold by 18:45Z (just under 4h after the last `evaluatedByHeuristic=0` row at 11:23Z, with the cron-stop landing at 14:45Z; in either case ≤4h after the wedge). Today's 16h staleness would have read as a 12h-overdue alert.

## Lane / implementation

- File: `agents/shared/metrics-snapshot.ts`. Two new entries in the metrics array, alongside `handler.heartbeat-coverage`.
- DB: no schema change needed (uses existing `evaluations` columns: `createdAt`, `evaluatedByHeuristic`).
- Owner field: assign to `evaluator`, but plumb the `metric-alert-reactor` recipient through may (per KE-783 recommendation #4: evaluator's heartbeat instructs `notify tech-lead` which is now frozen — so `evaluator` agent reading the alert is the right surface, but the *fix* lives in dev/may lane).

## Falsifiable success criteria

- F1: when added, `eval.llm-coverage-lag-h` reports ≥16 (true at time of writing).
- F2: when the LLM lane is restored (whenever), the metric drops to <1 within one cron interval (30 min).
- F3: a synthetic regression test — manually delete the most-recent `evaluatedByHeuristic=0` row and re-run snapshot — must show the gauge increase by exactly the deletion's age delta.

## Sequencing

This proposal does **not** depend on the refactor in `2026-05-07-eval-poller-processedset-only-on-eval.md`. Land them in either order. This one is more urgent because it provides the alert surface; without it, the next regression of the LLM lane will go undetected exactly the same way.

## Related & deferred

KE-783 recommendation #3 ("out-of-band evaluator dispatch") is a real refactor — I'm not proposing it here; that needs its own design. Filing this as a tracker note: when #3 lands, the metric defined above will continue to work without changes (it's downstream of the `evaluations` table, not the dispatch path).
