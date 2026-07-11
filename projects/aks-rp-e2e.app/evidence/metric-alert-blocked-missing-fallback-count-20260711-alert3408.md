# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 3408)

- Alert id: `3408`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-10T17:23:55.855Z`
- Chosen operation: `resolve_stale`

## Decision

Choose `resolve_stale`.

The alert row is still open, but the current runtime recompute in this session returns `0`, and the named offender task now carries both required fallback fields. That means the threshold breach was transient or already repaired before this triage session, so the remaining open alert row is stale relative to current metric state.

## Facts checked

### Runtime metric row

Runtime DB read in this session showed:

- `current = 1`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783736820080`

### Latest snapshots

Recent runtime snapshots showed a single-sample spike and then earlier healthy values:

- `1783736820080 => value 1, offenderTaskIds=["hold-compact-app-monitoring-westus2-managed-cluster-capacity-frontier-20260710"]`
- `1783736513623 => value 0`
- `1783736203459 => value 0`
- `1783735895649 => value 0`
- `1783735569678 => value 0`

### Current offender task state

`bun run task-tree show hold-compact-app-monitoring-westus2-managed-cluster-capacity-frontier-20260710` now shows the blocked contract includes:

- `fallback_at = 2026-07-12T02:29:02.395Z`
- `fallback_action = "If the wait is still true at fallback time, create or reuse an owner recovery/escalation task, or update the blocked wait with fresh evidence."`

So the task named by the last bad sample no longer satisfies the metric's missing-fallback predicate.

### Current direct metric recompute

This session ran:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

Observed output:

```text
0
```

That is the current source-command for this metric and is the strongest available read-path in this environment.

## Why this is `resolve_stale`

The metric implementation is still correct; current evidence says there is no live offender to repair. The alert row remains open only because the runtime alert lifecycle has not yet observed the recovered sample.

This session does not have a safe runtime write path to edit `metric_alerts`, so the correct owner action here is to document the stale condition and wait for the next metrics snapshot / reconciliation cycle to clear the alert through the normal runtime path.

## Next validation signal

Validate on the next `metrics-snapshot` or the next runtime sample of `aks-rp-e2e.process.blocked.missing-fallback-count`.
Recovery is confirmed when the runtime metric row moves to `current = 0` and alert `3408` resolves normally.
