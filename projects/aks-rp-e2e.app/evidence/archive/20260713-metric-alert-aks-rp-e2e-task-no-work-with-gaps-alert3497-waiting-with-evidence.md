# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3497`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-13T01:31:00Z`
- Owner: `app-ops`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row still shows `current=1`, but the owner-side source command recomputed the metric as `0` immediately after the planner refreshed the frontier and restored executable work.

## Evidence checked

1. Persisted runtime state was still breaching when the alert fired:
   - `metrics.current = 1`
   - latest persisted snapshot value `1` at `1783906163598`
2. A fresh owner-side recomputation after the frontier update no longer breaches:
   - `bun ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps --json` => `{"value":0}` at `2026-07-13T01:31:01.920Z`
3. The live task tree now contains executable work while gaps remain:
   - runtime tree updated at `2026-07-13T01:31:00.862Z`
   - active leaf: `domain/prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713`
   - runnable leaf: `aks-feature-compact-loop`
4. Current task summary confirms this is not a zero-work frontier:
   - `active: domain/prepare-rp-operation-status-polling-same-lineage-proof-recipe-20260713`
   - `runnable: aks-feature-compact-loop`
   - `review: none`

## Why this is not another operation

- Not `fix_root_cause`: the concrete process repair already happened through planner/task-tree movement before this triage. This session did not need to mutate the tree again.
- Not `resolve_stale`: the alert row should recover naturally after the next runtime metrics refresh updates the persisted metric row from `1` to `0`.
- Not `calibrate_metric` or `downgrade_priority`: the metric contract is still correct for a true no-work frontier.

## Next validation

Wait for the next `metrics-snapshot` / alert-recovery pass. Expected result:
- persisted metric row for `aks-rp-e2e.task.no-work-with-gaps` moves from `current=1` to `current=0`
- alert `3497` recovers naturally

If the next snapshot still persists `1` while the source command still returns `0`, re-triage as a metric state-sync defect rather than a real no-work frontier breach.
