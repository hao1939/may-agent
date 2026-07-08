# Metric alert triage — `aks-rp-e2e.process.blocked.missing-waiting-for-count`

- Alert id: `2949`
- Metric id: `aks-rp-e2e.process.blocked.missing-waiting-for-count`
- Judged at: `2026-07-07T04:41:28Z`
- Chosen operation: `waiting_with_evidence`
- Metric owner: `aks-explorer`

## Judgment

The persisted metric row and open alert still show a breach (`current=3`, threshold `0`), but the current live metric recompute and the current runtime task-tree source of truth are already back in range. The supported blocked-contract repair path reports nothing left to repair, so there is no safe owner-side fix to apply in this session. In this read-only alert-triage environment there is also no safe runtime write path to resolve the stale metric/alert row directly, so the correct final operation is `waiting_with_evidence` until the next metrics refresh either recovers the alert automatically or reproduces concrete offending task ids.

## Evidence checked

### 1. Persisted metric row and alert still show the breach

Runtime metric row during triage:

- `current = 3`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `status = active`
- `updated_at = 1783418718734`

Open alert row during triage:

- `id = 2949`
- `resolved_at = NULL`
- message reports `current=3, threshold=0, target=0`

Recent snapshots show the breach is abrupt and inconsistent with nearby samples:

- `1783418718734 => 3`
- `1783418404405 => 0`
- `1783418089957 => 0`
- `1783417774867 => 9`
- `1783417460049 => 0`

### 2. The metric still measures blocked tasks missing `waiting_for`

`projects/aks-rp-e2e.app/scripts/project-metrics.ts` defines:

```ts
"aks-rp-e2e.process.blocked.missing-waiting-for-count": () => ({
  value: tasks.blockedMissingWaitingFor,
}),
```

So this alert should only stay open when the current task-tree contract still has blocked tasks lacking `blocker.waiting_for`.

### 3. Current live metric recompute is already back to zero

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/project-metrics.ts aks-rp-e2e.process.blocked.missing-waiting-for-count --json
```

Observed result:

```json
{ "measuredAt": 1783419008207, "value": 0 }
```

### 4. Supported repair path finds nothing left to backfill

Command:

```bash
cd /app/projects/aks-rp-e2e.app && bun run ./scripts/task-tree.ts repair-blocked-contracts --dry-run
```

Observed result:

```json
{
  "dryRun": true,
  "repairedCount": 0,
  "unchangedCount": 91,
  "repaired": []
}
```

So there is no current blocked holder that the supported repair path can safely fix now.

### 5. Nearby history shows a real breach was already repaired earlier today

Earlier durable evidence for alert `2915` records a real missing-`waiting_for` offender that was repaired via the supported `repair-blocked-contracts` path and then verified back to `0`.

That matters because the current session differs:

- the persisted alert row still says `current=3`;
- the current live recompute is already `0`; and
- the supported repair path is now a no-op.

So this open alert is best judged as waiting on refresh/validation, not as a fresh actionable contract defect.

## Why this is not `fix_root_cause`

`fix_root_cause` would require a current blocked task missing `blocker.waiting_for` and a safe repair to apply now. In this session:

- the official live metric recompute is already `0`; and
- `repair-blocked-contracts --dry-run` reports `repairedCount: 0`.

There is no truthful repair left to apply at this moment.

## Why this is not `resolve_stale`

The remaining issue does look stale/transient at the alert-row level, but this workflow does not expose a safe runtime write path for resolving `metric_alerts` or forcing an immediate metrics refresh. The concrete owner action available here is to leave durable evidence and wait for the next validation signal.

## Conclusion

Choose `waiting_with_evidence`: the live runtime tree is currently compliant with the blocked wait-target contract, the supported repair path is a no-op, and the next metrics refresh is the correct validation signal for whether alert `2949` auto-recovers or reproduces a real offender.

## Next validation signal

Validate on the next `metrics-snapshot` / alert refresh cycle for `aks-rp-e2e.process.blocked.missing-waiting-for-count`.

- If the refreshed value stays `0`, alert `2949` should recover as stale/transient state.
- If it returns `>0`, reopen only with exact offender task ids from a fresh runtime-tree audit and the supported repair path output.
