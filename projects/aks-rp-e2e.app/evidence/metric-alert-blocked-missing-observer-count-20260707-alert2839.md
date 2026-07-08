# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2839`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The persisted metric row and open alert still show a breach (`current=6`), but the live task-tree source of truth no longer shows any blocked task missing observer metadata, and the supported blocked-contract repair tool has nothing left to repair.

This means the actionable defect is not currently present in the runtime tree. The remaining issue is a stale metric/alert lifecycle state that this triage workflow cannot safely overwrite because it only has read-only DB access. The correct owner action in this environment is therefore `waiting_with_evidence` until the next safe metrics refresh validates recovery or reproduces a live offender.

## Evidence checked

### 1. Persisted runtime metric / alert still breaching

Runtime DB checks showed the currently stored metric row and open alert are still stale-open:

- `metrics.current = 6`
- `metrics.threshold = 0`
- `metric_alerts.id = 2839` with `resolved_at = null`
- latest snapshots include `6` at `1783389112173`

### 2. Live metric sampler now recomputes to 0

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count
```

Observed value:

- `0`

### 3. Supported repair path reports no remaining repairable offenders

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount: 0`
- `unchangedCount: 73`

So the supported repair tool does not find any current blocked holder missing observer metadata to backfill.

### 4. Direct runtime tree audit also finds no live offenders

A direct audit of `.state/tasks/tree.json` against the metric contract found:

```json
{
  "count": 0,
  "offenders": []
}
```

The audit checked blocked tasks for the required observer contract fields:

- `blocker.observed_by`
- `blocker.observation_method`
- `blocker.next_check_at`

## Why this is not `fix_root_cause`

`fix_root_cause` would be correct only if the live tree still contained exact blocked tasks missing observer metadata and the owner could safely repair them. In this session:

- the live sampler returned `0`
- the supported repair tool found `0` repairs
- direct tree audit found `0` offenders

So there is no current root-cause task-tree mutation to perform.

## Why this is not `calibrate_metric`

The metric definition still appears correct: it should alert when blocked tasks actually lack observer metadata. The mismatch here is between stale persisted metric/alert state and the current live task-tree recompute, not a bad threshold or wrong measurement rule.

## Conclusion

`waiting_with_evidence` is the correct final operation because the live source of truth has already recovered to `0`, there is no current blocked-contract defect to repair, and this workflow lacks a safe write path to resolve the stale alert row directly.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed sample stays `0`, alert `2839` should recover as stale/transient state.
- If it returns `>0`, reopen only with concrete offender task ids from a fresh `.state/tasks/tree.json` audit and the supported repair tool output.
