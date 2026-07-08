# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2848`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The alert payload reports a persisted breach (`current=1`, threshold `0`), but a direct audit of the current task-tree source of truth shows no blocked leaf currently missing observer metadata. The live tree already contains the required `observed_by`, `observation_method`, and `next_check_at` fields on sampled blocked tasks, including the blocked controller root and the LocalDNS family wait. In this read-only triage environment there is no safe runtime write path to clear the stale metric/alert row directly, so the correct owner action is `waiting_with_evidence` until the next metrics refresh either recovers the alert or reproduces a concrete offender.

## Evidence checked

### 1. Persisted alert is still open

From the alert payload provided to this session:

- `metric.current = 1`
- `metric.threshold = 0`
- `metric.target = 0`
- `metric.priority = P0`
- alert `2848` remains open (`resolved_at = null`)

### 2. Current metric contract still requires observer metadata on blocked leaves

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` computes `blockedMissingObserver` only from blocked leaf tasks missing one or more of:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`

So if the live tree has all three fields, the intended current value is `0`.

### 3. Direct current tree audit finds no live offenders

A direct audit of `/app/projects/aks-rp-e2e.app/tasks/tree.json` using the same metric rule found:

```json
{
  "count": 0,
  "ids": []
}
```

That means there is no current blocked leaf in the task tree that lacks the required observer contract.

### 4. Sample blocked tasks already carry observer metadata

The blocked LocalDNS family wait `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c` currently has:

- `blocker.observed_by.workflow = "project-planner"`
- `blocker.observation_method = "Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence."`
- `blocker.next_check_at = "2026-07-06T14:45:00Z"`

The blocked controller root `aks-spec-verification-loop` currently has:

- `blocker.observed_by.workflow = "spec-loop-controller"`
- `blocker.observation_method = "Durable loop controller recomputes blocked wait stewardship from current child states and workflow progress on each controller pulse."`
- `blocker.next_check_at = "2026-07-06T06:24:08Z"`

These examples match the required observer contract and support the direct audit result of zero live offenders.

## Why this is not `fix_root_cause`

`fix_root_cause` would require a current blocked leaf that still lacks observer metadata and a safe repair to perform now. The direct audit found zero live offenders, so there is no current task-tree mutation to make.

## Why this is not `resolve_stale`

The remaining issue appears to be stale metric/alert lifecycle state, but this workflow does not expose a safe runtime write path for resolving `metric_alerts` or forcing a metric refresh. The concrete owner action available here is to record the discrepancy and wait for the next safe metrics refresh.

## Conclusion

Choose `waiting_with_evidence`: the live task tree is already compliant with the observer contract, the persisted alert is likely stale relative to the current tree, and the next metrics refresh is the correct validation signal.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed value stays `0`, alert `2848` should recover as stale/transient state.
- If it returns `>0`, reopen only with the exact offender task ids from a fresh task-tree audit.
