# Metric alert triage — `aks-rp-e2e.planner.slow-count-24h` — alert `3106`

- Operation: `waiting_with_evidence`
- Judged by: `app-ops`
- Judged at: `2026-07-08T18:00:00Z`

## Decision

Choose `waiting_with_evidence` because the breach is real but currently reflects two already-finished slow planner wakes inside the rolling 24h window, while later planner sessions are succeeding again.

This is not `resolve_stale` because the live metric still truthfully reads `current = 2`.

This is not `fix_root_cause` in this triage session because the current planner loop is no longer persistently slow, and the safe owner action available here is to record the bounded residue, watch for recurrence, and validate at the next aging boundary.

## Current facts

### 1) Runtime metric is still breaching now

The runtime `metrics` row for `aks-rp-e2e.planner.slow-count-24h` currently shows:

- `current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P2`
- `status = active`
- source command: `bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.planner.slow-count-24h`

A fresh resample from that source command during this triage also returned `value = 2`.

### 2) The metric definition still matches real planner slowness

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines the metric as:

- `plannerRecent.filter((run) => isSlowPlannerRun(run)).length`

and the helper counts a planner wake when it is slow/interrupted/cancelled, including timeout-text results.

### 3) Exactly two planner wakes in the last 24h currently qualify

A direct bounded parse of `projects/aks-rp-e2e.app/.state/planner-runs.jsonl` found exactly these two in-window qualifying planner wakes:

1. `2026-07-08T09:52:18.140Z`
   - `status = assigned`
   - `ran_agent = true`
   - `steps = ["event-review", "planning-update"]`
   - `result = Agent step "app-ops" timed out after 360000ms`
2. `2026-07-08T16:23:21.089Z`
   - `status = assigned`
   - `ran_agent = true`
   - `steps = ["event-review", "planning-update"]`
   - `result = Agent step "app-ops" timed out after 360000ms`

No other planner-wake rows in the last 24h matched the metric rule during this bounded audit.

### 4) The planner has recovered after the latest counted slow wake

Recent `workflow:project-planner` owner sessions after those two timeouts are mostly successful, including many `done` sessions around:

- `17:12Z`
- `17:20Z`
- `17:23Z`
- `17:30Z`
- `17:37Z`
- `17:48Z`
- `17:52Z`
- `17:56Z`

The latest planner-run tail in `.state/planner-runs.jsonl` also shows successful assigned/idle wakes at `17:51:56Z`, `17:51:59Z`, `17:52:04Z`, `17:55:16Z`, and `17:59:00Z`, with no newer qualifying slow row after the `16:23:21Z` timeout.

That means the current alert is real rolling-window residue from two earlier slow wakes, not proof that the planner is still actively stalled right now.

## Concrete change made

I refreshed this durable evidence note with the current `current = 2` state, the exact two counted planner wakes, and the newer successful planner activity so the alert now has a current owner judgment rather than stale one-count evidence from earlier today.

## Why `waiting_with_evidence`

`waiting_with_evidence` is the truthful operation because:

1. the breach is still real right now,
2. the counted offenders are exactly identified,
3. later planner activity shows recovery instead of an ongoing same-minute outage, and
4. the next honest validation is either a new slow wake recurring or the older counted wakes aging out of the 24h window.

## Next validation

Validate on the next `metrics-snapshot` after `2026-07-09T16:23:21Z`. If no newer slow planner wake lands before then, the metric should naturally drop below `2` as the two counted timeout rows age out of the rolling 24h window.