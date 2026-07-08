# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 3100)

- Alert id: `3100`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-08T02:41Z`
- Chosen operation: `resolve_stale`

## Decision

Choose `resolve_stale`.

The alert payload reported `current=1`, but the live runtime state has already recovered:

- the current metric row now shows `current=0`
- the newest snapshot is `0` with `offenderTaskIds=[]`
- there is no longer any open `metric_alerts` row for this metric
- direct recompute from `scripts/project-metrics.ts` returns `0`
- direct audits of both `.state/tasks/tree.json` and `tasks/tree.json` find no blocked task missing `fallback_at` or `fallback_action`

That means alert `3100` is stale relative to current runtime state and has already self-resolved through the normal metrics snapshot / alert reconciliation path.

## Facts checked

### Current runtime DB state

Metric row now shows:

- `current = 0`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783501653940`

Open alert rows now show:

- `0` open alerts for `aks-rp-e2e.process.blocked.missing-fallback-count`

### Recent snapshots

Most recent snapshots inspected:

- `1783501653940 => 0` with `{"offenderTaskIds":[]}`
- `1783501285498 => 1` with `{"offenderTaskIds":["rerun-spec-storage-csi-file-clone-same-path-20260708-blocked"]}`
- `1783500971111 => 0` with `{"offenderTaskIds":[]}`
- older recent samples also `0`

This shows a short-lived spike that has already recovered.

### Direct recompute

Command run in this session:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

Observed output:

```text
0
```

### Current task-tree audits

A direct scan of both `.state/tasks/tree.json` and `tasks/tree.json` found:

- runtime tree missing-fallback offenders: `0`
- committed tree missing-fallback offenders: `0`

## Why `resolve_stale` is correct

- The metric breach was real at sample time, but it is not currently breaching.
- The alert row already cleared through the normal runtime path, so there is nothing left to fix or manually resolve.
- The correct durable action for this triage is to record that alert `3100` was transient/stale by the time of judgment.

## Next validation signal

The next `metrics-snapshot` for `aks-rp-e2e.process.blocked.missing-fallback-count` should remain `0` with `offenderTaskIds=[]`.
If it returns to `>0`, reopen only with the fresh blocked task id(s) from that sample.
