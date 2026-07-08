# Metric alert triage — aks-rp-e2e.process.blocked.missing-observer-count

- Alert id: `2845`
- Metric id: `aks-rp-e2e.process.blocked.missing-observer-count`
- Judged at: `2026-07-07T02:27:50Z`
- Chosen operation: `waiting_with_evidence`

## Judgment

The persisted metric row and open alert still show a breach (`current=3`), but the live task-tree source of truth no longer shows any blocked task missing observer metadata, and the supported blocked-contract repair tool has nothing left to repair.

This means the actionable defect is not currently present in the runtime tree. The remaining issue is stale metric/alert lifecycle state that this triage workflow cannot safely overwrite because it only has read-only DB access. The correct owner action in this environment is therefore `waiting_with_evidence` until the next safe metrics refresh validates recovery or reproduces a live offender.

## Evidence checked

### 1. Persisted runtime metric / alert still breaching

Runtime DB checks showed the currently stored metric row and open alert are still stale-open:

- `metrics.current = 3`
- `metrics.threshold = 0`
- `metrics.target = 0`
- `metrics.priority = P0`
- open alert `2845` with `resolved_at = null`
- latest snapshots oscillated `0 -> 8 -> 0 -> 3`, so the breach is not a one-time historical artifact but a currently unresolved lifecycle state

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

### 4. Metric definition still matches the intended contract

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-observer-count": () => ({
  value: tasks.blockedMissingObserver,
}),
```

So this metric should still alert only when blocked tasks actually lack observer metadata. The mismatch in this session is between persisted metric/alert state and the current runtime-tree recompute, not a bad threshold or wrong measurement rule.

## Why this is not `fix_root_cause`

`fix_root_cause` would be correct only if the live tree still contained exact blocked tasks missing observer metadata and the owner could safely repair them. In this session:

- the live sampler returned `0`
- the supported repair tool found `0` repairs
- there is no current offender named by the repair path

So there is no current root-cause task-tree mutation to perform.

## Why this is not `resolve_stale`

This alert likely is stale relative to the current live recompute, but this workflow does not provide a safe runtime write path for manually resolving `metric_alerts` or overwriting `metrics.current`. The durable owner action available here is to record the discrepancy evidence and wait for the next safe metrics refresh.

## Conclusion

`waiting_with_evidence` is the correct final operation because the live source of truth has already recovered to `0`, there is no current blocked-contract defect to repair, and this workflow lacks a safe write path to resolve the stale alert row directly.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-observer-count`.

- If the refreshed sample stays `0`, alert `2845` should recover as stale/transient state.
- If it returns `>0`, reopen only with concrete offender task ids from a fresh `.state/tasks/tree.json` audit and the supported repair tool output.
