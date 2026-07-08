# Metric recovery review — `aks-rp-e2e.process.blocked.missing-waiting-for-count` (alert 3035)

- Alert id: `3035`
- Event type: `metric.recovered`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `no_change_needed`

## Recovery assessment

This recovery does **not** require a new task-tree repair, metric-definition change, or owner-context update.

The current state is internally consistent:

- the recovery event reports `current = 0`
- a fresh direct blocked-task audit of `projects/aks-rp-e2e.app/tasks/tree.json` found `missing = 0`
- a fresh direct blocked-task audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found `missing = 0`
- a fresh metric recompute returned `{"value":0}` for `aks-rp-e2e.process.blocked.missing-waiting-for-count`

## Why no further tree change is useful now

Earlier same-day triage already fixed the last concrete offender:

- `evidence/metric-alert-blocked-missing-waiting-for-count-20260707-alert3019.md`

That repair added the missing machine-readable `blocker.waiting_for` contract to the blocked task:

- `wait-compact-machines-agentpool-run-28809049156-review-20260707`

This recovered event is therefore best interpreted as confirmation that the prior blocked-contract repair worked and that the metric sampler is aligned with both the committed and runtime task trees.

## Decision

Leave the project/task tree and metric definition unchanged.

- No blocked task currently lacks `blocker.waiting_for`
- The metric definition in `scripts/register-project-metrics.ts` and sampler wiring in `scripts/project-metrics.ts` still match the intended contract
- No new owner memory/context is needed because this is a normal recovery after a documented same-day repair

## Next validation trigger

Only act again if a future nonzero sample names a new blocked task missing `waiting_for`, or if a future breach appears while fresh direct audits still show `0`, which would indicate sampler drift rather than task-tree contract drift.
