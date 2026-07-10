# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3325)

- Date: 2026-07-10
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3325`
- Owner: `app-ops`

## Judgment

This alert is stale now.

Fresh live recomputes from the metric implementation currently return `0` for both:

- `aks-rp-e2e.process.integrity.task-tree-problem-count`
- `aks-rp-e2e.process.assignment-state-mismatch-count`

The persisted metric row still shows `current = 1`, so the open alert is lagging behind current runtime state rather than reflecting a still-live integrity problem.

## Evidence checked

### Persisted metric row still shows the old breach

Runtime DB inspection showed the metric row still at:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783652633497`

Open alert row:

- `metric_alerts.id = 3325`
- `resolved_at = null`

### Live task-tree shape is valid now

`bun run task-tree summary` showed:

- `roots = ["project"]`
- active task ids only:
  - `compact-feature-cluster-autoscaler`
  - `ops/retry-routed-workflow-session-row-verification-after-empty-turn-20260710`

So there is no current multi-root or detached-root problem.

### Fresh live metric recomputes are back in range

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed:

```json
{"measuredAt":1783653171352,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed:

```json
{"measuredAt":1783653171519,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

### Integrity check is not reporting a current app-integrity failure here

`bun run integrity` returned:

- `App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=162`

with only unrelated domain-workspace warnings about legacy `tasks/` and `agents/` directories.

## Why this is `resolve_stale`

- The metric implementation is the source of truth for whether the threshold is currently breached.
- Fresh direct recomputes are `0` now.
- The persisted metric row and open alert are therefore stale relative to current runtime state.
- This session has read-only DB access, so the correct owner action available here is to record the stale-state judgment as durable evidence and wait for the supported metrics snapshot / recovery cycle to clear the persisted alert state.

## Next validation

Validate on the next `metrics-snapshot` / alert refresh for `aks-rp-e2e.process.integrity.task-tree-problem-count`.

Expected recovery signal:

- recomputed metric remains `0`
- `metrics.current` refreshes from `1` to `0`
- alert `3325` resolves automatically
