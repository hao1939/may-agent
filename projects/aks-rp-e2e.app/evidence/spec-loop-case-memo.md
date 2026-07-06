# Spec Loop Case Memo

Purpose: keep a short audit trail of what each good or bad example taught us. Each entry should say what signal we saw, what evidence backs it, what we changed or decided, and what live verification remains.

Working rule: every GitHub live run should produce learning, even when it is not a clean pass. A pass teaches the proof shape we should preserve. A failure teaches the smallest repair owner: test carrier, spec/model linkage, target environment, product behavior, or workflow ingestion. Mixed compact runs must be split by spec branch; do not let one broken branch hide another branch's valid pass.

## 2026-07-06

### compact loop pass-vs-fail review

- Signal: compact feature results are split into two very different classes. Passing compact packages are consistently `packageStatus=ready` plus `lastLiveProofVersion=live-aks-proof-v2`; most failures are not retryable live failures, but package readiness/eligibility residue.
- Evidence: current compact-loop state has `28 done`, `55 error`, and `1 pending`. Done packages account for 100 selected specs, 67 clusters, and 33 clusters saved. Error packages account for 554 selected specs, 530 clusters, and only 14 clusters saved.
- Aggregate failure shape: `package-partial/partial` is the dominant bucket with 25 features, 434 selected specs, 423 required clusters, and only 11 saved clusters. `live-workflow/ready` is smaller but more actionable: 5 features, 40 selected specs, 40 clusters, 0 saved clusters. `reviewed-exception` buckets are mostly policy/eligibility frontiers, not compact-planner crashes.
- Good compact examples: `industry` compacted 18 specs into 2 clusters and passed; `workload-health` compacted 5 specs into 1 cluster and passed; `runtime-container` compacted 6 specs into 2 clusters and passed; `artifact-streaming` compacted 4 specs into 2 clusters and passed.
- Failed but useful examples: `workload-identity` was ready and ran live, with 8/9 branches passing and only `workload-identity-automatic-sku` failing cluster create. `deployment-safeguards` was ready and ran live, with 6/7 passing and only `vpa-interop` failing one claim. `managementplane-addon` was ready and ran live, with 6/7 passing and only `version-upgrade` failing.
- Large not-ready examples: `network-cni` selected 69 specs but needed 69 clusters and remains `package-partial`; `net-integration` selected 51 specs and needed 51 clusters; `kms-etcd-encryption` selected 43 specs and needed 43 clusters; `storage-csi` selected 33 specs and needed 33 clusters. These are not good retry candidates until eligibility/frontier grouping improves.
- Lesson: compact success needs two conditions, not one. First, the package must be live-ready. Second, the DAG must find genuinely compatible shared cluster state. Large selected-spec counts do not imply useful compaction if each branch carries incompatible cluster shape, target, network, SKU, upgrade, or destructive-state requirements.
- Workflow improvement: ready packages with one failing branch should be split after a nonpassing workflow. The loop should harvest per-branch passes, keep those proofs, and create focused repair/retry work only for the failing branch. Do not keep the whole feature red when the artifact proves most branches passed.
- Planner improvement: package-partial features should be driven by their `selectionBlocker.kind`, not retried as whole-feature live runs. `repo-local-live-ready-filter` and `reviewed-exception` need reclassification or explicit policy change. `repo-local-spec-metadata-eligibility-gap` needs spec metadata/eligibility repair. `repo-local-mixed-terminal-and-promotion-frontier` needs branch-level promotion or exact external wait replacement.
- Compacting improvement: for large features with near-zero saved clusters, split into smaller feature slices by compatible route shape before live dispatch. The current feature-level package can still be the accounting unit, but live proof should run subpackages whose DAG routes actually share cluster state.
- Status: use this review to update the compact loop recovery policy: per-branch artifact ingestion for nonpassing ready packages, selectionBlocker-driven work for partial/blocked packages, and route-shape slicing for large low-savings packages.

### spec-loop controller attempt reset

