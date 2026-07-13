# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3435)

## Judgment

Chosen operation: `waiting_with_evidence`

The runtime metric row and open alert still show a breach (`current=1`, alert unresolved), but the current live recompute already returns `0` and `bun run integrity` reports `App integrity OK`. This means the most likely state is a transient/stale alert waiting for the next metrics snapshot / alert reconciliation cycle rather than an active tree-integrity defect that app-ops can safely repair right now.

## Evidence checked

### Runtime alert row

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3435;
```

Result:

- `id = 3435`
- `metric_id = aks-rp-e2e.process.integrity.task-tree-problem-count`
- `resolved_at = NULL`
- message says `current=1, threshold=0, target=0`

### Metric row at alert time

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
- `updated_at = 1783794580497`

### Metric implementation

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` computes:

```ts
taskTreeProblemCount: (roots === 1 ? 0 : 1) + assignmentStateMismatch,
```

and exports the metric as:

```ts
"aks-rp-e2e.process.integrity.task-tree-problem-count": () => ({
  value: tasks.taskTreeProblemCount,
}),
```

### Fresh live recompute

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Result:

```json
{"measuredAt":1783794874427,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### Integrity check

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Result:

- Warnings only about domain workspace residue:
  - `domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/`
  - `domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/`
- Final status: `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=140`

## Why not another operation?

- Not `fix_root_cause`: there is no currently reproducible task-tree root/integrity failure to repair.
- Not `resolve_stale`: this environment has no safe runtime write path to resolve the alert row directly.
- Not `upgrade_or_escalate`: evidence does not show an active integrity emergency; it shows apparent recovery already happened.

## Next validation

Wait for the next `metrics-snapshot` / alert reconciliation cycle to refresh:

- `metrics.current` for `aks-rp-e2e.process.integrity.task-tree-problem-count`
- alert `3435` resolution state

Expected recovery signal: metric remains `0` and alert `3435` resolves on the next snapshot refresh.
