# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3270)

- Date: 2026-07-09
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3270`
- Owner: `app-ops`

## Judgment

This alert is stale in persisted runtime state, not a currently reproducible task-tree integrity defect.

The persisted metric row still shows `current = 1`, but fresh live checks now show:

- the task tree has exactly one root (`project`)
- the app integrity check passes
- live recomputes of both `process.assignment-state-mismatch-count` and `process.integrity.task-tree-problem-count` return `0`

Because this metric is defined as `(roots === 1 ? 0 : 1) + assignmentStateMismatch`, a current live value of `0` means neither root-shape nor assignment-mismatch contributors are presently breaching.

## Evidence checked

### 1) Persisted metric row still shows the old breach

```sql
SELECT current, updated_at, threshold, target, priority, status
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`

### 2) Live task-tree summary shows exactly one root

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed excerpt:

```json
{
  "roots": ["project"],
  "active_task_ids": [
    "ops/repair-task-tree-archived-evidence-metadata-primitive-20260709m",
    "ops/repair-unowned-work-assignment-mismatch-done-attempt-20260709n"
  ]
}
```

### 3) Integrity check passes now

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed result:

```text
$ bun run ./scripts/check-integrity.ts
[warn] domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/
[warn] domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=553
```

### 4) Metric implementation says this alert is only root-count plus assignment mismatch

Source excerpt from `scripts/project-metrics.ts`:

```ts
taskTreeProblemCount: (roots === 1 ? 0 : 1) + assignmentStateMismatch,
```

### 5) Live assignment-mismatch contributor is now zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed result:

```json
{"measuredAt":1783598015177,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### 6) Live integrity metric recompute is now zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1783598020131,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

## Why this is `resolve_stale`

- The live source of truth is back in range.
- The persisted alert is lagging behind current runtime state.
- No safe runtime write path is available in this session to edit `metric_alerts` or force a snapshot refresh directly.
- The correct owner action is therefore to document the stale-state judgment and let the next supported metrics snapshot / alert reconciliation cycle close the alert automatically.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `1` to `0`
- alert `3270` resolves automatically