- Signal: process issue found while repairing storage CSI. `spec.storage-csi.disk-xfs` and `spec.storage-csi.disk-resize` were both still `pending` with exhausted direct attempts in `.state/spec-loop/state.json`, so the controller treated them as exact wait residue even after the domain repo had useful repairs.
- Evidence: after commit `04b0b3a18` fixed the XFS hidden evidence dependency and current `dev` showed disk-resize local policy/check passing, the loop root still reported `dispatchablePending=0` and no active child. Manual GitHub runs `28791413293` and `28791466920` had to be dispatched to gather fresh live evidence.
- Lesson: a domain repair must reset or supersede the old attempt budget for the affected spec, or the app will look idle while repaired work is actually ready to verify. The state transition should be structured, not inferred from free-form review text.
- Status: needs controller/state repair after the current storage live results land.

### spec.cloud-provider.ipbased-lb-backend-pool

- Signal: good example.
- Evidence: GitHub run `28761720336` passed on staging. Artifact result says the test created a VirtualMachines AKS cluster, exercised `NodeIP -> NodeIPConfiguration -> NodeIP`, validated backend addressing and connectivity, and requested resource-group cleanup.
- Lesson: a good spec run has a clear live target, real cluster creation, claim-level assertions, and cleanup evidence. This is the shape the loop should ingest and close automatically.
- Status: live pass already available.

### spec.network-swift-v2.overlay-mode

- Signal: stale wait that was actually good.
- Evidence: GitHub run `28671514613` was successful; verifier ingestion classified it as pass.
- Lesson: completed successful workflow runs can stay stuck if the loop does not reattach the verifier to the exact run id. The fix pattern is to reuse the original task family and ingest the same-run artifacts, not rerun blindly.
- Status: ledger moved to pass.

### spec.kms.v2plus-negative-cases

- Signal: bad example with concrete test-carrier bug.
- Evidence: GitHub run `28613951457` failed before product behavior with Azure `InvalidParameter`: generated AKS node resource group name length was 101, over the 80 character limit.
- Root cause: the self-managed KMS negative-case carrier used a 32-character suffix from the run id, making `rg`, `clusterName`, and AKS-generated node resource group too long.
- Fix: commit `ec82e5862` in `aks-rp-e2e` shortens KMS negative-case suffixes to 8 characters and adds a short hash for ordinary generated direct-wrapper resource names.
- Verification: GitHub live runs `28787475030` and `28787631265` both passed on staging. Artifact result: cases 1-6 passed, case 0 async RBAC case skipped by default, cleanup complete.

### spec.kms.v2-negative-cases

- Signal: second bad example found while checking the KMS naming fix.
- Evidence: GitHub run `28787475066` used commit `ec82e5862`, created a real staging baseline cluster `aks-test-001-0055uil5`, then failed 6/9 claim assertions.
- Root cause: the older v2 carrier created the baseline cluster with `SystemAssigned` identity. After that was fixed, the negative request shapes still used invalid placeholder key versions and stale expected validation messages, so the RP rejected earlier/different branches than the spec intended.
- Fix: commits `198159d7`, `d7d327dc`, and `3c932298` in `aks-rp-e2e` move the baseline to user-assigned identity, use valid-looking 32-character key versions, skip the async RBAC case by default, and align expected sync validation messages with live RP responses.
- Verification: GitHub live run `28789321533` passed on staging westus2 against `3c932298`; artifact result says 1/0/0/0 pass/fail/error/skipped, cases 1-4 confirmed frontend 400 rejections, case 0 async RBAC skipped by default, and cleanup complete.
- Classifier lesson: the failed run `28788820586` reported top-level category `environment_blocker`, but the failed child claims were exact expected-message mismatches for cases 2-4. The loop should use the same-spec child failed assertions as the repair owner, not blindly trust the top-level bucket.

### spec.traffic-api-proxy.websocket-streaming

- Signal: repeated bad example.
- Evidence: six recent GitHub workflow failures and zero successes. Latest inspected run `28772107191` created a real staging cluster and requested cleanup, but failed at witness pod readiness.
- Root cause: the default witness image `mcr.microsoft.com/oss/busybox/busybox:1.36` returns 404 from MCR, so the pod can be created but cannot become Ready.
- Fix: commit `f342d799` switches the default witness image to `mcr.microsoft.com/cbl-mariner/busybox:2.0` and prints fuller witness diagnostics into stdout.
- Verification: GitHub live run `28787859038` passed on staging. This confirms the repeated failures were a bad witness image, not the API proxy feature.
- Classifier lesson: the nonpassing run surfaced as `environment_blocker`, but child evidence showed only `setup.witness-pod-ready` failed after cluster creation. A witness pod image/pull failure is carrier setup unless the artifact proves a target outage.

