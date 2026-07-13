# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.process.assignment.not-consumed-count`

- Alert id: `3507`
- Metric id: `aks-rp-e2e.process.assignment.not-consumed-count`
- Judged at: `2026-07-13T07:07:38Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row and open alert still show a breach (`current=1`, `resolved_at=null`), but a fresh owner-side recompute from the metric source command now returns `value=0` with no queued assignments. There is no live assignment-consumption defect left for app-ops to repair safely in this session, and this triage environment exposes only read-only runtime DB access, so the owner cannot directly resolve `metric_alerts` or rewrite `metrics.current` here.

## Evidence checked

### Persisted runtime state still shows the alert open

Runtime `metrics` row for `aks-rp-e2e.process.assignment.not-consumed-count`:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783926274271`
- `config = {"alert":{"mode":"consecutive_failures","count":1}}`

Open alert row:

- `metric_alerts.id = 3507`
- `resolved_at = null`
- `created_at = 1783926338239`

Latest persisted snapshot still shows the breach from the earlier sample window:

- `measured_at = 1783926274271`
- `value = 1`

### Fresh live recompute is already healthy

Fresh recompute from the metric source command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment.not-consumed-count --json
```

Observed result:

```json
{"measuredAt":1783926458840,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"assignments\":[]}"}
```

So the current live metric source no longer finds any queued assignment contributors.

### The suspected assignment was consumed by the worker

The assignment queue is now empty:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts assignments
```

Observed result:

```json
[]
```

The active task that had been assigned during the breach window now records a started worker attempt:

- task id: `ops/reconcile-spec-loop-runners-feature-set-contract-20260713`
- `trace.current_attempt_id = a_ops_reconcile-spec-loop-runners-feature-set-contract-20260713_20260713070555`
- `trace.worker_started_attempt_id = a_ops_reconcile-spec-loop-runners-feature-set-contract-20260713_20260713070555`
- `trace.worker_started_at = 2026-07-13T07:06:35.129Z`

That means the queued assignment that triggered the prior snapshot has already been consumed by the worker path, and the live recompute agrees.

## Why this is `waiting_with_evidence`

This alert is no longer a live dispatch-consumption defect that app-ops can fix inside this session.

What is true now:

1. The persisted metric row and open alert still reflect the earlier breach.
2. The live metric source command now returns `0` with an empty assignments list.
3. The currently active assigned task shows `worker_started_attempt_id` equal to `current_attempt_id`, which is exactly the consumed state this metric expects.
4. This environment does not provide a safe runtime write path to clear the stale alert row directly.

Because the current live source is already in range, `fix_root_cause` would be misleading for this session, and `resolve_stale` would require a runtime write path that is not available here. The concrete owner action taken is to record durable evidence that the breach has already recovered in the live source of truth and should now be validated by the next normal metrics refresh.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle.

Expected outcomes:

- persisted `metrics.current` for `aks-rp-e2e.process.assignment.not-consumed-count` updates from `1` to `0`, and
- alert `3507` resolves automatically.

If the next refresh still persists `1`, re-triage using the fresh contributor set from `project-metrics.ts` rather than the stale persisted snapshot.
