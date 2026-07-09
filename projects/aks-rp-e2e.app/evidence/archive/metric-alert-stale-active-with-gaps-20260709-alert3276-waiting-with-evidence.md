# Metric alert triage — `waiting_with_evidence` — `aks-rp-e2e.task.stale-active-with-gaps`

- Alert id: `3276`
- Metric id: `aks-rp-e2e.task.stale-active-with-gaps`
- Triage time: `2026-07-09T11:43:09Z`
- Chosen operation: `waiting_with_evidence`

## Why this alert is waiting instead of being repaired again

The persisted runtime metric still shows an open breach:

- `metrics.current = 1`
- `threshold = 0`
- `target = 0`
- open `metric_alerts` row `3276` remains unresolved

But fresh owner-side validation now shows the stale-active condition is already gone:

- `bun run scripts/project-metrics.ts aks-rp-e2e.task.stale-active-with-gaps --json` returned `value=0` at `measuredAt=1783600239547`
- `bun run task-tree frontier` shows the formerly affected Fleet verify task as an active frontier item with current assignment metadata, not a dead hidden residue
- runtime `sessions` now includes `s_task_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607091220` in `status=running`, along with the related active app-ops repair session

## Current theory

This looks like a measurement-timing / alert-lifecycle lag, not a fresh root-cause break:

1. Earlier same-day repair work already requeued the false active Fleet verifier caused by empty owner/worker assignment metadata.
2. The planner then relaunched the Fleet verifier with truthful owner/worker metadata.
3. The persisted metric row and open alert still reflect the earlier sampled `1`, while a fresh recompute against current task/session state returns `0`.

## Concrete evidence accepted now

The durable change in this triage session is this accepted evidence record: the owner is explicitly treating alert `3276` as a recovered-but-not-yet-persisted condition and using the next normal metrics snapshot as validator.

I am **not** choosing `fix_root_cause` because there is no current stale active leaf left to repair safely.
I am **not** choosing `resolve_stale` because this environment has no safe runtime write path for `metric_alerts`.

## Next validation

Accept the next normal `metrics-snapshot` as the validator.

Expected result:

- `aks-rp-e2e.task.stale-active-with-gaps` persists from stored `current=1` to `0`
- alert `3276` resolves through the normal runtime recovery path

If the next persisted snapshot still reports `1`, re-open this as a real measurement/runtime regression because current task frontier and live session state already recompute to `0`.