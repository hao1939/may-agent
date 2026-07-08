# Metric alert triage — aks-rp-e2e.process.assignment-state-mismatch-count (alert 3114)

- Alert id: `3114`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Judged at: `2026-07-08T02:41:10Z`
- Chosen operation: `waiting_with_evidence`

## Current persisted alert state checked

Persisted metric state still shows a breach:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- open alert row `metric_alerts.id = 3114`, `resolved_at = null`

Recent persisted snapshots for this metric:

- `1783505861064` => `1`
- `1783505545314` => `0`
- `1783505231245` => `0`
- `1783504917961` => `0`
- `1783504605601` => `0`

Recent metric lifecycle evidence shows this family has already had transient breach/recovery cycles today, including a prior recovery event for alert `3088` and a prior judged stale/recovered cycle for alert `3082`.

## Current live verification

Fresh direct recompute no longer reproduces the breach:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed output:

```json
{"measuredAt":1783506288856,"value":0}
```

The metric implementation counts only open/orphan `event_pair_runs` rows for `pair_name='project.task'` whose correlated task is missing or not `active`.

Current live `event_pair_runs` inspection showed six open `project.task` rows, but every sampled row is a freshly assigned current attempt for still-live work, for example:

- `reconcile-compact-loop-live-workflow-202607081018:a_reconcile-compact-loop-live-workflow-202607081018_20260708102352`
- `reconcile-spec-loop-pending-cluster-autoscaler-6:a_reconcile-spec-loop-pending-cluster-autoscaler-6_20260708102308`
- `reconcile-spec-loop-pending-secops-fips-7:a_reconcile-spec-loop-pending-secops-fips-7_20260708102250`
- `reconcile-spec-loop-pending-network-cni-9:a_reconcile-spec-loop-pending-network-cni-9_20260708102243`
- `repair-spec-net-integration-custom-route-table-user-assigned-msi-node-payload-20260708:a_repair-spec-net-integration-custom-route-table-user-assigned-msi-node-payload-20260708_20260708102208`
- `reconcile-spec-loop-pending-kms-7:a_reconcile-spec-loop-pending-kms-7_20260708101902`

Recent event/session evidence confirms these are active or just-finished current attempts rather than stale orphaned pairs:

- assignment events exist for all six keys in the last minutes;
- completion events already arrived for `reconcile-spec-loop-pending-kms-7`, `reconcile-compact-loop-live-workflow-202607081018`, `reconcile-spec-loop-pending-cluster-autoscaler-6`, `reconcile-spec-loop-pending-secops-fips-7`, and `reconcile-spec-loop-pending-network-cni-9`;
- the planner packet at `1783506286846` already moved several of those tasks into `review`, consistent with a transient assignment-state race between snapshot timing and closure handling.

## Why this is `waiting_with_evidence`

There is no current reproducible assignment-state mismatch to repair safely from this session:

1. the persisted metric row still says `current=1`,
2. the direct recompute already says `value=0`, and
3. the currently open `project.task` pairs correspond to active in-flight work rather than missing/non-active tasks.

That means the most truthful current state is a transient or already-healed assignment-state mismatch whose persisted metric/alert lifecycle has not yet caught up.

This triage environment does not provide a safe runtime write path to force-resolve `metric_alerts` or manually rewrite the metric row. The concrete owner action available here is therefore to record durable evidence that the live source of truth is already back in range and wait for the next supported metrics refresh to validate recovery or reproduce a new live offender.

## Concrete next validation

Wait for the next `metrics-snapshot` / alert reconciliation cycle for `aks-rp-e2e.process.assignment-state-mismatch-count`.

Recovery is confirmed when the persisted metric row refreshes to `0` and alert `3114` resolves automatically. If a future recompute returns `>0` again, re-open only with the exact current `correlation_key` values whose correlated tasks are missing or non-active at that time.