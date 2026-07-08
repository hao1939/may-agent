# Metric alert triage — `aks-rp-e2e.process.assignment-state-mismatch-count` alert 3180

- Alert id: `3180`
- Metric id: `aks-rp-e2e.process.assignment-state-mismatch-count`
- Judged at: `2026-07-08T18:05:15Z`
- Chosen operation: `waiting_with_evidence`

## Persisted alert state

The persisted metric row still shows an open breach:

- `metrics.current = 2`
- `threshold = 0`
- `target = 0`
- `priority = P0`
- `metrics.updated_at = 1783533157880`
- open alert row `metric_alerts.id = 3180`, `resolved_at = null`

Latest persisted snapshots for this metric:

- `1783533157880` => `2`
- `1783532854686` => `0`
- `1783532142476` => `0`
- `1783531844691` => `0`
- `1783531539874` => `0`
- `1783531240374` => `0`
- `1783530940531` => `0`
- `1783530641596` => `0`
- `1783530339820` => `0`
- `1783530040429` => `0`

## Live source-of-truth check

Fresh direct recompute no longer reproduces the breach:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.process.assignment-state-mismatch-count --json
```

Observed output:

```json
{"measuredAt":1783533850636,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0}
```

The metric implementation defines this signal as open/orphan `project.task` assignment pairs whose correlated task is missing or no longer active. Current runtime inspection of open `event_pair_runs` rows shows only current open assignments for live work, for example:

- `reconcile-spec-loop-pending-secops-fips-23:a_reconcile-spec-loop-pending-secops-fips-23_20260708180149`
- `reconcile-spec-loop-pending-net-integration-22:a_reconcile-spec-loop-pending-net-integration-22_20260708180148`
- `reconcile-compact-live-workflow-app-monitoring-residual-20260708:a_reconcile-compact-live-workflow-app-monitoring-residual-20260708_20260708175821`
- `reconcile-spec-loop-pending-storage-csi-16:a_reconcile-spec-loop-pending-storage-csi-16_20260708175821`
- `reconcile-spec-loop-pending-network-cni-28:a_reconcile-spec-loop-pending-network-cni-28_20260708175821`
- `ops-repair-spec-loop-holder-remap-parity-alert-3177-20260708:a_ops-repair-spec-loop-holder-remap-parity-alert-3177-20260708_20260708175817`
- `verify-compact-fleet-fleet.hubless-rpapi-lifecycle-202607081739:a_verify-compact-fleet-fleet_hubless-rpapi-lifecycle-202607081739_20260708175606`
- `reconcile-compact-loop-package-partial-202607081739:a_reconcile-compact-loop-package-partial-202607081739_20260708175605`
- `implement-network-cni-agic-overlay-runtime-slices-20260708:a_implement-network-cni-agic-overlay-runtime-slices-20260708_20260708175132`

Those task ids are still present in `.state/tasks/tree.json`, and their open pair rows were created by recent `project.task.assigned` events rather than by stale historical residue.

## Why the correct operation is `waiting_with_evidence`

There is no currently reproducible assignment-state mismatch to repair safely in this triage session:

1. the persisted metric row still says `current = 2`,
2. the live recompute already says `value = 0`, and
3. the currently open `project.task` pairs are current in-flight assignments, not missing/non-active tasks.

This environment only provides read-only DB access, so there is no safe runtime write path here to resolve `metric_alerts`, rewrite `metrics.current`, or otherwise force alert closure. The truthful owner action is therefore to record that the live source of truth is already back in range and wait for the next supported metrics refresh / alert reconciliation cycle to either validate recovery or produce a new live offender.

## Next validation

Wait for the next `metrics-snapshot` / alert reconciliation cycle for `aks-rp-e2e.process.assignment-state-mismatch-count`.

Recovery is confirmed when the persisted metric row refreshes to `0` and alert `3180` resolves automatically. If the next live recompute returns `>0`, re-triage only with the exact current `correlation_key` values whose correlated tasks are missing or non-active at that time.
