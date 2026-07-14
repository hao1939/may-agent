# Metric alert triage — `aks-rp-e2e.spec.blocked-count` — alert `3635`

- Metric id: `aks-rp-e2e.spec.blocked-count`
- Alert id: `3635`
- Judged at: `2026-07-14T12:00:00Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The breach is still real, but the correct operation is `waiting_with_evidence`.
The metric is persistently breaching at `73`, yet the live app state shows a drained
spec-verification loop whose remaining frontier is already represented by exact blocked
wait carriers rather than hidden runnable or review work.

## Evidence checked

### Runtime metric rows

`query_db(metrics)` confirmed:

- `aks-rp-e2e.spec.blocked-count`: `current=73`, `threshold=10`, `target=0`, `priority=P2`
- `aks-rp-e2e.task.blocked-actionable-count`: `current=0`, `threshold=0`, `priority=P2`
- `aks-rp-e2e.spec.unverified-without-work`: `current=0`, `threshold=0`, `priority=P0`
- `aks-rp-e2e.task.no-work-with-gaps`: `current=0`, `threshold=0`, `priority=P0`

So the blocked-spec inventory is high, but the companion “missing work” and “no work with gaps”
signals are both clear.

### Open alert row and recent persisted samples

`query_db(metric_alerts)` confirmed alert `3635` is still open for this metric.

`query_db(metric_snapshots)` confirmed the latest ten samples are all still `73`:

- `73` at `1784030091704`
- `73` at `1784029772046`
- `73` at `1784029458603`
- `73` at `1784029141939`
- `73` at `1784028832238`
- `73` at `1784028781225`
- `73` at `1784028663542`
- `73` at `1784028346601`
- `73` at `1784028029937`
- `73` at `1784027704458`

This is not a stale or already-recovered alert.

### Fresh local recompute

Commands:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count --json
```

Results:

- recompute returned `73`
- JSON recompute returned `{ "value": 73, ... }`

So the registered metric source still agrees with the runtime row.

### Live task-tree state

`bun run task-tree summary` returned:

- `counts.active = 2`
- `counts.blocked = 122`
- `frontier.runnable = []`
- `frontier.review = []`
- active frontier leaves are only:
  - `focus-terminal-frontier-finality-reconciliation-20260714`
  - `ops/repair-focus-terminal-frontier-active-readout-drift-20260714e`

`bun run task-tree show aks-spec-verification-loop` returned:

- root state: `blocked`
- `workflowProgress.executionDrained = true`
- `workflowProgress.noRefillNow = true`
- `workflowProgress.reason = "spec-loop execution is drained and the remaining frontier is exact wait stewardship"`
- `workflowProgress.blockedWaitChildren = 67`
- `workflowProgress.activeChildren = 0`
- `workflowProgress.reviewChildren = 0`
- `workflowProgress.waitingChildren = 0`
- `workflowProgress.backlogChildren = 0`
- blocker observer: `spec-loop-controller`
- blocker observation method: task-tree rollup keeps the root blocked only while blocked child waits remain
- blocker `next_check_at = 2026-07-14T12:08:34.612Z`
- blocker resume condition: resolve or replace a blocked child task
- blocker fallback: rerun owner review if the child-blocked stewardship still holds at `2026-07-15T11:58:34.612Z`

That is concrete waiting state with an observer, check method, resume condition, and fallback already attached to the live frontier.

### Same-day family review already burned down one real overlap

Same-day evidence in `evidence/archive/ops-review-spec-blocked-count-alert-family-20260714b.md`
showed the planner had already consolidated the shared authenticated-artifact family and
reduced the spec-loop blocked frontier from `70` to `68` before this triage. That review
also found no overdue child waits and no justified new duplicate-collapse task from the
current family surface.

## Why this is `waiting_with_evidence`

- **Not `fix_root_cause`**: current evidence does not show a new safe app-ops correction; the remaining surface is already represented as exact blocked waits.
- **Not `resolve_stale`**: the runtime row, persisted snapshots, and fresh recompute all still show `73`.
- **Not `calibrate_metric`**: the metric may need a future design decision, but this session has no safe runtime metric-write path and the alert is still describing a real blocked inventory.
- **Not `upgrade_or_escalate`**: the emergency companion signals remain clear (`blocked-actionable-count = 0`, `spec.unverified-without-work = 0`, `task.no-work-with-gaps = 0`).

## Waiting contract

- **What we are waiting on:** one of the represented blocked spec-family child tasks under `aks-spec-verification-loop` to resolve or be replaced.
- **Owner of the blocked work:** `aks-explorer` / the existing child wait owners represented under the spec loop.
- **Observer:** `spec-loop-controller`, with task-tree rollup as the observation mechanism.
- **Check method:** rerun the metric sampler and `task-tree show aks-spec-verification-loop`; treat any nonzero `blocked-actionable-count`, `spec.unverified-without-work`, or `task.no-work-with-gaps` as a fresh process incident rather than a wait refresh.
- **Next meaningful validation:** first resume tranche at `2026-07-14T18:00:00Z`, or earlier if the next `metrics-snapshot` changes the value.
- **Fallback:** if the value remains `73` after the next resume tranche and a represented wait becomes overdue or a companion health metric rises above `0`, reopen as root-cause or calibration work instead of refreshing the same wait note.

## Validation trigger

Re-check on the next `metrics-snapshot` or at `2026-07-14T18:00:00Z`, whichever comes first.
Revisit immediately if either condition becomes true:

1. `aks-rp-e2e.task.blocked-actionable-count > 0`, `aks-rp-e2e.spec.unverified-without-work > 0`, or `aks-rp-e2e.task.no-work-with-gaps > 0`; or
2. a currently represented spec-loop wait becomes overdue or is replaced by new runnable/review work.
