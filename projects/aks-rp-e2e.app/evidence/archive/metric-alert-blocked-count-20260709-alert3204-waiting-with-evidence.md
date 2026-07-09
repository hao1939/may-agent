# Metric alert triage — `aks-rp-e2e.task.blocked-count` — alert `3204`

- Metric id: `aks-rp-e2e.task.blocked-count`
- Alert id: `3204`
- Judged at: `2026-07-09T10:49:00Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The breach is real and current, but the most truthful action is still `waiting_with_evidence`.
The metric is already calibrated to a P3 watch threshold of `130`, the count is still above
that line at `156-157`, and the blocked inventory remains dominated by exact domain wait leaves
that are actively being normalized by current compact-loop repair work rather than by an app-level
integrity failure that app-ops can safely close by force.

## Evidence checked

### Runtime metric row

`query_db(metrics)` returned:

- `current=156`
- `threshold=130`
- `target=0`
- `priority=P3`
- `project=aks-rp-e2e`
- source command `bun /app/projects/aks-rp-e2e.app/scripts/project-metrics.ts aks-rp-e2e.task.blocked-count`

### Recent persisted samples

`query_db(metric_snapshots)` since the alert was created shows the breach is still live now, not stale:

- `156` at `1783594141673`
- `156` at `1783593824106`
- `155` at `1783593507908`
- `155` at `1783593190580`
- `155` at `1783592874492`
- `156` at `1783592558064`
- `156` at `1783592235825`
- `158` at `1783591919865`
- `157` at `1783591604228`
- `156` at `1783591287038`
- `156` at `1783590971325`
- `172-173` plateau immediately before the current reduction wave

The signal has improved from `173` down to `156`, but it has not recovered below the `130`
threshold.

### Fresh local recompute

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.task.blocked-count
```

Result:

- `157`

This is within one count of the persisted `156` sample and confirms the alert row is not stale.

### Live task-tree summary

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/task-tree.ts summary
```

Relevant result:

- `counts.blocked=157`
- `counts.active=1`
- `counts.review=1`
- `counts.backlog=1`
- active frontier still contains `ops-repair-feature-compact-runtime-backbinding-warning-family-20260709e`
- review frontier still contains `aks-spec-verification-loop` and `repair-spec-secops-fips-slice2-terminal-calico-readback-carrier-20260709`

So the blocked pressure is still high, but there is still active/review motion and the project is
not yet in a zero-motion starvation state.

### Current root-cause context

The most recent app-ops repair evidence,
`evidence/archive/ops-repair-compact-environment-overblock-family-20260709d.md`, shows the
remaining compact environment-overblock problem is now mostly **projection drift / stale feature-state
backbinding** rather than a fresh blocked-contract failure. That note specifically identifies stale or
missing feature pointers for `gpu`, `cluster-autoscaler`, `planned-maintenance`, `ccp-coredns`, and
`ossku-migration`, while also recording that several broader environment-holder families were already
reduced to exact shared waits.

That means the metric is still measuring real blocked leaves, but the next safe action belongs to the
existing compact-loop repair lane rather than to a manual close, silent downgrade, or another threshold
change in this session.

## Why this is `waiting_with_evidence`

- **Not `resolve_stale`**: runtime metric row, persisted snapshots, direct recompute, and live task-tree
  summary all still show the breach.
- **Not `fix_root_cause`**: app-ops should not hand-edit runtime task-tree state or force-close domain waits;
  the concrete fix path is already in flight via the active compact-loop backbinding repair lane.
- **Not `calibrate_metric`**: the threshold was already raised to `130`, and the signal is still materially above
  that level even after the current reduction wave.
- **Not `upgrade_or_escalate`**: this remains a P3 watch signal with live motion and an identified in-project
  repair lane; there is no destructive or policy-only human action required yet.

## Validation trigger

Re-check on the next metrics snapshot after the active repair/review frontier changes. This judgment should
be revisited immediately if either of these becomes true:

1. `aks-rp-e2e.task.blocked-count` remains above `130` after
   `ops-repair-feature-compact-runtime-backbinding-warning-family-20260709e` and the current review frontier
   drain, or
2. blocked count stays above `150` while `active + review` falls to zero.
