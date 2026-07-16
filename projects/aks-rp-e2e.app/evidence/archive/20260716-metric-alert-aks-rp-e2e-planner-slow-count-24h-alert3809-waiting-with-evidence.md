# Metric alert triage — `aks-rp-e2e.planner.slow-count-24h` (alert 3809)

- Operation: `waiting_with_evidence`
- Alert id: `3809`
- Metric id: `aks-rp-e2e.planner.slow-count-24h`
- Judged on: `2026-07-16`

## Why this is a wait, not a stale resolve or escalation

The breach is still real right now, so this is **not** a stale alert:

- runtime metric row still shows `current=2`, `threshold=0`, `target=0`, `priority=P2`
- direct recompute from the metric source command also returned `2`

However, the current breach is coming from only **two older slow planner wakes**
inside the rolling 24-hour window, and the planner has been healthy since the
newest one landed. That makes the correct disposition a visible wait for decay
or a genuinely new regression, not a manual resolve.

## Metric definition checked

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` still defines the metric as:

- trailing 24-hour `planner_wake` rows where `durationMs >= 180000`, or
- rows whose result includes `timed out after`, or
- rows whose status is `interrupted` or `cancelled`

So this metric is still measuring real slow/timeout planner incidents rather
than a known measurement bug.

## Current contributing slow wakes

A bounded parse of `projects/aks-rp-e2e.app/.state/planner-runs.jsonl` found
exactly these two qualifying planner wakes in the current trailing 24-hour
window:

1. `2026-07-15T10:32:58.641Z` — `status=assigned`, `steps=["event-review","planning-update"]`, `result="Agent step \"app-ops\" timed out after 360000ms"`
2. `2026-07-15T12:30:00.513Z` — `status=assigned`, `steps=["event-review","planning-update"]`, `result="Agent step \"app-ops\" timed out after 360000ms"`

## Evidence that the planner recovered after the last slow wake

After the newest qualifying slow wake at `2026-07-15T12:30:00.513Z`:

- there were `619` later `planner_wake` rows
- `laterSlowCount = 0`
- the latest later planner wake in the same log was
  `2026-07-16T02:45:59.231Z` with `status=settled` and
  `steps=["event-review","planning-update"]`

Recent completed owner sessions also show normal planner behavior again, for
example:

- `s_project_planner_event_review_20260716024425_8njo85` → `done`
- `s_project_planner_planning_update_20260716024425_nrjve7` → `done`

So the alert is currently a trailing-window residue from two already-past
planner timeouts, not evidence of an ongoing fresh burst.

## Chosen operation

Choose `waiting_with_evidence` because the alert is still truthful and visible,
but the latest source evidence shows no new slow planner wakes after the last
qualifying timeout. The safe next action is to leave the alert open and validate
on the next measurement cycle rather than force-resolving or reclassifying it.

## Next validation

Validate on the next `metrics-snapshot` for
`aks-rp-e2e.planner.slow-count-24h`.

Healthy outcome:

- the metric starts dropping below `2` as those two `2026-07-15` timeouts age
  out of the 24-hour window, and
- no new qualifying slow planner wakes appear in `planner-runs.jsonl` before
  that decay happens.
