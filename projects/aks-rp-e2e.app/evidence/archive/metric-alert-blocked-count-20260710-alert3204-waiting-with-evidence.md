# Metric alert triage — `aks-rp-e2e.task.blocked-count` — alert `3204`

- Metric id: `aks-rp-e2e.task.blocked-count`
- Alert id: `3204`
- Judged at: `2026-07-10T03:24:00Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The breach is real and still open, but the most truthful operation is `waiting_with_evidence`.
The raw blocked inventory remains above threshold at `155`, while the new companion
metric `aks-rp-e2e.task.blocked-actionable-count` is `0`, meaning the current blocked
surface is a represented exact-wait frontier rather than newly actionable blocked-process
repair work.

## Evidence checked

### Runtime metric rows

`query_db(metrics)` confirmed:

- `aks-rp-e2e.task.blocked-count`: `current=155`, `threshold=130`, `target=0`, `priority=P3`
- `aks-rp-e2e.task.blocked-actionable-count`: `current=0`, `threshold=0`, `target=0`, `priority=P2`

The raw metric description now explicitly says to route actionability through the companion
metric instead of paging repeatedly on represented waits.

### Recent persisted samples

Recent `metric_snapshots` still show the blocked inventory breaching and the companion
actionability signal staying clear:

- blocked count: `155` at `1783653603234`
- blocked count: `155` at `1783652945083`
- blocked count: `155` at `1783652633497`
- blocked count: `155` at `1783652321867`
- blocked count: `155` at `1783652009070`
- actionable blocked count: `0` at `1783653313165`
- actionable blocked count: `0` at `1783652839437`
- actionable blocked count: `0` at `1783652626639`
- actionable blocked count: `0` at `1783652147515`
- actionable blocked count: `0` at `1783651916852`

The alert is therefore neither stale nor newly urgent.

### Fresh local recompute

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.task.blocked-count
```

Result:

- `155`

This matches the persisted metric row.

### Live task-tree summary

`bun scripts/task-tree.ts summary` returned:

- `counts.blocked=155`
- `counts.active=3`
- `frontier.review=[]`
- active frontier includes `compact-feature-cluster-autoscaler`, `reconcile-spec-loop-pending-localdns-2`, and `ops/confirm-live-task-worker-reload-and-workflow-session-binding-20260710`

So the project is not motion-starved even though the blocked inventory remains high.

### Companion actionable metric note

The latest persisted note for `aks-rp-e2e.task.blocked-actionable-count` reports:

- `blockedLeafCount=155`
- `durableExactHolderCount=155`
- `actionableWarningTaskIds=[]`
- `repeatedBlockerGroupKeys=[]`
- `motionStarved=false`
- parent breakdown:
  - `aks-spec-verification-loop=91`
  - `aks-feature-compact-loop=53`
  - `project=11`

That is the key discriminator for this alert: all currently counted blocked leaves are still
classified as durable exact holders rather than warning-worthy blocked families.

## Why this is `waiting_with_evidence`

- **Not `fix_root_cause`**: there is no app-level integrity fault to repair in this session; the alert is measuring real blocked inventory, and the current active leaves are already the safe in-project motion.
- **Not `resolve_stale`**: runtime row, snapshots, local recompute, and task-tree summary all still show a live breach.
- **Not `calibrate_metric`**: the raw metric has already been clarified and paired with the actionable companion metric; current data still supports keeping the raw inventory alert visible.
- **Not `upgrade_or_escalate`**: the companion actionable signal is `0`, there is live active work, and no destructive or policy-only human action is required now.

## Validation trigger

Re-check on the next `metrics-snapshot` after the current active frontier changes.
Revisit this judgment immediately if either condition becomes true:

1. `aks-rp-e2e.task.blocked-actionable-count` rises above `0`, or
2. `aks-rp-e2e.task.blocked-count` stays above `130` while task-tree motion becomes starved (`active=0`, `review=0`, or the companion note flips `motionStarved=true`).
