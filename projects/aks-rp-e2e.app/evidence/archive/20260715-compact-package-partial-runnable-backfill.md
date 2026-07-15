# 2026-07-15 compact package-partial runnable backfill review

Assigned task: `ops/backfill-compact-package-partial-runnable-followups-20260715`

## Conclusion

- The compact package-partial family is **not** blocked-only.
- App-owned compact state currently shows **29 blocked package-partial holders with non-empty compactLiveReadiness.readySpecIds**.
- The hidden backlog is now materially represented by the live active leaf `reconcile-compact-loop-package-partial` (owner `aks-explorer`, state `active`), created at `2026-07-15T07:38:37.255Z` and started at `2026-07-15T07:38:43.508Z`.
- That leaf's goal is: “Restore truthful executable backlog for 29 feature compact package-partial frontier(s) by preserving exact blocked waits, reviewing the current rerun-ready member sets, and requeueing only the bounded work that is still dependency-clear.”
- Result: this worker does **not** propose duplicate blocked waits or a second package-partial follow-up tree mutation. The truthful executable backlog has already been backfilled into the live task tree; the remaining gap is stale top-level readout/metric narration, not missing compact follow-up work.

## Baseline and live-tree contrast

- Stale project-state readout at `2026-07-15T07:37:52.199Z` still says runnable=`0`, waiting=`0`, active=`1` with only `ops/backfill-compact-package-partial-runnable-followups-20260715` active.
- Live task tree now reads active=`4`, review=`1`, blocked=`122`, done=`1`, and includes active compact follow-up leaf `reconcile-compact-loop-package-partial`.
- This proves the originally hidden compact follow-up backlog has been materialized after the stale readout snapshot.

## Holder review

