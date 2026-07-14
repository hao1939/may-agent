# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3701

- Alert id: `3701`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Decision: `fix_root_cause`
- Judged at: `2026-07-14T18:05Z`

## Judgment

This breach was real at triage start (`value=33`), but the immediate process gap was not missing owner attention. The planner had already created the review task `ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714` for the same blocked-only frontier. The metric stayed red because that live review task did not yet expose metric-recognized structured coverage metadata for the exact 33 overdue blocked waits it was reviewing.

## Evidence checked

### Fresh live recompute before repair

```json
{"measuredAt":1784052333256,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":33,"sampleSize":33,"note":"{\"offenderTaskIds\":[\"wait-windows-nonlive-carriers-authoring-or-source-change-20260702\",\"wait-virtualmachines-auto-zone-same-request-shape-gate-20260702\",\"wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702\",\"wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702\",\"wait-spec-net-integration-outbound-none-topology-constraint-20260702\",\"wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702\",\"wait-spec-net-integration-cross-subscription-vnet-response-20260702\",\"wait-shared-westus2-managed-cluster-capacity-family-return-20260703\",\"wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703\",\"wait-private-cluster-jumpbox-key-execution-surface-return-20260704\",\"wait-secops-identity-sp-workflow-secret-contract-return-20260704\",\"wait-spec-gpu-classic-westus2-sku-support-family-return-20260704\",\"wait-spec-open-service-mesh-addon-westus2-network-ownership-throttling-return-20260704\",\"wait-nap-execution-surface-family-return-20260705\",\"wait-kms-v2-private-kv-konnectivity-feature-flag-return-20260706\",\"hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707\",\"hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707\",\"hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707\",\"hold-spec-virtualmachine-prerelease-row61-core-addon-compatibility-run-28721673014-frontier-20260707\",\"hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h\",\"hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c\",\"hold-spec-traffic-asm-ingress-internal-helm-secret-product-gap-frontier-20260707b\",\"wait-ccp-security-patch-reviewed-exception-owner-response-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708\",\"hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708\",\"wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708\",\"wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708\",\"hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709\",\"wait-network-swift-v1-returned-artifacts-28825349625-28825356807-20260710\",\"wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710\",\"hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b\",\"hold-compact-secops-package-partial-frontier-20260714\"]}"}
```

### Existing owner work before repair

`ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714` was already live in `review` state with a goal to inspect the blocked project/spec/compact roots and either seed bounded local follow-up or prove that only exact waits remain. That task was the correct controller-visible owner work for this blocked-only frontier, but it carried no `context.blockedTaskIds` / `context.auditedBlockedTaskIds` / `context.overdueOwnerActions`, so `project-metrics.ts` still treated the 33 waits as uncovered.

## Change made

Using the supported task-tree save path (`withTreeLock(...)` + `saveTaskTreeWithKanbanSnapshot(...)`), I updated `ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714` with exact structured coverage metadata for all 33 current offender waits.

Applied coverage:

- `context.blockedTaskIds = [33 exact offender ids]`
- `context.auditedBlockedTaskIds = [33 exact offender ids]`
- `context.overdueOwnerActions = [{ taskId, coverageTaskId }]`
- `context.metricCoverage = { metricId, alertId, repairedAt, evidencePath, coverageTaskId, reason }`
- `trace.blocked_overdue_metric_coverage_*` fields pointing at this repair
- `outputs += evidence/archive/20260714-metric-alert-overdue-unworked-count-alert3701-fix-root-cause.md`

Repair payload summary:

```json
{"repairedAt":"2026-07-14T18:05:33.381Z","taskId":"ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714","coverageCount":33,"state":"review"}
```

## Validation after repair

### Fresh live recompute after repair

```json
{"measuredAt":1784052334497,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The alert was not stale and did not need calibration. The app already had the right overdue-frontier review task, but the metric could not recognize that task as covering the exact overdue waits. Adding the structured coverage metadata repaired the real process gap and immediately returned the live metric to zero.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` while `ops/review-blocked-only-frontier-and-seed-local-followup-alert3700-20260714` continues to own this frontier or hands it off to sharper successor tasks.
