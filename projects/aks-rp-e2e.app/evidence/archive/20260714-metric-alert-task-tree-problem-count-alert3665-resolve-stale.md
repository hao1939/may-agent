# Metric alert triage — `aks-rp-e2e.process.integrity.task-tree-problem-count` (alert 3665)

- Date: 2026-07-14
- Final operation: `resolve_stale`
- Metric id: `aks-rp-e2e.process.integrity.task-tree-problem-count`
- Alert id: `3665`
- Owner: `app-ops`

## Judgment

This alert is stale/transient relative to the current live source of truth.

At triage start, the persisted metric row still showed `current=1`, alert `3665` was open, and one immediate live recompute also returned `value=1`. But within the same bounded triage window, without any manual DB or task-tree mutation from this session, `bun run integrity` returned `App integrity OK`, `bun run task-tree summary` showed the focus/review split back in a valid one-root shape, and a second fresh live recompute returned `value=0`.

Because this metric is computed directly from current task-tree integrity state, a current live recompute of `0` plus a passing integrity check means the breach that raised alert `3665` is no longer present now. The remaining inconsistency is the persisted metric/alert lifecycle waiting for the next snapshot refresh.

## Evidence checked

### 1) Persisted metric row was still breaching

```sql
SELECT id, current, threshold, target, priority, status, updated_at
FROM metrics
WHERE id = 'aks-rp-e2e.process.integrity.task-tree-problem-count';
```

Result excerpt:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1784029772046`

### 2) Alert row was still open

```sql
SELECT id, metric_id, alert_type, message, resolved_at, created_at
FROM metric_alerts
WHERE id = 3665;
```

Result excerpt:

- `resolved_at = null`
- message = `AKS RP E2E task tree integrity problems is above threshold: current=1, threshold=0, target=0`

### 3) Recent persisted snapshots show a brief spike, not a long sustained breach

```sql
SELECT value, measured_at, measured_by
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.process.integrity.task-tree-problem-count'
ORDER BY measured_at DESC
LIMIT 3;
```

Result excerpt:

- latest persisted sample at `1784029772046` = `1`
- previous persisted sample at `1784029141939` = `0`
- earlier persisted sample at `1784028832238` = `0`

### 4) First live recompute during triage still saw the transient breach

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784029884400,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":1}
```

### 5) Current integrity check now passes

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run integrity
```

Observed result:

```text
[warn] domain workspace still contains tasks/; app-control task trees belong in aks-rp-e2e.app/tasks/
[warn] domain workspace still contains agents/; app-control agent workspace belongs in aks-rp-e2e.app/agents/
App integrity OK: aks-rp-e2e owner=aks-explorer workflows=15 tasks=128
```

### 6) Current live task-tree summary is back in the expected shape

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree summary
```

Observed excerpt:

```json
{
  "roots": ["project"],
  "frontier": {
    "active": [
      "focus-terminal-frontier-finality-reconciliation-20260714",
      "ops/reconcile-project-root-shared-wait-family-carriers-20260714c"
    ],
    "review": [
      "ops/reconcile-project-root-residual-blocker-carriers-20260714d"
    ]
  }
}
```

### 7) Second fresh live recompute already recovered to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.integrity.task-tree-problem-count --json
```

Observed result:

```json
{"measuredAt":1784029937509,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

## Why this is `resolve_stale`

- The persisted metric row and alert still reflect the earlier `current=1` sample.
- The current live metric source now returns `0`.
- `bun run integrity` currently passes.
- The current live task-tree summary again shows a single `project` root and a coherent active/review frontier.
- This session has read-only DB access only, so the safe action is to record the stale-state judgment and wait for the next `metrics-snapshot` / alert refresh to reconcile the persisted row automatically instead of making ad hoc runtime DB edits.

## Next validation

Next validation point: the next `metrics-snapshot` / alert refresh should move persisted `metrics.current` for `aks-rp-e2e.process.integrity.task-tree-problem-count` from `1` to `0` and clear alert `3665` automatically.
