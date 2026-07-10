# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3322)

- Date: 2026-07-10
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3322`
- Owner: `app-ops`

## Judgment

This alert is stale now.

Fresh live recomputes from the metric implementation currently return `0` for both:

- `aks-rp-e2e.process.integrity.task-tree-problem-count`
- `aks-rp-e2e.process.assignment-state-mismatch-count`

The persisted metric row still shows `current = 1`, so the open alert is lagging behind current runtime state rather than reflecting a still-live integrity problem.

## Evidence checked

### Persisted metric row still shows the old breach

```sql
SELECT current, updated_at, threshold, target, priority, status
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Observed:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`

### Live task-tree shape is valid

`bun run task-tree summary` showed:

- `roots: ["project"]`

So there is no current multi-root / detached-root problem.

### Live integrity check is clean for this metric family

`bun run integrity` returned:

- `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=168`

### Fresh live metric recomputes are now back in range

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed:

```json
{"measuredAt":1783651237548,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed:

```json
{"measuredAt":1783651237699,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### Open `project.task` pairs no longer show a counted mismatch contributor

Current open pairs are only:

- `compact-feature-cluster-autoscaler:...`
- `domain/reconcile-localdns-pending-current-facts-20260710:...`
- `ops/fix-worker-routable-approval-dispatch-emitter-surface-20260710:...`

At current runtime state, the fresh recompute above confirms these no longer produce an assignment-state mismatch count.

## Why this is `resolve_stale`

- The metric implementation is the source of truth for the alert condition.
- Fresh direct recomputes are `0` now.
- The persisted metric row and open alert are therefore stale relative to current runtime state.
- This session has read-only DB access, so the correct owner action is to document the stale-state judgment and let the next supported metrics snapshot / alert reconciliation cycle clear the persisted alert state.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `1` to `0`
- alert `3322` resolves automatically
