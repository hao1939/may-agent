# Metric alert triage — `aks-rp-e2e.spec.blocked-count` — alert `3635` refresh 3

- Metric id: `aks-rp-e2e.spec.blocked-count`
- Alert id: `3635`
- Judged at: `2026-07-14T19:04:00Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The breach is still real, but the correct operation remains `waiting_with_evidence`.
The metric is still `73`, while the live spec-verification loop is a truthful blocked steward with an exact wait contract, companion actionability signals remain clear, and the broader project still has live active/review work rather than a no-motion incident.

## Current evidence checked

### Runtime metric row still breaches

Fresh runtime inspection confirms:

- `aks-rp-e2e.spec.blocked-count`: `current=73`, `threshold=10`, `target=0`, `priority=P2`
- alert row `3635` is still unresolved
- latest ten persisted samples remain `73`
- fresh recompute from the registered source command still returns `73`

Checked via:

```sql
SELECT id,current,target,threshold,priority,status,blocker,updated_at,alert_op,description
FROM metrics
WHERE id = 'aks-rp-e2e.spec.blocked-count';
```

```sql
SELECT value,measured_at,measured_by,note
FROM metric_snapshots
WHERE metric_id = 'aks-rp-e2e.spec.blocked-count'
ORDER BY measured_at DESC
LIMIT 10;
```

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count --json
```

Observed values:

- metric row: `73 > 10`, `priority=P2`
- recompute: `73`
- recompute JSON: `{"measuredAt":1784055856512,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":73}`

### Companion health metrics remain clear

Fresh runtime inspection also confirms:

- `aks-rp-e2e.task.blocked-actionable-count = 0`
- `aks-rp-e2e.spec.unverified-without-work = 0`
- `aks-rp-e2e.task.no-work-with-gaps = 0`

So the blocked-spec inventory is high, but the stronger process-failure signals are still clear.

### Live task-tree state still shows exact blocked-wait stewardship

Fresh `bun run task-tree summary` and `bun run task-tree show aks-spec-verification-loop` now show:

- project frontier active leaves: `1`
- project frontier review leaves: `2`
- project frontier runnable leaves: `0`
- `aks-spec-verification-loop` state: `blocked`
- `workflowProgress.executionDrained = true`
- `workflowProgress.noRefillNow = true`
- `workflowProgress.blockedWaitChildren = 68`
- `workflowProgress.activeChildren = 0`
- `workflowProgress.reviewChildren = 0`
- `workflowProgress.waitingChildren = 0`
- `workflowProgress.backlogChildren = 0`
- root blocker owner: `aks-explorer`
- blocker observer workflow: `spec-loop-controller`
- blocker observation method: task-tree rollup recomputes parent state from current child states
- blocker `next_check_at = 2026-07-14T19:13:21.783Z`
- blocker `resume_condition = Resume when the blocked child task is resolved or replaced.`
- blocker `fallback_at = 2026-07-15T19:03:21.783Z`
- blocker fallback action: rerun task-tree rollup/owner review and refresh blocker metadata or reopen a concrete child follow-up

This is still a valid exact wait with owner, observer, check method, resume condition, and fallback.

### Current project motion is still real

The project is not fully stalled:

- active frontier leaf: `ops/send-row37-managed-aad-sharper-followup-20260714`
- review frontier leaves:
  - `ops/followup-row37-managed-aad-owner-return-20260714`
  - `ops/publish-network-cni-reviewed-slice-alert3702-20260714`

That means the blocked-spec inventory is being observed within a still-moving project state, not a dead queue with missing work.

## Why this remains `waiting_with_evidence`

- **Not `fix_root_cause`**: current evidence shows no safe app-ops repair to perform; the spec loop is already represented by exact blocked waits.
- **Not `resolve_stale`**: the runtime row, latest snapshots, and fresh recompute all still show `73`.
- **Not `calibrate_metric`**: the metric may still deserve future design review, but this session has no safe runtime metric-write path and the current live reading is not false.
- **Not `upgrade_or_escalate`**: companion process-failure signals remain `0`, and the current state is a truthful exact-wait frontier rather than an emergency or ambiguous contradiction.
- **Not `document_exception`**: there is no approved temporary exception text or expiry recorded on the runtime metric.

## Waiting contract

- **What we are waiting on:** one of the represented blocked child waits under `aks-spec-verification-loop` to resolve or be replaced.
- **Owner of the blocked work:** `aks-explorer` / current child wait owners.
- **Observer:** `spec-loop-controller`.
- **Check method:** rerun the metric sampler and `task-tree show aks-spec-verification-loop`; treat any nonzero `task.blocked-actionable-count`, `spec.unverified-without-work`, or `task.no-work-with-gaps` as a new incident instead of another passive refresh.
- **Next meaningful validation:** `2026-07-14T19:13:21.783Z` or the next `metrics-snapshot`, whichever changes first.
- **Fallback:** if the metric remains `73` after a child wait becomes overdue, or a companion metric rises above `0`, reopen as root-cause or calibration work rather than repeating the same passive wait refresh.
