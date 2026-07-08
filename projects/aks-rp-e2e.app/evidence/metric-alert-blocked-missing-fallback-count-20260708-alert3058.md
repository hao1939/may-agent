# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 3058)

- Alert id: `3058`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-08T02:41Z`
- Chosen operation: `resolve_stale`

## Decision

Choose `resolve_stale`.

The persisted runtime metric row still shows `current=1`, but a direct current recompute of the metric now returns `0`, and direct audits of both the runtime task tree (`.state/tasks/tree.json`) and committed task tree (`tasks/tree.json`) find no blocked task missing `fallback_at` or `fallback_action`.

That means alert `3058` is stale relative to current task-tree state.

## Facts checked

### Runtime DB state

Current runtime rows inspected in this session:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783486826548`
- alert row `3058` remains open with `resolved_at = null`

Latest snapshots:

- `1783486826548 => 1`
- `1783486516694 => 0`
- `1783486207610 => 0`
- `1783485898738 => 0`
- `1783485590502 => 0`
- `1783485280821 => 0`
- `1783484972387 => 0`
- `1783484664178 => 2`

This shows a point-in-time spike, not a sustained plateau.

### Current recompute

Command run in this session:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

Observed output:

```text
0
```

### Current task-tree audits

Command run in this session scanned both `.state/tasks/tree.json` and `tasks/tree.json` for blocked tasks missing `fallback_at` or `fallback_action`.

Observed result:

- runtime tree missing-fallback offenders: `0`
- committed tree missing-fallback offenders: `0`

## Why `resolve_stale` is correct

- The metric implementation remains correct; the current recompute is healthy.
- There is no current blocked task for app-ops to repair safely.
- This workflow does not provide a safe runtime write path to manually edit `metric_alerts`.
- The truthful action is to record that the alert is stale and allow the next `metrics-snapshot` / alert reconciliation cycle to clear the row.

## Next validation signal

Wait for the next `metrics-snapshot` / alert reconciliation cycle for `aks-rp-e2e.process.blocked.missing-fallback-count`.
If the runtime row updates to `0` and alert `3058` resolves, this judgment was correct.
If a later sample returns `>0`, reopen only with the fresh blocked task id(s) from that sample.