| Feature | Current holder | Rerun-ready count | Example ready members | Current truth |
|---|---|---:|---|---|
| network-cni | `hold-compact-network-cni-package-partial-frontier-20260709i` | 53 | spec.network-acns.basic-retina-update-retina-enterprise, spec.network-acns.cilium-network-policy, spec.network-acns.cilium-observability … (+50 more) | Represented by active reconcile-compact-loop-package-partial |
| net-integration | `hold-compact-net-integration-package-partial-frontier` | 34 | spec.net-integration.authorized-ip-ranges, spec.net-integration.authorized-service-tags, spec.net-integration.auto-assign-hostports … (+31 more) | Represented by active reconcile-compact-loop-package-partial |
| storage-csi | `hold-compact-storage-csi-successor-pair-and-residual-frontier-20260707` | 30 | spec.storage-csi.blob-driver-disable, spec.storage-csi.blob-driver-enable, spec.storage-csi.blob-fuse2-clone … (+27 more) | Represented by active reconcile-compact-loop-package-partial |
| private-cluster | `hold-compact-private-cluster-package-partial-frontier-202607090641-ownerfix` | 22 | spec.private-cluster-addonv2.coreaddons-privatecluster, spec.private-cluster.apiserver-vnet-integration-create, spec.private-cluster.byo-dns-server … (+19 more) | Represented by active reconcile-compact-loop-package-partial |
| cluster-autoscaler | `hold-compact-cluster-autoscaler-five-carrier-frontier-20260714` | 18 | spec.cluster-autoscaler.cse-failure-fast-handling, spec.cluster-autoscaler.cse-failure-not-disruptive, spec.cluster-autoscaler.force-delete-long-unregistered … (+15 more) | Represented by active reconcile-compact-loop-package-partial |
| virtualmachines-agentpool | `hold-compact-virtualmachines-agentpool-cli-add-multi-sku-reviewed-exception-frontier-20260713` | 14 | spec.virtualmachines.accelerated-networking, spec.virtualmachines.autoscale-upgrade-survival, spec.virtualmachines.autoscaled-vms-crud … (+11 more) | Represented by active reconcile-compact-loop-package-partial |
| app-routing | `wait-compact-app-routing-vm-prerelease-environment-quartet-return-20260709` | 11 | spec.app-routing.custom-domain-ingress, spec.app-routing.default-domain-http-reachability, spec.app-routing.nginx-disablement.standalone-pass … (+8 more) | Represented by active reconcile-compact-loop-package-partial |
| secops | `hold-compact-secops-package-partial-frontier-20260714` | 11 | spec.secops-fips.enabled-cluster-create, spec.secops-fips.kata-blocked, spec.secops-fips.node-attestation … (+8 more) | Represented by active reconcile-compact-loop-package-partial |
| workload-autoscaler | `hold-compact-workload-autoscaler-package-partial-frontier` | 10 | spec.vpa.upgrade-survival-runtime, spec.workload-autoscaler.keda-disable-reenable-crud, spec.workload-autoscaler.keda-profile-state … (+7 more) | Represented by active reconcile-compact-loop-package-partial |
| kms-etcd-encryption | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | 9 | spec.kms.v2-enable-on-existing-public-kv-lifecycle, spec.kms.v2-negative-cases, spec.kms.v2-private-cluster-private-kv-trust-service-lifecycle … (+6 more) | Represented by active reconcile-compact-loop-package-partial |
| rp-cluster-lifecycle | `hold-compact-rp-cluster-lifecycle-split-frontier-20260711` | 8 | spec.rp-cluster-lifecycle.create-get-delete, spec.rp-cluster-lifecycle.list-credentials, spec.rp-cluster-lifecycle.nodeless-cluster-crud … (+5 more) | Represented by active reconcile-compact-loop-package-partial |
| ossku-migration | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | 6 | spec.ossku-migration.azurelinux-to-azurelinux3, spec.ossku-migration.azurelinux-to-ubuntu, spec.ossku-migration.azurelinux3-to-azurelinux … (+3 more) | Represented by active reconcile-compact-loop-package-partial |
| rp-nodepool-lifecycle | `hold-spec-rp-nodepool-lifecycle-rollback-environment-frontier-20260707` | 6 | spec.rp-nodepool-lifecycle.add-remove, spec.rp-nodepool-lifecycle.agentpool-operations, spec.rp-nodepool-lifecycle.agentpool-upgrade-resume … (+3 more) | Represented by active reconcile-compact-loop-package-partial |
| serverless | `wait-compact-serverless-multi-pod-burst-runtime-readiness-20260705` | 6 | spec.serverless-virtual-nodes.enable, spec.serverless-virtual-nodes.lifecycle, spec.serverless-virtual-nodes.network-connectivity … (+3 more) | Represented by active reconcile-compact-loop-package-partial |
| localdns | `hold-compact-localdns-package-partial-frontier` | 5 | spec.localdns.auto-default, spec.localdns.hosts-plugin, spec.localdns.lifecycle … (+2 more) | Represented by active reconcile-compact-loop-package-partial |
| planned-maintenance | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | 5 | spec.planned-maintenance.autoupgrade-k8s-mtc-window-patch, spec.planned-maintenance.autoupgrade-scheduling-api-lifecycle, spec.planned-maintenance.autoupgrade-scheduling-longpoll … (+2 more) | Represented by active reconcile-compact-loop-package-partial |
| aad-rbac | `hold-compact-aad-rbac-reviewed-exception-trio-frontier` | 4 | spec.aad-rbac.azure-rbac-authorization, spec.aad-rbac.nonaad-reset, spec.aad-rbac.nonaad-to-aadv2-migration … (+1 more) | Represented by active reconcile-compact-loop-package-partial |
| ccp-coredns | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | 4 | spec.ccp-coredns.autoscaler-proportional, spec.ccp-coredns.component-lifecycle, spec.ccp-coredns.custom-config … (+1 more) | Represented by active reconcile-compact-loop-package-partial |
| gpu | `wait-shared-underlay-runtime-input-family-upgrade-inclusive-20260708` | 3 | spec.gpu.mig-partitioning, spec.gpu.operator-default-install, spec.gpu.skip-driver-install | Represented by active reconcile-compact-loop-package-partial |
| jwt-authenticator | `hold-compact-jwt-authenticator-package-partial-frontier` | 3 | spec.jwt-authenticator.external-idp-crud, spec.jwt-authenticator.external-idp-login-publicly-routable, spec.jwt-authenticator.upgrade-survival | Represented by active reconcile-compact-loop-package-partial |
| ccp-metricsserver | `wait-compact-reviewed-exception-live-ready-policy-family-20260702` | 2 | spec.ccp-metricsserver.resource-metrics-api, spec.ccp-metricsserver.upgrade-survival | Represented by active reconcile-compact-loop-package-partial |
| node-http-proxy | `hold-compact-node-http-proxy-package-partial-frontier-owner-normalized-20260713` | 2 | spec.node-http-proxy.create, spec.node-http-proxy.update | Represented by active reconcile-compact-loop-package-partial |
| traffic-alb-controller | `hold-compact-traffic-alb-controller-package-partial-frontier` | 2 | spec.traffic-alb-controller.ingress-routing, spec.traffic-alb-controller.upgrade-survival | Represented by active reconcile-compact-loop-package-partial |
| traffic-applink | `hold-compact-traffic-applink-cross-cluster-self-contained-carrier-gap-20260707` | 2 | spec.traffic-applink.mesh-membership, spec.traffic-applink.service-discovery | Represented by active reconcile-compact-loop-package-partial |
| egress-lockdown | `ops/wait-shared-auth-runtime-and-stale-workflow-owner-return-family-20260711` | 1 | spec.egress-lockdown.vm-prerelease-vhd-matrix | Represented by active reconcile-compact-loop-package-partial |
| machines-agentpool | `wait-compact-machines-agentpool-run-28809049156-review-20260714` | 1 | spec.nap.default-machines-pool-cleanup-no-machine-crud | Represented by active reconcile-compact-loop-package-partial |
| secure-tls-bootstrap | `hold-compact-secure-tls-bootstrap-package-partial-frontier-20260707` | 1 | spec.secure-tls-bootstrap.arm64 | Represented by active reconcile-compact-loop-package-partial |
| trusted-access | `hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705` | 1 | spec.trusted-access.control-plane-lifecycle | Represented by active reconcile-compact-loop-package-partial |
| windows | `hold-compact-windows-eligibility-frontier-20260707` | 1 | spec.windows.node-pool-create-virtualmachines | Represented by active reconcile-compact-loop-package-partial |

