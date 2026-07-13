# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3465)

## Judgment

Chosen operation: `waiting_with_evidence`

The open alert and runtime metric row still show a breach (`current=1`, unresolved alert 3465), but a fresh live recompute already returns `0` and `bun run integrity` reports `App integrity OK`. That means the most likely current state is a transient or stale alert awaiting the next metrics snapshot / alert reconciliation cycle, not an active task-tree integrity defect that app-ops can safely repair right now.

## Evidence checked

### Runtime metric row

```sql
SELECT id, current, threshold, target, priority, project, status, updated_at, alert_op, blocker
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `project = aks-rp-e2e`
- `updated_at = 1783850684701`

### Open alert row

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3465;
```

Result:

- `id = 3465`
- `metric_id = aks-rp-e2e.process.integrity.task-tree-problem-count`
- `resolved_at = NULL`
- message says `current=1, threshold=0, target=0`

### Recent snapshots

Latest snapshots show a single fresh breach after a long run of `0` values:

- `1783850684701 -> 1`
- `1783850371252 -> 0`
- `1783850056839 -> 0`
- `1783849743536 -> 0`
- `1783849427664 -> 0`

### Metric implementation

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` computes this metric as:

```ts
const assignmentStateMismatch = openTaskAssignmentStateMismatchCount(tree);
...
taskTreeProblemCount: (roots === 1 ? 0 : 1) + assignmentStateMismatch,
...
"aks-rp-e2e.process.integrity.task-tree-problem-count": () => ({
  value: tasks.taskTreeProblemCount,
}),
```

So the metric only reflects task-tree root count or assignment-state mismatch count.

### Fresh live recompute

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Result:

```json
{"measuredAt":1783850773270,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### Integrity check

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Result:

- warnings only about domain workspace residue:
  - `domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/`
  - `domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/`
- final status: `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=141`

## Why this operation

- Not `fix_root_cause`: the current live recompute does not reproduce a task-tree integrity breach, so there is no safe active defect to repair.
- Not `resolve_stale`: this session has no safe runtime write path for the `metric_alerts` row.
- Not `upgrade_or_escalate`: the evidence does not show an active integrity emergency; it shows apparent recovery that has not yet propagated into the snapshot-backed metric row and alert lifecycle.

## Next validation

Wait for the next `metrics-snapshot` / alert reconciliation cycle to refresh:

- `metrics.current` for `aks-rp-e2e.process.integrity.task-tree-problem-count`
- alert `3465` resolution state

Expected recovery signal: the metric remains `0` and alert `3465` resolves on the next snapshot refresh.
