# Finding: Coder Utilization Drop — Misleading Metric

**Date**: 2026-04-18
**Lens**: B (Flow Complexity)
**Severity**: Low (the "drop" is an artifact, not a real regression)

## Summary

The dispatch-board reported "86 sessions/6h" for coder on Apr 16, which dropped to ~2/6h today. Investigation reveals the 86-session spike was **not organic work** — it was a gym/benchmark batch run (95 `kind=job` sessions with no `parentSessionId`). Organic coder utilization (tech-lead → coder via workflow) has been steady at ~10-23 sessions/day.

## Evidence

### The Apr 16 spike was gym runs, not features
- Apr 16 total: 102 coder sessions (`sessions` table, `date(startedAt/1000,'unixepoch')='2026-04-16'`)
- 95 of 102 had `kind='job'` and `parentSessionId=NULL` — these are gym scenario runs, not dispatched work
- Task content confirms: `"Our product search API is crashing when users search for products..."` — a gym scenario, not a real feature
- Only 7 of 102 were `source='workflow', kind='call'` — actual tech-lead dispatches

### Organic coder rate is stable
| Day | Total | Gym (job) | Organic (workflow) |
|-----|-------|-----------|-------------------|
| Apr 16 | 102 | 95 | 7 |
| Apr 17 | 23 | 0 | 23 |
| Apr 18 (12h) | 11 | 0 | 11 |
| Apr 15 | 25 | 0 | 25 |

### Last 5.5h gap is real but explained
- Last coder session: `2026-04-18T06:32:00Z` (5.5h ago)
- Tech-lead ran 24 sessions since then: 15 heartbeats + 13 lens investigations + 2 other
- Tech-lead has been executing investigation lenses instead of dispatching feature work
- Dispatch board notes: "no unstarted feature items (remaining items need Hao approval or merges)"

## Root Cause

1. **Primary**: The dispatch-board's "86 sessions/6h" metric conflated gym benchmark runs with organic work, creating a false baseline.
2. **Secondary**: Tech-lead has no features to dispatch — all items on dispatch-board are either done, awaiting Hao approval, or awaiting merge. The 5.5h gap is a supply problem (no dispatchable work), not a dispatch problem.

## Recommended Action

1. **Fix metric**: Dispatch-board health reporting should filter out `kind='job'` sessions when computing agent utilization (the 86/6h number was misleading). Location: wherever may generates the dashboard — likely `agents/may/handlers/` cron handler.
2. **No action needed on coder dispatch** — organic rate is normal. The gap reflects an empty feature queue, not a tech-lead failure.
