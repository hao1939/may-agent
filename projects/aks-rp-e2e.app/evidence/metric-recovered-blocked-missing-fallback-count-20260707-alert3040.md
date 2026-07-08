# Metric recovery review — `aks-rp-e2e.process.blocked.missing-fallback-count` (alert 3040)

- Alert id: `3040`
- Event type: `metric.recovered`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `no_change_needed`

## Recovery assessment

This recovery does **not** require a new task-tree repair, metric-definition change, or owner-context update.

The current state is internally consistent:

- the recovery event reports `current = 0`
- the persisted metric row now shows `current = 0`
- alert `3040` is already resolved
- a fresh direct blocked-task audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found `missing = 0`

## Why no further tree change is useful now

Earlier same-day triage already identified and fixed the concrete runtime-tree defect:

- `evidence/metric-alert-blocked-missing-fallback-count-20260707-alert2917.md`

That repair added the missing blocked-wait fallback contract to the runtime task:

- `wait-spec-network-acns-retina-enterprise-k8s-upgrade-run-28850100843-review-20260707`

A fresh read of the runtime tree now shows that task is no longer an active blocked leaf; it has already been reviewed and marked `done`, with the previous blocked contract preserved in `trace.previous_blocker_before_terminal_github_wait_review`.

The recovered event is therefore best interpreted as confirmation that the prior blocked-contract repair worked and that the sampler, persisted metric row, and alert state are now aligned.

## Decision

Leave the project/task tree and metric definition unchanged.

- No blocked task currently lacks required fallback metadata
- The metric definition still matches the intended blocked-contract rule
- No new durable owner memory is needed because this is a normal recovery after documented same-day repair

## Next validation trigger

Only act again if a future nonzero sample names a new blocked task missing `fallback_at` or `fallback_action`, or if a future breach appears while fresh direct audits still show `0`, which would indicate sampler drift rather than a task-tree contract defect.