### spec.kms.v2-trust-service-public-cluster-private-kv-lifecycle

- Signal: bad example that reached product claims.
- Evidence: run `28425949999` created the resource group, identity, VNet, Key Vault, key, RBAC, and cluster; the only failed claim was `assert.kms.second-rotation-guard-before-replace`.
- Lesson: this is not a runner/auth/setup failure. It is a product-or-model expectation mismatch: the spec expected a guard before key replacement, but ARM returned HTTP 200.
- Status: needs spec expectation review before another unchanged rerun.

### spec.node-http-proxy.create + spec.node-http-proxy.update

- Signal: bad-to-good pair for a carrier implementation bug.
- Evidence: GitHub run `28673627741` failed before Azure behavior with `ReferenceError: proxyVmSizeCandidates is not defined` in both node HTTP proxy scenario tests. Follow-up run `28673740487` passed both specs on staging with 4/4 create claims and 5/5 update+disable claims.
- Lesson: when the error is a local TypeScript/runtime exception, do not classify it as product behavior. Fix the carrier and require a GitHub live rerun. The pass is strong because it created proxy network resources, created AKS clusters, checked persisted ARM config, checked node proxy env vars, and requested cleanup.
- Status: live pass available.

### spec.oidc-issuer.v133-explicit-enable-runtime

- Signal: bad-to-good pair for self-contained setup.
- Evidence: GitHub run `28696695136` failed with `ResourceGroupNotFound` because the test pointed at a cluster/resource group it did not create. Follow-up run `28698354953` passed on staging after using an owned cluster: initial OIDC disabled, PUT enabled OIDC, discovery returned 200, and JWKS returned RSA keys.
- Lesson: a single spec must be able to run alone. If the first live action is `GET existing cluster`, the test is probably depending on hidden state unless the spec explicitly defines that dependency.
- Status: live pass available.

### spec.node-ephemeral-disk.auto-resource-placement

- Signal: repeated bad example that reached the product witness.
- Evidence: run `28745513582` first failed cluster create with HTTP 400. Follow-up run `28745737007` created the cluster successfully, verified `osDiskType=Ephemeral`, found the node resource group, and then failed only `assert.ephemeral-auto-resource.placement-derived-resourcedisk`.
- Detail: run `28745513582` also failed the local request-shape claim `planned-request-omits-osdiskplacement`, proving the carrier was intentionally testing derived placement rather than explicitly setting placement. Run `28745737007` moved past create and the VMSS witness reported `diffDiskSettings.placement=ResourceDisk`.
- Lesson: this is no longer a setup/auth failure. The spec expects the compute witness to prove derived `DiffDiskPlacementResourceDisk`, but the live ARM witness reports `ResourceDisk`. Next work should review whether the spec expectation should accept ARM's returned enum, whether the witness path needs normalization, or whether the target SKU/region changes the derived placement behavior.
- Status: needs expectation/witness review.

### spec.storage-csi.disk-resize + spec.storage-csi.disk-xfs

