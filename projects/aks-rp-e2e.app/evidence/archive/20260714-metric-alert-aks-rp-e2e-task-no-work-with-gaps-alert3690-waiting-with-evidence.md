# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3690`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triaged at: `2026-07-14T16:23:21Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row still shows a breaching sample (`current=1`), but the owner-side source metric now recomputes healthy (`0`) under the current live task tree and running worker sessions. This environment does not provide a safe runtime write path for `metrics` or `metric_alerts`, so the concrete owner action is to leave durable evidence and wait for the next `metrics-snapshot` / alert-recovery pass.

## Metric definition checked

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines this metric as:

```ts
!approvalBlockedSuppression &&
!tasks.projectClosed &&
tasks.runnable === 0 &&
healthyActive === 0 &&
openGaps > 0
  ? 1
  : 0
```

So the metric should be `1` only when the project has:

1. no runnable backlog,
2. no healthy active-running task,
3. and verification gaps still open.

## Runtime metric state checked

Read-only runtime inspection during triage showed:

- `metrics.current = 1`
- `metrics.updated_at = 1784048838701`
- alert `3690` is still unresolved
- latest snapshot sequence: `1, 0, 1, 0, 0, 0, 0, 0, 0, 0`

That alternating pattern is consistent with a transient or timing-sensitive stale sample, not a stable starvation condition.

## Current owner-side recomputation

Command:

```bash
cd /app/projects/aks-rp-e2e.app && \
  printf 'active-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.active-count && \
  printf 'stale-active-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.stale-active-count && \
  printf 'no-work-with-gaps=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps && \
  printf 'unknown-path-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.model.unknown-path-count && \
  printf 'spec-unverified-count=' && bun run ./scripts/project-metrics.ts aks-rp-e2e.spec.unverified-count
```

Observed output:

```text
active-count=1
stale-active-count=0
no-work-with-gaps=0
unknown-path-count=60
spec-unverified-count=89
```

Interpretation:

- `unknown-path-count=60` and `spec-unverified-count=89` prove verification gaps still remain.
- `active-count=1` and `stale-active-count=0` prove there is at least one healthy active worker.
- Therefore the no-work condition is false right now, so the owner-side metric correctly recomputes `0`.

## Live task and session evidence

Current live task summary shows:

- `active: ops-apply-repair-post-dismissal-escalation-terminal-sync-20260714-state-`
- leaf state: `active: 1`, `blocked: 122`, `done: 1`
- `runnable: none`
- `review: none`

The active task record includes:

- `state: active`
- `owner: app-ops`
- `session_id: s_task_ops-apply-repair-post-dismissal-escalation-terminal-sync-20260714-state-`
- `worker_started_at: 2026-07-14T17:08:22.415Z`

The runtime `sessions` table also shows two current running app-ops sessions for project `aks-rp-e2e`:

1. `s_task_ops-apply-repair-post-dismissal-escalation-terminal-sync-20260714-state-`
2. `s_project_planner_planning_update_20260714170819_61bmmz`

This matches the healthy recomputation: the project is not out of executable owner work anymore.

## Why this is not another operation

- Not `fix_root_cause`: there is no remaining no-work frontier to repair for this alert right now; the source metric already computes healthy.
- Not `resolve_stale`: the alert likely is stale, but this workflow has no safe runtime write path to resolve `metric_alerts` directly.
- Not `calibrate_metric`: the metric contract still correctly describes a real P0 starvation condition.
- Not `downgrade_priority`: a true no-work-with-gaps breach should remain P0.
- Not `upgrade_or_escalate`: no destructive action or human policy decision is needed.
- Not `document_exception`: this is not an intentionally accepted breach.

## Next validation

Wait for the next `metrics-snapshot` / alert-recovery pass. Expected validation: the persisted runtime row for `aks-rp-e2e.task.no-work-with-gaps` should move from `1` to `0`, after which alert `3690` should recover naturally. If the persisted row remains `1` after the next snapshot while the owner-side metric command still returns `0`, re-triage it as a metric state-sync defect rather than project starvation.
