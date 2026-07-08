# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2872`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The persisted metric row and open alert still show a breach (`current=1`, threshold `0`), but the current runtime task-tree source of truth does not show any blocked leaf missing the required observer contract fields. The supported blocked-contract repair tool also reports nothing left to repair. In this triage environment there is no safe runtime write path to clear the stale metric/alert row directly, so the correct owner action is `waiting_with_evidence` until the next metrics refresh either recovers the alert or reproduces a concrete offender.

## Evidence checked

### 1. Persisted metric and alert still show an open breach

Runtime DB inspection showed:

- `metrics.current = 1`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- alert `2872` remains open (`resolved_at = null`)

### 2. Metric contract still measures blocked leaves missing observer metadata

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines `aks-rp-e2e.process.blocked.missing-observer-count` as `tasks.blockedMissingObserver`, so the metric is still intended to fire only when blocked tasks actually lack observer metadata.

### 3. Live metric recompute is already back in range

```bash
cd /app/projects/aks-rp-e2e.app && bun run metrics:sample aks-rp-e2e.process.blocked.missing-observer-count --json
```

Observed result:

```json
{ "measuredAt": 1783400424463, "value": 0 }
```

So the current runtime recompute already says the metric should be `0`.

### 4. Supported repair tool finds nothing left to backfill

```bash
cd /app/projects/aks-rp-e2e.app && bun run task-tree repair-blocked-contracts --dry-run
```

Observed result:

- `repairedCount: 0`
- `unchangedCount: 82`

So there is no current blocked holder that the supported repair path can fix.

### 5. Direct runtime-tree audit finds no live offenders

A direct audit of `.state/tasks/tree.json` using the required observer fields (`observed_by`, `observation_method`, `next_check_at`) found:

```json
{
  "count": 0,
  "ids": [],
  "sample": []
}
```

That means there is no current blocked leaf in the runtime task tree that lacks the required observer contract.

## Why this is not `fix_root_cause`

`fix_root_cause` would require a current blocked leaf that still lacks observer metadata and a safe repair to apply now. The live recompute is already `0`, the dry-run repair tool finds `repairedCount: 0`, and the direct runtime-tree audit found zero offenders.

## Why this is not `resolve_stale`

The remaining problem appears to be stale metric/alert lifecycle state, but this workflow does not expose a safe runtime write path for resolving `metric_alerts` or forcing a metrics refresh. The concrete owner action available here is to leave durable evidence and wait for the next validation signal.

## Conclusion

Choose `waiting_with_evidence`: the live runtime task tree is already compliant with the observer contract, there is no safe repair to apply now, and the next metrics refresh is the correct validation signal.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed value stays `0`, alert `2872` should recover as stale/transient state.
- If it returns `>0`, reopen only with the exact offender task ids from a fresh `.state/tasks/tree.json` audit.
