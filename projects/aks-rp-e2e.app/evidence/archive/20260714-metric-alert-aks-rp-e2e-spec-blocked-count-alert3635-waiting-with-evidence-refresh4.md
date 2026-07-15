# Metric alert triage — `aks-rp-e2e.spec.blocked-count` — alert `3635` refresh 4

- Metric id: `aks-rp-e2e.spec.blocked-count`
- Alert id: `3635`
- Judged at: `2026-07-14T23:52:00Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The breach is still real at `73 > 10`, but the correct operation is now `waiting_with_evidence`.

Current primary-source evidence shows three things at once:

1. the metric is still truthfully measuring a represented blocked-spec frontier;
2. the stronger companion process-gap metrics are currently clear (`task.blocked-actionable-count = 0`, `spec.unverified-without-work = 0`, `task.no-work-with-gaps = 0`);
3. there is now a concrete active app-ops repair task already in flight for the related blank-resume escalation lineage: `ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re`.

Because a specific repair lane now exists and the project is not in a no-work incident, another emergency escalation would only duplicate the active repair. The right move is to leave an exact waiting contract tied to that live task and revalidate on its completion or the next metric sample.

## Current evidence checked

### Runtime metric row still breaches

Fresh runtime inspection confirms:

- `aks-rp-e2e.spec.blocked-count`: `current=73`, `threshold=10`, `target=0`, `priority=P2`
- alert row `3635` is still unresolved
- latest ten persisted samples all remain `73`
- fresh source-command recompute still returns `73`

Checked via:

```sql
SELECT id,name,current,target,threshold,priority,status,blocker,project,updated_at,alert_op,description
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

```sql
SELECT id,metric_id,alert_type,message,resolved_at,created_at
FROM metric_alerts
WHERE metric_id = 'aks-rp-e2e.spec.blocked-count'
  AND resolved_at IS NULL
ORDER BY created_at DESC;
```

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count --json
```

Observed values:

- metric row: `73 > 10`, `priority=P2`
- alert row: unresolved `3635`
- persisted samples: ten straight `73`
- recompute JSON: `{"measuredAt":1784073086763,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":73}`

### Companion process-gap metrics are currently clear

Fresh runtime inspection also confirms:

- `aks-rp-e2e.task.blocked-actionable-count = 0`
- `aks-rp-e2e.spec.unverified-without-work = 0`
- `aks-rp-e2e.task.no-work-with-gaps = 0`
- blocked metadata hygiene companions remain `0`:
  - `aks-rp-e2e.process.blocked.missing-owner-count`
  - `aks-rp-e2e.process.blocked.missing-fallback-count`
  - `aks-rp-e2e.process.blocked.missing-observer-count`
  - `aks-rp-e2e.process.blocked.missing-waiting-for-count`
  - `aks-rp-e2e.process.blocked.overdue-unworked-count`

So the blocked-spec inventory is high, but the stronger “missing work / broken blocked contract” alerts are not firing right now.

### The spec loop is still a truthful blocked-wait steward

Fresh task-tree inspection shows:

- `aks-spec-verification-loop.state = blocked`
- `workflowProgress.executionDrained = true`
- `workflowProgress.noRefillNow = true`
- `workflowProgress.blockedWaitChildren = 67`
- `workflowProgress.activeChildren = 0`
- `workflowProgress.reviewChildren = 0`
- `workflowProgress.waitingChildren = 0`
- `workflowProgress.backlogChildren = 0`
- blocker owner: `aks-explorer`
- blocker observer workflow: `spec-loop-controller`
- blocker `next_check_at = 2026-07-15T00:01:08.611Z`
- blocker `resume_condition = Resume when the blocked child task is resolved or replaced.`
- blocker `fallback_at = 2026-07-15T23:51:08.611Z`

This remains a represented blocked frontier, not a hidden runnable queue.

### There is now one concrete active repair lane for the related escalation lineage

Fresh task-tree inspection also shows an active app-ops repair task:

- task id: `ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re`
- state: `active`
- owner: `app-ops`
- goal: dismiss `esc_1784053094475_s1g6wx`, create or refresh exactly one nonblank `spec.blocked-count` owner-decision wait for `esc_1784054467358_jnkbho`, then resolve `esc_1784054467358_jnkbho` as superseded and verify the remaining blank-resume set

Its review context explicitly says the prior worker memo was useful but not yet applied, and the active successor exists to perform the state repair through supported app mechanisms.

That means this alert now has a concrete in-flight process lane instead of only repeated passive refreshes.

## Why `waiting_with_evidence` is the right operation now

- **Not `fix_root_cause`**: the blocked-spec count itself is still truthful and I do not have a safe runtime metric-write path in this session.
- **Not `resolve_stale`**: runtime row, snapshots, and recompute all still say `73`.
- **Not `upgrade_or_escalate`**: the earlier stronger P0 no-work condition is now back to `0`, and there is already one active app-ops repair task for the related lineage, so a new escalation would duplicate in-flight work.
- **Not `calibrate_metric` / `downgrade_priority`**: those require a safe runtime metric update path that is not available here.
- **Not `document_exception`**: no approved exception text or review expiry exists on the live metric.

## Waiting contract

- **What we are waiting on:** completion of `ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re`, which should either create exactly one nonblank owner-decision wait for `aks-rp-e2e.spec.blocked-count` / `esc_1784054467358_jnkbho` or close that lineage as already governed.
- **Owner of the wait:** `app-ops` for the active state-repair task; downstream owner/human only if that task converts the lineage into the explicit metric-policy decision wait it already describes.
- **Observer:** planner/task-review flow through the live task tree plus the next `metrics-snapshot`.
- **Check method:** rerun the escalation lifecycle query, `task-tree show ops-apply-apply-runtime-blank-resume-escalation-repair-20260714-state-re`, `task-tree show aks-spec-verification-loop`, and the `aks-rp-e2e.spec.blocked-count` sampler.
- **Next meaningful validation:** when the active repair task completes, or the next `metrics-snapshot`, whichever happens first.
- **Fallback:** if that active repair task completes without establishing one exact owner-decision wait or terminally closing the same lineage, reopen as `upgrade_or_escalate` because the alert path will still lack a durable governing carrier.
