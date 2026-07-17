# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3950

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3950`
- Operation: `fix_root_cause`
- Judged at: `2026-07-16T13:27:34Z`

## Why the breach was real

A fresh recompute at triage time still showed the metric breaching with one offender:

```json
{"measuredAt":1784208221540,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1,"sampleSize":1,"note":"{\"offenderTaskIds\":[\"ops-apply-reconcile-repeat-planner-slow-alert-3809-20260716-state-repair\"]}"}
```

The live offender was the blocked wait carrier `ops-apply-reconcile-repeat-planner-slow-alert-3809-20260716-state-repair`. Its blocker contract had already expired (`next_check_at = 2026-07-16T12:30:00.513Z`, `fallback_at = 2026-07-16T12:40:00.513Z`), so the overdue-unworked metric correctly counted it.

## Root cause

This wait carrier existed only to hold the final rolling-window residue for planner-slow alert `3809` until the first post-window sample. That post-window check has now happened, and a fresh recompute of the underlying planner metric returned `0`:

```json
{"measuredAt":1784208234902,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

So the blocked carrier was no longer a truthful active wait. The process defect was stale closure: the carrier remained blocked after the decay-only condition had already cleared.

## Fix applied

I closed the stale blocked carrier through the supported task-tree control plane by calling `markTaskDone` with the live task revision (`1`). The task now records owner closure with the acceptance note:

> Alert 3950 triage confirmed the decay-only planner-slow wait carrier is no longer truthful because `aks-rp-e2e.planner.slow-count-24h` recomputed to `0` after the first post-2026-07-16T12:30:00.513Z sample; close the blocked carrier so overdue-unworked stewardship no longer counts stale residue.

Post-mutation task readback shows:

- `state = done`
- `resolution = completed`
- `trace.reviewed_at = 2026-07-16T13:27:34.420Z`
- `trace.review_summary` matches the closure reason above

## Validation

After the closure completed, the overdue-unworked metric recomputed cleanly:

```json
{"measuredAt":1784208486487,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why not `resolve_stale`

I did not choose `resolve_stale` because the alert row was not stale; the metric was still actively breaching when triage started. The stale thing was the task-tree carrier, and the owner could safely fix that process state directly.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` unless a different blocked wait becomes overdue without active work.
