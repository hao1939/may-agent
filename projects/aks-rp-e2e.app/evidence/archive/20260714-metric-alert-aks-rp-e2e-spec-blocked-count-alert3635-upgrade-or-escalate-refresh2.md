# Metric alert triage — `aks-rp-e2e.spec.blocked-count` — alert `3635` refresh 2

- Metric id: `aks-rp-e2e.spec.blocked-count`
- Alert id: `3635`
- Judged at: `2026-07-14T21:30:00Z`
- Chosen operation: `upgrade_or_escalate`

## Judgment

The breach is still real at `73 > 10`, but the latest runtime evidence now makes the policy problem sharper: the raw blocked-spec inventory is still interrupting at `P2` even though the app already uses **separate stronger health signals** for actionable closure gaps.

Today the stronger signal is live: `aks-rp-e2e.task.no-work-with-gaps = 1` at `P0`, while the spec loop itself is still a truthful blocked-wait steward with `68` blocked wait children and `0` active/review/waiting/backlog child leaves. That means the interrupting work should come from the P0 gap signal, not repeated paging on the raw blocked-spec inventory.

Because this session has read-only runtime DB access and filesystem tools only, I cannot safely mutate the live metric row. The correct final operation is therefore `upgrade_or_escalate`: record an explicit project-context escalation asking the metric owner/human to decide whether `aks-rp-e2e.spec.blocked-count` should keep interrupting at `P2`, or be calibrated to the same dashboard-only pattern already used for `aks-rp-e2e.task.blocked-count`, `aks-rp-e2e.spec.unverified-count`, `aks-rp-e2e.spec.ready-count`, and `aks-rp-e2e.spec.draft-count`.

## Current evidence checked

### Live runtime metric row still breaches

Runtime inspection in this session confirms:

- `aks-rp-e2e.spec.blocked-count`: `current=73`, `threshold=10`, `target=0`, `priority=P2`
- alert row `3635` is still unresolved
- latest ten snapshots all remain `73`
- fresh source-command recompute still returns `73`

Checked via:

```sql
SELECT id,current,target,threshold,priority,status,blocker,updated_at,alert_op,description,config
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
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count --json
```

Observed values:

- metric row: `73 > 10`, `priority=P2`
- alert row: unresolved `3635`
- recompute: `73`
- recompute JSON: `{"measuredAt":1784063375214,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":73}`

### Stronger actionable signal is now the active interrupting condition

Runtime inspection also shows:

- `aks-rp-e2e.task.blocked-count = 123`, but already calibrated as dashboard-only (`threshold=999999`, `priority=P3`)
- `aks-rp-e2e.task.blocked-actionable-count = 0`
- `aks-rp-e2e.spec.unverified-without-work = 0`
- `aks-rp-e2e.task.no-work-with-gaps = 1` at `P0`

That combination means:

1. the blocked frontier is large,
2. the blocked frontier is **not** currently flagged as blocked-actionable process residue, but
3. the project **does** currently have a stronger P0 closure-gap signal that already tells app-ops to react.

So the raw blocked-spec inventory no longer needs to be the interrupting pager.

### Live task tree still shows exact blocked-wait stewardship, not hidden spec work

Fresh `bun run task-tree summary` and `bun run task-tree show aks-spec-verification-loop` show:

- project frontier active leaves: `1` (`ops-apply-ops-apply-ops-apply-repair-approval-followup-apply-gap-2026071`)
- project frontier review leaves: `2`
- project frontier runnable leaves: `0`
- `aks-spec-verification-loop` state: `blocked`
- spec-loop `workflowProgress.executionDrained = true`
- spec-loop `workflowProgress.noRefillNow = true`
- spec-loop `workflowProgress.blockedWaitChildren = 68`
- spec-loop `workflowProgress.activeChildren = 0`
- spec-loop `workflowProgress.reviewChildren = 0`
- spec-loop `workflowProgress.waitingChildren = 0`
- spec-loop `workflowProgress.backlogChildren = 0`
- spec-loop blocker `next_check_at = 2026-07-14T21:18:41.126Z`
- spec-loop fallback `fallback_at = 2026-07-15T21:08:41.126Z`

So `aks-rp-e2e.spec.blocked-count` is still measuring a truthful represented wait frontier, not an unrepresented spec execution queue.

### Repetition is already established

Recent owner sessions for this same alert include multiple same-day metric-alert-triage runs, including:

- `s_1784055818396_14`
- `s_1784054469944_95`
- `s_1784054322713_91`
- `s_1784052518851_45`
- `s_1784045018485_76`
- `s_1784037688546_34`
- `s_1784030292680_16`

In parallel, there is already a separate running owner triage session for the stronger alert family:

- `s_1784063314053_61` — `workflow:metric-alert-triage` for `aks-rp-e2e.task.no-work-with-gaps`

That is more evidence that this raw blocked-spec metric should not keep being the interrupting lane.

## Exact decision now requested from owner/human

Choose one of these two policy paths:

1. **Keep `aks-rp-e2e.spec.blocked-count` as an interrupting `P2` metric**, and explicitly document in the runtime metric blocker/review text why repeated alerts on a represented exact-wait frontier are still worth interrupting; or
2. **Calibrate it to the inventory/watch pattern already used elsewhere** by downgrading the raw blocked-spec inventory signal and relying on the already-stronger closure-gap metrics for interruption.

## Minimal calibration shape if option 2 is chosen

The source tree already shows the intended neighbor pattern in `scripts/register-project-metrics.ts`:

- `aks-rp-e2e.task.blocked-count` is already `threshold=999999`, `priority=P3`
- `aks-rp-e2e.spec.unverified-count` is already `threshold=999999`, `priority=P3`
- `aks-rp-e2e.spec.ready-count` is already `threshold=999999`, `priority=P3`
- `aks-rp-e2e.spec.draft-count` is already `threshold=999999`, `priority=P3`

If calibration is approved, the smallest aligned change is:

- set `aks-rp-e2e.spec.blocked-count.threshold` to `999999`
- set `aks-rp-e2e.spec.blocked-count.priority` to `P3`
- update its description to say it is a dashboard-only blocked-spec inventory counter
- direct interrupting response to:
  - `aks-rp-e2e.task.no-work-with-gaps`
  - `aks-rp-e2e.spec.unverified-without-work`
  - `aks-rp-e2e.task.blocked-actionable-count`

## Why not another operation

- **Not `fix_root_cause`**: the raw blocked-spec count is not a stale or broken measurement, and the live actionable repair lane is already the separate P0 `task.no-work-with-gaps` alert.
- **Not `resolve_stale`**: runtime row, snapshots, and recompute all still say `73`.
- **Not `waiting_with_evidence`**: multiple same-day owner triages have already refreshed evidence; the unresolved step is now metric policy, not discovery.
- **Not `calibrate_metric`**: this session cannot safely mutate runtime metric rows with the available tools.
- **Not `document_exception`**: there is no approved exception text or review expiry on the live metric.

## Next validation

Validate on the next `metrics-snapshot`, or sooner if either:

- `aks-rp-e2e.spec.blocked-count` changes from `73`, or
- the owner/human applies a priority/threshold policy decision for this metric.