## Evidence that the active follow-up leaf is the right backfill surface

- `reconcile-compact-loop-package-partial` is a live `domain_leaf` under `aks-feature-compact-loop`, owned by `aks-explorer`, and explicitly scoped to blocked package-partial backlog restoration.
- Its acceptance text requires reviewing current rerun-ready member sets, preserving exact blocked waits, and requeueing only bounded dependency-clear work.
- Its context records `sourceStates=["blocked"]`, `totalFeatureCount=29`, and a populated `rerunReadySpecIdsByFeature` map covering all 29 reviewed holders.
- Inputs/conflict scope sample the first 20 feature keys (aad-rbac, app-routing, ccp-coredns, ccp-metricsserver, cluster-autoscaler, egress-lockdown, gpu, jwt-authenticator, kms-etcd-encryption, localdns, machines-agentpool, net-integration, network-cni, node-http-proxy, ossku-migration, planned-maintenance, private-cluster, rp-cluster-lifecycle, rp-nodepool-lifecycle, secops), while the full rerun-ready map additionally carries unsampled-but-represented holders: storage-csi, virtualmachines-agentpool, workload-autoscaler, serverless, traffic-alb-controller, traffic-applink, secure-tls-bootstrap, trusted-access, windows.

## Exact reviewer/planner interpretation

- **Do not add duplicate blocked waits.** The exact holders already remain visible on their current blocked frontiers.
- **Do not create a second package-partial backlog leaf.** The existing active leaf `reconcile-compact-loop-package-partial` is already the truthful executable follow-up surface for this family.
- If a root-level no-work-with-gaps or focus readout still claims there is no executable backlog, treat that as a **stale readout / root-summary sync problem**, not evidence that the compact family still lacks runnable follow-up work.
- Optional separate planner/app-ops follow-through (outside this worker task): refresh root/project readout so top-level metrics and summaries acknowledge the already-materialized active compact follow-up leaf.

## No new event proposal

- No new canonical event proposal is needed from this worker memo, because the relevant controller pulse has already happened and the live tree already contains the backfilled active follow-up leaf.
