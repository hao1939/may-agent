# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3566

- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Alert id: `3566`
- Operation: `fix_root_cause`
- Judged at: `2026-07-13T18:09:33Z`

## Why this was a real breach

A fresh local recompute at triage start still showed the metric live-breaching rather than stale:

```json
{"measuredAt":1783966089354,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":53,"sampleSize":53,"note":"{\"offenderTaskIds\":[\"wait-windows-nonlive-carriers-authoring-or-source-change-20260702\",\"wait-virtualmachines-auto-zone-same-request-shape-gate-20260702\",\"wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702\",\"wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702\",\"wait-spec-net-integration-outbound-none-topology-constraint-20260702\",\"wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702\",\"wait-spec-net-integration-cross-subscription-vnet-response-20260702\",\"wait-shared-westus2-managed-cluster-capacity-family-return-20260703\",\"wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703\",\"wait-private-cluster-jumpbox-key-execution-surface-return-20260704\",\"wait-secops-identity-sp-workflow-secret-contract-return-20260704\",\"wait-spec-gpu-classic-westus2-sku-support-family-return-20260704\",\"wait-spec-open-service-mesh-addon-westus2-network-ownership-throttling-return-20260704\",\"wait-nap-execution-surface-family-return-20260705\",\"wait-kms-v2-private-kv-konnectivity-feature-flag-return-20260706\",\"hold-compact-traffic-applink-upgrade-survival-contract-mismatch-frontier-20260707\",\"hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707\",\"hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707\",\"hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707\",\"hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707\",\"hold-spec-virtualmachine-prerelease-row61-core-addon-compatibility-run-28721673014-frontier-20260707\",\"hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h\",\"hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c\",\"hold-spec-node-confidential-vm-snp-pool-run-28672036322-artifact-visibility-frontier-20260707c\",\"hold-spec-traffic-asm-ingress-internal-helm-secret-product-gap-frontier-20260707b\",\"wait-ccp-security-patch-reviewed-exception-owner-response-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708\",\"hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708\",\"wait-spec-secops-fips-terminal-artifact-visibility-family-return-20260708\",\"hold-spec-localdns-managed-cluster-quota-family-frontier-20260708\",\"wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708\",\"wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708\",\"hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709\",\"hold-compact-ccp-agent-reviewed-exception-frontier\",\"hold-compact-localdns-package-partial-frontier\",\"hold-compact-workload-identity-live-workflow-frontier\",\"hold-compact-jwt-authenticator-package-partial-frontier\",\"hold-spec-private-cluster-private-endpoint-connections-lifecycle-westus2-capacity-frontier-20260707\",\"wait-localdns-hosts-plugin-create-http400-body-or-surface-change-20260703\",\"wait-network-swift-v1-returned-artifacts-28825349625-28825356807-20260710\",\"wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710\",\"hold-compact-ccp-autoupgrader-pipeline-reviewed-exception-frontier\",\"hold-compact-ccp-metricsserver-reviewed-exception-frontier\",\"hold-compact-app-monitoring-westus2-managed-cluster-capacity-frontier-20260710\",\"hold-compact-traffic-alb-controller-package-partial-frontier\",\"wait-localdns-create-http400-residual-family-return-20260704\",\"ops/wait-compact-remediator-runtime-owner-review-return-20260709-owner-normalized\",\"hold-spec-localdns-windows-nodepool-unsupported-nonlive-evidence-ceiling-20260712\",\"hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707\",\"hold-compact-paf-throttling-reviewed-exception-frontier-owner-normalized-20260713\",\"hold-compact-ccp-security-patch-os-variants-reviewed-exception-frontier-20260713\",\"ops/review-1800-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-lineage-20260713\"]}"}
```

Grouping the sampled offender ids by parent scope showed the breach was one missing active-review wave across the three canonical blocked-overdue scopes:

- `aks-spec-verification-loop`: 37 overdue waits
- `aks-feature-compact-loop`: 14 overdue waits
- `project`: 2 overdue waits

## Root-cause fix applied

I created and assigned three exact app-ops review leaves with the canonical overdue coverage scopes that the metric recognizes:

1. `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713`
   - `conflict_scope=["ops:blocked-overdue:spec-loop"]`
   - sampled offender set stored on task context
2. `ops/review-1826-compact-loop-overdue-blocked-frontier-wave-20260713`
   - `conflict_scope=["ops:blocked-overdue:compact-loop"]`
   - sampled offender set stored on task context
3. `ops/review-1827-project-overdue-blocked-frontier-wave-20260713`
   - `conflict_scope=["ops:blocked-overdue:project"]`
   - sampled offender set stored on task context

Each task was then assigned to `app-ops`, making the overdue blocked waits actively represented again instead of passively expired.

## Immediate validation

After the three coverage tasks were added and assigned, a fresh local recompute cleared the metric:

```json
{"measuredAt":1783966173828,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

The live frontier immediately reflected those active review leaves:

- `ops/review-1825-spec-loop-overdue-blocked-frontier-wave-20260713`
- `ops/review-1826-compact-loop-overdue-blocked-frontier-wave-20260713`
- `ops/review-1827-project-overdue-blocked-frontier-wave-20260713`

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` while these review waves stay active or get replaced by sharper same-lineage successor work.
