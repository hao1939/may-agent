# Metric alert triage — `aks-rp-e2e.spec.blocked-count` — alert `3635` refresh 2

- Metric id: `aks-rp-e2e.spec.blocked-count`
- Alert id: `3635`
- Judged at: `2026-07-14T16:10:42Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The breach is still real, but the correct operation remains `waiting_with_evidence`.
The metric is still `73`, while the live spec-verification loop is a blocked steward
with exact child waits already represented and no companion signal indicating missing
or actionable process work.

## Evidence checked

### Runtime metric rows

Fresh runtime inspection confirmed:

- `aks-rp-e2e.spec.blocked-count`: `current=73`, `threshold=10`, `target=0`, `priority=P2`
- `aks-rp-e2e.task.blocked-actionable-count`: `current=0`, `threshold=0`, `priority=P2`
- `aks-rp-e2e.spec.unverified-without-work`: `current=0`, `threshold=0`, `priority=P0`
- `aks-rp-e2e.task.no-work-with-gaps`: `current=0`, `threshold=0`, `priority=P0`

The blocked-spec inventory is high, but the companion actionability and missing-work
signals remain clear.

### Open alert row and recent samples

The open alert row for `3635` is still unresolved.

The latest ten runtime samples are all `73`, including:

- `73` at `1784044707934`
- `73` at `1784044277373`
- `73` at `1784044065214`
- `73` at `1784043742489`
- `73` at `1784043421995`

This is not stale or already recovered.

### Fresh local recompute

Commands:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count --json
```

Results:

- recompute returned `73`
- JSON recompute returned `{"measuredAt":1784045046535,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":73}`

So the runtime row still agrees with the registered metric source.

### Live task-tree wait contract

`bun run task-tree summary` showed:

- `counts.active = 1`
- `counts.blocked = 122`
- `frontier.runnable = []`
- `frontier.review = []`
- the only active frontier leaf is `focus-terminal-frontier-finality-reconciliation-20260714`

`bun run task-tree show aks-spec-verification-loop` showed:

- root state: `blocked`
- `workflowProgress.executionDrained = true`
- `workflowProgress.noRefillNow = true`
- `workflowProgress.reason = "spec-loop execution is drained and the remaining frontier is exact wait stewardship: 0 active child leaf/leaves, 0 review child leaf/leaves, 0 waiting child leaf/leaves, 0 backlog child leaf/leaves, 67 blocked wait leaf/leaves, 0 backlog follow-up leaf/leaves; stranded pending residue=177"`
- `workflowProgress.blockedWaitChildren = 67`
- `workflowProgress.activeChildren = 0`
- `workflowProgress.reviewChildren = 0`
- `workflowProgress.waitingChildren = 0`
- `workflowProgress.backlogChildren = 0`
- blocker owner: `aks-explorer`
- blocker observer workflow: `spec-loop-controller`
- blocker observation method: task-tree rollup recomputes parent state from child states
- blocker `next_check_at = 2026-07-14T16:06:17.453Z`
- blocker resume condition: resolve or replace a blocked child task
- blocker fallback: rerun owner review if child-blocked stewardship still holds at `2026-07-15T15:56:17.453Z`

This is already a valid exact wait with owner, observer, check method, resume condition,
and fallback.

## Why this is `waiting_with_evidence`

- **Not `fix_root_cause`**: current evidence shows no safe app-ops repair to perform; the frontier is already represented by exact blocked waits.
- **Not `resolve_stale`**: the runtime row, latest snapshots, and fresh local recompute all still show `73`.
- **Not `calibrate_metric`**: the metric may need a future design split, but this session has no safe runtime metric-write path and the alert still describes a real blocked inventory.
- **Not `upgrade_or_escalate`**: the stronger companion health metrics remain `0`, so this is not an emergency process failure.
- **Not `document_exception`**: the blocked frontier is real, but there is no approved temporary exception or expiry policy to record.

## Waiting contract

- **What we are waiting on:** one of the represented blocked child waits under `aks-spec-verification-loop` to resolve or be replaced.
- **Owner of the blocked work:** `aks-explorer` / current child wait owners.
- **Observer:** `spec-loop-controller`.
- **Check method:** rerun the metric sampler and `task-tree show aks-spec-verification-loop`; treat any nonzero `task.blocked-actionable-count`, `spec.unverified-without-work`, or `task.no-work-with-gaps` as a fresh incident instead of another passive refresh.
- **Next meaningful validation:** next `metrics-snapshot` or the next controller pulse after the current blocked-root check window, whichever changes first.
- **Fallback:** if the metric remains `73` after a child wait becomes overdue or a companion metric rises above `0`, reopen as root-cause or calibration work rather than refreshing the same acceptance.
