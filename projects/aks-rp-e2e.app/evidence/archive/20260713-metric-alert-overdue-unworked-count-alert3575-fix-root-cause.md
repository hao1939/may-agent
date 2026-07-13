# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3575

- Alert id: `3575`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Decision: `fix_root_cause`
- Triage time: `2026-07-13T20:44Z`

## Judgment

This breach was real at triage start, but the root cause was not a missing owner wake. The planner had already created and assigned three exact app-ops overdue-review tasks at `20:42Z`, and together their goals covered all 12 offender waits sampled by the metric. The metric stayed red because those active tasks did not yet expose metric-recognized structured coverage metadata (`context.blockedTaskIds` / `context.overdueOwnerActions`).

## Evidence checked

### Fresh live recompute before repair

```json
{"measuredAt":1783975433098,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":12,"sampleSize":12,"note":"{\"offenderTaskIds\":[\"wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704\",\"hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706\",\"hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707\",\"hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c\",\"hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h\",\"hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h\",\"hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708\",\"hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708\",\"hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier-20260708\",\"hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix\",\"hold-compact-rp-cluster-lifecycle-split-frontier-20260711\",\"hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier-owner-normalized-20260713\"]}"}
```

### Active owner work already existed before repair

The live task tree already had these active app-ops leaves:

1. `ops/apply-shared-auth-artifact-result-family-overdue-review-20260713`
   - goal names four offenders:
     - `wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704`
     - `hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h`
     - `hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h`
     - `hold-compact-rp-cluster-lifecycle-split-frontier-20260711`
2. `ops/apply-private-cluster-compact-mixed-frontier-overdue-review-20260713`
   - goal names `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix`
3. `ops/apply-spec-frontier-overdue-wave-20260713`
   - goal names the remaining seven offenders:
     - `hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706`
     - `hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707`
     - `hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c`
     - `hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708`
     - `hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708`
     - `hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier-20260708`
     - `hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier-owner-normalized-20260713`

Before repair, none of those active tasks had `context.blockedTaskIds`, `context.overdueOwnerActions`, or a recognized `ops:blocked-overdue:*` conflict scope, so `project-metrics.ts` still counted the waits as uncovered.

## Change made

Using the task-tree safe write path (`withTreeLock(...)` + `saveTaskTreeWithKanbanSnapshot(...)`), I updated the three already-active overdue-review leaves with exact structured coverage metadata.

### Applied coverage metadata

```json
{
  "repairedAt": "2026-07-13T20:44:44.693Z",
  "evidencePath": "evidence/archive/20260713-metric-alert-overdue-unworked-count-alert3575-fix-root-cause.md",
  "coverage": {
    "ops/apply-shared-auth-artifact-result-family-overdue-review-20260713": [
      "wait-shared-github-auth-preflight-401-family-spec-defender-compact-oidc-20260704",
      "hold-spec-private-cluster-shared-apiserver-subnet-run-28840446579-result-visibility-frontier-20260707h",
      "hold-spec-private-cluster-update-public-second-hop-run-28671841561-artifact-frontier-20260707h",
      "hold-compact-rp-cluster-lifecycle-split-frontier-20260711"
    ],
    "ops/apply-private-cluster-compact-mixed-frontier-overdue-review-20260713": [
      "hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix"
    ],
    "ops/apply-spec-frontier-overdue-wave-20260713": [
      "hold-spec-loop-pending-managementplane-addon-row60-nonlive-policy-frontier-20260706",
      "hold-spec-node-confidential-vm-kata-snp-runtime-adjacent-hypothesis-frontier-20260707",
      "hold-spec-network-acns-performance-cilium-upgrade-user-iptables-runtime-blocker-20260707c",
      "hold-spec-cluster-autoscaler-vm-prerelease-scale-from-zero-labels-fips-reviewed-frontier-20260708",
      "hold-spec-kms-v2-trust-service-node-subnet-http409-post-rerun-frontier-20260708",
      "hold-spec-loop-pending-network-acns-hubble-ui-runtime-frontier-20260708",
      "hold-compact-virtualmachine-prerelease-row60-legacy-addon-disable-scaling-reviewed-exception-frontier-owner-normalized-20260713"
    ]
  }
}
```

Each task now carries:

- `context.blockedTaskIds = [...]`
- `context.overdueOwnerActions = [...]`
- `context.metricCoverage = { metricId, alertId, repairedAt, evidencePath, reason }`
- `trace.blocked_overdue_metric_coverage_repaired_at`
- `trace.blocked_overdue_metric_coverage_evidence`

## Validation after repair

### Fresh live recompute after repair

```json
{"measuredAt":1783975489055,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The issue was not stale alert state and not a missing human escalation. The owner had already created the correct active recovery work, but the metric could not recognize that work as covering the overdue waits. Adding the exact structured coverage metadata fixed the real process gap and immediately returned the live metric to zero.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` while these three active review leaves continue to own the same 12 waits or replace them with sharper same-lineage work.
