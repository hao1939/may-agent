# Metric recovery review — `aks-rp-e2e.process.blocked.missing-observer-count` (alert 3036)

- Alert id: `3036`
- Event type: `metric.recovered`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T13:13:10Z`
- Chosen operation: `no_change_needed`

## Recovery assessment

This recovery does **not** require a new task-tree repair, metric-definition change, or owner-context update.

The current state is internally consistent:

- the recovery event reports `current = 0`
- the persisted metric row now shows `current = 0`
- alert `3036` is already resolved
- a fresh direct blocked-task audit of `projects/aks-rp-e2e.app/.state/tasks/tree.json` found `missing = 0`
- a fresh metric recompute returned `{"value":0}` for `aks-rp-e2e.process.blocked.missing-observer-count`

## Why no further tree change is useful now

Earlier same-day triage already repaired the concrete blocked-contract defect and captured the root-cause evidence:

- `evidence/metric-alert-blocked-missing-observer-count-20260707-alert3033.md`
- `evidence/metric-alert-blocked-missing-observer-count-20260707-alert3036.md`

Those triage notes showed that the live offender(s) were runtime blocked leaves missing observer metadata and that the supported repair path cleared the live sample back to zero.

The recovered event is therefore best interpreted as confirmation that the prior blocked-contract repair worked and that the sampler, persisted metric row, and alert state are now aligned.

## Decision

Leave the project/task tree and metric definition unchanged.

- No blocked task currently lacks required observer metadata
- The metric definition in `scripts/register-project-metrics.ts` still matches the intended blocked-contract rule
- No new durable owner memory is needed because this is a normal recovery after documented same-day repair

## Next validation trigger

Only act again if a future nonzero sample names a new blocked task missing observer metadata, or if a future breach appears while fresh direct audits still show `0`, which would indicate sampler drift rather than a task-tree contract defect.
