# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3374)

- Date: 2026-07-10T17:53Z
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3374`
- Owner: `app-ops`

## Judgment

This alert is stale now.

The persisted metric row and fresh snapshot history show a new breach at `current = 3`, but fresh owner-side recomputes of the live metric family now return `0` for both:

- `aks-rp-e2e.process.integrity.task-tree-problem-count`
- `aks-rp-e2e.process.assignment-state-mismatch-count`

The live task tree also has exactly one root (`project`), so there is no current detached-root or multi-root integrity problem.

## Evidence checked

### Persisted metric row still shows the breach

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Observed:

- `current = 3`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`

Latest stored snapshots likewise show the jump from `0` to `3`.

### Metric implementation confirms what contributes to the count

`project-metrics.ts` defines:

```ts
taskTreeProblemCount: (roots === 1 ? 0 : 1) + assignmentStateMismatch,
```

So the metric can only be nonzero if either:

- the tree root count is not exactly one, or
- `assignmentStateMismatch` is nonzero.

### Fresh live recomputes are now back in range

```bash
cd /app/projects/aks-rp-e2e.app && bun ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed:

```json
{"measuredAt":1783705956402,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

```bash
cd /app/projects/aks-rp-e2e.app && bun ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed:

```json
{"measuredAt":1783706013315,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### Live task-tree shape is valid

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed relevant fields:

- `roots: ["project"]`
- no extra root ids are present

## Why this is `resolve_stale`

- The metric implementation is the source of truth for the alert condition.
- Fresh direct recomputes are `0` now.
- The current root count is valid and the mismatch contributor metric is also `0`.
- Therefore the open alert row is lagging behind current runtime state rather than describing a still-live integrity failure.

## Required follow-up validation

Wait for the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `3` to `0`
- alert `3374` resolves automatically
