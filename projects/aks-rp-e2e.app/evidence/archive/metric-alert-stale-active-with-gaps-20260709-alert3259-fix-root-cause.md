# Metric alert triage — fix_root_cause — `aks-rp-e2e.task.stale-active-with-gaps`

- Alert id: `3259`
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Judged at: `2026-07-09T08:32:26Z`
- Chosen operation: `fix_root_cause`

## Why this breach was real

Runtime metric state at alert time reported a live breach:

- `metrics.current=1`, `threshold=0`, `target=0`, `priority=P0`
- recent snapshots flipped `0 -> 1`
- local sampling before repair still returned `value=1`

The active leaf that caused the breach was:

- task id: `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090822`
- task state before repair: `active`
- task session id: `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822`

Runtime inspection showed that exact session id was absent from the `sessions` table, so the task tree still claimed active work that no longer had a live worker session.

## Concrete owner action taken

I repaired the stale active state using the task-tree safe mutation path instead of editing runtime files directly:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree requeue-active \
  verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607090822 \
  --reason "stale-active metric repair: task session s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607090822 is absent from runtime sessions; requeue for clean reassignment"
```

That changed the leaf from `active` to `backlog` and recorded:

- `trace.stale_active_requeued_at=2026-07-09T08:31:59.408Z`
- `trace.stale_active_requeue_reason=...session ... is absent from runtime sessions...`

## Validation after repair

Immediately after the requeue:

- `bun run task-tree frontier` showed no active frontier items and exposed the repaired task as runnable backlog.
- `bun run scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json` returned `value=0`.
- `bun run scripts/project-metrics.ts aks-rp-e2e.task.stale-active-count --json` returned `value=0`.
- `bun run scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` returned `value=0` because runnable backlog now exists.

## Result

This was not a metric calibration problem and not a stale alert row. The root cause was a real task-tree/runtime mismatch: an `active` leaf referenced a missing worker session. Requeuing the leaf through the task-tree command restored truthful frontier state and cleared the sampled breach.
