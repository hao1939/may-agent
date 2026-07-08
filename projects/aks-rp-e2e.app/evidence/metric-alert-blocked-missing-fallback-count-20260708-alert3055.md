# Metric alert triage — aks-rp-e2e.process.blocked.missing-fallback-count (alert 3055)

- Alert id: `3055`
- Metric id: `aks-rp-e2e.process.blocked.missing-fallback-count`
- Judged at: `2026-07-08T02:41Z`
- Chosen operation: `resolve_stale`

## Decision

Choose `resolve_stale`.

The open alert was created from a point-in-time snapshot where the persisted metric row still showed `current=2`, but a direct current recompute of the metric in this session now returns `0`.
That means the alert row is stale relative to current runtime state.

## Facts checked

### Runtime metric row at alert time

Read from the runtime DB:

- `metrics.current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `updated_at = 1783484664178`
- `source_command = bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count`

Recent snapshots show the same shape:

- `1783484664178 => 2`
- `1783484355871 => 0`
- `1783484046696 => 0`
- `1783483738315 => 0`
- `1783483430189 => 0`

So the breach was real when sampled, but it was also abrupt and recent.

### Current metric implementation

`scripts/project-metrics.ts` computes `aks-rp-e2e.process.blocked.missing-fallback-count` from blocked leaf tasks and counts a task as missing fallback only when either blocked-contract field is absent:

- `fallback_at`
- `fallback_action`

### Current runtime recompute

Command run in this session:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-fallback-count
```

Observed output:

```text
0
```

That direct recompute is the most current available measurement path for this metric and it now shows no missing-fallback offenders.

## Why `resolve_stale` is the right operation

This session does not have a safe runtime write path for manually editing `metric_alerts` or `metrics` rows.
Given the direct recompute is already back in range, the truthful action is to record that the alert is stale and let the next metrics snapshot / reconciliation cycle clear it through the normal runtime path.

`fix_root_cause` is not the right operation for this triage because there is no current offender left to repair.
`calibrate_metric` is not appropriate because the metric logic remains correct.
`upgrade_or_escalate` is not appropriate because current runtime evidence does not show an ongoing P0 breach.

## Durable evidence left by this session

This evidence note records the judgment and the current recompute result so later review can distinguish:

- sampled breach state (`current=2`)
- current runtime state (`direct recompute = 0`)
- resulting operation (`resolve_stale`)

## Next validation signal

Wait for the next `metrics-snapshot` / alert reconciliation cycle for `aks-rp-e2e.process.blocked.missing-fallback-count`.
If the runtime row updates to `0` and the alert resolves, this triage was correct.
If a later snapshot returns `>0`, reopen only with the fresh blocked task ids from that sample.