- Signal: compact pair exposes two different problems.
- Evidence: single-spec run `28754793703` and compact run `28775604245` both failed `spec.storage-csi.disk-resize` after real cluster/PVC work. In run `28775604245`, cluster setup passed and cleanup passed, but PVC/PV proof failed with `pvc-phase=Pending` and the filesystem witness failed because the pod image did not have `lsblk`. The same compact run failed `spec.storage-csi.disk-xfs` before Azure work because the GitHub workspace was missing `evidence/archive/storage-csi-disk-xfs-replay-carrier-skeleton-20260624.md`.
- Lesson: compact failure is not always a compact-planner bug. Here `disk-resize` has carrier/runtime proof problems, while `disk-xfs` has a repo packaging/linkage problem. The loop should split those causes and fix each path instead of retrying the compact pair unchanged.
- Repair pattern: for `disk-resize`, use a witness image/tooling path that can prove mount size and make PVC binding/PV driver evidence non-contradictory. For `disk-xfs`, remove the hidden dependency on an untracked archive note or commit the required evidence file if it is truly part of the executable contract.
- Fix: `disk-xfs` executable preflight now requires tracked feature/spec/model files only; the ignored archive note remains optional audit context through the tracked model summary.
- Verification: GitHub run `28791413293` passed on staging westus2 against commit `04b0b3a18`. Child evidence shows `probeEvidence.status=pass`, no failed assertions, real resource group `rg-test-dd1605-si-disk-xfs-706028`, real cluster `aks-test-dd1605-si-disk-xfs-706028`, 19/19 bounded claims, and cleanup delete requested.
- Extra local lesson: `bun test features/...` can accidentally run copied tests under historical `workspace/` directories. Use focused Vitest (`bun x vitest run <test-file>`) or another command that excludes worktree archives when validating a domain fix.
- Disk-resize update: GitHub run `28791466920` failed after real cluster/PVC work. The PVC/PV claims failed because the probe checked binding before the consumer pod triggered provisioning, and the mounted-size claim failed because the image did not have `lsblk`.
- Fix: commit `a4f562b4d` moves PVC/PV proof after consumer pod creation and changes the mounted-size witness to `df -BG /mnt/datavolume | tail -1`, keeping the same 20Gi filesystem-size claim.
- Verification: GitHub run `28793232048` passed on staging westus2 against commit `a4f562b4d`. Child evidence shows `probeEvidence.status=pass`, no failed assertions, real resource group `rg-test-a2302b-disk-resize-827280`, real cluster `aks-test-a2302b-disk-resize-827280`, 5/5 bounded claims, and cleanup delete requested.
- Status: disk-xfs and disk-resize are both verified live passes.

### spec.network-swift-v1.dynamic-ip-allocation vs spec.network-swift-v1.scale-validation

- Signal: same feature, different quality of proof.
- Evidence: run `28698043880` created the Swift V1 dynamic IP cluster and ran CNS/pod checks, but failed `assert.pod-ips-from-node-subnet`, `assert.dynamic-allocation-on-schedule`, and `assert.ip-released-on-pod-delete`; the logs showed CNS matches missing even though pod IPs were in subnet. Run `28726934094` passed scale validation on staging with 4/4 claims.
- Lesson: feature-level success does not prove every path in the feature. The loop should keep the passing scale-validation evidence, but the dynamic-IP path needs deeper model/product review around CNS visibility and release accounting.
- Status: scale-validation passed; dynamic-ip-allocation needs review before rerun.

### network-acns feature family

- Signal: repeated feature-level failures sharing setup assumptions.
- Evidence: run `28726850908` failed cluster create with HTTP 400: `LocalDNS cannot be enabled. VM size in Agentpool 'system' is too small`; run `28726854817` reached runtime validation but failed with `Retina metrics missing prefixes: hubble_`.
- Lesson: when many specs in one feature fail, inspect the shared feature carrier defaults first. ACNS currently has at least one shared sizing issue and one runtime expectation issue, so opening separate isolated retries for every ACNS spec wastes time. These are also different owners: the LocalDNS failure is carrier sizing/target-environment compatibility; the missing `hubble_` metric prefix is runtime expectation or metrics collection semantics.
- Evidence-quality lesson: `28726854817` exited through an uncaught scenario exception, leaving `probeEvidence=null`, empty audit identifiers, and only stderr as the root-cause source. Scenario tests should catch runtime assertion failures and write structured failed assertions before exiting nonzero.
- Repair pattern: first fix the shared ACNS cluster defaults to use a system pool size accepted by LocalDNS in staging. Then make the Retina carrier write structured evidence for missing metric prefixes, rerun bounded ACNS specs, and separately audit the Retina metric-prefix expectation against live metric names.
- Status: needs feature-level ACNS carrier/default review.

### spec.net-integration.natgw-v2-migration-v2-to-block

- Signal: good long-running control-plane example.
- Evidence: GitHub run `28761665501` passed on staging westus2. The result says the NAT Gateway V2-to-block path completed create, cache update, node-image upgrade, VNet subnet wiring, `outboundType=block` update, and final GET.
- Lesson: not every successful proof is quick. A 50+ minute run can still be a strong single-spec pass when it has a real cluster, explicit target, staged mutations, readback, and cleanup. The loop should ingest this as a live pass and preserve the full control-path sequence as a good template for outbound-type migration specs.
- Status: live pass already available.

### spec.private-cluster.none-private-dns-zone-v3

