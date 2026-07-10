# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` alert 3323

- Alert id: `3323`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Judged at: `2026-07-10T11:43:09Z`
- Chosen operation: `waiting_with_evidence`

## Persisted alert state checked

The persisted runtime metric row still shows an active breach:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- open alert row `metric_alerts.id = 3323`, `resolved_at = null`
- persisted metric `updated_at = 1783650441256`

Recent persisted snapshots for this metric show a single-sample spike after a long zero run:

- `1783650441256` => `1`
- `1783649804967` => `0`
- `1783649492274` => `0`
- `1783648839844` => `0`
- `1783648253645` => `0`
- `1783647874029` => `0`
- `1783647218642` => `0`
- `1783646596038` => `0`
- `1783645901365` => `0`
- `1783645259462` => `0`

## Current live verification

Fresh direct recompute no longer reproduces the breach:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed output:

```json
{"measuredAt":1783651277735,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

The metric implementation is a direct gauge of `tasks.assignmentStateMismatch`:

```ts
"aks-rp-e2e.process.assignment-state-mismatch-count": () => ({
  value: tasks.projectClosed ? 0 : tasks.assignmentStateMismatch,
}),
```

Current open `project.task` pair rows are all live active assignments rather than stale missing/non-active tasks:

- `compact-feature-cluster-autoscaler:a_compact-feature-cluster-autoscaler_20260710023331`
- `ops/fix-worker-routable-approval-dispatch-emitter-surface-20260710:a_ops_fix-worker-routable-approval-dispatch-emitter-surface-20260710_20260710023942`
- `ops/investigate-session-row-loss-compact-cluster-autoscaler-20260710c:a_ops_investigate-session-row-loss-compact-cluster-autoscaler-20260710c_20260710023942`
- `domain/reconcile-localdns-pending-current-facts-20260710:a_domain_reconcile-localdns-pending-current-facts-20260710_20260710023942`

Recent task completion history also shows the system is actively closing task pairs, including:

- `project.task.completed` for `domain/reconcile-localdns-pending-current-facts-20260710` at `1783651273487`
- `project.task.completed` for `ops/investigate-session-row-loss-compact-cluster-autoscaler-20260710c` at `1783650986623`
- `metric.recovered` events at `1783648730698` and `1783648730796` for prior recovery cycles in this family

## Why this is `waiting_with_evidence`

This alert is currently best judged as a stale/transient persisted breach that has already healed in the live source of truth:

1. the persisted `metrics` row still says `current=1`,
2. the current direct metric recompute says `value=0`, and
3. the currently open `project.task` pairs are all legitimate in-flight assignments rather than stale orphaned pairs.

I do not have a safe runtime write path in this session to manually resolve `metric_alerts` or rewrite the persisted metric row. The truthful owner action available here is therefore to record durable evidence that the live measurement is back in range and wait for the next supported `metrics-snapshot` / alert reconciliation cycle to catch up.

## Concrete next validation

Wait for the next `metrics-snapshot` / alert reconciliation cycle for `aks-rp-e2e.process.assignment-state-mismatch-count`.

Recovery is confirmed when the persisted metric row refreshes to `0` and alert `3323` auto-resolves. If a future direct recompute returns `>0` again, reopen only with the exact current `correlation_key` values whose correlated tasks are missing or non-active at that time.
