# Dev Infra Core Single-Spec Proof Audit - 2026-07-07

Focus task: `verify-dev-infra-core-single-spec-live-passes-20260707`

Source set: `../aks-rp-e2e/ci/feature-sets/dev-infra-core.txt`
Resolved plan: `../aks-rp-e2e/runs/plans/plan_20260707122201575_wgregl.json`

Result: 25/25 selected specs are `pass` in `.state/spec-loop/state.json`.

Proof split:
- Direct single-spec proof: 22
- Compact feature proof accepted for this focus audit: 3

Compact proof rows:
- `spec.runtime-container.kscr-rotation-matrix` - run `28550628082`
- `spec.node-pool-config.ephemeral-disk` - run `28636410252`
- `spec.industry.node-restriction-compliance` - run `28517359884`

These compact proofs are acceptable for unblocking the planned dev-infra-core run because the next acceptance gate is the full planned ADO execution for this exact feature set. If that planned run fails, repair should start from the concrete planned-run result and affected execution group.

All selected specs:

| Spec | Status | Latest Run | Proof |
| --- | --- | --- | --- |
| `spec.net-integration.outbound-lb-custom-ip` | pass | `28361356374` | single-spec |
| `spec.net-integration.static-egress-vmss` | pass | `28363941587` | single-spec |
| `spec.net-integration.authorized-ip-ranges` | pass | `28361543965` | single-spec |
| `spec.net-integration.authorized-service-tags` | pass | `28363270235` | single-spec |
| `spec.net-integration.nsg-control` | pass | `28363274488` | single-spec |
| `spec.net-integration.node-public-ip` | pass | `28361391946` | single-spec |
| `spec.net-integration.outbound-nat-gateway` | pass | `28361405979` | single-spec |
| `spec.net-integration.outbound-migration-natgw-to-lb` | pass | `28249921835` | single-spec |
| `spec.private-cluster.apiserver-vnet-integration-create` | pass | `28249395533` | single-spec |
| `spec.private-cluster.vnet-integration-private` | pass | `28250366988` | single-spec |
| `spec.private-cluster.privatelink-create` | pass | `28250859487` | single-spec |
| `spec.cloud-provider.ccm-lifecycle` | pass | `28365725598` | single-spec |
| `spec.storage-csi.disk-pvc-dynamic-provision` | pass | `28251348881` | single-spec |
| `spec.storage-csi.blob-driver-enable` | pass | `28252148030` | single-spec |
| `spec.storage-csi.file-pvc-dynamic-provision` | pass | `28252830212` | single-spec |
| `spec.rp-nodepool-lifecycle.agentpool-operations` | pass | `28254310705` | single-spec |
| `spec.rp-cluster-lifecycle.preflight-validation` | pass | `28253578923` | single-spec |
| `spec.planned-maintenance.configuration-crud-lifecycle` | pass | `28255081755` | single-spec |
| `spec.runtime-container.kscr-rotation-matrix` | pass | `28550628082` | compact-feature |
| `spec.node-pool-config.ephemeral-disk` | pass | `28636410252` | compact-feature |
| `spec.network-cni.cilium-dataplane` | pass | `28287120869` | single-spec |
| `spec.ppg.cluster-and-agentpool-placement` | pass | `28363753262` | single-spec |
| `spec.industry.node-restriction-compliance` | pass | `28517359884` | compact-feature |
| `spec.windows.node-pool-create-virtualmachines` | pass | `28289274210` | single-spec |
| `spec.kms.v2plus-enable-pmk-from-v2-public` | pass | `28288937509` | single-spec |

Next step: queue `run-dev-infra-core-planned-ado-pass-20260707` on ADO pipeline definition `467665` with `feature_set=dev-infra-core`, `target=staging`, and source branch `dev`.