- Signal: good exact-carrier example.
- Evidence: GitHub run `28750369397` passed on staging westus2 with 5/5 claims: create with system private DNS zone, verify managed zone, update to `none`, verify private FQDN mutation, and verify managed-zone deletion. Scale diagnostics also passed 2/2.
- Lesson: this is the preferred shape for a spec that changes a lifecycle setting: prove the starting state, perform the mutation, prove both the visible API value and the side-effect boundary. In this case the side-effect boundary is the managed private DNS zone deletion.
- Status: live pass already available.

### spec.cloud-provider.ipbased-lb-backend-pool

- Signal: good staged-mutation example.
- Evidence: GitHub run `28761720336` passed on staging westus2 with `probeEvidence.status=pass`, real resource group `rg-test-001-ackend-pool-646993`, real cluster `aks-test-001-ackend-pool-646993`, 8/8 claims, and cleanup delete requested. The carrier created a VirtualMachines cluster, exercised `NodeIP -> NodeIPConfiguration -> NodeIP`, and verified backend-pool addressing plus external/internal connectivity at each phase.
- Lesson: this is a strong pattern for specs that mutate one API setting through multiple states. The proof should keep the state machine explicit, assert connectivity after each mutation, and keep cleanup separate from verdict claims.
- Status: live pass already available.

### traffic-api-proxy compact freshness check

- Signal: a newer compact result can contradict an older single-spec pass.
- Evidence: single-spec run `28430406147` passed `spec.traffic-api-proxy.access-control` on June 30 with 4/4 claims. Later compact run `28763481080` on July 6 ran seven traffic-api-proxy specs: five specs passed, `spec.traffic-api-proxy.websocket-streaming` was blocked by reference preflight, and `spec.traffic-api-proxy.access-control` failed 3/4 claims because the authorized RunCommand call returned HTTP 401 `InvalidAADClusterToken`.
- Lesson: spec-loop state should not blindly preserve an old pass when a newer same-spec artifact from a compact workflow fails a verdict-bearing claim. It should flag the spec for freshness review or revalidation. Compact workflow ingestion also needs per-spec handling: harvest the five passes, open a targeted repair/revalidation for access-control, and keep websocket-streaming on its source/preflight path.
- Follow-up: exact freshness rerun `28794227326` confirmed the failure on current `dev` with the same `InvalidAADClusterToken` claim failure. Root cause was shared token helper behavior: `getArmToken({ resource: AKS server app id })` reused `ARM_ACCESS_TOKEN`, which is ARM-audience, as the AAD cluster token. Commit `b21463f2e` now uses `ARM_ACCESS_TOKEN` only for the ARM audience. Rerun `28795013704` verified the same spec on staging with `probeEvidence.status=pass`, 4/4 claims, real resource group `rg-test-e405da-ess-control-654679`, real cluster `aks-test-e405da-ess-control-654679`, and cleanup HTTP 202.

### compact stale wait cleanup

- Signal: compact-loop state had blocked waits whose exact named specs had already passed in the single-spec loop. The storage-csi two-spec wait for run `28775604245` still blocked compact progress even after `spec.storage-csi.disk-xfs` passed in run `28791413293` and `spec.storage-csi.disk-resize` passed in run `28793232048`.
- Fix: `feature-compact-loop-controller` now closes blocked compact waits only when every spec id named by the wait is `pass` in spec-loop state. The first implementation was too loose because it scanned only passing ids; the corrected scanner scans all known spec ids and then requires every named one to be pass.
- Safety lesson: mixed frontier waits must stay blocked. During the live pulse audit, `wait-compact-ccp-coredns-reviewed-exception-or-filter-change-20260701` and `hold-compact-traffic-applink-two-member-mixed-frontier-20260706` were reopened because they also name pending specs (`spec.ccp-coredns.pdb-disruption-budget`, `spec.traffic-applink.cross-cluster-discovery`, and `spec.traffic-applink.upgrade-survival`).
- Verification: focused compact-loop tests cover both sides: all-named-specs-pass closes the stale wait, while a mixed pass+pending wait remains blocked. Live pulse closed the true stale storage, node-http-proxy, private-cluster, managedsystem, net-integration, and KMS waits, and the two mixed waits were restored with explicit blockers.

### spec.planned-maintenance.autoupgrade-scheduling-api-lifecycle

