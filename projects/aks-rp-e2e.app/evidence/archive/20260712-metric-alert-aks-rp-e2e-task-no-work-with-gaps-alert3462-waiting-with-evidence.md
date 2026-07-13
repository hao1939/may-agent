# Metric alert triage — waiting_with_evidence — `aks-rp-e2e.task.no-work-with-gaps`

- Alert id: `3462`
- Metric id: `aks-rp-e2e.task.no-work-with-gaps`
- Triage time: `2026-07-12T09:36:00Z`
- Owner: `app-ops`

## Judgment

Choose `waiting_with_evidence` because the persisted runtime metric row still shows `current=1`, but the owner-side source command now recomputes the metric as `0` after the planner added a second healthy active ops leaf.

## Evidence checked

1. Runtime metric row still breaching:
   - `metrics.current = 1`
   - latest snapshot value `1` at `1783848801517`
2. Current owner-side recomputation no longer breaches:
   - `bun ./scripts/project-metrics.ts aks-rp-e2e.task.no-work-with-gaps` => `0`
3. The task tree now has two active leaves instead of one:
   - `domain/reconcile-current-unpublished-net-integration-rp-cluster-lifecycle-slice-20260712`
   - `ops/repair-no-work-with-gaps-active-only-frontier-semantics-20260712`
4. The new ops leaf is already assigned and active, so there is now executable work while gaps remain.
5. Related process signals still show a real stale-active/unowned-work issue on the domain leaf:
   - `aks-rp-e2e.task.stale-active-with-gaps` => `1`
   - `aks-rp-e2e.process.unowned-work-count` => `1`

## Why this is not another operation

- Not `fix_root_cause`: this triage environment did not safely mutate runtime metric state itself; the concrete process change already happened through planner/task-tree work, and validation now depends on the next metrics snapshot.
- Not `resolve_stale`: the alert row should recover naturally only after the persisted metric row is refreshed.
- Not `downgrade_priority` or `calibrate_metric`: the metric contract is still correct for a true zero-work frontier.

## Next validation

Wait for the next `metrics-snapshot`. Expected result:
- persisted metric row for `aks-rp-e2e.task.no-work-with-gaps` moves from `1` to `0`
- alert `3462` recovers naturally

If the next snapshot still persists `1` while the source command remains `0`, re-triage this as a metric state-sync defect rather than a project-starvation incident.
