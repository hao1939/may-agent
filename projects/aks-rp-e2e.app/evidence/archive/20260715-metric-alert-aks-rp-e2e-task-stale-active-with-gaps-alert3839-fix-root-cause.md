# Metric alert triage — aks-rp-e2e.task.stale-active-with-gaps (alert 3839)

- Operation: `fix_root_cause`
- Triage time: 2026-07-15T15:01:47Z
- Alert row at triage: current runtime metric row still `current=1`, `threshold=0`, `priority=P0`, `updated_at=1784127012069`.

## Why the breach was real

Fresh owner-side sampling before repair reproduced the breach:

- `bun ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json`
  returned `{"value":1,"measuredAt":1784127638845}`.
- `bun ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-count --json`
  returned `{"value":2,"measuredAt":1784127638630}`.
- `bun ./scripts/project-metrics.ts aks-rp-e2e.process.unowned-work-count --json`
  reported stale active task id `fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203` with stale session `s_task_fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203_zure-overlay-dual-stack-windows2022-run-172310203_20260715140903` and restart reason `session-no-activity`.

The active task state confirmed the stale carrier:

- `task-tree show fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203`
  showed `state: active`, `owner: aks-explorer`, session id `s_task_fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203_zure-overlay-dual-stack-windows2022-run-172310203_20260715140903`, and `worker_started_at: 2026-07-15T14:15:04.813Z`.
- Runtime `sessions` row for that session still showed `status='running'` but `lastActivityAt=1784125706771`, which was more than the 10 minute stale threshold behind triage time.

## Concrete fix applied

Used the app-safe task-tree repair path to requeue the stale active leaf:

```bash
bun ./scripts/task-tree.ts requeue-active \
  fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203 \
  --reason "metric-alert aks-rp-e2e.task.stale-active-with-gaps: session stale >10m with verification gaps remaining" \
  --fresh-session
```

The command returned the repaired task id:

```json
["fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203"]
```

## Validation after repair

Fresh owner-side resampling after the repair showed the targeted metric cleared:

- `aks-rp-e2e.task.stale-active-with-gaps` -> `0` at `measuredAt=1784127723380`
- `aks-rp-e2e.task.stale-active-count` -> `0` at `measuredAt=1784127731120`

The task tree now shows the stale carrier removed from active frontier and returned to runnable backlog:

- `task-tree show fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203`
  now shows `state: backlog` with trace fields:
  - `stale_active_requeued_at: 2026-07-15T15:01:47.634Z`
  - `stale_active_requeue_reason: metric-alert aks-rp-e2e.task.stale-active-with-gaps: session stale >10m with verification gaps remaining`
  - `stale_active_fresh_session: true`
- `task-tree summary` now lists `fix-network-cni-azure-overlay-dual-stack-windows2022-run-172310203` under `frontier.runnable` and no longer under `frontier.active`.

## Remaining follow-up outside this alert

`aks-rp-e2e.process.unowned-work-count` still sampled `1` immediately after the requeue because the replacement worker session started before the task state was re-promoted to active, yielding an assignment-mismatch note for the same task. That is a separate open metric alert and should be validated/fixed by its own triage path; it does not change the fact that the stale-active-with-gaps root cause was repaired.

## Next validation signal

Wait for the next `metrics-snapshot` run to update the persisted runtime `metrics` row and close alert 3839 if the repaired live state holds.