- Signal: good same-spec live pass from the compact/package-partial lane.
- Evidence: GitHub run `28795403896` passed on staging westus2. The artifact created real resource group `rg-test-0b9624-i-lifecycle-306358` and cluster `aks-test-0b9624-i-lifecycle-306358`, validated six MTC API lifecycle claims, deleted the MTC, and confirmed resource group deletion.
- Lesson: this is a good Phase A proof shape: it verifies the API lifecycle and scheduling state without pretending to prove an actual upgrade trigger. Artifact ingestion should also tolerate this carrier's current shape where stdout contains `spec=spec.planned-maintenance.autoupgrade-scheduling-api-lifecycle` but `probeEvidence.specId` is missing.

### app-routing vm-prerelease compact branch set

- Signal: mixed compact run with both useful pass evidence and test-code failures.
- Evidence: GitHub run `28698006097` ran four app-routing specs. `spec.app-routing.vm-prerelease.osm-acnginx-internal` passed and `spec.app-routing.vm-prerelease.osm-internal-nginx-internal` passed. Both created real staging clusters and ARM readback persisted webAppRouting plus OSM addon profile. `spec.app-routing.vm-prerelease.default-acnginx-internal` and `spec.app-routing.vm-prerelease.osm-external-nginx.internal` failed in preflight before Azure resource changes because expected lineage inputs such as `appRouting.mesh.family` or `useSharedIdentity` were missing.
- Lesson: compact result ingestion must be per spec, not only per workflow. A compact workflow can contain two branches that should close as live pass and two branches that need test-spec/input repair.
- Repair pattern: for the failed branches, fix the spec input lineage so preflight can build the exact request shape. Do not rerun the already-passing OSM branches just because the compact workflow was nonpassing overall.
- Status: two branches have live pass; two branches need preflight input repair.

### image-cleaner feature pair

- Signal: mixed pair with one strong pass and one product/model question.
- Evidence: GitHub run `28697908219` passed `spec.security-profile.image-cleaner-upgrade-restart-survival`: Image Cleaner stayed enabled through upgrade/restart and components were running. The same run failed `spec.security-profile.image-cleaner-vulnerable-image-erasure` after creating a real cluster: disable returned 400, post-disable still showed enabled, re-enable returned 400, eraser collectors completed, and the vulnerable image remained present.
- Lesson: a feature can have one healthy lifecycle path and one questionable semantics path. The vulnerable-image-erasure failure should not invalidate upgrade/restart survival. It also should not be blindly called a product gap until the spec confirms whether disable/re-enable is expected to be mutable in this API version and whether the eraser collector witness proves the right node/image state.
- Repair pattern: audit the official API/behavior expectation for Image Cleaner mutation, then update either the spec expectation or the carrier request shape. Rerun only the erasure path after that repair.
- Status: upgrade/restart survival has live pass; vulnerable-image-erasure needs semantics review.

### spec.private-cluster-addonv2.coreaddons-privatecluster

- Signal: bad good-example, also a workflow/result integrity bug.
- Evidence: GitHub run `28610923892` had workflow conclusion `success` and child result `status=passed`, but the child evidence had `probeEvidence.status=gated` and a failed preflight assertion `jumpbox-key-preflight`: the run required `AKS_RP_E2E_JUMPBOX_SSH_PRIVATE_KEY` before private-kubeconfig assertions could proceed.
- Lesson: a green GitHub workflow is not enough. A spec loop pass must require same-spec child evidence with no failed preflight/claim assertions and no gated evidence status. Otherwise the app can close a spec that did not actually prove live behavior.
- Fix: `single-spec-verifier` now fails closed when a same-spec child artifact is gated or contains failed preflight/claim assertions, even if the top-level result says pass.
- Status: not ingested as pass; needs a real private-path live run with the required jumpbox/private-kubeconfig prerequisite.

### gpu feature family

- Signal: feature family with one pass and several environment-shaped failures.
- Evidence: run `28696176301` passed `spec.gpu.mig-partitioning` with provisioningState `Succeeded`. Runs `28696180146`, `28696185393`, and `28696189852` failed because GPU VM sizes such as `Standard_NC24s_v3` and `Standard_NC6s_v3` were not supported for the staging subscription in `westus2`.
- Lesson: not all GPU specs are broken. The loop should separate “supported SKU path passed” from “requested SKU unavailable in target env” and either choose target-supported SKUs from the spec constraints or mark the target requirement explicitly.
- Status: MIG path passed; other GPU paths need target/SKU compatibility repair.
