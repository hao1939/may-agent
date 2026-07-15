# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3673

- Alert id: `3673`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Operation: `fix_root_cause`
- Judged at: `2026-07-14T15:03Z`

## Judgment

This breach was real, current, and safe to repair locally. A fresh local recompute at triage start still returned `value=8` and named eight exact blocked waits whose review windows had expired without active coverage. Current checked-in/source-backed authority still preserves the same blocked meanings for both spec-loop carriers and the VirtualMachines compact split frontier, so the correct action was to refresh those exact waits in place rather than reopen unchanged reruns, calibrate the metric, or escalate.

## Evidence checked

### Live metric still breaching at triage start

```json
{"measuredAt":1784041310433,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":8,"sampleSize":8,"note":"{\"offenderTaskIds\":[\"hold-spec-remediator-node-not-ready-restart-runtime-nonpass-frontier-20260707c\",\"hold-spec-rp-cluster-lifecycle-new-vnet-runner-variant-pipeline-only-reviewed-exception-20260707\",\"hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708\",\"hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708\",\"hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708\",\"hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b\",\"wait-spec-virtualmachine-prerelease-row75-row76-run-28721673014-node-readiness-family-20260711\",\"hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713\"]}"}
```

### Current authority still preserves the same blocked meanings

- `features/virtualmachines-agentpool/compact/staging.summary.md` still marks the exact nine-member blocked split frontier with the same sub-frontiers, including:
  - auto-zone pair as `api-shape-environment-blocked-frontier`
  - row61 + row75/row76 as `reviewed-live-run-environment-frontier`
  - `cli-add-multi-sku` as `reviewed-exception-frontier`
- `AKS_RP_E2E_WRITE_CHECK_EVIDENCE=1 bun features/remediator-node-not-ready-restart/tests/remediator-node-not-ready-restart.ts --check --run-id=metric-alert-3673-remediator-20260714` passed and preserved the exact row-163 remediator contract plus the required `NodeReboot*` / `NodeReimage*` assertions.
- `bun features/rp-cluster-lifecycle/tests/rp-cluster-lifecycle-new-vnet-runner-variant.ts --check --run-id=metric-alert-3673-newvnet-20260714` passed and preserved `terminalClassification=pipeline_only` with `metadata.noExecutionCoverageClaim=true`.

## Root cause

The waits themselves were still truthful. The regression was stewardship: their review windows had expired again, so the overdue-unworked metric correctly treated them as uncovered blocked debt.

## Change made

I refreshed the same eight exact waits through the supported task-tree safe write path and then updated each blocker so `resume_at` moved forward with the new watch window:

1. `hold-spec-remediator-node-not-ready-restart-runtime-nonpass-frontier-20260707c`
2. `hold-spec-rp-cluster-lifecycle-new-vnet-runner-variant-pipeline-only-reviewed-exception-20260707`
3. `hold-compact-virtualmachines-agentpool-auto-zone-invalidavailabilityzones-frontier-20260708`
4. `hold-compact-virtualmachines-agentpool-row61-oldest-branch-runtime-frontier-20260708`
5. `hold-compact-virtualmachines-agentpool-row75-row76-node-readiness-frontier-20260708`
6. `hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b`
7. `wait-spec-virtualmachine-prerelease-row75-row76-run-28721673014-node-readiness-family-20260711`
8. `hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713`

All eight now record the same refresh summary in task trace:

> Alert 3673 triage confirmed the same blockers remain exact and only the review windows expired; advanced the blocked-wait watch windows by 24h without widening lineage.

Representative readback after repair:

- `hold-spec-remediator-node-not-ready-restart-runtime-nonpass-frontier-20260707c`
  - `blocker.next_check_at = 2026-07-16T15:00:00.000Z`
  - `blocker.resume_at = 2026-07-16T15:00:00.000Z`
  - `blocker.fallback_at = 2026-07-17T18:00:00.000Z`
- `hold-compact-virtualmachines-agentpool-split-frontier-maintained-20260708b`
  - `blocker.next_check_at = 2026-07-16T15:00:00.000Z`
  - `blocker.resume_at = 2026-07-16T15:00:00.000Z`
  - `blocker.fallback_at = 2026-07-17T15:00:00.000Z`
- `wait-spec-virtualmachine-prerelease-row75-row76-run-28721673014-node-readiness-family-20260711`
  - `blocker.next_check_at = 2026-07-16T15:00:00.000Z`
  - `blocker.resume_at = 2026-07-16T15:00:00.000Z`
  - `blocker.fallback_at = 2026-07-17T15:00:00.000Z`

## Validation after repair

A fresh direct recompute cleared the metric immediately:

```json
{"measuredAt":1784041410014,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The metric was neither stale nor noisy. It correctly exposed eight exact blocked waits whose timing metadata had lapsed again. Refreshing those same waits in place, while preserving their exact source-backed meanings and moving both `next_check_at` and `resume_at` back into the future, repaired the actual process gap.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until one of these same-lineage waits reaches its next review window again or one frontier materially changes.
