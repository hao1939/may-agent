# Metric alert triage — `aks-rp-e2e.planner.slow-count-24h` (alert 3809)

- Operation: `waiting_with_evidence`
- Alert id: `3809`
- Metric id: `aks-rp-e2e.planner.slow-count-24h`

## Why the breach is still real

The runtime metric row still breaches now:

- `current=2`
- `threshold=0`
- `target=0`
- `priority=P2`
- `source_command=bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.planner.slow-count-24h`

A fresh direct recompute from `/app/projects/aks-rp-e2e.app` still returns `2` for the metric, matching the runtime row.

## What is actually driving the current `2`

A bounded parse of `.state/planner-runs.jsonl` found exactly **two** qualifying slow planner wakes in the trailing 24-hour window:

1. `2026-07-15T10:32:58.641Z` — `Agent step "app-ops" timed out after 360000ms`
2. `2026-07-15T12:30:00.513Z` — `Agent step "app-ops" timed out after 360000ms`

Both rows are `steps=["event-review","planning-update"]` planner wakes, so the metric is counting real owner-step planner timeout incidents rather than noise.

## Why this is not an active current-day regression

The same bounded parse also showed:

- `recentCount=1017`
- `slowCount=2`
- `newestSlow=2026-07-15T12:30:00.513Z`
- `laterCount=764`
- `laterOwnerPlannerCount=237`
- `laterSlowCount=0`

So there have been **764 later planner wakes with zero additional slow matches** after the newest qualifying slow wake, including **237 later owner-step wakes**.

The later sample rows are normal successful planner activity, including recent `event-review/planning-update` and `task-reviewed-apply/quick-refill` wakes such as:

- `2026-07-16T05:20:13.187Z` — `assigned` planning update creating and dispatching a new domain task for the unpublished-change P0 breach
- `2026-07-16T05:21:27.984Z` — `settled` planning update retiring a duplicate blocked wait
- `2026-07-16T05:23:20.058Z` — `settled` planning update creating/assigning a replacement five-spec requeue task

The sessions table agrees with that recovery posture: recent `workflow:project-planner` owner sessions after the slow rows are repeatedly `status='done'`, including:

- `s_project_planner_planning_update_20260716052030_hzfh44`
- `s_project_planner_planning_update_20260716051824_5fs2an`
- `s_project_planner_planning_update_20260716051649_i8e9qn`
- `s_project_planner_planning_update_20260716051334_68f1yq`

## Additional context signal

The live planner-run tail through `2026-07-16T05:23:37.717Z` contains no new qualifying slow wake after `2026-07-15T12:30:00.513Z`, so this is now a rolling-window residue signal rather than an ongoing burst.

## Why the final operation is `waiting_with_evidence`

`waiting_with_evidence` is the truthful judgment because:

- the metric is still above threshold right now,
- the two counted wakes are real,
- but they are both older residual rows from 2026-07-15 rather than evidence of an ongoing fresh planner slowdown,
- and the live planner has already returned to sustained normal operation with hundreds of later non-slow wakes and healthy recent owner-step completions.

So the right action is not to manually resolve the alert or invent a speculative new repair. The correct action is to leave the alert visible and wait for the rolling 24-hour window to age out the last qualifying row.

## Next validation

Validate on the next `metrics-snapshot` after **`2026-07-16T12:30:00.513Z`**, when the newest remaining slow wake ages out of the 24-hour window.

If no new slow planner wakes land before then, `aks-rp-e2e.planner.slow-count-24h` should fall from `2` to `0` on the next sample after that timestamp.
