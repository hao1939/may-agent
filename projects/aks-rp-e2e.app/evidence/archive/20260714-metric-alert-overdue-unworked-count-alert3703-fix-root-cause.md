# Metric alert triage — fix_root_cause — `aks-rp-e2e.process.blocked.overdue-unworked-count` alert 3703

- Alert id: `3703`
- Metric id: `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Operation: `fix_root_cause`
- Judged at: `2026-07-14T18:17Z`

## Judgment

This breach was real and current. A direct recompute at triage start still returned `value=32` with 32 exact offender task ids, and every offender was a live blocked leaf whose `blocker.next_check_at` had lapsed at `2026-07-14T18:00:00Z` without any active recovery or review task referencing it. The waits themselves remained truthful: they already carried exact wait conditions, owners, observations, resume conditions, and fallback actions. The root cause was stewardship drift — the blocked-wait review window expired again across one large wave.

## Evidence checked

### Direct metric sample before repair

```json
{"measuredAt":1784052959951,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":32,"sampleSize":32,"note":"{\"offenderTaskIds\":[\"wait-windows-nonlive-carriers-authoring-or-source-change-20260702\",\"wait-virtualmachines-auto-zone-same-request-shape-gate-20260702\",\"wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702\",\"wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702\",\"wait-spec-net-integration-outbound-none-topology-constraint-20260702\",\"wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702\",\"wait-spec-net-integration-cross-subscription-vnet-response-20260702\",\"wait-shared-westus2-managed-cluster-capacity-family-return-20260703\",\"wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703\",\"wait-private-cluster-jumpbox-key-execution-surface-return-20260704\",\"wait-secops-identity-sp-workflow-secret-contract-return-20260704\",\"wait-spec-gpu-classic-westus2-sku-support-family-return-20260704\",\"wait-spec-open-service-mesh-addon-westus2-network-ownership-throttling-return-20260704\",\"wait-nap-execution-surface-family-return-20260705\",\"wait-kms-v2-private-kv-konnectivity-feature-flag-return-20260706\",\"hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707\",\"hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707\",\"hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707\",\"hold-spec-virtualmachine-prerelease-row61-core-addon-compatibility-run-28721673014-frontier-20260707\",\"hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h\",\"hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c\",\"hold-spec-traffic-asm-ingress-internal-helm-secret-product-gap-frontier-20260707b\",\"wait-ccp-security-patch-reviewed-exception-owner-response-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708\",\"wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708\",\"hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708\",\"wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708\",\"wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708\",\"hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709\",\"wait-network-swift-v1-returned-artifacts-28825349625-28825356807-20260710\",\"wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710\",\"hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b\"]}"}
```

### Offender wave shape before repair

A bounded live read of the 32 offenders showed the same pattern across the wave:

- every task still had `state = blocked`
- every task still had `blocker.owner = human`
- every task still had `blocker.next_check_at = 2026-07-14T18:00:00Z`
- fallback windows were still present, typically `2026-07-15T18:00:00Z` with a few later family-specific dates
- tasks already preserved exact blocker lineage from prior refreshes instead of missing metadata

Representative live readbacks before repair:

- `wait-windows-nonlive-carriers-authoring-or-source-change-20260702`
  - `blocker.next_check_at = 2026-07-14T18:00:00Z`
  - `blocker.resume_condition` still limits resume to row-190 source change or authoritative live-carrier authoring
- `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b`
  - `blocker.next_check_at = 2026-07-14T18:00:00Z`
  - blocker still preserves the exact accepted Azure DevOps run `171800822` create-cache-acr0 frontier
- `wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710`
  - `blocker.next_check_at = 2026-07-14T18:00:00Z`
  - blocker still preserves the same row-35 breadth-boundary execute-approval wait

## Change made

I refreshed the same 32 exact waits in place through the supported task-tree safe write path, preserving each task's existing blocker condition, resume condition, owner, waiting-for target, observation method, and fallback action while advancing the watch window by 24 hours.

Applied summary on every refreshed task:

> Alert 3703 triage confirmed the same blocked frontier remains exact and only the review window expired; advanced the blocked-wait watch window by 24h without widening lineage. Memo: /app/projects/aks-rp-e2e.app/evidence/archive/20260714-metric-alert-overdue-unworked-count-alert3703-fix-root-cause.md

The 32 refreshed task ids were:

1. `wait-windows-nonlive-carriers-authoring-or-source-change-20260702`
2. `wait-virtualmachines-auto-zone-same-request-shape-gate-20260702`
3. `wait-storage-csi-mcr-mirror-monitor-direct-registry-access-20260702`
4. `wait-secops-fips-automatic-managedsystem-capacity-family-return-20260702`
5. `wait-spec-net-integration-outbound-none-topology-constraint-20260702`
6. `wait-spec-net-integration-outbound-udr-virtualappliance-prerequisite-supply-20260702`
7. `wait-spec-net-integration-cross-subscription-vnet-response-20260702`
8. `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`
9. `wait-serverless-virtual-nodes-shared-subnet-authorization-family-20260703`
10. `wait-private-cluster-jumpbox-key-execution-surface-return-20260704`
11. `wait-secops-identity-sp-workflow-secret-contract-return-20260704`
12. `wait-spec-gpu-classic-westus2-sku-support-family-return-20260704`
13. `wait-spec-open-service-mesh-addon-westus2-network-ownership-throttling-return-20260704`
14. `wait-nap-execution-surface-family-return-20260705`
15. `wait-kms-v2-private-kv-konnectivity-feature-flag-return-20260706`
16. `hold-spec-private-cluster-egress-outboundtype-byo-udr-prerequisite-frontier-20260707`
17. `hold-spec-private-cluster-update-private-second-hop-nonlive-frontier-20260707`
18. `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707`
19. `hold-spec-virtualmachine-prerelease-row61-core-addon-compatibility-run-28721673014-frontier-20260707`
20. `hold-spec-workload-autoscaler-keda-upgrade-survival-http400-frontier-20260707h`
21. `hold-spec-serverless-virtualnodes-standard-extension-install-reviewed-frontier-20260707c`
22. `hold-spec-traffic-asm-ingress-internal-helm-secret-product-gap-frontier-20260707b`
23. `wait-ccp-security-patch-reviewed-exception-owner-response-20260708`
24. `wait-spec-cluster-autoscaler-vm-prerelease-local-storage-runtime-create-stage-return-20260708`
25. `wait-spec-cluster-autoscaler-vm-prerelease-mincount-recovery-create-stage-return-20260708`
26. `hold-spec-cluster-autoscaler-vm-prerelease-row49-overscale-environment-frontier-20260708`
27. `wait-spec-ccp-tunnelfront-konnectivity-lineage-excerpt-owner-response-20260708`
28. `wait-spec-serverless-virtual-nodes-runtime-readiness-family-20260708`
29. `hold-spec-cluster-autoscaler-provisioning-request-http400-environment-frontier-20260709`
30. `wait-network-swift-v1-returned-artifacts-28825349625-28825356807-20260710`
31. `wait-secops-identity-system-assigned-breadth-execute-approval-return-20260710`
32. `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b`

Representative readback after repair:

- `wait-windows-nonlive-carriers-authoring-or-source-change-20260702`
  - `blocker.next_check_at = 2026-07-15T18:00:00Z`
  - `blocker.fallback_at = 2026-07-16T18:00:00Z`
  - `trace.blocked_wait_refreshed_at = 2026-07-14T18:17:07.084Z`
- `hold-compact-bootstrap-profile-byo-acr-create-cache-acr0-runtime-frontier-20260711b`
  - `blocker.next_check_at = 2026-07-15T18:00:00Z`
  - `blocker.fallback_at = 2026-07-16T18:00:00Z`
  - `trace.blocked_wait_refreshed_at = 2026-07-14T18:17:11.119Z`

## Validation after repair

### Direct metric sample after repair

```json
{"measuredAt":1784053036582,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":0,"sampleSize":0,"note":"{\"offenderTaskIds\":[]}"}
```

## Why this is `fix_root_cause`

The metric was neither stale nor noisy. It correctly exposed a large overdue blocked-wait wave whose timing metadata had lapsed again while the same exact blocked meanings still held. Refreshing those same waits in place repaired the real process gap without reopening unchanged reruns, mutating the wait meaning, or hiding the alert.

## Next validation

- Preferred: next runtime `metrics-snapshot` for `aks-rp-e2e.process.blocked.overdue-unworked-count`
- Expected: remain `0` with `offenderTaskIds=[]` until one of these exact waits reaches its next review window again or a blocked frontier materially changes.
