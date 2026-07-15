# Metric alert triage — `aks-rp-e2e.spec.blocked-count` — alert `3635` refresh

- Metric id: `aks-rp-e2e.spec.blocked-count`
- Alert id: `3635`
- Judged at: `2026-07-14T18:41:00Z`
- Chosen operation: `upgrade_or_escalate`

## Judgment

The breach is still real (`73 > 10`), but the current evidence shows a **represented exact-wait frontier**, not hidden runnable repair work. Because this alert has now repeated across multiple same-day owner triage sessions, and because the remaining decision is a **metric-policy choice** rather than a safe worker-side state mutation, the responsible operation remains `upgrade_or_escalate`.

This refresh adds one concrete improvement over the earlier escalation note: it records the **exact source-level calibration options** already visible in `scripts/register-project-metrics.ts`, so the next owner/human decision can act without rediscovering the implementation shape.

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
SELECT value,measured_at,measured_by
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
- recompute JSON: `{"measuredAt":1784054381158,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":73}`

### Companion process-health signals remain clear

Fresh runtime inspection also confirms:

- `aks-rp-e2e.task.blocked-actionable-count = 0`
- `aks-rp-e2e.spec.unverified-without-work = 0`
- `aks-rp-e2e.task.no-work-with-gaps = 0`

So the blocked-spec inventory is high, but the stronger process-failure signals are currently clear.

### Live task-tree state still shows exact blocked-wait stewardship

Fresh `bun run task-tree summary` and `bun run task-tree show aks-spec-verification-loop` show:

- project frontier active leaves: `2`
- project frontier runnable leaves: `0`
- `aks-spec-verification-loop` state: `blocked`
- spec-loop `workflowProgress.executionDrained = true`
- spec-loop `workflowProgress.noRefillNow = true`
- spec-loop `workflowProgress.blockedWaitChildren = 68`
- spec-loop `workflowProgress.activeChildren = 0`
- spec-loop `workflowProgress.reviewChildren = 0`
- spec-loop `workflowProgress.waitingChildren = 0`
- spec-loop `workflowProgress.backlogChildren = 0`
- root blocker owner: `aks-explorer`
- observer workflow: `spec-loop-controller`
- `next_check_at = 2026-07-14T18:49:25.533Z`
- fallback: rerun rollup/owner review at `2026-07-15T18:39:25.533Z`

This is still a truthful blocked steward, not a stale or hidden-work state.

### Repetition has already crossed the escalation threshold

Runtime events and sessions now show:

- completed owner triage sessions for this same alert at `1784022611201`, `1784030292680`, `1784037688546`, `1784045018485`, and `1784052518851`
- a prior durable `metric.alert_judged` event already recorded `operation = upgrade_or_escalate` for alert `3635`

That means another plain `waiting_with_evidence` refresh would add little operational value. The unresolved step is no longer discovery; it is policy selection.

## Exact source-level decision now requested

The current source tree already shows the intended calibration pattern for comparable inventory metrics:

- `aks-rp-e2e.task.blocked-count` is already dashboard-only with `threshold=999999`, `priority=P3`, and directs interrupting actionability to `aks-rp-e2e.task.blocked-actionable-count`
- `aks-rp-e2e.spec.unverified-count`, `aks-rp-e2e.spec.ready-count`, and `aks-rp-e2e.spec.draft-count` are already documented as dashboard burn-down counters with `priority=P3`
- `aks-rp-e2e.spec.blocked-count` is the remaining spec-inventory metric still configured as interrupting `P2 threshold=10`

So the owner/human decision needed is now narrow and concrete:

1. **Keep `aks-rp-e2e.spec.blocked-count` as interrupting `P2` inventory alert**, and explicitly populate runtime blocker/review text explaining why repeated exact-wait stewardship should continue to interrupt; **or**
2. **Calibrate it to the existing inventory-metric pattern** by downgrading the raw blocked-spec inventory signal and routing interruption through actionability signals already backed by the task tree.

## Minimal calibration shape if option 2 is chosen

If the decision is to calibrate, the source-level shape is already obvious from neighboring metrics in `scripts/register-project-metrics.ts`:

- set `aks-rp-e2e.spec.blocked-count.threshold` to `999999`
- set `aks-rp-e2e.spec.blocked-count.priority` to `P3`
- update its description to say it is a dashboard-only blocked-spec inventory signal
- explicitly point operators at:
  - `aks-rp-e2e.task.blocked-actionable-count`
  - `aks-rp-e2e.spec.unverified-without-work`
  - `aks-rp-e2e.task.no-work-with-gaps`

I did **not** apply that calibration from this session because the current environment exposes only read-only runtime DB access plus filesystem tools, and the alert has already reached the point where a deliberate owner/human policy choice is required.

## Why not another operation

- **Not `fix_root_cause`**: no safe local state repair is currently missing; the frontier is already represented truthfully.
- **Not `resolve_stale`**: runtime row, latest samples, and fresh recompute all still say `73`.
- **Not `waiting_with_evidence`**: repetition across multiple owner sessions and a same-day prior escalation means simple wait-refresh is no longer the most responsible endpoint.
- **Not `calibrate_metric`**: calibration itself is the requested decision, but this session cannot safely mutate runtime metric rows and should not silently choose the policy unilaterally.
- **Not `document_exception`**: there is no approved exception text or review expiry on the runtime metric.

## Next validation

Validate on the next `metrics-snapshot` after the owner/human policy decision, or sooner if either:

- `aks-rp-e2e.spec.blocked-count` changes from `73`, or
- any companion health metric rises above `0`.
