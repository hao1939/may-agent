---
id: aks-rp-e2e
owner: aks-explorer
status: waiting
type: milestone
priority: P1
iteration: 204
max_concurrent: 3
max_task_attempts: 2
project_app: v2
project_policy: aggressive-push
runtime_control_plane: .app
wait_reason: devbox-access-needed-for-source-probes — all cron jobs disabled, 4 tasks gated on devbox mount
---

# Project: AKS RP E2E - Input/Expectation Knowledge Map

## Goal
Build a durable map between AKS input space and expected behavior space, then use that map to understand current e2e coverage and plan higher-value tests. Success is not just "run another scenario"; success is a growing knowledge model where each feature maps to one or more AKS input paths, each test maps to expected and observed behavior paths, and every execution result improves the model.

Execution evidence still matters, but it is no longer the whole project goal. First build the knowledge map from existing handwritten e2ev3 cases, RP/e2ev3 source, AKS public APIs/docs, and existing run artifacts. After the current coverage state is clear, move to the advanced phase: discover unreached or surprising regions of the input/expectation space where AKS RP quality can improve.

## Strategy Checkpoint

The project purpose is now stable:

1. **Learn** feature intent from Go e2ev3 source, API/spec, user docs, design
   notes, implementation references, and existing evidence.
2. **Ground** each feature with a reference packet so pass/fail judgment has a
   source-of-truth bundle.
3. **Experiment** with tracked lightweight TypeScript probes that reflect the
   learned intent and emit structured evidence.
4. **Replan** only after learning and single-case probes are solid: generate
   high-density run plans and TS probes that combine compatible cases into one
   AKS cluster lifecycle.
5. **Measure** whether replanning helps through scenario density, expectation
   density, new knowledge yield, cluster amortization, run-hour efficiency, and
   diagnostic cleanliness.

Do not jump straight from the knowledge map to a large combined run. The next
phase should prove that reference-backed TS probes can honestly reproduce one
learned case before using generated scripts to combine multiple cases.

## Core Strategy
- Treat AKS behavior as two connected spaces:
  - **Input space:** API shape, request path, feature flags, cluster/nodepool/add-on/security/network/profile settings, environment, and operation type.
  - **Expectation space:** accepted/rejected contract, persisted state, defaulting, immutability, runtime behavior, traffic reachability, cleanup behavior, and error shape.
- A **feature** is a selected subset/intersection of input space and expectation space that is meaningful enough to test. Strong features should be anchored by one or more solid developer-written e2ev3 checks when they exist.
- A **test** is evidence for an expectation path under a concrete input path and observation context.
- Existing handwritten e2ev3 cases are the primary source for feature inference. They were written by AKS developers, so each case likely encodes a meaningful product contract, historical bug, boundary, or customer scenario. Do not guess feature importance when a handwritten case can tell us what developers already cared about.
- Public API/spec is the best source for understanding AKS input space: resources, properties, operations, request shapes, allowed values, mutability, and constraints.
- Public docs are the best source for understanding expectation space: intended behavior, user-visible contract, lifecycle, prerequisites, validation rules, and operational outcomes.
- When a case fails, classify whether it is a test/probe issue, implementation issue, environment issue, or source/doc mismatch before changing the capability model. Design docs, API docs/specs, and user docs are the contract sources for that decision; current probe output alone is not enough.
- Each feature should collect a reference packet: design docs, API/spec, user docs, Go e2ev3 source, useful implementation references, existing evidence, and known contradictions. That packet is the ground truth bundle used when judging probe results.
- Staging probes and RP source are supporting knowledge sources. Execution is the final authority for observed behavior, but source/docs are valid inputs for building candidate paths and coverage hypotheses.
- Start with one selected feature and make the process solid before generalizing. ManagedSystem Pool is the first worked example because it already has REST, CLI, standalone e2ev3, staging, positive, negative, and boundary evidence. The process should then be reusable for other features: infer feature intent from handwritten tests, enumerate input space from API/spec, enumerate expectation space from docs/tests/source, map evidence, find gaps, and plan the next high-density probe.
- Optimize future runs for coverage density: prefer tests that cover multiple important input/expectation paths in one run, or that resolve a high-uncertainty gap in the map.
- Do the dark-side discovery only after the baseline map is credible: first know what we cover, then deliberately search the regions we never reached.

## Execution Strategy

Use Go e2ev3 as the source of product intent, not the only execution vehicle.
The project should learn from handwritten Go cases, then build lightweight
TypeScript probes that directly call the same underlying AKS surfaces and write
structured evidence.

### REST-First Staging Replay

For the golden replay pipeline, prefer staging replay through ARM REST or
generated AKS clients instead of Azure CLI command surfaces. `az` failures are
still useful evidence when the feature path is explicitly a CLI contract, but
they should not block product/API replay work for unrelated paths. New replay
probes should make API versions, request bodies, actor headers, LRO polling,
response errors, and cleanup state explicit. `az` may be used as an
authentication/bootstrap fallback only when managed identity or `ARM_ACCESS_TOKEN`
is unavailable and the evidence records that fallback.

The current policy and next-step rationale are captured in
`evidence/outputs/rest-first-staging-replay-review.md`.

The canonical REST-first golden-path baseline is now ManagedSystem Pool REST
add-existing, captured in
`evidence/outputs/managedsystem-rest-golden-path-contract.md`. That branch has
the complete source -> feature packet -> test spec -> run plan -> TypeScript
probe -> local check -> gated staging replay -> cleanup evidence -> model
judgment chain. Reuse this pattern for other features, but keep adjacent
ManagedSystem branches separate: CLI create/add are CLI-contract failures,
runtime placement is audit-only in the reference probe, disable migration is a
separate product/runtime fail path, and single-pool/reconcile/runtime
restrictions need their own gated cloud evidence.

Phases:
- **Learning:** extract scenario intent from Go e2ev3 source, public API/docs,
  and existing artifacts into the capability model.
- **Experimenting:** save reviewable TypeScript probes that map one learned
  case or branch to explicit API/CLI/kubectl actions and expectation checks.
- **Replanning:** after the first two phases are solid, generate high-density
  run plans and TS probes that combine compatible cases in one cluster lifecycle.

Accepted run plans and probes should be tracked under `run-plans/` and
`probes/`. Runtime evidence stays under `outputs/`. This keeps the system
auditable: future agents can inspect what the probe intended, what it actually
ran, and whether its coverage claim was honest.

Execution strategy details live in `execution/README.md`.

## Test Efficiency Metrics

The replanning goal is to reduce total AKS test execution time by increasing
useful coverage per cluster lifecycle, without making failures ambiguous.

Track:
- **Scenario density:** unique scenario contracts covered per cluster lifecycle.
- **Expectation density:** unique expectation paths verified per cluster
  lifecycle.
- **New knowledge yield:** new pass/fail/blocked judgments per run.
- **Cluster amortization:** baseline cluster CRUD count minus actual cluster
  CRUD count.
- **Run-hour efficiency:** verified expectation paths per cluster-hour.
- **Diagnostic cleanliness:** whether failures map clearly to one branch or
  make the combined run ambiguous.

Do not optimize density alone. A combined run is valuable only if it preserves
clear diagnosis and honest evidence.

## Selected Feature Focus
Use ManagedSystem Pool as the pattern for later feature work. The point is not
only to say pass or fail; the point is to draw the boundary:
- accepted input paths: direct REST add/delete with the minimal ManagedSystem shape;
- rejected input paths: CLI preview create/add paths that send incompatible default fields;
- expected behavior paths: request acceptance, persisted pool mode, delete behavior, mode immutability, and clear error shape;
- observation contexts: staging REST, staging CLI, and standalone e2ev3;
- neighboring surfaces: generic `VirtualMachines` agent pools, Node Auto Provisioning, and default node pool behavior.

The ManagedSystem Pool deep dive should start from the handwritten e2ev3 case
and supporting source, then reconcile staging REST/CLI evidence against that
developer-authored intent. Avoid inferring the feature boundary only from API
shape or result artifacts.

When this selected feature is solid, use the same template for the next feature:
define the feature boundary, enumerate input paths, enumerate expectation paths,
map existing tests, identify missing paths, then choose the smallest high-value
probe. Starting with one feature is a process-design choice: if the ManagedSystem
Pool map is clean and useful, the same workflow should apply to App Routing,
NAP, workload identity, security profile, bootstrap profile, VirtualMachines
agent pools, and later dark-side discovery.

## Signals
- knowledge.input-space-modeled: current capability model has 35 AKS input variables.
- knowledge.expectation-space-modeled: current capability model has 68 expectation variables.
- knowledge.feature-mapping-started: current capability model has 61 feature mappings and 67 test-case evidence mappings; current validator has 7 failing feature IDs, 7 unknown feature IDs, and 2 blocked feature IDs after iteration122.
- knowledge.source-inventory-modeled: `outputs/iteration73-capability-model-source-inventory-update.md` converted handwritten e2ev3 source intent into first-class model structure; validator exits 0.
- e2e.existing-cases-cataloged: `outputs/scenario-catalog.md` and e2e artifacts provide the first source for inferring feature intent and coverage.
- knowledge.public-api-candidates-started: `outputs/aks-public-api-scenario-candidates.md` derives additional candidate feature surfaces from public AKS API/docs.
- execution.evidence-collected: staging and standalone artifacts provide pass/fail/blocker evidence for ManagedSystem, App Routing, NAP, workload identity, autoscaler, security, bootstrap, and VirtualMachines paths.

## Current State
Project App V2 task-tree execution has been reframed around the AKS feature-learning system instead of recent incidents. The root now decomposes into `aks-learning-system` and `execution-engine-audit`. Under `aks-learning-system`, the durable work areas are `knowledge-model-maintenance`, `feature-inventory-and-queue`, `feature-learning-loop`, `cross-feature-synthesis`, and `human-directed-maintenance`.

The feature-learning queue was refreshed at iteration 198 (see `outputs/iteration198-feature-learning-queue-refresh.md`). The prioritized next tasks are:
1. **Reference packet:** `workload-autoscaler-keda-profile-state` (unknown, no cloud gate, source-backed)
2. **Reference packet:** `workload-autoscaler-vpa-profile-state` (unknown, no cloud gate, source-backed)
3. **Reference packet:** `image-cleaner-state-interval` (unknown, no cloud gate, source-backed)
4. **Test-spec:** `managedsystem-runtime-restrictions` (unknown, source-backed)
5. **Test-spec:** `managedsystem-single-pool-constraint` (unknown, source-backed)
6. **Test-spec:** `managedsystem-reconcile-preservation` (unknown, source-backed)
7. **Execution gate check:** `managedsystem-disable-migration` (fail, needs trigger investigation)

The current ready leaf is the first queue item: create a reference packet for `workload-autoscaler-keda-profile-state` by reading devbox source plans.

Iteration185 owner-loop reconciliation handled the duplicate unread Hao resume comments after `---read @iter184---`. They repeated the already-completed iteration183 request to replan selected ManagedSystem knowledge paths `path.managedsystem.rest-add-existing.minimal-rest`, `path.managedsystem.mode-immutability`, and `path.managedsystem.delete-existing`; no new execution authorization, source/build/rollout signal, feature-registration signal, environment/capacity unblock, or distinct local model-hygiene request was present. The project remains `status: waiting` because the human resume request is complete: those paths share `compatibleGroupKey=managedsystem.add-existing-minimal-rest.single-cluster`, and `run-plans/managedsystem-add-immutability-delete-combined.yaml` combines them into one planned AKS cluster lifecycle: baseline normal cluster, minimal ARM REST ManagedSystem add, mode-mutation rejection check, ManagedSystem pool delete, and resource-group cleanup verification. `probes/managedsystem-add-immutability-delete-combined.ts` implements the reviewable TypeScript probe with path-specific verdicts and explicit non-goals for CLI default-payload, runtime isolation, single-pool, reconcile, disable-migration, and unrelated branches. Local verification passed with `bun probes/managedsystem-add-immutability-delete-combined.ts --check --run-id=iteration183-local-check-v2`; the generated artifact reports 10 assertions and 0 failures, no cloud mutation, and `no-product-model-change`. Fresh owner-loop validation also confirmed the iteration183 deliverables exist and `bun capability-model/src/validate.ts knowledge-map/model.json` passes with `uncoveredFeatureIds=[]`. The replan decision is recorded in `outputs/iteration183-managedsystem-combined-replan.md`; waiting-state reconciliations are recorded in `outputs/iteration184-owner-loop-status-reconciliation.md` and `outputs/iteration185-owner-loop-duplicate-resume-reconciliation.md`.

Current non-pass frontier is still gated rather than missing local model work. Blocked paths are Bootstrap BYO ACR lifecycle, Machines API CRUD, PAF throttling, and VPA cert renewal. Unknown paths are App Routing default-domain Istio, App Routing default-domain TLS lifecycle, full NAP default Machines pool cleanup, and the three execution-capable-but-gated ManagedSystem probes (`managedsystem-reconcile-preservation`, `managedsystem-runtime-restrictions`, `managedsystem-single-pool-constraint`). Current fail paths are documented product/test-surface failures with artifacts: App Routing default-domain/TLS-secret, NAP cleanup no-Machine-CRUD split, ManagedSystem disable migration, ManagedSystem CLI create/add, and VirtualMachines CLI comma multi-SKU.

The project should remain gated after the local replan. The new combined ManagedSystem probe must not run cloud mutation unless an owner/operator supplies `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-add-immutability-delete-combined`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the prior ManagedSystem SKU/image/defaulting gate is clear. Do not create another same-branch cloud rerun task solely because the project woke up.

**iteration355 review (owner loop — new harvest path found):** Devbox still absent but `scenarios/test-specs/` IS accessible (74 specs at `/app/projects/aks-rp-e2e/scenarios/test-specs/`). Index updated 2026-06-14. Re-scanned all 74 spec files: found 15 specs with pass/staging-pass status (up from 13 at iteration322 freeze). **3 newly harvestable specs** not in project's 56-feature set: (1) `app-routing-nginx-to-istio-migration` (status=pass, 18 assertions, 4 devbox sourceRefs), (2) `app-routing-nginx-disablement` (status=pass, 5 assertions, devbox sourceRef), (3) `vpa-upgrade-survival-runtime` (status=pass, iter115 cloud replay evidence). 3 new tasks created (iteration355-harvest-new-pass-specs, iteration356-updated-coverage-matrix-v18, iteration357-rescan-additional-pass-specs).

## Current Phase

The reference-backed TypeScript probe pattern has now been exercised or built on six runtime/product branches and extended with several local design-gated skeletons. ManagedSystem REST add-existing, VPA upgrade-survival, Bootstrap profile managed-ACR lifecycle, OIDC signing-key rotation, and App Routing NGINX-to-Istio migration produced cloud pass evidence; Bootstrap BYO-ACR produced bounded blocker evidence; ManagedSystem runtime/single-pool/reconcile and Machines/NAP cleanup now have reviewable local designs but remain execution-gated.

The generic App Routing NGINX-to-Istio migration probe has passed in staging via the iteration137 explicitly gated execution. It preserved the non-default-domain boundary and does not claim or unblock the failed/default-domain TLS branches.

The NAP cleanup no-Machine-CRUD split has failed in the selected staging eastus2 environment: iteration143 created a source-shaped NAP Auto cluster and persisted `nodeProvisioningProfile.mode=Auto` / `defaultNodePools=Auto`, but `aksmanagedap` was NotFound before Manual update; cleanup reached `az group exists=false` with no Machine CRUD or `deleteMachines` calls. Iteration144/145 triaged this as likely rollout/environment mismatch because checked-in `enable-managed-machine-agent-pool` and `regionallooper-reconcile-nap-cluster-enabled` rules do not enable staging eastus2. Do not blind-rerun the same eastus2 input unless owner/rollout/source/environment inputs materially change.

`outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md` is the latest local reference packet. It closes the parser-visible VirtualMachines CLI comma multi-SKU packet task without cloud mutation: the failing boundary is specifically `az aks nodepool add --vm-set-type VirtualMachines --vm-sizes <sku1,sku2>` on the preview CLI surface, where help advertises a two-SKU comma-list but active `aks-preview` source rejects `len(--vm-sizes) != 1` before constructing the request. Adjacent product/API paths remain separate and passing: CLI add with one SKU, CLI manual-scale multiple single-size profiles, REST mixed manual `manual[]` profiles, CLI/REST single-size autoscale update, and autoscaled VMs CRUD/upgrade. No model edit was needed; the validator still exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 56 evidence references, 8 failing feature IDs, 7 unknown feature IDs, and 2 blocked feature IDs.

`outputs/iteration153-managedsystem-runtime-restrictions-execution-implementation.md` is the latest local implementation artifact. It closes the runtime-restrictions implementation task without cloud mutation: `probes/managedsystem-runtime-restrictions.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-runtime-restrictions`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the clean REST setup boundary from iteration123/151/152: normal baseline cluster, exactly one ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, then runtime-only assertions for ManagedSystem node labels/taints, CoreDNS readiness/managed-system affinity, critical add-on placement/affinity, VAP/VAPBinding presence, customer nginx Pending/Unschedulable, temporary pod cleanup, setup-failure vs runtime-restrictions classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun probes/managedsystem-runtime-restrictions.ts --check`, non-mutating `--run-id=iteration153-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0). The model remains unchanged and `managedsystem-runtime-restrictions` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`outputs/iteration152-managedsystem-reconcile-preservation-execution-implementation.md` remains the reconcile-preservation implementation artifact. It closes the reconcile-preservation implementation task without cloud mutation: `probes/managedsystem-reconcile-preservation.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-reconcile-preservation`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the source-equivalent REST boundary from iteration125/151: first ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, managed-cluster GET sanitized with CleanManagedSystemPoolForPUT-equivalent rules so ManagedSystem profiles keep only `name`/`mode`/`count` and omit `type` plus read-only/default fields, no-op managed-cluster PUT, preservation assertions, setup-failure vs reconcile-preservation classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun probes/managedsystem-reconcile-preservation.ts --check`, non-mutating `--run-id=iteration152-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0); an owner-loop rerun also passed with `--run-id=iteration152-local-gated-rerun`. The model remains unchanged and `managedsystem-reconcile-preservation` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`outputs/iteration151-managedsystem-single-pool-constraint-execution-implementation.md` remains the single-pool implementation artifact. It closes the single-pool implementation task without cloud mutation: `probes/managedsystem-single-pool-constraint.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-single-pool-constraint`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the clean REST boundary from iteration124/150: first ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, second ManagedSystem pool via the same minimal body with only the pool name changed, post-rejection agentPools list assertions, setup-failure vs second-pool-rejection classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun probes/managedsystem-single-pool-constraint.ts --check`, non-mutating `--run-id=iteration151-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0). The model remains unchanged and `managedsystem-single-pool-constraint` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`outputs/iteration150-managedsystem-cli-failure-reference-packet.md` remains the latest ManagedSystem CLI failure reference packet. It closes the ManagedSystem CLI create/add failure refresh without cloud mutation: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` fail because the preview CLI sends ordinary/default node-pool fields (`OSTypeCasePreserved`, `availabilityProfile`, `count`, `networkProfile`, `osType`, `scaleSetPriority`, `workloadRuntime`, and add-specific `scaleDownMode`) that RP rejects for ManagedSystem pools. The accepted adjacent path remains the minimal ARM REST add-existing body `{"properties":{"mode":"ManagedSystem"}}`, proven by iteration56/20260519/iteration112. No model edit was needed; the validator still exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 7 failing feature IDs, 7 unknown feature IDs, and 3 blocked feature IDs. Do not rerun the same CLI failure unless a new `aks-preview`/Azure CLI version, CLI source fix, or owner request gives a material trigger.

`outputs/iteration149-paf-throttling-model-hygiene.md` remains the latest local model-changing artifact. It reconciles the iteration148 source/precondition packet into `outputs/e2e-capability-model.json`: `paf-throttling` is now **blocked/gated** instead of stale fail, with current observations `identity.msi.available=unknown` and `paf.throttling.behavior=unknown` because no artifact reached a failed `Verify PAF Objects` assertion. The validator exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 60 evidence references, 7 failing feature IDs, 7 unknown feature IDs, and 3 blocked feature IDs. Do not rerun standalone/staging PAF until MSI/HCP access, eastus2/underlay capacity or owner-approved bypass, and a source-owner/source-confirmed `DedicatedOom` trigger/assertion path are all available.

`outputs/iteration148-paf-throttling-source-precondition-reference-packet.md` remains the source/precondition packet behind the iteration149 model edit. It classified the prior `paf-throttling` model fail as stale/ambiguous standalone evidence rather than a confirmed PAF product failure: the first run failed before PAF assertions because the devbox lacked the `akse2ehcp-e2e` MSI; the post-MSI retry reached the dedicated/OOM stress gate but `Verify PAF Objects` was skipped because no kube-apiserver OOMKilled/137 event appeared within the source timeout; later `AKSCapacityHeavyUsage` evidence is a standalone capacity gate.

Human review remains asynchronous. Agents should continue to leave reviewable artifacts and execute bounded preflight/probes when safe, but same-branch cloud reruns require a material trigger or a changed probe input that tests a distinct coverage claim. No further BYO rerun is allowed without a new source/environment/build signal. ManagedSystem cloud execution should wait for a source-shaped request plan with explicit SKU/location/preflight gates, cleanup plan, sanitizer/request-shape evidence where applicable, and clear assertion boundaries. Machines/NAP Machine API cloud execution should wait for the Machine preview feature registrations or an equivalent source environment. App Routing migration execution is complete for the generic branch; preserve the checked-in gates and preflights for any future adjacent App Routing work.

This keeps the project on the agreed phase order: learn -> ground -> experiment -> refine -> next single-case TS probe -> replan.

## Linked Context
- `knowledge-map/README.md` — normalized knowledge-map model, visualization contract, and human/LLM update protocol
- `knowledge-map/feature-workflow.md` — repeatable deeper/wider workflow for turning one feature into model-backed knowledge
- `knowledge-map/model.json` — canonical accepted knowledge model; prefer this over legacy generated summaries under `outputs/`
- `knowledge-map/views/` — generated status, graph, path-summary, and evidence views derived from the canonical model
- `knowledge-map/deep-dives/managedsystem-pool.md` — worked deep feature example: sources, scenarios, input DAGs, expectations, verification, quality, risks, and improvement loop
- `execution/README.md` — phased learning/experimenting/replanning strategy for TS probes
- `execution/automation.md` — operating model for cron/supervisor triggers, always-on controller behavior, lane selection, execution gates, and agent compliance
- `agents/aks-explorer/cron.json` — disabled project-local trigger template for regular learning, weekly replanning review, and manual verification wake-ups
- `features/README.md` — stable feature reference-packet directory
- `run-plans/README.md` — tracked reviewable run-plan directory
- `probes/README.md` — tracked TypeScript probe directory
- `probe-lib/README.md` — shared helper library directory for probes
- `outputs/iteration155-knowledge-map-normalization.md` — local review aligning current project findings to the normalized scenario/DAG/behavior model
- `outputs/iteration185-owner-loop-duplicate-resume-reconciliation.md` — owner-loop reconciliation that handled duplicate ManagedSystem replan resume comments without queuing new work
- `features/managedsystem-pool.yaml` — stable ManagedSystem Pool reference packet
- `run-plans/managedsystem-rest-add-existing.yaml` — first single-case TS probe plan
- `probes/managedsystem-rest-add-existing.ts` — executable reference-backed probe
- `features/workload-autoscaler-vpa-upgrade-survival.yaml` — second reference-backed TS probe feature packet
- `run-plans/vpa-upgrade-survival-runtime.yaml` — VPA upgrade-survival TS probe plan
- `probes/vpa-upgrade-survival-runtime.ts` — executable VPA upgrade-survival probe
- `outputs/iteration115-vpa-upgrade-survival-runtime.md` — VPA upgrade-survival pass summary and model update evidence
- `features/bootstrap-profile-managed-acr-lifecycle.yaml` — Bootstrap managed-ACR reference packet
- `run-plans/bootstrap-profile-managed-acr-lifecycle.yaml` — Bootstrap managed-ACR TS probe plan
- `probes/bootstrap-profile-managed-acr-lifecycle.ts` — executable Bootstrap managed-ACR probe
- `outputs/iteration116-bootstrap-managed-acr-lifecycle.md` — Bootstrap managed-ACR pass summary and model update evidence
- `features/bootstrap-profile-byo-acr-lifecycle.yaml` — Bootstrap BYO-ACR reference packet
- `run-plans/bootstrap-profile-byo-acr-lifecycle.yaml` — Bootstrap BYO-ACR TS probe plan
- `probes/bootstrap-profile-byo-acr-lifecycle.ts` — executable Bootstrap BYO-ACR probe, hardened after the v2 timeout
- `outputs/iteration117-bootstrap-byo-acr-lifecycle.md` — Bootstrap BYO-ACR initial blocked attempt and cleanup evidence
- `outputs/iteration117-bootstrap-byo-acr-v2-timeout-blocker.md` — detailed BYO-ACR v2 create timeout blocker evidence
- `outputs/iteration116-post-vpa-ts-probe-selection.md` — local selection artifact that chose the now-completed Bootstrap managed-ACR lifecycle probe
- `tasks/README.md` — task index; all external task breakdown files should be reachable from here
- `tasks/managedsystem-pool/wave-01-feature-standard.yaml` — ManagedSystem Pool parallel feature-standard task wave
- `outputs/input-expectation-knowledge-map.md` — consolidated input/expectation knowledge map and ranked gaps
- `outputs/e2ev3-handwritten-coverage-inventory.md` — handwritten e2ev3 source inventory mapping scenarios to input paths, expectation paths, current evidence coverage, and model gaps
- `outputs/iteration73-capability-model-source-inventory-update.md` — validated capability-model update from handwritten e2ev3 source inventory
- `outputs/iteration74-node-restriction-source-spec-resolution.md` — Node Restriction source/spec contradiction resolution and operation-shape correction
- `outputs/iteration75-model-driven-probe-selection.md` — ranked high-density future probes from the validated model
- `outputs/iteration76-workload-identity-oidc-runtime-staging.md` — Workload Identity Linux token projection and OIDC discovery/JWKS runtime pass evidence
- `outputs/iteration77-identity-runtime-model-consolidation.md` — branch-accurate Identity/OIDC model consolidation
- `outputs/iteration78-workload-autoscaler-runtime-staging.md` — KEDA runtime pass and bounded VPA component/recommendation evidence
- `outputs/iteration79-vpa-runtime-model-split.md` — branch-accurate VPA runtime model split and next-probe reranking
- `outputs/iteration80-app-routing-tls-source-hypothesis.md` — source-first comparison showing App Routing DefaultDomainCertificate TLS failure is not explained by malformed customer CR/input
- `outputs/iteration81-app-routing-tls-owner-escalation.md` — owner escalation packet and diagnostic rerun gate for App Routing TLS
- `outputs/iteration91-app-routing-tls-gated-followup-tracker.md` — explicit App Routing TLS follow-up tracker with owner/diagnostic/fixed-build rerun gates and no-blind-rerun rule
- `outputs/iteration99-oidc-v133-explicit-enable-staging.md` — OIDC v1.33 explicit-enable discovery/JWKS staging pass evidence
- `outputs/iteration100-post-oidc-v133-unknown-selection.md` — post-OIDC v1.33 unknown-selection artifact selecting VirtualMachines mixed-SKU REST scale as the next non-gated branch
- `outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md` — VirtualMachines mixed-SKU REST scale staging pass evidence for `Scenario_Mixed_SKU_Scale`
- `outputs/iteration102-post-virtualmachines-unknown-selection.md` — post-VirtualMachines unknown-selection artifact selecting Workload Identity Windows token projection as the next non-gated branch
- `outputs/iteration103-workload-identity-windows-token-projection-staging.md` — Workload Identity Windows token-projection staging pass evidence for `Scenario_WorkloadIdentity` Windows branch
- `outputs/iteration92-next-model-unknown-selection.md` — local selection artifact that selected the focused VPA residual runtime probe
- `outputs/iteration93-vpa-residual-runtime-staging.md` — VPA Helm, HA/leader-election, and in-place-update staging pass evidence
- `outputs/iteration94-next-model-unknown-selection.md` — local selection artifact choosing Image Cleaner vulnerable-image erasure as the next non-gated runtime branch
- `outputs/iteration82-post-escalation-next-probe-selection.md` — post-App-Routing ranking that selected Node Restriction
- `outputs/iteration83-node-restriction-fullput-runtime-staging.md` — Node Restriction corrected full-PUT disable contract and runtime-default staging pass evidence
- `outputs/iteration84-keda-disable-reenable-crud-staging.md` — KEDA disable/re-enable CRUD lifecycle staging pass evidence
- `outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md` — Workload Identity disable/re-enable lifecycle staging pass evidence
- `outputs/managedsystem-pool-feature-standard.md` — integrated ManagedSystem Pool feature-standard packet and next execution recommendation
- `outputs/managedsystem-pool-feature-standard-init-tasks.md` — narrative draft for the ManagedSystem Pool feature-standard parallel task wave
- `outputs/iteration88-managedsystem-disable-migration-checkpointed.md` — checkpointed ManagedSystem rerun showing current add-phase SKU/image gate and cleanup status
- `outputs/iteration24-managedsystem-pool-pass.md` — pass evidence for `Scenario_ManagedSystemPool_Enable`
- `outputs/underlay-debug-findings.md` — root cause analysis, MSI fix, retry results
- `outputs/e2e-run-results-summary.md` — original e2e run results, including older App Routing default-domain traffic/TLS failure context
- `outputs/managedsystem-pool-exploration.md` — ManagedSystem Pool feature exploration and refreshed conclusions
- `outputs/iteration55-managedsystem-staging-results.md` — initial staging ManagedSystem Pool evidence
- `outputs/iteration56-managedsystem-staging-refresh.md` — refreshed staging ManagedSystem Pool CLI/REST classification matrix
- `outputs/20260519T1646Z-managedsystem-priority-staging.md` — fresh priority re-test confirming ManagedSystem Pool REST/CLI/delete verdict
- `outputs/aks-public-api-scenario-candidates.md` — prioritized public API feature scenarios
- `outputs/iteration57-node-autoprovision-staging.md` — NAP staging create evidence
- `outputs/iteration58-node-autoprovision-followup.md` — NAP staging update evidence
- `outputs/iteration59-app-routing-staging.md` — App Routing public CLI staging enablement evidence
- `outputs/iteration60-workload-identity-staging.md` — OIDC issuer + workload identity public CLI staging evidence
- `outputs/iteration61-workload-autoscaler-staging.md` — workload autoscaler KEDA/VPA public CLI profile-state evidence
- `outputs/iteration62-security-profile-staging.md` — Image Cleaner pass and Node Restriction tag-only PATCH/non-contract evidence
- `outputs/iteration63-bootstrap-profile-staging.md` — bootstrapProfile.artifactSource contract-first staging evidence
- `outputs/iteration64-virtualmachines-agentpool-staging.md` — non-ManagedSystem VirtualMachines agent-pool single-SKU pass and multi-SKU failure evidence
- `outputs/iteration65-virtualmachines-multisku-contract.md` — VirtualMachines single-SKU autoscale/update contract evidence and misleading multi-SKU add help classification
- `outputs/iteration66-virtualmachines-manual-scale-staging.md` — VirtualMachines manual-scale multi-profile add/delete staging evidence
- `outputs/iteration67-app-routing-disable-staging.md` — App Routing public CLI disable pass and persisted disabled-state evidence
- `outputs/iteration68-app-routing-defaultdomain-staging.md` — App Routing default-domain public API/state pass evidence
- `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` — App Routing default-domain HTTP traffic reachability pass evidence
- `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` — App Routing DefaultDomainCertificate/TLS-secret staging failure and fallback-cert HTTPS evidence
- `outputs/e2e-capability-model.json` — project-local capability model and evidence map
- `outputs/scripts/README.md` — reusable scripts produced for cleanup/run/capacity/MSI work
- `outputs/iteration33-standalone-environment-dead.md` — blocker evidence: old standalone builds recycled
- `devbox:/home/hayua/rp` — AKS RP checkout and staging execution context

## Task Management
- `project.md` is the project control plane and navigation root. It should stay readable: goal, current state, next action, validation rules, key context links, and the small parser-compatible task block.
- Detailed task breakdowns live under `tasks/`. A task file must be reachable from `project.md` directly or through `tasks/README.md`.
- Durable findings, evidence, feature packets, and run results live under `outputs/`.
- Keep one task responsible for one durable output artifact. Parallel tasks must write to different outputs; integration tasks merge them afterward.
- Until the project parser can load `tasks/**/*.yaml`, keep the active parser-compatible task block in `project.md` and put richer breakdowns in `tasks/`.

## Capability Map
- `Scenario_Traffic_AppRouting_Nginx_Disablement`: pass. Green evidence is in `outputs/successful-e2e-run.md`.
- `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`: partially reconciled. Fresh staging HTTP default-domain traffic passes (`outputs/iteration69-app-routing-defaultdomain-traffic-staging.md`), but TLS/DefaultDomainCertificate certificate provisioning fails in staging (`outputs/iteration70-app-routing-defaultdomain-tls-staging.md`) and older standalone evidence also points to TLS secret provisioning failure.
- `Scenario_PAFThrottling`: blocked/gated after iteration149 model hygiene. Current evidence does not prove a PAF product failure: the first run lacked `akse2ehcp-e2e` MSI, the post-MSI retry reached `DedicatedOom` but timed out before `Verify PAF Objects`, and later standalone evidence hit eastus2 `AKSCapacityHeavyUsage`. Do not rerun until MSI/HCP access, target capacity or owner-approved bypass, and source-owner/source-confirmed OOM trigger/assertion path are all available.
- Duplicate-registered scenarios: blocked by framework/test-selection ambiguity; use source inspection before retrying exact scenario names.
- ManagedSystem ARM REST add-existing-pool: pass in staging. Evidence is in `outputs/managedsystem-pool-exploration.md`.
- ManagedSystem Azure CLI create/add: fail. CLI sends default fields that RP rejects for ManagedSystem pools.
- ManagedSystem standalone e2ev3 scenario: pass. Evidence is in `outputs/iteration24-managedsystem-pool-pass.md`.

## Capability Model
- Source: `outputs/e2e-capability-model.json`
- Validator: `capability-model/src/validate.ts`
- Scope: project-local to `aks-rp-e2e`; do not promote to shared infra until this model proves useful through real iterations.
- Boundary: observation context (`standalone`, `staging`, `dev`, `devbox`, build version, execution surface) is a filter for where/how evidence was collected, not AKS product input space.
- Purpose: model the relation between AKS inputs, expected behavior, existing tests, observed behavior, and evidence. It is a coverage and discovery map, not just a result ledger.
- Mapping rule: each feature must map to one or more AKS input paths and expectation paths; each test case should map the concrete input path it exercised, the expected behavior path it intended to verify, and the observed path it actually produced.
- Current deterministic summary: 35 AKS input variables, 71 AKS state/behavior expectation variables, 63 feature mappings, 69 test-case evidence mappings, 58 judgments, 60 evidence references.
- Current feature status from validator after iteration149: 7 fail (`app-routing-default-domain`, CLI create/add ManagedSystem paths, `virtualmachines-agentpool-cli-add-multi-sku`, `app-routing-default-domain-tls-secret`, `managedsystem-disable-migration`, `machines-agentpool-nap-default-pool-cleanup-no-machine-crud`), 7 unknown feature IDs (`bootstrap-profile-byo-acr-lifecycle`, `app-routing-default-domain-istio`, `app-routing-default-domain-tls-lifecycle`, `managedsystem-runtime-restrictions`, `machines-agentpool-nap-default-pool-cleanup`, `managedsystem-single-pool-constraint`, `managedsystem-reconcile-preservation`), and 3 blocked (`paf-throttling`, `workload-autoscaler-vpa-cert-renewal-runtime`, `machines-agentpool-api-crud`). `paf-throttling` is blocked/gated by MSI/HCP, capacity, and `DedicatedOom` trigger preconditions rather than a confirmed product fail. `machines-agentpool-nap-default-pool-cleanup-no-machine-crud` is a failed partial split after iteration143; it must not close the full NAP cleanup or Machines API CRUD branches, and same-input staging eastus2 rerun is gated by iteration145 owner/rollout triggers. `app-routing-nginx-to-istio-migration` is pass after iteration137 as a generic AppRoutingIstio/Gateway branch; it does not close default-domain Istio, default-domain TLS lifecycle, or the failed TLS-secret provisioning branch. `workload-autoscaler-vpa-upgrade-survival-runtime` is pass after iteration115, `bootstrap-profile-managed-acr-lifecycle` is pass after iteration116, `oidc-issuer-default-enabled-signing-key-rotation` is pass after iteration119, `node-restriction-tag-only-patch-shape` is pass/non-contract after iteration121, and the legacy `workload-autoscaler-vpa-runtime` roll-up is retired after iteration122.
- Rule: agents may propose model changes, but the model is accepted only when the TypeScript validator passes.

## Weaknesses
- TLS secret provisioning weakness: DefaultDomain failed because required TLS secret was not provisioned.
- PAF precondition weakness: PAFThrottling evidence is gated by standalone/test-harness prerequisites (historical missing `akse2ehcp-e2e` MSI, eastus2 `AKSCapacityHeavyUsage`, and an unconfirmed `DedicatedOom` OOMKilled/137 trigger), not by an observed PAF object assertion failure.
- Scenario-selection weakness: duplicate registrations make several scenario names ambiguous.
- Standalone teardown leak: e2ev3 fires DELETE on the resource group and immediately returns ("success to start deleting resource group without wait it done"). If the test process is interrupted before ARM finishes, the standalone RP datastore keeps a `Succeeded` cluster that counts against per-underlay capacity and eventually trips `AKSCapacityHeavyUsage` for new runs.
- ManagedSystem CLI bug: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` send default fields that RP rejects.

## Next Action
Execute the active task tree children under `project-frontier-replan-7`:

1. **`app-routing-http-reach-fail-hypothesis`** (active, P2): Analyze the app-routing default-domain-http-reachability fail path — document root-cause hypothesis, check if existing evidence reveals a product bug vs test gap, and create a test-spec.
2. **`pass-path-expectation-density-enrichment`** (ready, P3): Enrich thin pass paths (<3 behavioral expectations) from feature packets, API specs, or existing evidence. Target: raise at least 5 paths to 4+ expectations.
3. **`nap-full-cleanup-test-spec-creation`** (ready, P3): Create a test-spec for the full NAP cleanup path that captures expected behavior and known failure modes.

All three are safe local/domain work with no cloud dependency. Cloud-gated resume triggers remain unchanged for ManagedSystem live execution, App Routing TLS, Machines API, NAP, VPA cert renewal, Bootstrap BYO-ACR, and PAF.

## Backlog
- UI graph for the knowledge model: the current quality panel is mostly a table/list view. It is missing the critical visualization for the core idea: an **input-space graph**, an **expectation-space graph**, and **feature mappings as paths across both spaces**. Keep this as a backlog design task for now, not part of the current handwritten-source inventory. When picked up, the UI should make the knowledge model visible: how a feature selects paths from both spaces, which tests/evidence attach to those paths, and where staging/standalone coverage is missing, blocked, failing, or not yet explored.

## Migration Notes

### 2026-05-21 — Bootstrap BYO-ACR TS probe built; initial execution blocked on create timeout
- `features/bootstrap-profile-byo-acr-lifecycle.yaml`, `run-plans/bootstrap-profile-byo-acr-lifecycle.yaml`, and `probes/bootstrap-profile-byo-acr-lifecycle.ts` now capture the source-backed `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_BYO_ACR` branch: custom VNet, two public Premium BYO ACRs, `aks-managed-mcr` cache rules, AcrPull role assignments, Cache/Direct/Cache lifecycle, registry switch, and image-pull assertions.
- `outputs/iteration117-bootstrap-byo-acr-lifecycle.md` records the initial blocked outcome. First execution surfaced the missing custom VNet input and was cleaned up; v2 used custom VNet and source-shaped ACR0 Cache create, but AKS remained `Creating` past the 7200s wrapper timeout with no ARM `status.errordetail`; cleanup reached `az group exists=false`.
- The probe was hardened after the timeout to use `az aks create --no-wait`, explicit `az aks show` polling, ARM GET-on-timeout, structured `operation-timeout` blockers, and normal cleanup; `iteration117-preflight3` passed.
- The next parser-visible task is a single hardened BYO follow-up run. If it again cannot reach a terminal product verdict, close BYO as blocked-for-now and pivot to post-BYO unknown selection; do not blind-rerun BYO without a new source/build/environment signal.
- Existing gates remain in force for VPA cert renewal, Machines/Machine API/NAP cleanup, App Routing TLS/Istio, ManagedSystem residual branches, OIDC signing-key rotation, and Node Restriction tag-only PATCH.

### 2026-05-21 — Bootstrap managed-ACR TS probe passed; selected Bootstrap BYO-ACR lifecycle
- `features/bootstrap-profile-managed-acr-lifecycle.yaml`, `run-plans/bootstrap-profile-managed-acr-lifecycle.yaml`, and `probes/bootstrap-profile-managed-acr-lifecycle.ts` completed the third reference-backed TS probe path.
- `outputs/iteration116-bootstrap-managed-acr-lifecycle.md` records a pass for `bootstrap-profile-managed-acr-lifecycle`: Cache create assigned an AKS-managed ACR and image pull succeeded; Direct disable cleared `containerRegistryId`, image pull still succeeded, and managed ACR/private endpoint/private DNS cleanup was observed; Cache re-enable assigned a new managed registry and image pull succeeded; cleanup verified `az group exists=false`; validator exited 0.
- Superseded by iteration117: the BYO packet/run-plan/probe now exist, and the next task is one hardened follow-up execution, not creating the BYO artifacts from scratch.

### 2026-05-21 — VPA upgrade-survival TS probe passed; selected Bootstrap managed-ACR lifecycle
- `outputs/iteration115-vpa-upgrade-survival-runtime.md` and generated probe evidence completed the second reference-backed TS probe. The run passed `workload-autoscaler-vpa-upgrade-survival-runtime`: VPA components/recommendations passed before upgrade on Kubernetes `1.34.7`, cluster/nodepool upgraded to `1.35.4`, VPA components/recommendations passed again after upgrade, cleanup reached `az group exists=false`, and the capability-model validator exited 0.
- `outputs/iteration116-post-vpa-ts-probe-selection.md` ranked remaining unknowns and selected `bootstrap-profile-managed-acr-lifecycle` as the next non-gated single-case TS probe. It must start from source grounding for `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR` and must not include BYO ACR registry switching.
- Superseded by later iteration116 Bootstrap managed-ACR pass: continue with the separate BYO-ACR lifecycle task, not another managed-ACR rerun.

### 2026-05-21 — Post-VirtualMachines autoscaled selection picked Image Cleaner survival
- `outputs/iteration110-post-vmauto-unknown-selection.md` completed the local-only post-iteration109 selection loop. The validator exited 0 with 35 input variables, 67 expectation variables, 7 failing features, 13 unknown features, and 2 blocked features.
- The selection preserved blockers/gates for VPA cert renewal, Machines/Machine API/NAP cleanup, App Routing TLS/Istio, ManagedSystem branches, OIDC signing-key rotation, and Node Restriction tag-only PATCH.
- The selected next parser-visible task is `image-cleaner-upgrade-restart-survival-staging`, scoped to `image-cleaner-upgrade-restart-survival` with source preflight required before any cloud mutation and explicit non-goals for VPA/KEDA, bootstrap, identity/OIDC, VirtualMachines, Machines/NAP, App Routing, ManagedSystem, Node Restriction, and unrelated probes.

### 2026-05-21 — Image Cleaner survival passed; shifted to TS probe strategy
- `outputs/iteration111-image-cleaner-upgrade-restart-survival-staging.md` completed the Image Cleaner upgrade/restart survival probe and updated `image-cleaner-upgrade-restart-survival` to pass.
- The capability-model validator exits 0 with 35 input variables, 67 expectation variables, 62 features, 41 pass, 7 fail, 12 unknown, and 2 blocked.
- The next project phase is not another immediate cloud probe. It is to create the first reference-backed, reviewable TS probe path so later replanning can safely combine compatible cases into fewer AKS cluster lifecycles.

### 2026-05-21 — First reference-backed TS probe executed and blocked on ManagedSystem SKU/image
- `features/managedsystem-pool.yaml`, `run-plans/managedsystem-rest-add-existing.yaml`, and `probes/managedsystem-rest-add-existing.ts` now form the first reviewable reference-backed TS probe path.
- `outputs/iteration112-managedsystem-rest-add-existing-managedsystem-rest-add-existing.md` and its JSON/self-review artifacts show clean devbox preflight and automatic execution. The minimal ManagedSystem REST PUT was accepted, but the pool failed when staging/RP selected Arm64-only `Standard_D8pds_v5` with an x64 image. Cleanup reached `az group exists=false`.
- Superseded by later iteration112 v2 plus iteration113/114: the TS probe process review is done, diagnostics were refined, and a v2 cloud execution passed the claimed REST add-existing contract. Do not rerun the same ManagedSystem cloud probe unless the input changes to answer a distinct coverage question.

### 2026-05-21 — ManagedSystem TS probe v2 passed the worked REST add-existing contract
- `outputs/iteration112-managedsystem-rest-add-existing-v2-managedsystem-rest-add-existing.md` is the latest ManagedSystem TS-probe evidence. It created one eastus2 staging cluster on devbox, executed minimal ARM REST `{"properties":{"mode":"ManagedSystem"}}`, observed `Succeeded`, `mode=ManagedSystem`, `type=VirtualMachines`, null/omitted top-level `vmSize`/`count`, and CriticalAddonsOnly NoSchedule/NoExecute taints, then verified cleanup to `az group exists=false`.
- Runtime Kubernetes capture stayed audit-only: the probe did not claim critical add-on placement, VAP/VAPBinding, customer workload unschedulability, disable migration, or reconcile preservation.
- The existing `managedsystem-pool-rest-add-existing` model status remains pass; the v2 artifact is additional evidence for the same pass judgment, not a new feature verdict.

### 2026-05-21 — TS probe process reviewed; selected local diagnostics refinement
- `outputs/iteration113-ts-probe-process-review-and-replan.md` completed the local-only review. It judged the first reference-backed TS probe path directionally sound and honest: source intent was preserved for the minimal REST add-existing path, runtime claims were not overstated, diagnosis was correctly classified as environment-blocked, and no capability-model edit was made.
- The review found local process fixes needed before copying the pattern: verdict-impact metadata for assertions, first-class blocker extraction from ARM status/error detail, cleanup verification in JSON, shorter tool-version capture, and markdown rendering from structured evidence.
- Superseded by iteration114: the diagnostics refinement is done, and the next parser-visible task is the VPA upgrade-survival reference-backed TS probe.

### 2026-05-21 — Local TS probe diagnostics refined; selected VPA upgrade-survival TS probe
- `outputs/iteration114-ts-probe-local-diagnostics-refinement.md` completed the local-only diagnostics refinement with no cloud execution and no ManagedSystem rerun.
- `probes/managedsystem-rest-add-existing.ts` now emits assertion `verdictImpact`, extracts ARM `status.errordetail` into a structured blocker, verifies cleanup with bounded `az group exists`, captures short CLI/extension version data, and renders blocker/cleanup/model-impact details from structured JSON. `run-plans/managedsystem-rest-add-existing.yaml` and `execution/README.md` were updated to carry the reusable pattern.
- The selected next parser-visible task is `vpa-upgrade-survival-reference-backed-ts-probe`, scoped to `workload-autoscaler-vpa-upgrade-survival-runtime`; it must not include gated VPA certificate renewal and must not create cloud resources until source/reference/run-plan/probe preflight is clean.

### 2026-05-21 — VirtualMachines autoscaled VMs CRUD/upgrade passed
- `outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md` completed the source-shaped `Scenario_Autoscaled_VMs_CRUD` probe. Source preflight found the plan has no `AKSAPIVersion()` override, so generated `awesome` clients use `2026-03-02-preview`; a false start with `2026-03-01` rejected `autoscale` as an unknown field and was cleaned up.
- Successful staging run used eastus2, `Standard_D2s_v4`, Kubernetes `1.33.11` -> `1.34.7`, feature header `Microsoft.ContainerService/VMsAgentPoolAutoscalePreview`, default pool `autoscaleap` type `VirtualMachines`, autoscale update `1-3` then `3-5`, and ManagedCluster PUT upgrade. The final ARM state preserved autoscale `min=3/max=5`, nodeStatus count `3`, MC/AP versions `1.34.7`, and all three Kubernetes nodes were Ready with kubelet `v1.34.7`; cleanup reached `az group exists=false`.
- `outputs/e2e-capability-model.json` now marks `virtualmachines-autoscaled-vms-crud` pass and validator exits 0 with 7 failing, 13 unknown, and 2 blocked features. Superseded by iteration110: the next action is Image Cleaner upgrade/restart survival preflight/probe, not another immediate VirtualMachines rerun.

### 2026-05-21 — Selected VPA certificate renewal after Machines blocker
- `outputs/iteration106-post-machines-blocker-unknown-selection.md` completed local-only post-Machines ranking. It ran the project validator successfully and recorded 7 failing, 15 unknown, and 1 blocked feature.
- `machines-agentpool-api-crud` remains blocked on missing `Microsoft.ContainerService/PutMachinePreview` and `DeleteSpecificMachinesPreview` in staging subscription `26fe00f8-9173-4872-9134-bb1d2e00343a`; do not rerun Machines CRUD or NAP default Machines cleanup until those features or an equivalent source environment are available.
- The selected next parser-visible task is `vpa-cert-renewal-runtime-staging`, scoped to `workload-autoscaler-vpa-cert-renewal-runtime` with source preflight required before any cloud mutation and explicit non-goals for upgrade survival, KEDA, Image Cleaner, VirtualMachines, bootstrap, identity/OIDC, App Routing, ManagedSystem, Machines, NAP, and Node Restriction.

### 2026-05-21 — Machines AgentPool eastus2 retry blocked by Machine preview feature registration
- `outputs/iteration105-machines-agentpool-api-crud-staging.md` now includes an iteration106 follow-up: no leftover `mach105-*` groups existed, eastus2/`Standard_D2s_v4` baseline cluster creation succeeded, `2026-05-02-preview` direct ARM was unavailable, and `2026-03-02-preview` Machines pool create succeeded with `mode=Machines`/`type=VirtualMachines`.
- The first Machine PUT then failed with `PutMachinePreview` NotRegistered; fresh feature preflight also showed `DeleteSpecificMachinesPreview` NotRegistered. Both retry resource groups reached `ResourceGroupNotFound`.
- `outputs/e2e-capability-model.json` now marks `machines-agentpool-api-crud` as blocked with evidence `iteration105-machines-agentpool-eastus2-retry-blocked`; validator exits 0 with 7 failing, 15 unknown, and 1 blocked feature. The next task is local `post-machines-blocker-unknown-selection`, not a blind Machines rerun.

### 2026-05-20 — Machines AgentPool API CRUD first attempt blocked at westus2 baseline
- `outputs/iteration105-machines-agentpool-api-crud-staging.md` completed the source/API/custom-feature preflight and extracted the `Scenario_MachinesAgentPool` contract: VMSS system baseline, Machines pools, Machine create/get/update/list/delete, UltraSSD positive and negative paths, and cleanup shape.
- Two `westus2` staging baseline creates failed before any Machines API call (`mc=Failed pools=agentpool0:Failed`); both `mach105-*` resource groups were verified deleted (`az group exists=false` / `ResourceGroupNotFound`).
- No model update was made; `machines-agentpool-api-crud` remains `unknown`. The next parser-visible task is `machines-agentpool-api-crud-eastus2-retry`, scoped to the same branch with a known-good/dynamic baseline.

### 2026-05-20 — Selected Machines AgentPool API CRUD after post-Windows ranking
- `outputs/iteration104-post-wi-windows-unknown-selection.md` ranked the 16 remaining unknowns after Workload Identity Windows token projection and selected `machines-agentpool-api-crud` as the next non-gated branch.
- Fresh capability-model validator run during this owner loop exited 0 with 35 input variables, 67 expectation variables, 7 failing features, 16 unknown features, and 0 blocked features.
- Superseded by iteration105: `machines-agentpool-api-crud-staging` is done/blocked and the next task is `machines-agentpool-api-crud-eastus2-retry`.

### 2026-05-20 — Completed Workload Identity Windows token projection; selecting next unknown
- `outputs/iteration103-workload-identity-windows-token-projection-staging.md` closed `workload-identity-runtime-token-projection-windows` as pass: source confirmed the `Scenario_WorkloadIdentity` Windows branch, staging created an OIDC/WI-enabled Azure CNI cluster with Windows profile and a Windows2022 pool, the Windows ServerCore pod was mutated by azure-wi webhook with expected env vars and projected token volume, the token decoded with matching issuer/audience/subject, and cleanup reached `group_exists=false`.
- Fresh capability-model validator run after iteration103 exited 0 with 35 input variables, 67 expectation variables, 7 failing features, 16 unknown features, and 0 blocked features.
- Superseded by iteration104 completion: `post-wi-windows-unknown-selection` is now done and selected `machines-agentpool-api-crud-staging` as the next parser-visible task.

### 2026-05-20 — Selected Workload Identity Windows token projection after VirtualMachines pass
- `outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md` closed `virtualmachines-mixed-sku-rest-scale` as pass: source-equivalent REST/PUT transitions created a mixed-SKU VirtualMachines user pool, scaled through AgentPool PUT and ManagedCluster PUT paths, matched `virtualMachinesProfile.scale.manual[]` and `virtualMachineNodesStatus[]`, and cleaned up to `ResourceGroupNotFound`.
- Fresh capability-model validator run after iteration101 exited 0 with 35 input variables, 67 expectation variables, 7 failing features, 17 unknown features, and 0 blocked features.
- `outputs/iteration102-post-virtualmachines-unknown-selection.md` ranked the remaining unknowns and selected `workload-identity-runtime-token-projection-windows` as the next bounded non-gated branch, using `Scenario_WorkloadIdentity` source intent plus iteration76 Linux pass and iteration77/85 identity context.
- The next parser-visible task is `workload-identity-windows-token-projection-staging`; it must complete source and Windows capacity/SKU preflight before creating any cluster, and must not combine OIDC signing-key rotation, upgrade survival, or unrelated feature probes.

### 2026-05-20 — Completed OIDC v1.33 explicit-enable runtime
- `outputs/iteration99-oidc-v133-explicit-enable-staging.md` closed `oidc-issuer-v133-explicit-enable-runtime` as pass: source confirmed the `~1.33.x` explicit-enable path, staging Kubernetes `1.33` created without explicit OIDC persisted disabled/null issuer state, source-equivalent full PUT enabled OIDC, discovery and JWKS returned HTTP 200 with expected issuer/JWKS/two-RSA-key shape, and cleanup reached `ResourceGroupNotFound`.
- Fresh capability-model validator run after iteration99 exited 0 with 35 input variables, 67 expectation variables, 7 failing features, 18 unknown features, and 0 blocked features.
- The next parser-visible work should be a post-iteration99 unknown-selection artifact; do not re-run OIDC v1.33 or silently pivot to VirtualMachines without that selection/preflight step.

### 2026-05-20 — Selected OIDC v1.33 explicit-enable runtime after post-OIDC ranking
- `outputs/iteration98-post-oidc-unknown-selection.md` ranked the 19 remaining model unknowns after the OIDC post-delete cleanup pass and selected `oidc-issuer-v133-explicit-enable-runtime` as the next bounded non-gated branch.
- Fresh capability-model validator run during the owner loop exited 0 with 35 input variables, 67 expectation variables, 7 failing features, 19 unknown features, and 0 blocked features.
- Superseded by iteration99 completion: `oidc-v133-explicit-enable-staging` has now passed; continue with post-iteration99 unknown selection.

### 2026-05-20 — Completed OIDC post-delete cleanup; selecting next unknown
- `outputs/iteration97-oidc-post-delete-cleanup-staging.md` closed `oidc-issuer-default-enabled-post-delete-cleanup` as pass: Kubernetes `1.34` default-enabled OIDC discovery/JWKS were reachable before delete, source-equivalent no-wait cluster/resource-group deletion succeeded, discovery and JWKS returned `404 WebContentNotFound` within about 5m49s, and cleanup reached `ResourceGroupNotFound`.
- Fresh capability-model validator run after iteration97 exited 0 with 35 input variables, 67 expectation variables, 7 failing features, 19 unknown features, and 0 blocked features.
- The next parser-visible task is `post-oidc-unknown-selection`; it must rank the remaining non-gated unknowns and select one bounded execution branch before any new cloud mutation.


### 2026-05-20 — Selected OIDC post-delete cleanup after Image Cleaner erasure pass
- `outputs/iteration95-image-cleaner-vulnerable-erasure-staging.md` closed `image-cleaner-vulnerable-image-erasure` as pass: source-preflighted vulnerable image removal succeeded after Image Cleaner re-enable, eraser collectors completed, node image checks found the vulnerable image absent, cleanup reached `ResourceGroupNotFound`, and the capability-model validator exited 0.
- `outputs/iteration96-post-image-cleaner-unknown-selection.md` ranked the remaining non-gated unknowns and selected OIDC default-enabled post-delete issuer cleanup as the next branch because iteration76 already proved discovery/JWKS on Kubernetes `1.34` and the remaining cleanup expectation was narrow and lower cost than Windows, upgrade, or cert-renewal branches.
- Superseded by iteration97 completion: `oidc-post-delete-cleanup-staging` has now passed; continue with `post-oidc-unknown-selection` rather than re-running this branch.

### 2026-05-20 — Selected Image Cleaner vulnerable-image erasure after VPA residual pass
- `outputs/iteration93-vpa-residual-runtime-staging.md` closed the focused VPA residual branches for Helm metadata, HA/leader-election, and in-place update on Kubernetes `1.34.7`; VPA cert renewal and upgrade survival remain explicit unknown/non-goals.
- Fresh capability-model validator run after iteration93 exited 0 with 35 input variables, 67 expectation variables, 7 failing features, and 21 unknown features.
- `outputs/iteration94-next-model-unknown-selection.md` ranked the remaining non-gated unknowns and selected Image Cleaner vulnerable-image erasure as the next branch because Image Cleaner component lifecycle already passed and actual vulnerable-image removal is the strongest non-gated security runtime gap.
- The next parser-visible task is `image-cleaner-vulnerable-erasure-staging`; it must confirm the source vulnerable image, node/containerd run-command path, eraser collector selector, and wait budget before creating a staging cluster.

### 2026-05-20 — Completed App Routing TLS tracker; selected next model unknown
- `outputs/iteration91-app-routing-tls-gated-followup-tracker.md` records the valid-input DefaultDomainCertificate TLS-secret failure, owner questions, diagnostic data needed, allowed rerun triggers, and explicit no-blind-rerun rule.
- App Routing TLS remains gated on owner response, CCP/default-domain-svc diagnostic access, fixed/known-good build/configuration, or source-proven chart/config mismatch; no customer-cluster-only rerun is selected.
- Fresh capability-model validator run during tracker creation exited 0 with 35 input variables, 67 expectation variables, 7 failing features, and 24 unknown features.
- The single active parser-visible task is now `next-model-unknown-selection` to choose a bounded non-blocked unknown branch before any cloud mutation.

### 2026-05-20 — Selected App Routing TLS tracker
- Owner loop selected resume-menu item 2 and created the single active parser-visible task `app-routing-tls-gated-followup-tracker`.
- This is local tracker/bookkeeping work only; App Routing staging rerun remains gated on owner response, CCP/default-domain-svc diagnostic access, or a fixed/known-good build/configuration.
- Fresh capability-model validator run during selection exited 0 with 35 input variables, 67 expectation variables, 7 failing features, and 24 unknown features.

### 2026-05-20 — Paused after checkpointed ManagedSystem rerun
- `managedsystem-disable-migration-runtime-probe` completed with iteration86 negative runtime evidence.
- `managedsystem-disable-migration-checkpointed-rerun` was later dropped after two checkpointed attempts; iteration88 captured add-phase failures caused by RP-selected `Standard_D8pds_v5` Arm64 SKU with x64 node image and cleanup verification.
- The project is paused because all parser-visible tasks are closed and the next phase needs an owner choice from the resume menu.

### 2026-05-20 — Reactivated for task-driven execution
- Reactivated because the current task chain was parser-visible and the next
  step did not require external unblock.
- This path dispatched the ManagedSystem migration tasks directly instead of
  using the legacy project workflow.

## Plan
1. ✅ Run e2e scenarios and collect initial standalone results
2. ✅ Explore ManagedSystem Pool enough to split REST/CLI/standalone evidence
3. ✅ Capture standalone e2ev3 verdict for Scenario_ManagedSystemPool_Enable
4. ✅ Refresh ManagedSystem Pool evidence in staging using a fixed CLI/REST classification matrix
5. ✅ Update `outputs/managedsystem-pool-exploration.md` and validate `outputs/e2e-capability-model.json` with current ManagedSystem evidence
6. ✅ Fetch Azure AKS public API specs/docs and derive the next candidate feature scenarios in `outputs/aks-public-api-scenario-candidates.md`
7. ✅ Validate Node Auto Provisioning create/update behavior in staging and update the capability model
8. ✅ Validate Web App Routing/App Routing public API behavior in staging and update the capability model
9. ✅ Validate OIDC issuer + workload identity public API behavior in staging and update the capability model
10. ✅ Select the next public API candidate based on iteration60 results
11. ✅ Validate workload autoscaler profile KEDA/VPA public API behavior and update the capability model
12. ✅ Select the next public API candidate based on iteration61 results
13. ✅ Validate security profile image cleaner/node restriction public API behavior and update the capability model
14. ✅ Validate bootstrap profile artifact source public API behavior with a contract-first staging probe and update the capability model if verdicted
15. ✅ Validate non-ManagedSystem VirtualMachines agent pool public preview behavior and classify the multi-SKU/manual-scale contract
16. ✅ Close App Routing public API disable/default-domain/traffic evidence and escalate DefaultDomainCertificate TLS failure
17. ✅ Consolidate the input/expectation knowledge map and handwritten e2ev3 coverage inventory
18. ✅ Resolve Node Restriction source/spec contradiction and validate corrected runtime/default behavior
19. ✅ Validate KEDA disable/re-enable CRUD lifecycle in staging
20. ✅ Validate Workload Identity disable/re-enable lifecycle in staging
21. ✅ Decompose and validate Image Cleaner runtime lifecycle branches with source-gated staging evidence
22. ✅ Execute ManagedSystem Pool delete/disable migration runtime probe with checkpointed staging evidence
23. ✅ Execute Image Cleaner vulnerable-image erasure with source-gated staging evidence
24. ✅ Select the next post-Image-Cleaner non-gated model unknown
25. ✅ Execute OIDC default-enabled post-delete issuer cleanup with source-gated staging evidence
26. ✅ Select the next post-OIDC non-gated model unknown
27. ✅ Execute OIDC v1.33 explicit-enable discovery/JWKS runtime with source-gated staging evidence
28. ✅ Select and execute VirtualMachines mixed-SKU REST scale transitions with source-gated staging evidence
29. ✅ Select the next post-VirtualMachines non-gated model unknown
30. ✅ Execute Workload Identity Windows token projection with source-gated staging evidence
31. ✅ Select the next post-Windows non-gated model unknown
32. ⚠️ Execute Machines AgentPool API CRUD with source/API-version-gated staging evidence — blocked on Machine preview feature registration
33. ✅ Select the next non-gated unknown after the Machines feature-registration blocker
34. ⚠️ Execute VPA certificate renewal runtime with source-gated staging evidence — blocked on missing source TLS-manager CronJob in staging
35. ✅ Select the next non-gated unknown after the VPA cert-renewal source-equivalence blocker
36. ✅ Execute VirtualMachines autoscaled VMs CRUD/upgrade with source-gated staging evidence
37. ✅ Execute Image Cleaner upgrade/restart survival with source-gated staging evidence
38. ✅ Create, run, and self-review the first reference-backed TypeScript probe path
39. ✅ Review the first TS probe process and select the next bounded experiment/replan step
40. ✅ Refine TS probe diagnostics and structured evidence locally before generalizing
41. ✅ Create and execute the VPA upgrade-survival reference-backed TS probe
42. ✅ Create and execute the Bootstrap managed-ACR lifecycle reference-backed TS probe
43. ⚠️ Create and execute the Bootstrap BYO-ACR lifecycle reference-backed TS probe — bounded blocked attempts, no product verdict
44. ✅ Create and execute the OIDC signing-key rotation reference-backed TS probe
45. ✅ Resolve Node Restriction tag-only PATCH source/spec shape before any cloud mutation
46. ✅ Retire/reclassify Node Restriction tag-only PATCH as source-resolved/non-contract in the capability model
47. ✅ Retire/reclassify the legacy VPA runtime roll-up so split VPA branches drive future selection
48. ✅ Design a source-safe ManagedSystem runtime-restrictions TS probe/run plan before any cloud mutation
49. ✅ Design a source-safe ManagedSystem single-pool constraint TS probe/run plan before any cloud mutation
50. ✅ Design a source-safe ManagedSystem reconcile-preservation TS probe/run plan before any cloud mutation
51. ✅ Select the next bounded unknown after ManagedSystem residual branch designs
52. ✅ Design the Machines/NAP default Machines pool cleanup source boundary
53. ✅ Design the App Routing default-domain Istio source boundary
54. ✅ Select the next residual split-model or waiting state
55. ✅ Design and model the NAP default Machines pool cleanup split without Machine CRUD
56. ✅ Research and model a generic non-default-domain AppRoutingIstio/Gateway split
57. ✅ Design the generic App Routing NGINX-to-Istio migration run plan/probe locally
58. ✅ Refresh the consolidated knowledge map after App Routing migration design
59. ✅ Implement the execution-gated App Routing NGINX-to-Istio migration probe body locally
60. ✅ Execute one gated App Routing NGINX-to-Istio migration probe run
61. ✅ Create the NAP default Machines pool cleanup no-Machine-CRUD reference-backed TS probe design
62. ✅ Implement the NAP cleanup no-Machine-CRUD execution-gated TS probe body locally
63. ⚠️ Execute the NAP cleanup no-Machine-CRUD gated split probe — blocked before resource creation by ambiguous API-version/NAP feature preflights
64. ✅ Harden the NAP cleanup no-Machine-CRUD execution preflights locally
65. ⚠️ Execute the NAP cleanup no-Machine-CRUD gated rerun after hygiene — split branch failed: NAP Auto persisted but `aksmanagedap` was NotFound before Manual
66. ✅ Triage the `aksmanagedap` absence against source/API expectations before any rerun
67. ✅ Produce NAP managed-machine-pool rollout/environment escalation packet
68. ✅ Refresh the knowledge map and next-frontier selection after NAP escalation
69. ✅ Build the VirtualMachines CLI multi-SKU failure reference packet locally
70. ✅ Build the PAF throttling source/precondition reference packet locally
71. ✅ Perform PAF throttling model hygiene locally
72. ✅ Build a ManagedSystem CLI failure reference packet locally
73. ✅ Implement the ManagedSystem single-pool constraint execution-gated TS probe body locally
74. ✅ Implement the ManagedSystem reconcile-preservation execution-gated TS probe body locally
75. ✅ Implement the ManagedSystem runtime-restrictions execution-gated TS probe body locally
76. ✅ Perform post-ManagedSystem implementation frontier selection locally
77. ✅ Migrate App Routing NGINX-to-Istio and NAP cleanup split into normalized knowledge-map paths
78. ✅ Migrate Bootstrap BYO ACR lifecycle into normalized knowledge-map paths without cloud execution
79. ✅ Migrate App Routing default-domain TLS-secret into normalized knowledge-map paths without cloud execution
80. ✅ Migrate PAF throttling blocked preconditions into normalized knowledge-map paths without cloud execution
81. ✅ Migrate VirtualMachines CLI comma multi-SKU failure into normalized knowledge-map paths without cloud execution
82. ✅ Migrate VPA cert-renewal blocked reconciler path into normalized knowledge-map paths without cloud execution
83. ✅ Migrate VirtualMachines mixed-SKU REST scale pass into normalized knowledge-map paths without cloud execution
84. ✅ Migrate VirtualMachines autoscaled VMs CRUD/upgrade pass into normalized knowledge-map paths without cloud execution
85. ✅ Migrate VirtualMachines CLI single-SKU add and single-SKU autoscale update pass paths into normalized knowledge-map paths without cloud execution
86. ✅ Migrate VirtualMachines CLI manual-scale multiple single-size profiles into normalized knowledge-map paths without cloud execution
87. ✅ Migrate App Routing default-domain Istio/Gateway source branch into normalized knowledge-map paths without cloud execution
88. ✅ Migrate App Routing default-domain TLS lifecycle source branch into normalized knowledge-map paths without cloud execution
89. ✅ Migrate App Routing default-domain HTTP/default-domain enablement branch into normalized knowledge-map paths without cloud execution
90. ✅ Migrate App Routing public API enable/disable into normalized knowledge-map paths without cloud execution
91. ✅ Migrate App Routing standalone NGINX disablement into normalized knowledge-map paths without cloud execution
92. ✅ Migrate ManagedSystem standalone e2ev3 enable into normalized knowledge-map paths without cloud execution
93. ✅ Migrate Node Auto Provisioning public API create/update passes into normalized knowledge-map paths without cloud execution
94. ✅ Migrate Workload Identity public API create/update passes into normalized knowledge-map paths without cloud execution
95. ✅ Migrate Workload Identity Linux/Windows runtime token-projection passes into normalized knowledge-map paths without cloud execution
96. ✅ Migrate Identity/OIDC lifecycle passes into normalized knowledge-map paths without cloud execution
97. ✅ Migrate Bootstrap profile public API and managed-ACR lifecycle passes into normalized knowledge-map paths without cloud execution
98. ✅ Migrate Workload Autoscaler KEDA/VPA profile and runtime branches into normalized knowledge-map paths without cloud execution
99. ✅ Migrate security-profile Image Cleaner and Node Restriction branches into normalized knowledge-map paths without cloud execution
100. ✅ Migrate Machines API CRUD and full NAP default Machines pool cleanup into normalized knowledge-map paths without cloud execution
101. ⏸️ Wait for an external execution/source trigger before queuing the next bounded task — reconfirmed by iteration185 owner loop after duplicate ManagedSystem replan resume comments were handled by the iteration183 deliverables

## Tasks
- id: managedsystem-pool-priority-test
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Prioritize ManagedSystem Pool testing. Read the current project state plus `outputs/managedsystem-pool-exploration.md`, `outputs/iteration56-managedsystem-staging-refresh.md`, `outputs/iteration24-managedsystem-pool-pass.md`, and `outputs/e2e-capability-model.json`. Run the smallest fresh ManagedSystem Pool validation that can confirm or update the current verdict, using devbox `/home/hayua/rp` and staging or standalone as appropriate. Produce a new timestamped artifact under `outputs/` with exact commands, environment, API version, request bodies where applicable, raw error snippets, cleanup status, and a verdict table. If the verdict changes or strengthens the model, update `outputs/e2e-capability-model.json`, run `cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json`, and include the validator result in the artifact. If execution is blocked, write precise blocker evidence and the next unblock action.
  depends_on: []
  attempts: 1

- id: app-routing-defaultdomain-traffic
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Validate App Routing default-domain traffic reachability in staging with a real workload/Service/Ingress. Produce `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` with docs/source preflight, one fresh staging cluster, default-domain enablement, kube credentials, minimal HTTP workload/service/Ingress, kubectl state, curl reachability probes against the generated default domain, cleanup status, and a verdict table. Update `outputs/e2e-capability-model.json` only if the run gives a clear traffic verdict, then run `cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json` and include the validator result in the artifact.
  depends_on: [managedsystem-pool-priority-test]
  attempts: 1

- id: knowledge-map-foundation
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Build the first explicit AKS input/expectation knowledge-map foundation, with the handwritten ManagedSystem Pool e2ev3 case as the worked feature-boundary example. Result artifact: `outputs/input-expectation-knowledge-map.md`.
  depends_on: [app-routing-defaultdomain-traffic]
  attempts: 1

- id: e2ev3-feature-matrix-inventory
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: Inventory existing handwritten e2ev3 cases as feature-matrix knowledge, not as a run queue. Use `outputs/scenario-catalog.md`, existing run artifacts, and devbox source under `/home/hayua/rp/test/e2ev3`. For each selected case, infer the feature intent from the handwritten plan/scenario/steps/assertions, then map it to AKS input paths, expected behavior paths, and current evidence status. Highlight cases that cover multiple paths in one run and cases whose names hide multiple registrations or ambiguous input paths. Update the capability model only for well-supported mappings, then validate it.
  depends_on: [knowledge-map-foundation]
  attempts: 1

- id: capability-model-source-inventory-update
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Update `outputs/e2e-capability-model.json` from the handwritten e2ev3 inventory so the model represents source-derived input paths, expectation paths, test cases, and partial evidence relationships. Result artifact: `outputs/iteration73-capability-model-source-inventory-update.md`; validator exits 0.
  depends_on: [e2ev3-feature-matrix-inventory]
  attempts: 1

- id: node-restriction-source-spec-investigation
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: Investigate the Node Restriction source/spec contradiction locally before any new cloud probe. Read `outputs/e2ev3-handwritten-coverage-inventory.md`, `outputs/iteration62-security-profile-staging.md`, `outputs/iteration73-capability-model-source-inventory-update.md`, `outputs/e2e-capability-model.json`, AKS public API/spec references, public docs if available, and relevant devbox source under `/home/hayua/rp`. Produce `outputs/node-restriction-source-spec-investigation.md` explaining the intended contract, public/API request shape, feature gate or API-version requirements, source assertions, why iteration62 did not persist `securityProfile.nodeRestriction`, and the next concrete action. Do not run staging, `az`, cluster creation, or cloud probes.
  depends_on: [capability-model-source-inventory-update]
  attempts: 1

- id: public-api-input-expectation-expansion
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: Expand the knowledge map from AKS public API specs and public docs with clear source roles. Use public API/spec primarily to identify missing input variables, domains, request shapes, operations, mutability, and constraints. Use public docs primarily to identify expectation variables, intended behavior, prerequisites, lifecycle, validation rules, and user-visible outcomes. Then propose feature candidates only where a meaningful subset/intersection of input and expectation space exists, preferably anchored by existing developer-written e2ev3 checks. Start from `outputs/aks-public-api-scenario-candidates.md` and the current capability model. Produce an artifact under `outputs/` with proposed model additions and the evidence source for each proposal. Do not execute cloud probes in this task; this is map-building and candidate design.
  depends_on: [node-restriction-source-spec-investigation]
  attempts: 1

- id: high-density-probe-plan
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: After the knowledge foundation, e2ev3 inventory, and public API expansion are done, select the next execution probes by coverage value. Produce an artifact under `outputs/` ranking candidate probes by input paths covered, expectation paths checked, cost/risk, uncertainty reduced, and whether they explore a dark-side region we have never reached. The output should recommend the next one or two concrete runs with exact first commands and expected model updates.
  depends_on: [public-api-input-expectation-expansion]
  attempts: 1

- id: model-driven-probe-selection
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Produce `outputs/iteration75-model-driven-probe-selection.md`, a ranked next-probe matrix derived from the validated capability model's failing/unknown features, public API/docs candidates, handwritten e2ev3 intent, and existing evidence. Include candidate coverage, input paths, expectation paths, anchors, cost/risk, and a final recommended next probe. Also update `outputs/input-expectation-knowledge-map.md` with the top 3 high-density probe recommendations. Do not run staging/cloud probes.
  depends_on: [high-density-probe-plan]
  attempts: 1

- id: workload-identity-oidc-runtime-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: Execute the selected high-density probe — Workload Identity + OIDC runtime token/discovery in staging. Produce `outputs/iteration76-workload-identity-oidc-runtime-staging.md` with exact inputs, commands, OIDC discovery/JWKS evidence, Linux pod token-projection evidence, verdicts for `workload-identity-runtime-token-projection` and one OIDC runtime branch, cleanup status, and capability-model update/validator output if a clear verdict is reached. Do not combine this run with KEDA/VPA, App Routing, Windows token projection, signing-key rotation, or post-delete issuer cleanup.
  depends_on: [model-driven-probe-selection]
  attempts: 1

- id: keda-vpa-runtime-staging
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Source-scope and execute the next ranked high-density runtime probe — Combined KEDA/VPA runtime in staging. Produce `outputs/iteration78-workload-autoscaler-runtime-staging.md` with source-derived input/expectation paths, explicit non-goals, exact devbox/staging commands, KEDA runtime scaling evidence, VPA runtime recommendation/component evidence, cleanup status, and capability-model/knowledge-map updates if clear verdicts are reached. Do not combine this run with App Routing TLS, Identity/OIDC residuals, Image Cleaner, Node Restriction, upgrade/HA/cert-renewal branches, or unrelated probes.
  depends_on: [workload-identity-oidc-runtime-staging]
  attempts: 1

- id: app-routing-tls-source-hypothesis
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: Investigate the App Routing DefaultDomainCertificate TLS-secret failure from source before any rerun. Produce `outputs/iteration80-app-routing-tls-source-hypothesis.md` comparing iteration70's CR/input and observed missing-secret behavior against App Routing controller/source-required preconditions, then decide whether the next step is a corrected focused rerun or owner escalation. Do not run staging/cloud probes in this task.
  depends_on: [keda-vpa-runtime-staging]
  attempts: 1

- id: vpa-model-split-and-rerank
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: Split VPA runtime evidence into branch-accurate model features (VPA components/recommendations passed, in-place update/HA/cert-renewal/upgrade unknown) and rerank the next cloud probe. Produce `outputs/iteration79-vpa-runtime-model-split.md`, update `outputs/e2e-capability-model.json` and `outputs/input-expectation-knowledge-map.md`, validate the model. No staging/cloud probes.
  depends_on: [app-routing-tls-source-hypothesis]
  attempts: 1

- id: app-routing-tls-corrected-rerun
  status: done
  result: superseded
  assignee: aks-explorer
  goal: Superseded by `outputs/iteration80-app-routing-tls-source-hypothesis.md`: the source hypothesis did not identify a corrected customer CR/input and selected owner escalation before any rerun. Do not dispatch a staging rerun from this task.
  depends_on: [vpa-model-split-and-rerank]
  attempts: 0

- id: app-routing-tls-owner-escalation-packet
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Convert `outputs/iteration80-app-routing-tls-source-hypothesis.md` into a concise owner-escalation packet and project decision artifact. Produce `outputs/iteration81-app-routing-tls-owner-escalation.md` with the exact failing contract, iteration70 evidence, source-derived fault-domain ranking, minimum CCP/default-domain-svc diagnostics needed, and a clear next-step decision: wait for owner/fixed build, run a diagnostic rerun with underlay access, or pivot to another high-density non-blocked feature. Do not run staging/cloud probes in this task.
  depends_on: [vpa-model-split-and-rerank]
  attempts: 1

- id: post-app-routing-escalation-next-probe-selection
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: Produce `outputs/iteration82-post-escalation-next-probe-selection.md`: pick the next non-blocked high-value feature path after App Routing TLS escalation. Start from `outputs/input-expectation-knowledge-map.md`, `outputs/e2e-capability-model.json`, `outputs/iteration81-app-routing-tls-owner-escalation.md`, and current failing/unknown feature lists. Rank at least three candidates by input paths covered, expectation paths checked, cost/risk, required access, and whether the work can proceed without waiting on App Routing owner/CCP diagnostics. End with one concrete next task recommendation and any model/knowledge-map update needed. Do not run staging/cloud probes in this task.
  depends_on: [app-routing-tls-owner-escalation-packet]
  attempts: 0

- id: node-restriction-full-put-disable-probe
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: Execute the Node Restriction corrected full-PUT disable contract probe in staging. Start from `outputs/node-restriction-source-spec-investigation.md`, `outputs/iteration74-node-restriction-source-spec-resolution.md`, and `outputs/iteration62-security-profile-staging.md`. Use a staging cluster with Node Restriction enabled, then attempt disable via full PUT (not PATCH) with the source-resolved correct request shape. Also probe runtime-default behavior to determine whether the feature has a default state when not explicitly set. Produce `outputs/iteration83-node-restriction-full-put-disable-staging.md` with exact commands, request bodies, API version, response evidence, runtime kubectl checks if applicable, cleanup status, and verdict table. Update `outputs/e2e-capability-model.json` only for branches that receive clear pass/fail evidence; run `cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json` if the model changes.
  depends_on: [post-app-routing-escalation-next-probe-selection]
  attempts: 1

- id: managedsystem-feature-intent-source-anchors
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Build the ManagedSystem Pool feature-intent source map. Read devbox source under /home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/managedsystem*.go, /home/hayua/rp/test/e2ev3/validate/agent_pool/managedsystem_pool.go, /home/hayua/rp/test/e2ev3/handlers/azure/azcontainerservice/clean_managedsystem_pool.go, and .claude/skills/test-managedsystem-pool/. Produce outputs/managedsystem-pool-feature-intent.md explaining feature meaning, source paths, behavior each path contributes, scenario inventory, source-intended vs observed behavior separation, and unknowns."
  depends_on: [node-restriction-full-put-disable-probe]
  attempts: 1

- id: managedsystem-api-doc-boundary
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Build the ManagedSystem Pool API/docs boundary. Use public AKS API/spec as input-space source and public docs/design references as expectation-space source. Produce outputs/managedsystem-pool-api-doc-boundary.md answering what enables the feature, what must not be sent, API/RP vs CLI contract distinction, and missing doc/design links."
  depends_on: [node-restriction-full-put-disable-probe]
  attempts: 1

- id: managedsystem-evidence-state-matrix
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Audit ManagedSystem Pool states from existing artifacts and the capability model. Produce outputs/managedsystem-pool-evidence-state-matrix.md covering standalone e2ev3 enable, staging REST add, staging CLI create/add, mode immutability, delete, and unknown/exploring runtime behaviors with linked raw evidence. Read first: outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, outputs/iteration24-managedsystem-pool-pass.md, outputs/iteration56-managedsystem-staging-refresh.md, outputs/20260519T1646Z-managedsystem-priority-staging.md, outputs/managedsystem-pool-exploration.md, outputs/iteration53-managedsystem-pool-inventory-and-blocker.md."
  depends_on: [node-restriction-full-put-disable-probe]
  attempts: 1

- id: managedsystem-agent-repro-pack
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Convert the known ManagedSystem Pool checks into an agent-consumable repro pack. Produce outputs/managedsystem-pool-repro-pack.md with placeholder-based commands for minimal ARM REST add, polling/show, CLI create diagnostic, CLI add diagnostic, delete, post-delete verification, optional e2ev3 entry, cleanup guidance, and async cleanup/leak risk. Do not execute the checks."
  depends_on: [node-restriction-full-put-disable-probe]
  attempts: 1

- id: managedsystem-related-resource-context
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Build the related-resource context for ManagedSystem Pool. Produce outputs/managedsystem-pool-related-context.md covering managed cluster, agent pool, VirtualMachines type, node status, node taints, critical add-ons, and VAP/VAP bindings. Separate ManagedSystem from generic VirtualMachines pools, Node Auto Provisioning, normal System pools, and CLI preview behavior."
  depends_on: [node-restriction-full-put-disable-probe]
  attempts: 1

- id: managedsystem-feature-standard-packet
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Integrate the ManagedSystem Pool parallel artifacts into one standard feature packet. Read outputs/managedsystem-pool-feature-intent.md, outputs/managedsystem-pool-api-doc-boundary.md, outputs/managedsystem-pool-evidence-state-matrix.md, outputs/managedsystem-pool-repro-pack.md, and outputs/managedsystem-pool-related-context.md. Produce outputs/managedsystem-pool-feature-standard.md as the integrated packet. Update outputs/e2e-capability-model.json only for unambiguous model additions, then run the capability-model validator. The packet should be reusable as the template for the next feature, explain the feature without hiding uncertainty, and name the next concrete action."
  depends_on: [managedsystem-related-resource-context]
  attempts: 1

- id: managedsystem-disable-migration-runtime-probe
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Execute the ManagedSystem Pool delete/disable migration runtime probe in staging. Start from outputs/managedsystem-pool-feature-standard.md and outputs/managedsystem-pool-repro-pack.md. Create a normal baseline cluster, add ManagedSystem via the proven minimal ARM REST payload, verify critical add-ons run on nodes labelled kubernetes.azure.com/mode=managed-system, delete the ManagedSystem pool, verify the pool is NotFound, and verify coredns, metrics-server, konnectivity-agent, and coredns-autoscaler migrate back to nodes labelled kubernetes.azure.com/mode=system. Produce outputs/iteration86-managedsystem-disable-migration-runtime-staging.md with exact commands, API version, Kubernetes object snippets, delete timing, cleanup status, and a verdict table. Update outputs/e2e-capability-model.json only if managedsystem-disable-migration gets clear evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. Do not rerun known CLI create/add failures or combine this with second-pool, reconcile, App Routing, Image Cleaner, KEDA/VPA, Workload Identity, or Node Restriction."
  depends_on: [managedsystem-feature-standard-packet]
  attempts: 2

- id: managedsystem-disable-migration-checkpointed-rerun
  result: dropped
  status: done
  assignee: aks-explorer
  goal: "Complete the checkpointed ManagedSystem Pool migration evidence. Check for interrupted-run resources (msmig* resource groups on devbox), then run a phase-logged staging script that creates a normal baseline cluster, adds one ManagedSystem pool via proven minimal ARM REST payload (api-version=2025-04-02-preview), records critical add-on placement on managed-system nodes (coredns, metrics-server, konnectivity-agent, coredns-autoscaler), deletes the ManagedSystem pool, verifies NotFound, records the same add-ons on system nodes, cleans up the resource group with --no-wait, and updates the capability model only if managedsystem-disable-migration is clearly resolved. Each phase must checkpoint to a devbox log file so interruption preserves partial evidence. Produce outputs/iteration88-managedsystem-disable-migration-checkpointed.md."
  depends_on: [managedsystem-disable-migration-runtime-probe]
  attempts: 2
  dropped_reason: "Two checkpointed staging attempts preserved evidence and cleanup status but both failed in wait_pool before placement: RP selected Standard_D8pds_v5 (Arm64-only) with an x64 Ubuntu image. Dropped to avoid another long retry until the staging SKU/image default is fixed or an owner provides an allowed override; iteration86 remains the model evidence for managedsystem-disable-migration."

- id: app-routing-tls-gated-followup-tracker
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Create outputs/iteration91-app-routing-tls-gated-followup-tracker.md as a local gated follow-up tracker for App Routing DefaultDomainCertificate TLS-secret provisioning. Start from outputs/iteration81-app-routing-tls-owner-escalation.md, outputs/iteration80-app-routing-tls-source-hypothesis.md, outputs/iteration70-app-routing-defaultdomain-tls-staging.md, and the current capability model validator summary. Record the failing valid-input contract, evidence links, owner questions, diagnostic data needed, allowed rerun triggers, explicit no-blind-rerun rule, and the project state/task recommendation after this tracker is complete. Do not run staging, az, kubectl, cluster creation, or cloud probes; this is tracker/bookkeeping only. Update project.md afterward to reflect the next correct state."
  depends_on: [managedsystem-disable-migration-checkpointed-rerun]
  attempts: 1

- id: next-model-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration92-next-model-unknown-selection.md as a local selection artifact for the next non-blocked model-unknown branch. Start from outputs/input-expectation-knowledge-map.md, outputs/iteration75-model-driven-probe-selection.md, outputs/e2e-capability-model.json, and the current validator unknown list. Rank a small set of viable unknowns by input paths covered, expectation paths checked, source/e2ev3 anchor, cost/risk, required access, and gating/non-goals. End with one concrete recommended branch, exact first commands or preflight reads for a later execution task, and expected model/knowledge-map update. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [app-routing-tls-gated-followup-tracker]
  attempts: 1

- id: vpa-residual-runtime-staging
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Execute the VPA residual runtime probe in staging as selected by outputs/iteration92-next-model-unknown-selection.md. Focus on in-place update behavior, Helm metadata/ownership, and HA/leader-election evidence. Start from outputs/iteration78-workload-autoscaler-runtime-staging.md (VPA components/recommendations pass), outputs/iteration79-vpa-runtime-model-split.md (branch split), and the iteration92 preflight commands. Produce outputs/iteration93-vpa-residual-runtime-staging.md with source preflight, exact devbox/staging commands, in-place update evidence, Helm chart metadata, leader-election evidence, cleanup status, and capability-model/knowledge-map updates if clear verdicts are reached. Do not combine with cert-renewal, upgrade-survival, App Routing, Image Cleaner, KEDA, or unrelated probes."
  depends_on: [next-model-unknown-selection]
  attempts: 1

- id: post-image-cleaner-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration96-post-image-cleaner-unknown-selection.md selecting the next non-blocked model-unknown branch after Image Cleaner vulnerable-image erasure passed. Start from outputs/input-expectation-knowledge-map.md, outputs/e2e-capability-model.json, outputs/iteration94-next-model-unknown-selection.md, and the current validator unknown list (20 unknowns). Rank VPA cert renewal/upgrade survival, Workload Identity Windows, OIDC post-delete cleanup, and at least two other viable unknowns by input paths covered, expectation paths checked, source/e2ev3 anchor, cost/risk, required access, and gating status. End with one concrete recommended branch, exact preflight reads for a later execution task, and expected model/knowledge-map update. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [image-cleaner-vulnerable-erasure-staging]
  attempts: 1

- id: oidc-post-delete-cleanup-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute the OIDC default-enabled post-delete issuer cleanup staging probe selected by outputs/iteration96-post-image-cleaner-unknown-selection.md. Start from outputs/iteration76-workload-identity-oidc-runtime-staging.md, outputs/iteration77-identity-runtime-model-consolidation.md, outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and the iteration96 preflight commands. Before creating any cluster, confirm from devbox source the exact Kubernetes version branch for default-enabled OIDC issuer, discovery and JWKS URL construction, expected post-delete HTTP status/body/error shape, source wait budget and polling interval, whether source deletes the resource group or managed cluster and waits for ARM deletion, and any skip/cloud-environment conditions. Then create a small staging cluster on Kubernetes >=1.34, capture ARM OIDC profile and issuer URL, prove discovery/JWKS reachable before delete, delete the source-equivalent cluster/resource group, wait for the source-required ARM deletion point, poll discovery/JWKS until the source-expected post-delete status appears or budget expires, clean up, and produce outputs/iteration97-oidc-post-delete-cleanup-staging.md with exact commands, raw evidence snippets, cleanup status, and a verdict table. Update outputs/e2e-capability-model.json only if oidc-issuer-default-enabled-post-delete-cleanup gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. Do not combine with OIDC signing-key rotation, v1.33 explicit-enable runtime, Windows Workload Identity, VPA/KEDA, App Routing, ManagedSystem, Image Cleaner upgrade/restart, or unrelated probes."
  depends_on: [post-image-cleaner-unknown-selection]
  attempts: 2

- id: post-oidc-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration98-post-oidc-unknown-selection.md selecting the next non-gated model-unknown branch after OIDC default-enabled post-delete cleanup passed. Start from outputs/iteration97-oidc-post-delete-cleanup-staging.md, outputs/iteration96-post-image-cleaner-unknown-selection.md, outputs/input-expectation-knowledge-map.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, and the current validator unknown list (19 unknowns). Rank Workload Identity Windows, VirtualMachines mixed-SKU REST scale, VPA cert renewal/upgrade survival, Image Cleaner upgrade/restart survival, bootstrap profile lifecycle, OIDC signing-key rotation/v1.33 explicit-enable, and any other viable non-gated unknowns by input paths covered, expectation paths checked, source/e2ev3 anchor, cost/risk, required access, and gating status. End with one concrete recommended branch, exact preflight reads for a later execution task, and expected model/knowledge-map update. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [oidc-post-delete-cleanup-staging]
  attempts: 1

- id: oidc-v133-explicit-enable-staging
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Execute the OIDC v1.33 explicit-enable discovery/JWKS staging probe selected by outputs/iteration98-post-oidc-unknown-selection.md. Start from outputs/iteration98-post-oidc-unknown-selection.md, outputs/iteration97-oidc-post-delete-cleanup-staging.md, outputs/iteration76-workload-identity-oidc-runtime-staging.md, outputs/iteration77-identity-runtime-model-consolidation.md, outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/e2e-capability-model.json. Before creating any cluster, confirm from devbox source the exact Scenario_OIDC_Issuer_v133 Kubernetes 1.33.x selector, initial OIDC disabled/nil profile expectation, managed-cluster update path/payload for enabling OIDC, discovery and JWKS URL construction, expected post-enable HTTP/key/body shape, and any skip or feature-gate conditions. Then create one small Kubernetes 1.33.x staging cluster without explicit OIDC enablement, capture ARM OIDC profile before update, enable OIDC via the source-equivalent update path, capture ARM OIDC profile after update, prove discovery/JWKS reachability and key shape, clean up the resource group, and produce outputs/iteration99-oidc-v133-explicit-enable-staging.md with exact commands, raw evidence snippets, cleanup status, and a verdict table. Update outputs/e2e-capability-model.json only if oidc-issuer-v133-explicit-enable-runtime gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. If Kubernetes 1.33.x is unavailable or source semantics cannot be resolved, write a blocker artifact instead of changing the model. Do not combine with OIDC signing-key rotation, post-delete cleanup, Workload Identity Windows, VPA/KEDA, App Routing, ManagedSystem, Image Cleaner, VirtualMachines, Machines, bootstrap, or unrelated probes."
  depends_on: [post-oidc-unknown-selection]
  attempts: 1

- id: post-oidc-v133-unknown-selection
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration100-post-oidc-v133-unknown-selection.md selecting the next non-gated model-unknown branch after OIDC v1.33 explicit-enable runtime passed. Start from outputs/iteration99-oidc-v133-explicit-enable-staging.md, outputs/iteration98-post-oidc-unknown-selection.md, outputs/input-expectation-knowledge-map.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, and the current validator unknown list (18 unknowns). Rank remaining viable unknowns by source/e2ev3 anchor, input paths, expectation paths, cost/risk, required access, and gating status. End with one concrete recommended branch, exact preflight reads for a later execution task, and expected model/knowledge-map update. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [oidc-v133-explicit-enable-staging]
  attempts: 1

- id: virtualmachines-mixed-sku-rest-scale-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute the VirtualMachines mixed-SKU REST scale transition staging probe selected by outputs/iteration100-post-oidc-v133-unknown-selection.md. Start from outputs/iteration100-post-oidc-v133-unknown-selection.md, outputs/iteration64-virtualmachines-agentpool-staging.md, outputs/iteration65-virtualmachines-multisku-contract.md, outputs/iteration66-virtualmachines-manual-scale-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/e2e-capability-model.json. Before creating any cluster, confirm from devbox source the exact Scenario_Mixed_SKU_Scale source steps, API version(s), baseline cluster shape, additional VirtualMachines pool create payload, AgentPool PUT vs ManagedCluster PUT scale transitions, expected virtualMachinesProfile.scale.manual[] arrays, node count/VM-size assertions, wait budgets, cleanup shape, feature gates, and SKU/location selection criteria. Then create only the minimal source-equivalent staging resources, execute the bounded REST/PUT mixed-SKU scale sequence, capture request/response bodies, ARM state, profile/node assertions, cleanup status, and produce outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md with a verdict table. Update outputs/e2e-capability-model.json only if virtualmachines-mixed-sku-rest-scale gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. If source/API-version/SKU/preflight blocks a source-equivalent run, write a blocker artifact instead of changing the model. Do not combine with Machines API CRUD, NAP default Machines pool cleanup, VirtualMachines autoscaled VMs upgrade, CLI comma-multi-SKU revalidation, OIDC, ManagedSystem, App Routing, bootstrap, VPA, Image Cleaner, or unrelated probes."
  depends_on: [post-oidc-v133-unknown-selection]
  attempts: 1

- id: post-virtualmachines-unknown-selection
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration102-post-virtualmachines-unknown-selection.md selecting the next non-gated model-unknown branch after VirtualMachines mixed-SKU REST scale passed. Start from outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/iteration100-post-oidc-v133-unknown-selection.md, outputs/iteration76-workload-identity-oidc-runtime-staging.md, outputs/iteration77-identity-runtime-model-consolidation.md, outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md, outputs/input-expectation-knowledge-map.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, and the current validator unknown list (17 unknowns). Rank remaining viable unknowns by source/e2ev3 anchor, input paths, expectation paths, cost/risk, required access, and gating status. End with one concrete recommended branch, exact preflight reads for a later execution task, and expected model/knowledge-map update. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [virtualmachines-mixed-sku-rest-scale-staging]
  attempts: 1

- id: workload-identity-windows-token-projection-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute the Workload Identity Windows token-projection staging probe selected by outputs/iteration102-post-virtualmachines-unknown-selection.md. Start from outputs/iteration102-post-virtualmachines-unknown-selection.md, outputs/iteration76-workload-identity-oidc-runtime-staging.md, outputs/iteration77-identity-runtime-model-consolidation.md, outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/e2e-capability-model.json. Before creating any cluster, confirm from devbox source the exact Scenario_WorkloadIdentity Windows branch steps, create-time cluster shape, Windows admin profile, Windows node-pool creation request/CLI/API path, node size/count and wait budgets, federated identity credential and service-account subject/audience, Windows pod image/command, expected azure-wi env vars, projected token file path, token decode expectations, skip conditions, feature gates, cloud/environment gates, Windows SKU/location capacity constraints, and cleanup shape. Then create only the minimal source-equivalent staging resources, execute the bounded Windows token-projection check, capture command inputs, ARM state, Kubernetes object/pod evidence, decoded token issuer/audience/subject, cleanup status, and produce outputs/iteration103-workload-identity-windows-token-projection-staging.md with a verdict table. Update outputs/e2e-capability-model.json only if workload-identity-runtime-token-projection-windows gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. If source/capacity/API preflight blocks a source-equivalent run, write a blocker artifact instead of changing the model. Do not combine with OIDC signing-key rotation, post-delete cleanup, v1.33 explicit-enable revalidation, Workload Identity disable/re-enable lifecycle, Linux token revalidation beyond setup sanity, upgrade survival, VPA/KEDA, App Routing, ManagedSystem, VirtualMachines, Machines, bootstrap, or unrelated probes."
  depends_on: [post-virtualmachines-unknown-selection]
  attempts: 1

- id: image-cleaner-vulnerable-erasure-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute the Image Cleaner vulnerable-image erasure staging probe selected by outputs/iteration94-next-model-unknown-selection.md. Start from outputs/iteration86-image-cleaner-runtime-source-gated-staging.md, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, and the iteration94 preflight commands. Before creating any cluster, confirm from devbox source the vulnerable image constant, node/containerd run-command inspection path, eraser collector selector, and source wait budget. Then create a small staging cluster with Image Cleaner enabled, disable Image Cleaner, pull/prove the vulnerable image exists on nodes while disabled, re-enable Image Cleaner, wait for eraser collectors to complete, prove the vulnerable image is absent, clean up the resource group, and produce outputs/iteration95-image-cleaner-vulnerable-erasure-staging.md with exact commands, raw evidence snippets, cleanup status, and a verdict table. Update outputs/e2e-capability-model.json only if image-cleaner-vulnerable-image-erasure gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. Do not combine with Image Cleaner upgrade/restart survival, VPA/KEDA, Workload Identity/OIDC, App Routing, ManagedSystem, Node Restriction, bootstrap, VirtualMachines, or unrelated probes."
  depends_on: [vpa-residual-runtime-staging]
  attempts: 2

- id: post-wi-windows-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration104-post-wi-windows-unknown-selection.md selecting the next non-gated model-unknown branch after Workload Identity Windows token projection passed. Start from outputs/iteration103-workload-identity-windows-token-projection-staging.md, outputs/iteration102-post-virtualmachines-unknown-selection.md, outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/input-expectation-knowledge-map.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, and the current validator unknown list (16 unknowns). Rank remaining viable unknowns by source/e2ev3 anchor, input paths, expectation paths, cost/risk, required access, gating status, and expected model update. End with one concrete recommended branch, exact preflight reads for a later execution task, and explicit non-goals. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [workload-identity-windows-token-projection-staging]
  attempts: 1

- id: machines-agentpool-api-crud-staging
  result: failed
  status: done
  assignee: aks-explorer
  goal: "Execute the Machines AgentPool API CRUD staging probe selected by outputs/iteration104-post-wi-windows-unknown-selection.md. Start from outputs/iteration104-post-wi-windows-unknown-selection.md, outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/iteration102-post-virtualmachines-unknown-selection.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/e2e-capability-model.json. Before creating any cluster, confirm from devbox source the exact Scenario_MachinesAgentPool steps and non-goals, API versions for ManagedCluster/AgentPool/Machine operations, required custom feature headers/provider features, baseline cluster shape, Machines-mode agent-pool create request and expected persisted fields, Machine create/get/update/list/delete request/response shapes, unsupported UltraSSD negative path and expected error, skip conditions, SKU/location/zone constraints, preview API availability checks, wait budgets, and cleanup shape. Then create only the minimal source-equivalent staging resources, execute the bounded Machines-mode agent-pool and Machine API CRUD sequence, capture request/response bodies, ARM state, Machine API evidence, unsupported UltraSSD rejection evidence if source-required, cleanup status, and produce outputs/iteration105-machines-agentpool-api-crud-staging.md with a verdict table. Update outputs/e2e-capability-model.json only if machines-agentpool-api-crud gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. If source/API-version/custom-feature/SKU/preflight blocks a source-equivalent run, write a blocker artifact instead of changing the model or pivoting. Do not combine with machines-agentpool-nap-default-pool-cleanup, virtualmachines-autoscaled-vms-crud, VirtualMachines CLI comma multi-SKU revalidation, OIDC, ManagedSystem, App Routing, bootstrap, VPA, Image Cleaner, or unrelated probes."
  depends_on: [post-wi-windows-unknown-selection]
  attempts: 2

- id: machines-agentpool-api-crud-eastus2-retry
  result: failed
  status: done
  assignee: aks-explorer
  goal: "Retry the same Machines AgentPool API CRUD branch after outputs/iteration105-machines-agentpool-api-crud-staging.md blocked at westus2 baseline cluster creation before any Machines API calls. Start from outputs/iteration105-machines-agentpool-api-crud-staging.md and agents/aks-explorer/workspace/iteration105-machines-probe-v2.sh. First verify no leftover mach105-* resource groups from iteration105. Reuse the source-derived Scenario_MachinesAgentPool request/expectation shapes and non-goals; do not redo broad selection. Adjust only the baseline environment/SKU selection, preferring eastus2 with Standard_D2s_v4 (known-good from iteration103) or e2ev3 dynamic sku.DefaultClaim/availability-zone logic. If the baseline cluster reaches Succeeded, execute the bounded source-shaped Machines sequence: source initial machinesap0 if needed, plan-created machinesap1, Machine create/get/update/list/delete, UltraSSD positive and negative path, Machines agent-pool delete, cleanup, and verdict table. Update outputs/e2e-capability-model.json only if machines-agentpool-api-crud gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. If baseline creation, source API-version equivalence, custom headers/features, Machine API, UltraSSD SKU/location, or cleanup blocks again, append/update outputs/iteration105-machines-agentpool-api-crud-staging.md or create a follow-up artifact with exact command/output evidence and cleanup status instead of pivoting. Do not combine with machines-agentpool-nap-default-pool-cleanup, virtualmachines-autoscaled-vms-crud, VirtualMachines CLI comma multi-SKU revalidation, OIDC, ManagedSystem, App Routing, bootstrap, VPA, Image Cleaner, or unrelated probes."
  depends_on: [machines-agentpool-api-crud-staging]
  attempts: 1

- id: post-machines-blocker-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration106-post-machines-blocker-unknown-selection.md selecting the next responsible non-gated model-unknown branch after Machines AgentPool API CRUD became blocked on missing Machine preview subscription features. Start from outputs/iteration105-machines-agentpool-api-crud-staging.md (including the iteration106 eastus2 retry follow-up), outputs/iteration104-post-wi-windows-unknown-selection.md, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, and outputs/e2e-capability-model.json. Run the local capability-model validator and use the current lists of failing, blocked, and unknown features. Rank remaining viable unknowns by source/e2ev3 anchor, input paths, expectation paths, cost/risk, required access, gating status, and expected model update. Treat machines-agentpool-api-crud as blocked until Microsoft.ContainerService/PutMachinePreview and Microsoft.ContainerService/DeleteSpecificMachinesPreview are registered or an equivalent source environment is provided; do not select a blind Machines rerun. End with either one concrete parser-visible execution task for the selected branch or a waiting/blocked project-state recommendation with explicit resume condition. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [machines-agentpool-api-crud-eastus2-retry]
  attempts: 1

- id: vpa-cert-renewal-runtime-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute the VPA certificate renewal runtime staging probe selected by outputs/iteration106-post-machines-blocker-unknown-selection.md. Start from outputs/iteration106-post-machines-blocker-unknown-selection.md, outputs/iteration93-vpa-residual-runtime-staging.md, outputs/iteration79-vpa-runtime-model-split.md, outputs/iteration78-workload-autoscaler-runtime-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/e2e-capability-model.json. Before creating any cluster, run the local validator and confirm from devbox source the exact Scenario_Overlay_VPA cert-renewal branch/handler, Kubernetes version/cloud/OS/arch gates, VPA addon input shape, custom feature requirements if any, VPA webhook/secret names and labels, initial certificate shape, cert mutation payload, wait budgets, polling intervals, expected renewal/recovery criteria, post-renewal VPA deployment/webhook/workload checks, and cleanup shape. Then create only the minimal source-compatible VPA-enabled staging resources, execute the bounded cert-renewal mutation and wait loop, capture ARM state, Kubernetes secret/cert evidence before and after mutation, VPA deployment/webhook health, cleanup status, and produce outputs/iteration107-vpa-cert-renewal-runtime-staging.md with a verdict table. Update outputs/e2e-capability-model.json only if workload-autoscaler-vpa-cert-renewal-runtime gets clear pass/fail/blocker evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. If source semantics, version gates, permissions, or staging capacity block a source-equivalent run, write a blocker artifact instead of changing scope. Do not combine with VPA upgrade survival, KEDA, Image Cleaner upgrade/restart, VirtualMachines autoscaled upgrade, bootstrap ACR lifecycle, Workload Identity/OIDC, App Routing, ManagedSystem, Machines, NAP, Node Restriction, or unrelated probes."
  depends_on: [post-machines-blocker-unknown-selection]
  attempts: 1

- id: post-vpa-blocker-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration108-post-vpa-blocker-unknown-selection.md selecting the next responsible non-gated model-unknown branch after VPA certificate renewal became blocked on missing source TLS-manager CronJob / source clarification. Start from outputs/iteration107-vpa-cert-renewal-runtime-staging.md, outputs/iteration106-post-machines-blocker-unknown-selection.md, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, and outputs/e2e-capability-model.json. Run the local capability-model validator and use the current failing, blocked, and unknown feature lists. Rank remaining viable unknowns by source/e2ev3 anchor, input paths, expectation paths, cost/risk, required access, gating status, and expected model update. Treat workload-autoscaler-vpa-cert-renewal-runtime as blocked until vpa-webhook-tls-reconciler exists or source clarification is provided; treat machines-agentpool-api-crud as blocked until PutMachinePreview and DeleteSpecificMachinesPreview are registered or equivalent environment is provided. End with one concrete parser-visible execution task or a waiting/blocked recommendation. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [vpa-cert-renewal-runtime-staging]
  attempts: 1

- id: virtualmachines-autoscaled-vms-crud-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute the VirtualMachines autoscaled VMs CRUD and upgrade staging probe selected by outputs/iteration108-post-vpa-blocker-unknown-selection.md. Start from outputs/iteration108-post-vpa-blocker-unknown-selection.md, outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/iteration65-virtualmachines-multisku-contract.md, outputs/iteration66-virtualmachines-manual-scale-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/e2e-capability-model.json. Before creating any cluster, run the local validator and confirm from devbox source the exact Scenario_Autoscaled_VMs_CRUD steps, baseline cluster/pool shape, API versions and/or CLI flags, request bodies, VM size/location/zone constraints, autoscale profile update sequence, persisted virtualMachinesProfile/profile/node assertions, source upgrade target logic, wait budgets, skip conditions, custom features/API availability checks, cleanup shape, and source-required health checks. Then create only the minimal source-equivalent staging resources, execute the bounded autoscale update sequence and source-required upgrade branch, capture request/response bodies, ARM state, profile/node assertions before and after upgrade, cleanup status, and produce outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md with a verdict table. Update outputs/e2e-capability-model.json only if virtualmachines-autoscaled-vms-crud gets clear pass/fail/blocker evidence, then run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts outputs/e2e-capability-model.json. If source/API-version/SKU/capacity/upgrade preflight blocks a source-equivalent run, write a blocker artifact instead of changing scope. Do not combine with Machines API CRUD, NAP default Machines pool cleanup, VirtualMachines CLI comma multi-SKU revalidation, completed mixed-SKU/manual/CLI checks beyond source-required setup sanity, OIDC/Workload Identity, App Routing, ManagedSystem, bootstrap, Image Cleaner, VPA/KEDA, Node Restriction, or unrelated probes."
  depends_on: [post-vpa-blocker-unknown-selection]
  attempts: 1

- id: post-vmauto-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration110-post-vmauto-unknown-selection.md selecting the next responsible non-gated model-unknown branch after outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md moved virtualmachines-autoscaled-vms-crud to pass. Start from outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md, outputs/iteration108-post-vpa-blocker-unknown-selection.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, and outputs/input-expectation-knowledge-map.md. Run the local capability-model validator and rank remaining viable unknowns by source/e2ev3 anchor, input paths, expectation paths, cost/risk, access, gates, and expected model update. Preserve existing blockers and gates for VPA cert renewal, Machines/Machine API/NAP cleanup, App Routing TLS/Istio, ManagedSystem gated branches, OIDC signing-key rotation, and Node Restriction tag-only PATCH. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task. End with one parser-visible execution task or a precise blocked/waiting recommendation."
  depends_on: [virtualmachines-autoscaled-vms-crud-staging]
  attempts: 1

- id: image-cleaner-upgrade-restart-survival-staging
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Execute the Image Cleaner upgrade/restart survival staging probe selected by outputs/iteration110-post-vmauto-unknown-selection.md. Start from outputs/iteration110-post-vmauto-unknown-selection.md, outputs/iteration86-image-cleaner-runtime-source-gated-staging.md, outputs/iteration95-image-cleaner-vulnerable-erasure-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/e2e-capability-model.json. Before creating any cluster, run the local validator and confirm from devbox source the exact Scenario_ImageCleaner step order, source-required versus source-skipped survival branches, Kubernetes version and upgrade target logic, restart/stop-start semantics, skip conditions, Image Cleaner enablement shape, interval value, feature/header/API requirements, expected ARM persisted state, component/resource assertions after create/upgrade/restart, whether vulnerable-image erasure is rechecked after survival, wait budgets, failure classification, and cleanup shape. Then create only the minimal source-equivalent staging resources, execute the bounded source upgrade branch and restart/stop-start branch only if source-supported, capture request/response bodies, ARM state, Kubernetes/resource assertions, wait outcomes, cleanup status, and produce outputs/iteration111-image-cleaner-upgrade-restart-survival-staging.md with a verdict table. Update outputs/e2e-capability-model.json only if image-cleaner-upgrade-restart-survival gets clear pass/fail/blocker evidence, then run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts outputs/e2e-capability-model.json. If source semantics, feature/API/version availability, SKU/capacity, restart/stop-start support, or cleanup blocks a source-equivalent run, write a blocker artifact instead of changing scope. Do not combine with VPA/KEDA, bootstrap, identity/OIDC, VirtualMachines, Machines/NAP, App Routing, ManagedSystem, Node Restriction, or unrelated probes."
  depends_on: [post-vmauto-unknown-selection]
  attempts: 1

- id: managedsystem-reference-backed-ts-probe
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Create, execute, and self-review the first reference-backed TypeScript probe experiment. Use ManagedSystem Pool as the worked feature. Start from execution/README.md, features/README.md, run-plans/README.md, probes/README.md, outputs/managedsystem-pool-feature-standard.md, outputs/managedsystem-pool-feature-intent.md, outputs/managedsystem-pool-api-doc-boundary.md, outputs/managedsystem-pool-evidence-state-matrix.md, outputs/managedsystem-pool-repro-pack.md, outputs/managedsystem-pool-related-context.md, outputs/e2e-capability-model.json, and the relevant Go e2ev3 source references already captured in the ManagedSystem artifacts. Produce a stable feature reference packet under features/, one reviewable run plan under run-plans/, and one executable TypeScript probe under probes/. The probe header must cite source Go paths, design/API/user-doc references or explicitly mark missing references, feature IDs, input paths, expectation paths, allowed execution surfaces, expected cluster lifecycle count, evidence outputs, and failure-diagnosis rules. After local/reference preflight succeeds, run the probe. Produce execution evidence under outputs/ and a self-review artifact explaining whether the probe process and result honestly reflected the learned Go test intent. If credentials, capacity, API availability, or environment gates block execution, record precise blocker evidence and cleanup status instead of waiting for human review."
  depends_on: [image-cleaner-upgrade-restart-survival-staging]
  attempts: 1

- id: ts-probe-process-review-and-replan
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration113-ts-probe-process-review-and-replan.md as a local-only post-probe review/replan artifact. Start from outputs/iteration112-managedsystem-rest-add-existing-managedsystem-rest-add-existing.md, outputs/iteration112-managedsystem-rest-add-existing-managedsystem-rest-add-existing.json, outputs/iteration112-managedsystem-rest-add-existing-managedsystem-rest-add-existing-self-review.md, execution/README.md, features/managedsystem-pool.yaml, run-plans/managedsystem-rest-add-existing.yaml, probes/managedsystem-rest-add-existing.ts, and outputs/e2e-capability-model.json. Judge whether the first reference-backed TS probe path honestly reflected source intent, preserved diagnosis clarity, emitted enough structured evidence, and revealed process fixes needed before generalizing. Decide one bounded next step: local probe/process refinement, the next single-case reference-backed TS probe for a non-gated feature, or the first small high-density run-plan design. Do not create cloud resources or rerun ManagedSystem REST add-existing unless the staging SKU/image blocker has a material trigger or the probe input changes to answer a distinct coverage question. End by updating project.md with the selected next parser-visible task or a clear waiting/blocker state."
  depends_on: [managedsystem-reference-backed-ts-probe]
  attempts: 1

- id: ts-probe-local-diagnostics-refinement
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration114-ts-probe-local-diagnostics-refinement.md and make the smallest local-only refinement needed before copying the TS probe pattern to more features. Start from outputs/iteration113-ts-probe-process-review-and-replan.md, iteration112 JSON/markdown/self-review, execution/README.md, run-plans/managedsystem-rest-add-existing.yaml, and probes/managedsystem-rest-add-existing.ts. Add or specify verdict-impact metadata for assertions, first-class environment blocker extraction from ARM status/error detail, bounded cleanup verification in JSON, shorter tool/environment version capture, and markdown rendering of blocker/cleanup/model-impact details from structured JSON. Do not create cloud resources or rerun ManagedSystem REST add-existing. End by updating project.md with either the next single-case reference-backed TS probe for a non-gated feature, the first small high-density run-plan design, or a clear waiting/blocker state."
  depends_on: [ts-probe-process-review-and-replan]
  attempts: 1

- id: vpa-upgrade-survival-reference-backed-ts-probe
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Create the next single-case reference-backed TypeScript probe for workload-autoscaler-vpa-upgrade-survival-runtime using the refined diagnostics pattern from outputs/iteration114-ts-probe-local-diagnostics-refinement.md and probes/managedsystem-rest-add-existing.ts. Start from execution/README.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, outputs/iteration78-workload-autoscaler-runtime-staging.md, outputs/iteration79-vpa-runtime-model-split.md, and outputs/iteration93-vpa-residual-runtime-staging.md. Inspect source-backed VPA upgrade/survival scenario intent before selecting exact inputs, upgrade target, waits, assertions, and cleanup. Create or update a VPA reference packet under features/ if needed, produce a reviewable run plan under run-plans/ and TS probe under probes/ before cloud mutation, use assertion verdictImpact, structured blockers from ARM status/error detail, bounded cleanup verification in JSON, short version capture, and markdown generated from structured blocker/cleanup/model-impact fields. Execute only after local/source/environment preflight is clean, produce structured evidence and self-review under outputs/, and update the capability model only for clear source-backed pass/fail/blocker evidence with validator success. Do not include gated VPA certificate renewal, KEDA, Image Cleaner, VirtualMachines, Machines/NAP, App Routing, ManagedSystem, Node Restriction, OIDC signing-key rotation, or unrelated probes."
  depends_on: [ts-probe-local-diagnostics-refinement]
  attempts: 1


- id: bootstrap-managed-acr-reference-backed-ts-probe
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Create the next single-case reference-backed TypeScript probe for bootstrap-profile-managed-acr-lifecycle using the refined diagnostics pattern from the ManagedSystem and VPA TS probes. Start from outputs/iteration116-post-vpa-ts-probe-selection.md, execution/README.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, and outputs/iteration63-bootstrap-profile-staging.md. Inspect devbox source for Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR, especially test/e2ev3/sigs/security/networkisolatedcluster/plans/bootstrap_profile.go and handlers that validate bootstrap profile state, image pulls, managed ACR cleanup, and Cache re-enable, before selecting exact inputs, API/CLI requirements, waits, assertions, and cleanup. Create or update a Bootstrap managed-ACR reference packet under features/, produce a reviewable run plan under run-plans/ and a TS probe under probes/ before any cloud mutation, use assertion verdictImpact, structured blockers from ARM status/error detail, bounded cleanup verification in JSON, short version capture, and markdown generated from structured blocker/cleanup/model-impact fields. Execute only after local/source/environment preflight is clean, produce structured evidence and self-review under outputs/, and update the capability model only for clear source-backed pass/fail/blocker evidence with validator success. Do not include BYO ACR registry switching, App Routing, ManagedSystem, VPA/KEDA, Image Cleaner, Workload Identity/OIDC, VirtualMachines, Machines/NAP, Node Restriction, or unrelated probes."
  depends_on: [vpa-upgrade-survival-reference-backed-ts-probe]
  attempts: 1

- id: bootstrap-byo-acr-reference-backed-ts-probe
  result: failed
  status: done
  assignee: aks-explorer
  goal: "Create the next single-case reference-backed TypeScript probe for bootstrap-profile-byo-acr-lifecycle using the refined diagnostics pattern from the ManagedSystem, VPA, and Bootstrap managed-ACR TS probes. Start from outputs/iteration116-bootstrap-managed-acr-lifecycle.md, features/bootstrap-profile-managed-acr-lifecycle.yaml, run-plans/bootstrap-profile-managed-acr-lifecycle.yaml, probes/bootstrap-profile-managed-acr-lifecycle.ts, execution/README.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, outputs/public-api-input-expectation-expansion.md, and outputs/iteration63-bootstrap-profile-staging.md. Inspect devbox source for Scenario_NetworkIsolatedCluster_Bootstrap_Profile_BYO_ACR, especially test/e2ev3/sigs/security/networkisolatedcluster/plans/bootstrap_profile.go and helpers/handlers that create BYO ACRs, assign roles, validate bootstrap profile state, validate image pulls, disable/re-enable Cache, switch registries, and clean up ACR resources, before selecting exact inputs, API/CLI requirements, waits, assertions, and cleanup. Create or update a Bootstrap BYO-ACR reference packet under features/, produce a reviewable run plan under run-plans/ and a TS probe under probes/ before any cloud mutation, use assertion verdictImpact, structured blockers from ARM status/error detail, bounded cleanup verification in JSON for both AKS and BYO ACR resources, short version capture, and markdown generated from structured blocker/cleanup/model-impact fields. Execute only after local/source/environment preflight is clean, produce structured evidence and self-review under outputs/, and update the capability model only for clear source-backed pass/fail/blocker evidence with validator success. Do not infer BYO behavior from the managed-ACR pass and do not combine this with App Routing, ManagedSystem, VPA/KEDA, Image Cleaner, Workload Identity/OIDC, VirtualMachines, Machines/NAP, Node Restriction, or unrelated probes."
  depends_on: [bootstrap-managed-acr-reference-backed-ts-probe]
  attempts: 2
  blocked_reason: "Initial BYO packet/run-plan/probe were produced and preflight passed. First execution exposed a missing source-required custom VNet input, then v2 with custom VNet remained Creating past the 7200s wrapper timeout with no ARM status.errordetail; cleanup verified false. Probe is now hardened for no-wait create/polling, so a single follow-up task is allowed."

- id: bootstrap-byo-acr-hardened-followup
  result: failed
  status: done
  assignee: aks-explorer
  goal: "Run one bounded follow-up execution of the hardened bootstrap-profile-byo-acr-lifecycle TypeScript probe. Start from outputs/iteration117-bootstrap-byo-acr-lifecycle.md, outputs/iteration117-bootstrap-byo-acr-v2-timeout-blocker.md, features/bootstrap-profile-byo-acr-lifecycle.yaml, run-plans/bootstrap-profile-byo-acr-lifecycle.yaml, probes/bootstrap-profile-byo-acr-lifecycle.ts, execution/README.md, and outputs/e2e-capability-model.json. First run --preflight-only to confirm the no-wait create, explicit polling, ARM GET-on-timeout, structured blocker, and cleanup path remains clean. Then execute with a fresh run id and a local wrapper timeout larger than AKS_RP_E2E_CLUSTER_CREATE_WAIT_SECONDS so the probe can write structured JSON/markdown if create remains stuck. Preserve the source-shaped BYO inputs: custom VNet/subnet, two public Premium ACRs, aks-managed-mcr cache rules, Cache create with ACR0, AcrPull assignments, image-pull checks, Direct disable, Cache re-enable, and switch to ACR1. If the lifecycle reaches clear terminal assertions, update outputs/e2e-capability-model.json only for source-backed pass/fail and run the validator. If create remains Creating, times out, or lacks ARM status.errordetail again, produce structured blocker evidence, verify resource-group/BYO ACR cleanup, keep bootstrap-profile-byo-acr-lifecycle unknown, and update project.md with a post-BYO unknown-selection task rather than rerunning BYO. Do not combine with any other feature branch."
  depends_on: [bootstrap-byo-acr-reference-backed-ts-probe]
  attempts: 1
  blocked_reason: "outputs/iteration118-bootstrap-byo-acr-hardened-followup.md: clean preflight; default-name attempt hit stale cluster-name collision and cleaned up; fresh-name attempt reached source-shaped custom VNet plus two public Premium BYO ACRs/cache rules, but AKS create failed pre-create because Standard_D4_v3 is not allowed in eastus2 for this staging subscription. Cleanup verified resource groups absent. BYO stays unknown and no further BYO rerun is allowed without a material trigger."

- id: post-byo-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration118-post-byo-unknown-selection.md selecting the next non-gated model-unknown branch after the allowed hardened bootstrap BYO-ACR follow-up closed as blocked. Start from outputs/iteration118-bootstrap-byo-acr-hardened-followup.md, outputs/iteration117-bootstrap-byo-acr-lifecycle.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Preserve existing gates for BYO, VPA cert renewal, Machines/NAP Machine API work, App Routing TLS/Istio, ManagedSystem gated branches, OIDC owner-only paths if discovered, and Node Restriction tag-only PATCH. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task. End with one concrete parser-visible next task."
  depends_on: [bootstrap-byo-acr-hardened-followup]
  attempts: 1

- id: oidc-signing-key-rotation-reference-backed-ts-probe
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Build and execute, only if source/environment preflight is clean, a reference-backed TypeScript probe for oidc-issuer-default-enabled-signing-key-rotation as selected by outputs/iteration118-post-byo-unknown-selection.md. Start from outputs/iteration76-workload-identity-oidc-runtime-staging.md, outputs/iteration77-identity-runtime-model-consolidation.md, outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md, outputs/iteration97-oidc-post-delete-cleanup-staging.md, outputs/iteration99-oidc-v133-explicit-enable-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/input-expectation-knowledge-map.md, outputs/e2e-capability-model.json, and devbox source under /home/hayua/rp/test/e2ev3. First identify the exact handwritten source scenario/branch for default-enabled OIDC signing-key rotation, the operation that triggers rotation, required permissions/custom features, discovery/JWKS URLs, expected key-count/overlap/removal behavior, polling budget, and cleanup shape. Produce a feature reference packet under features/, a reviewable run plan under run-plans/, and an executable TS probe under probes/. Run only after local/source/environment preflight is clean. If clear source-backed pass/fail evidence is reached, update outputs/e2e-capability-model.json and validate; if source trigger or environment access is unavailable, write a blocker artifact and keep the feature unknown. Do not combine with Workload Identity Windows/Linux revalidation, post-delete cleanup, v1.33 explicit-enable revalidation, App Routing, ManagedSystem, Bootstrap, VPA/KEDA, Image Cleaner, VirtualMachines, Machines/NAP, Node Restriction, or unrelated probes."
  depends_on: [post-byo-unknown-selection]
  attempts: 1

- id: node-restriction-tag-only-patch-source-shape
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Resolve the node-restriction-tag-only-patch-shape unknown locally before any cloud mutation. Start from outputs/node-restriction-source-spec-investigation.md, outputs/iteration74-node-restriction-source-spec-resolution.md, outputs/iteration83-node-restriction-fullput-runtime-staging.md, outputs/iteration62-security-profile-staging.md, outputs/e2e-capability-model.json, public AKS API/spec references, and relevant RP/e2ev3 source. Determine the exact PATCH operation shape for a tag-only or no-security-profile update when Node Restriction is enabled, whether PATCH can accidentally serialize securityProfile.nodeRestriction.enabled=false, the expected RP acceptance/rejection and error-shape contract if it does, and whether a future cloud probe is justified. Produce outputs/iteration120-node-restriction-tag-only-patch-shape.md with source/spec evidence, request-shape examples, verdict on whether to run a cloud probe, and any safe next task. Do not run staging, az, kubectl, cluster creation, or cloud mutation in this task."
  depends_on: [oidc-signing-key-rotation-reference-backed-ts-probe]
  attempts: 1

- id: node-restriction-tag-only-patch-model-hygiene
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Perform local-only model hygiene for node-restriction-tag-only-patch-shape after outputs/iteration120-node-restriction-tag-only-patch-shape.md resolved it as a non-contract/no-future-probe branch. Update outputs/e2e-capability-model.json so this branch no longer appears as an execution-worthy unknown, either by retiring it as a non-contract note or by adding precise PATCH-shape expectation semantics that record source/spec resolution. Update the relevant row or note in outputs/input-expectation-knowledge-map.md so future selection does not rediscover this as a cloud PATCH candidate. Produce a short artifact under outputs/ with the exact model/knowledge-map edits and validator output. Run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Do not run staging, az, kubectl, cluster creation, or cloud mutation."
  depends_on: [node-restriction-tag-only-patch-source-shape]
  attempts: 1

- id: vpa-runtime-rollup-model-hygiene
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Perform local-only hygiene for the legacy workload-autoscaler-vpa-runtime roll-up after the split VPA branch work. Start from outputs/iteration79-vpa-runtime-model-split.md, outputs/iteration93-vpa-residual-runtime-staging.md, outputs/iteration107-vpa-cert-renewal-runtime-staging.md, outputs/iteration115-vpa-upgrade-survival-runtime.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Decide whether the roll-up should be retired as a non-execution aggregate, marked blocked because exact source closure waits on VPA cert-renewal source/environment clarification, or represented by a schema-compatible note pointing to split branch features. Update outputs/e2e-capability-model.json and outputs/input-expectation-knowledge-map.md so this roll-up no longer appears as a direct cloud-probe unknown, run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts outputs/e2e-capability-model.json, and produce outputs/iteration122-vpa-runtime-rollup-model-hygiene.md with the exact edits and validator output. Do not run staging, az, kubectl, cluster creation, or cloud mutation."
  depends_on: [node-restriction-tag-only-patch-model-hygiene]
  attempts: 1

- id: managedsystem-runtime-restrictions-probe-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Design the next source-safe reference-backed TypeScript probe/run plan for managedsystem-runtime-restrictions before any cloud mutation. Start from outputs/managedsystem-pool-feature-standard.md, outputs/managedsystem-pool-feature-intent.md, outputs/managedsystem-pool-api-doc-boundary.md, outputs/managedsystem-pool-evidence-state-matrix.md, outputs/managedsystem-pool-repro-pack.md, outputs/managedsystem-pool-related-context.md, outputs/iteration112-managedsystem-rest-add-existing-v2-managedsystem-rest-add-existing.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Inspect current devbox source for Scenario_ManagedSystem_AgentPool and related validators to identify the minimal input path, required Kubernetes runtime assertions (node labels/taints, VAP/VAPBinding, critical add-on placement/affinity, customer workload unschedulability), SKU/location/version/custom-feature gates, and cleanup constraints. Produce a feature/run-plan/probe design artifact under outputs/ and update or create tracked files under features/, run-plans/, and probes/ only if the source contract is clear. Do not run staging, az, kubectl, cluster creation, or cloud mutation; if the design cannot be made safe, produce a blocker artifact with exact missing source/environment facts and recommend whether single-pool or reconcile preservation should be designed first instead."
  depends_on: [vpa-runtime-rollup-model-hygiene]
  attempts: 1

- id: managedsystem-single-pool-constraint-probe-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Perform local-only ManagedSystem single-pool constraint probe design. Start from outputs/managedsystem-pool-feature-intent.md, outputs/managedsystem-pool-feature-standard.md, outputs/managedsystem-pool-api-doc-boundary.md, outputs/managedsystem-pool-evidence-state-matrix.md, outputs/managedsystem-pool-repro-pack.md, outputs/iteration123-managedsystem-runtime-restrictions-probe-design.md, features/managedsystem-runtime-restrictions.yaml, run-plans/managedsystem-runtime-restrictions.yaml, probes/managedsystem-runtime-restrictions.ts, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Inspect current devbox source for ManagedSystem second-pool rejection intent, especially .claude/skills/test-managedsystem-pool/ scripts/skill text and any e2ev3/RP validation references that state only one ManagedSystem pool is allowed. Produce outputs/iteration124-managedsystem-single-pool-constraint-probe-design.md describing the accepted setup path, second-pool negative input path, expected rejection/error shape if source exposes it, execution gates, cleanup plan, and model impact rules. Create or update features/managedsystem-single-pool-constraint.yaml, run-plans/managedsystem-single-pool-constraint.yaml, and probes/managedsystem-single-pool-constraint.ts only if the source contract is clear enough to make the eventual probe auditable. Run a local-only design/reference preflight for any new probe skeleton and capture its output under outputs/. Do not run staging, az, kubectl, cluster creation, or cloud mutation; preserve the iteration123/iteration88 ManagedSystem execution gate."
  depends_on: [managedsystem-runtime-restrictions-probe-design]
  attempts: 1

- id: managedsystem-reconcile-preservation-probe-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Perform local-only ManagedSystem reconcile-preservation probe design. Start from outputs/managedsystem-pool-feature-intent.md, outputs/managedsystem-pool-feature-standard.md, outputs/managedsystem-pool-api-doc-boundary.md, outputs/managedsystem-pool-evidence-state-matrix.md, outputs/managedsystem-pool-repro-pack.md, outputs/iteration123-managedsystem-runtime-restrictions-probe-design.md, outputs/iteration124-managedsystem-single-pool-constraint-probe-design.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Inspect current devbox source for VerifyReconcileAccepted, CleanManagedSystemPoolForPUT, PutManagedCluster cleaning, and .claude skill/script reconcile intent. Produce outputs/iteration125-managedsystem-reconcile-preservation-probe-design.md describing accepted setup, cleaned managed-cluster PUT/reconcile input path, expected preservation, execution gates, cleanup plan, and model impact rules. Create or update features/managedsystem-reconcile-preservation.yaml, run-plans/managedsystem-reconcile-preservation.yaml, and probes/managedsystem-reconcile-preservation.ts only if the source contract is clear enough to make the eventual probe auditable. Run a local-only design/reference preflight for any new probe skeleton and capture its output under outputs/. Do not run staging, az, kubectl, cluster creation, or cloud mutation; preserve the iteration123/iteration88 ManagedSystem execution gate."
  depends_on: [managedsystem-single-pool-constraint-probe-design]
  attempts: 1

- id: post-managedsystem-design-unknown-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration126-post-managedsystem-design-unknown-selection.md selecting the next responsible bounded unknown after ManagedSystem runtime-restrictions, single-pool, and reconcile branches now have local execution-gated designs. Start from outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, outputs/iteration118-bootstrap-byo-acr-hardened-followup.md, outputs/iteration120-post-oidc-rotation-unknown-selection.md, outputs/iteration123-managedsystem-runtime-restrictions-probe-design.md, outputs/iteration124-managedsystem-single-pool-constraint-probe-design.md, outputs/iteration125-managedsystem-reconcile-preservation-probe-design.md, and current validator output. Rank remaining unknowns by source/e2ev3 anchor, input paths, expectation paths, cost/risk, required access, execution gates, and expected model update. Preserve gates for BYO, VPA cert renewal, Machines/NAP Machine API work, App Routing TLS/Istio, ManagedSystem cloud execution, and Node Restriction PATCH. Do not run staging, az, kubectl, cluster creation, or cloud mutation. End with one concrete parser-visible next task or a waiting/blocked recommendation with explicit resume trigger."
  depends_on: [managedsystem-reconcile-preservation-probe-design]
  attempts: 1

- id: machines-nap-default-pool-cleanup-source-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md as a local-only source/design artifact for machines-agentpool-nap-default-pool-cleanup. Start from outputs/iteration126-post-managedsystem-design-unknown-selection.md, outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/iteration105-machines-agentpool-api-crud-staging.md, outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md, outputs/iteration57-node-autoprovision-staging.md, and outputs/iteration58-node-autoprovision-followup.md. Run the local capability-model validator and use machines-agentpool-nap-default-pool-cleanup unknown plus machines-agentpool-api-crud blocked as source-of-truth constraints. Inspect the handwritten e2ev3/source anchor for Scenario_MachinesAgentPoolNAPEnabled and related Machines/NAP helpers to determine exact input path, expectation path, API versions, feature registrations, cleanup assertions, and whether nap.defaultMachinesPool.deletedOnManual can be split from full Machine CRUD. Preserve the Machine API cloud-execution gate: do not run staging, az, kubectl, cluster creation, or cloud mutation. End with either an execution-gated run-plan/probe-design recommendation or a blocked recommendation with explicit resume trigger: Microsoft.ContainerService/PutMachinePreview and Microsoft.ContainerService/DeleteSpecificMachinesPreview registered in staging subscription 26fe00f8-9173-4872-9134-bb1d2e00343a, or an equivalent source environment provided."
  depends_on: [post-managedsystem-design-unknown-selection]
  attempts: 1

- id: app-routing-istio-source-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration128-app-routing-istio-source-design.md as a local-only source/design artifact for app-routing-default-domain-istio and the adjacent app-routing-default-domain-tls-lifecycle unknown. Start from outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, outputs/iteration126-post-managedsystem-design-unknown-selection.md, outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/iteration70-app-routing-defaultdomain-tls-staging.md, outputs/iteration80-app-routing-tls-source-hypothesis.md, outputs/iteration81-app-routing-tls-owner-escalation.md, outputs/iteration91-app-routing-tls-gated-followup-tracker.md, outputs/iteration68-app-routing-defaultdomain-staging.md, and outputs/iteration69-app-routing-defaultdomain-traffic-staging.md. Run the local capability-model validator and use app-routing-default-domain-istio/app-routing-default-domain-tls-lifecycle unknown plus app-routing-default-domain-tls-secret fail as constraints. Inspect devbox handwritten source for Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld and related default-domain TLS steps, Gateway/HTTPRoute resources, preview features, and post-upgrade/traffic assertions. Decide whether the Istio branch has a distinct non-TLS/Gateway boundary worth modeling or is execution-gated by the same DefaultDomainCertificate/TLS-secret owner/fixed-build gate. Do not run staging, az, kubectl, cluster creation, or cloud mutation. End with an execution-gated design recommendation or blocked recommendation with explicit resume trigger."
  depends_on: [machines-nap-default-pool-cleanup-source-design]
  attempts: 1

- id: residual-split-model-selection
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration129-residual-split-model-selection.md as a local-only selection artifact after App Routing Istio, Machines/NAP cleanup, ManagedSystem residuals, Node Restriction PATCH, VPA roll-up, and BYO-ACR now have local design/hygiene artifacts or explicit gates. Start from outputs/iteration128-app-routing-istio-source-design.md, outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, outputs/iteration126-post-managedsystem-design-unknown-selection.md, outputs/iteration125-managedsystem-reconcile-preservation-probe-design.md, outputs/iteration124-managedsystem-single-pool-constraint-probe-design.md, outputs/iteration123-managedsystem-runtime-restrictions-probe-design.md, outputs/iteration122-vpa-runtime-rollup-model-hygiene.md, outputs/iteration121-node-restriction-tag-only-patch-model-hygiene.md, outputs/iteration118-bootstrap-byo-acr-hardened-followup.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Run the capability-model validator and rank remaining possible local-only split/design work versus waiting: NAP default Machines cleanup without Machine CRUD, generic AppRoutingIstio/Gateway API separate from default-domain managed TLS, residual ManagedSystem local work, BYO environment/SKU blocker hygiene, and failing-branch escalation refreshes. Preserve all documented no-rerun gates and do not run staging, az, kubectl, cluster creation, or cloud mutation. End with one concrete parser-visible next task, or recommend switching project frontmatter to waiting with explicit resume triggers if no honest bounded local work remains."
  depends_on: [app-routing-istio-source-design]
  attempts: 1

- id: machines-nap-default-pool-cleanup-split-model-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration130-machines-nap-default-pool-cleanup-split-model-design.md as a local-only split-model/design artifact for a NAP default Machines pool cleanup branch that excludes Machine subresource CRUD. Start from outputs/iteration129-residual-split-model-selection.md, outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Run the capability-model validator and use machines-agentpool-nap-default-pool-cleanup unknown plus machines-agentpool-api-crud blocked as source-of-truth constraints. Decide whether to add/design a separate model feature such as machines-agentpool-nap-default-pool-cleanup-no-machine-crud, with explicit input path, expectation path, non-goals, model relationship to the full source-equivalent machines-agentpool-nap-default-pool-cleanup feature, and execution gates. Preserve the Machine API gate for the full source-equivalent branch and preserve all iteration129 no-rerun gates. Do not run staging, az, kubectl, cluster creation, or cloud mutation. End with either a concrete schema/model-edit recommendation validated locally or a recommendation to move the project to paused/waiting with the residual resume triggers."
  depends_on: [residual-split-model-selection]
  attempts: 1

- id: approuting-generic-istio-gateway-source-split
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration132-approuting-generic-istio-gateway-source-split.md as a local-only source-split artifact for a possible generic AppRoutingIstio/Gateway API branch separate from default-domain managed TLS. Start from outputs/iteration131-nap-cleanup-split-model-edit.md, outputs/iteration128-app-routing-istio-source-design.md, outputs/iteration129-residual-split-model-selection.md, outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, and outputs/e2ev3-handwritten-coverage-inventory.md. Run the capability-model validator and use app-routing-default-domain-istio/app-routing-default-domain-tls-lifecycle unknown plus app-routing-default-domain-tls-secret fail as constraints. Inspect handwritten meshless-Istio / managed Gateway API / AppRoutingIstio source for scenarios that do not depend on DefaultDomainCertificate or default-domain managed TLS. Decide whether to add/design a separate generic AppRoutingIstio/Gateway model branch, with explicit input path, expectation path, non-goals, relationship to default-domain Istio/TLS branches, and execution gates. Preserve App Routing TLS no-rerun gates and all other iteration129/130/131 gates. Do not run staging, az, kubectl, cluster creation, or cloud mutation. End with either a concrete schema/model-edit recommendation validated locally or a recommendation to move the project to paused/waiting with residual resume triggers."
  depends_on: [machines-nap-default-pool-cleanup-split-model-design]
  attempts: 1

- id: approuting-nginx-to-istio-migration-probe-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration134-approuting-nginx-to-istio-migration-probe-design.md plus reviewable local artifacts for the newly modeled generic App Routing NGINX-to-Istio migration branch: features/app-routing-nginx-to-istio-migration.yaml, run-plans/app-routing-nginx-to-istio-migration.yaml, and probes/app-routing-nginx-to-istio-migration.ts (or an explicit no-probe-design decision if source/API shape is not stable enough). Start from outputs/iteration133-approuting-generic-migration-model-edit.md, outputs/iteration132-approuting-generic-istio-gateway-source-split.md, outputs/iteration128-app-routing-istio-source-design.md, outputs/iteration91-app-routing-tls-gated-followup-tracker.md, outputs/e2e-capability-model.json, and devbox source for Scenario_Traffic_AppRouting_NginxToIstio_Migration. Run the capability-model validator and use app-routing-nginx-to-istio-migration unknown plus app-routing-default-domain-tls-secret fail as constraints. Preserve the generic/non-default-domain boundary: no DefaultDomainCertificate, no default-domain-tls, no default-domain aksapp.io host, and no claims for default-domain Istio/TLS branches. Encode future execution gates, diagnostics, request/API-version preflights, and cleanup verification. Do not run staging, az, kubectl, cluster creation, or cloud mutation; this is local design only. End with either a next safe action or a paused/waiting recommendation with explicit resume triggers."
  depends_on: [approuting-generic-istio-gateway-source-split]
  attempts: 1

- id: post-approuting-design-knowledge-map-refresh
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration135-knowledge-map-refresh.md and refresh the consolidated local knowledge-map artifacts after iteration134. Start from outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/iteration122-vpa-runtime-rollup-model-hygiene.md, outputs/iteration130-machines-nap-default-pool-cleanup-split-model-design.md, outputs/iteration131-nap-cleanup-split-model-edit.md, outputs/iteration133-approuting-generic-migration-model-edit.md, and outputs/iteration134-approuting-nginx-to-istio-migration-probe-design.md. Run the local capability-model validator and quote the current counts/status lists. Update outputs/input-expectation-knowledge-map.md so the header/model snapshot, modeled input/expectation dimensions, App Routing generic migration branch, NAP cleanup split, VPA roll-up retirement, Node Restriction PATCH hygiene, current unknown/fail/blocked lists, and ranked next-frontier section reflect the validated post-iteration134 model instead of the older iteration71 snapshot. Update outputs/e2ev3-handwritten-coverage-inventory.md only for durable source-inventory corrections backed by local artifacts, especially Scenario_Traffic_AppRouting_NginxToIstio_Migration and its non-default-domain Gateway API/AppRoutingIstio boundary. Preserve all documented no-rerun gates and do not run staging, az, kubectl, cluster creation, or cloud mutation. End with a short next-frontier recommendation: future execution-gated App Routing migration implementation, waiting triggers, or another local map/model hygiene task if discovered."
  depends_on: [approuting-nginx-to-istio-migration-probe-design]
  attempts: 1

- id: approuting-nginx-to-istio-migration-execution-implementation
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Implement the execution-gated cloud body for probes/app-routing-nginx-to-istio-migration.ts without running cloud mutation. Start from outputs/iteration135-knowledge-map-refresh.md, outputs/iteration134-approuting-nginx-to-istio-migration-probe-design.md, features/app-routing-nginx-to-istio-migration.yaml, run-plans/app-routing-nginx-to-istio-migration.yaml, probes/app-routing-nginx-to-istio-migration.ts, and outputs/e2e-capability-model.json. Preserve the generic/non-default-domain boundary: no DefaultDomainCertificate, no default-domain-tls, no defaultDomain.enabled=true, no generated aksapp.io hostname, no HTTPS Gateway listener, no Gateway certificateRefs, and no claims for default-domain Istio/TLS branches. Extend the probe so it still defaults to local preflight and only mutates cloud when both --execute and AKS_RP_E2E_ALLOW_CLOUD_MUTATION=app-routing-nginx-to-istio-migration are set. Implement bounded validator/reference/API/request-shape/feature/SKU preflights plus source-shaped run steps, diagnostics, failure classification, cleanup verification, and model-impact rules for the future run. Run only local verification: bun probes/app-routing-nginx-to-istio-migration.ts --check, a non-mutating run such as bun probes/app-routing-nginx-to-istio-migration.ts --run-id=iteration136-local, and bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Produce outputs/iteration136-approuting-nginx-to-istio-migration-execution-implementation.md with exact code changes, verification evidence, residual execution gates, expected future command, and cleanup/model-impact rules. Do not run --execute, az, kubectl, cluster creation, or cloud mutation."
  depends_on: [post-approuting-design-knowledge-map-refresh]
  attempts: 1

- id: approuting-nginx-to-istio-migration-gated-execution
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute one bounded, explicitly gated App Routing NGINX-to-Istio migration probe run using probes/app-routing-nginx-to-istio-migration.ts. Start from outputs/iteration136-approuting-nginx-to-istio-migration-execution-implementation.md, outputs/iteration136-local-app-routing-nginx-to-istio-migration.{json,md}, features/app-routing-nginx-to-istio-migration.yaml, run-plans/app-routing-nginx-to-istio-migration.yaml, and outputs/e2e-capability-model.json. Preserve the generic/non-default-domain boundary: no DefaultDomainCertificate, no default-domain-tls, no defaultDomain.enabled=true, no generated aksapp.io hostname, no HTTPS Gateway listener, no Gateway certificateRefs, and no claims for default-domain Istio/TLS branches. Run with explicit gates only: --execute plus AKS_RP_E2E_ALLOW_CLOUD_MUTATION=app-routing-nginx-to-istio-migration, using Standard_D2s_v4 unless a preflight-backed override is recorded. Let read-only validator/reference/API/feature/SKU/request-shape preflights stop the run before resource creation if unsafe. If execution proceeds, verify NGINX HTTP baseline, Gateway API Standard + AppRoutingIstio update, HTTP Gateway/HTTPRoute, Gateway Programmed=True/address, continuous prober total>0/bad=0/ok=total through Ingress deletion and NGINX disable, diagnostics, and cleanup. Produce outputs/iteration137-approuting-nginx-to-istio-migration-execution.md with exact command, outcome/blocker, cleanup, failure classification, and model-impact recommendation. Update outputs/e2e-capability-model.json only for a clear source-shaped pass/fail with bounded cleanup, then validate it."
  depends_on: [approuting-nginx-to-istio-migration-execution-implementation]
  attempts: 2

- id: nap-cleanup-no-machine-crud-reference-backed-ts-probe-design
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Create a local-only reference-backed TypeScript probe design for machines-agentpool-nap-default-pool-cleanup-no-machine-crud. Start from outputs/iteration137-approuting-nginx-to-istio-migration-execution.md, outputs/iteration131-nap-cleanup-split-model-edit.md, outputs/iteration130-machines-nap-default-pool-cleanup-split-model-design.md, outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Produce outputs/iteration138-nap-cleanup-no-machine-crud-probe-design.md and, if the boundary is stable, tracked features/machines-nap-default-pool-cleanup-no-machine-crud.yaml, run-plans/machines-nap-default-pool-cleanup-no-machine-crud.yaml, and probes/machines-nap-default-pool-cleanup-no-machine-crud.ts. Preserve the split boundary: no Machine subresource CRUD, no claim for machines-agentpool-api-crud, and no claim for the full source-equivalent machines-agentpool-nap-default-pool-cleanup branch. Encode the cleanup-only path, execution gates, diagnostics, cleanup verification, model-impact rules, and local validator/probe preflight. Do not run staging, az, kubectl, cluster creation, or cloud mutation in this task."
  depends_on: [approuting-nginx-to-istio-migration-gated-execution]
  attempts: 1

- id: nap-cleanup-no-machine-crud-execution-implementation
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Implement the execution-gated cloud body for probes/machines-nap-default-pool-cleanup-no-machine-crud.ts without running cloud mutation. Start from outputs/iteration138-nap-cleanup-no-machine-crud-probe-design.md, features/machines-nap-default-pool-cleanup-no-machine-crud.yaml, run-plans/machines-nap-default-pool-cleanup-no-machine-crud.yaml, the current probe skeleton, outputs/iteration131-nap-cleanup-split-model-edit.md, outputs/iteration130-machines-nap-default-pool-cleanup-split-model-design.md, outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, and outputs/e2e-capability-model.json. Preserve the split boundary: no Machine PUT/GET/LIST/tag update, no agentPools/deleteMachines, no claim for machines-agentpool-api-crud, and no claim for the full source-equivalent machines-agentpool-nap-default-pool-cleanup branch. Extend the probe so it defaults to local preflight and only mutates cloud in a future execution task when both --execute and AKS_RP_E2E_ALLOW_CLOUD_MUTATION=machines-agentpool-nap-default-pool-cleanup-no-machine-crud are set. Implement bounded reference/validator/request-shape/API/SKU/feature preflights plus source-shaped run steps, diagnostics, failure classification, cleanup verification, and model-impact rules. Run only local verification: bun probes/machines-nap-default-pool-cleanup-no-machine-crud.ts --check, a non-mutating run such as bun probes/machines-nap-default-pool-cleanup-no-machine-crud.ts --run-id=iteration139-local, and bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Produce outputs/iteration139-nap-cleanup-no-machine-crud-execution-implementation.md with exact code changes, verification evidence, residual execution gates, expected future command, cleanup rules, and model-impact rules. Do not run --execute, az, kubectl, cluster creation, or cloud mutation."
  depends_on: [nap-cleanup-no-machine-crud-reference-backed-ts-probe-design]
  attempts: 1

- id: nap-cleanup-no-machine-crud-gated-execution
  result: failed
  status: done
  assignee: aks-explorer
  goal: "Execute one bounded, explicitly gated staging run of probes/machines-nap-default-pool-cleanup-no-machine-crud.ts. Start from outputs/iteration139-nap-cleanup-no-machine-crud-execution-implementation.md, outputs/iteration139-local-machines-nap-default-pool-cleanup-no-machine-crud.{json,md}, features/machines-nap-default-pool-cleanup-no-machine-crud.yaml, run-plans/machines-nap-default-pool-cleanup-no-machine-crud.yaml, and outputs/e2e-capability-model.json. Run only this split probe with --execute plus AKS_RP_E2E_ALLOW_CLOUD_MUTATION=machines-agentpool-nap-default-pool-cleanup-no-machine-crud, using Standard_D2s_v4 unless a preflight-backed override is recorded. Let read-only validator/reference/API/feature/SKU/CLI/kubectl/request-shape preflights stop the run before resource creation if unsafe. If execution proceeds, verify NAP Auto create/persistence, default pool aksmanagedap mode=Machines/type=VirtualMachines, Karpenter NodePool CPU limit 0, Manual update/persistence, ARM absence of aksmanagedap, Kubernetes absence of aks-aksmanagedap nodes, diagnostics, and whole-RG cleanup. Produce outputs/iteration140-nap-cleanup-no-machine-crud-execution.md with exact command, outcome/blocker, cleanup, failure classification, and model-impact recommendation. Update outputs/e2e-capability-model.json only for a clear source-shaped split pass/fail with bounded cleanup, then validate it. Do not call Machine PUT/GET/LIST/tag update or agentPools/deleteMachines; do not claim machines-agentpool-api-crud or the full source-equivalent machines-agentpool-nap-default-pool-cleanup branch; do not combine with unrelated branches."
  depends_on: [nap-cleanup-no-machine-crud-execution-implementation]
  attempts: 1
  blocked_reason: "outputs/iteration140-nap-cleanup-no-machine-crud-execution.md: explicit --execute run stopped before resource creation because read-only preflight could not prove nested managedClusters/agentPools API-version support from provider metadata and NodeAutoProvisioningPreview feature show returned FeatureNotFound. Local reference/validator/request-shape preflights passed, no Machine CRUD/deleteMachines calls were made, no resource group was created, cleanup was not needed, and the product model stayed unchanged."

- id: nap-cleanup-no-machine-crud-preflight-hygiene
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Perform local-only preflight hygiene for probes/machines-nap-default-pool-cleanup-no-machine-crud.ts after the iteration140 safe stop. Start from outputs/iteration140-nap-cleanup-no-machine-crud-execution.md and its generated JSON/markdown, the probe/run-plan/feature packet, outputs/iteration57-node-autoprovision-staging.md, outputs/iteration58-node-autoprovision-followup.md, and outputs/e2e-capability-model.json. Determine whether the AgentPools API-version provider-metadata miss and NodeAutoProvisioningPreview FeatureNotFound are true environment blockers or ambiguous preflight checks given prior NAP staging passes. If safe, update the probe and run-plan with auditable read-only proof paths/explicit override handling, then run bun probes/machines-nap-default-pool-cleanup-no-machine-crud.ts --check, bun probes/machines-nap-default-pool-cleanup-no-machine-crud.ts --run-id=iteration141-local, and bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Produce outputs/iteration141-nap-cleanup-no-machine-crud-preflight-hygiene.md with exact edits, verification evidence, and the future rerun gate. Do not run --execute or any cloud mutation; preserve no-Machine-CRUD and no-full-branch claims."
  depends_on: [nap-cleanup-no-machine-crud-gated-execution]
  attempts: 1

- id: nap-cleanup-no-machine-crud-gated-rerun-after-hygiene
  result: failed
  status: done
  assignee: aks-explorer
  goal: "Execute one bounded, explicitly gated staging rerun of probes/machines-nap-default-pool-cleanup-no-machine-crud.ts after iteration141 preflight hygiene. Start from outputs/iteration141-nap-cleanup-no-machine-crud-preflight-hygiene.md, outputs/iteration141-local-machines-nap-default-pool-cleanup-no-machine-crud.{json,md}, features/machines-nap-default-pool-cleanup-no-machine-crud.yaml, run-plans/machines-nap-default-pool-cleanup-no-machine-crud.yaml, and outputs/e2e-capability-model.json. Run only this split probe with --execute plus AKS_RP_E2E_ALLOW_CLOUD_MUTATION=machines-agentpool-nap-default-pool-cleanup-no-machine-crud and AKS_RP_E2E_ASSUME_NAP_FEATURE_GA=true, using Standard_D2s_v4 unless a read-only preflight-backed override is recorded. Let read-only validator/reference/API/feature/SKU/CLI/kubectl/request-shape preflights stop the run before resource creation if unsafe, but require generated evidence to record the hardened AgentPools proof path and iteration57/58 NAP availability evidence. If execution proceeds, verify NAP Auto create/persistence, default pool aksmanagedap mode=Machines/type=VirtualMachines, Karpenter NodePool CPU limit 0, Manual update/persistence, ARM absence of aksmanagedap, Kubernetes absence of aks-aksmanagedap nodes, diagnostics, and whole-RG cleanup. Produce outputs/iteration142-nap-cleanup-no-machine-crud-execution.md with exact command, outcome/blocker, cleanup, failure classification, and model-impact recommendation. Update outputs/e2e-capability-model.json only for a clear source-shaped split pass/fail with bounded cleanup, then validate it. Do not call Machine PUT/GET/LIST/tag update or agentPools/deleteMachines; do not claim machines-agentpool-api-crud or the full source-equivalent machines-agentpool-nap-default-pool-cleanup branch; do not combine with unrelated branches."
  depends_on: [nap-cleanup-no-machine-crud-preflight-hygiene]
  attempts: 1
  failure_reason: "outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun.md: after fixing the az rest --resource execution-host issue, hardened preflights passed and source-shaped NAP Auto create persisted mode=Auto/defaultNodePools=Auto, but the source-expected default Machines agent pool aksmanagedap returned NotFound before Manual cleanup assertions. Cleanup reached az group exists=false, no Machine API/deleteMachines calls were made, and outputs/e2e-capability-model.json now marks only the split no-Machine-CRUD branch fail."

- id: local-gap-selection-knowledge-map-refresh
  status: done
  result: superseded
  assignee: aks-explorer
  goal: "Produce outputs/iteration143-local-gap-selection-knowledge-map-refresh.md and refresh outputs/input-expectation-knowledge-map.md from the current validated model after iteration142. Start from project.md, outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, outputs/iteration137-approuting-nginx-to-istio-migration-execution.md, outputs/iteration141-nap-cleanup-no-machine-crud-preflight-hygiene.md, and outputs/iteration142-nap-cleanup-no-machine-crud-execution.md. Run bun capability-model/src/validate.ts outputs/e2e-capability-model.json and quote the current fail/unknown/blocked lists. Identify which remaining unknown/failing features are actionable without cloud mutation and which are gated by TLS owner diagnostics, Machine preview features, ManagedSystem cloud execution, BYO SKU/environment, or the NAP az-rest execution-host issue. Update the ranked next-frontier section of the knowledge map accordingly. Do not run az, kubectl, --execute, cluster creation, or cloud mutation."
  depends_on: [nap-cleanup-no-machine-crud-gated-rerun-after-hygiene]
  attempts: 0
  dropped_reason: "Superseded by iteration143 model-changing NAP split failure and the more specific nap-aksmanagedap-absence-source-triage task."

- id: managedsystem-cli-failure-reference-packet
  status: done
  result: dropped
  assignee: aks-explorer
  goal: "Produce outputs/iteration144-managedsystem-cli-failure-reference-packet.md as a local/source-backed reference packet for managedsystem-pool-cli-create-cluster and managedsystem-pool-cli-add-existing. Start from outputs/iteration143-local-gap-selection-knowledge-map-refresh.md, outputs/iteration56-managedsystem-staging-refresh.md, outputs/20260519T1646Z-managedsystem-priority-staging.md, outputs/managedsystem-pool-api-doc-boundary.md, outputs/managedsystem-pool-feature-standard.md, features/managedsystem-pool.yaml, and relevant RP/e2ev3/CLI source references already captured in the ManagedSystem artifacts. Compare the failing CLI default payload fields against the passing minimal REST request shape, record exact accepted/rejected input paths and expected error-shape evidence, and recommend any capability-model or knowledge-map hygiene needed. Do not rerun CLI/staging or create cloud resources."
  depends_on: [local-gap-selection-knowledge-map-refresh]
  attempts: 0

- id: virtualmachines-cli-multisku-failure-reference-packet
  status: done
  result: dropped
  assignee: aks-explorer
  goal: "Produce outputs/iteration145-virtualmachines-cli-multisku-failure-reference-packet.md as a local/source-backed reference packet for virtualmachines-agentpool-cli-add-multi-sku. Start from outputs/iteration143-local-gap-selection-knowledge-map-refresh.md, outputs/iteration64-virtualmachines-agentpool-staging.md, outputs/iteration65-virtualmachines-multisku-contract.md, outputs/iteration66-virtualmachines-manual-scale-staging.md, outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md, and outputs/e2e-capability-model.json. Reconcile the CLI comma multi-SKU failure with REST mixed-SKU/manual-profile passes, public swagger/source request shapes, and CLI help/serialization behavior; define the exact failing input boundary and adjacent passing paths. Do not run az, kubectl, cluster creation, or cloud mutation."
  depends_on: [local-gap-selection-knowledge-map-refresh]
  attempts: 0

- id: paf-throttling-source-precondition-reference-packet
  status: done
  result: dropped
  assignee: aks-explorer
  goal: "Produce outputs/iteration146-paf-throttling-source-precondition-reference-packet.md as a local-only reference packet for paf-throttling. Start from outputs/e2e-run-results-summary.md, outputs/iteration26-pafthrottling-retry.md if present, outputs/underlay-debug-findings.md, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, and relevant devbox source for Scenario_PAFThrottling. Identify the required MSI/identity inputs, source assertions, historical missing-identity failure evidence, whether the current fail should be modeled as product failure, environment/precondition failure, or stale standalone evidence, and the exact non-cloud next unblock action if any. Do not run standalone/staging, az, kubectl, cluster creation, or cloud mutation."
  depends_on: [local-gap-selection-knowledge-map-refresh]
  attempts: 0

- id: nap-aksmanagedap-absence-source-triage
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Triage the iteration143 NAP Auto aksmanagedap absence locally before any rerun. Start from outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun.md and generated JSON, outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, outputs/iteration141-nap-cleanup-no-machine-crud-preflight-hygiene.md, probes/machines-nap-default-pool-cleanup-no-machine-crud.ts, run-plans/machines-nap-default-pool-cleanup-no-machine-crud.yaml, features/machines-nap-default-pool-cleanup-no-machine-crud.yaml, outputs/e2e-capability-model.json, and relevant devbox source for Scenario_MachinesAgentPoolNAPEnabled. Produce outputs/iteration144-nap-aksmanagedap-absence-source-triage.md classifying whether aksmanagedap NotFound is product regression, source/API drift, missing input/feature/header, or inconclusive; include exact source/API evidence, model-impact recommendation, and bounded next action. Do not run --execute, az aks create, cloud mutation, Machine APIs, or deleteMachines."
  depends_on: [nap-cleanup-no-machine-crud-gated-rerun-after-hygiene]
  attempts: 1

- id: nap-managed-machine-pool-rollout-escalation-packet
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration145-nap-managed-machine-pool-rollout-escalation.md as a local-only escalation packet after outputs/iteration144-nap-aksmanagedap-absence-source-triage.md. Summarize iteration143 observed aksmanagedap NotFound and cleanup, cite source/toggle evidence that enable-managed-machine-agent-pool and regionallooper-reconcile-nap-cluster-enabled are not checked-in enabled for staging eastus2, list precise owner/environment questions, preserve the no same-input eastus2 rerun rule, and state the distinct rerun gate if a rollout-enabled source-equivalent environment is provided. Do not run --execute, az aks create, cloud mutation, Machine APIs, or deleteMachines; do not edit the model."
  depends_on: [nap-aksmanagedap-absence-source-triage]
  attempts: 1

- id: post-nap-escalation-knowledge-map-refresh
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration146-post-nap-escalation-knowledge-map-refresh.md and refresh outputs/input-expectation-knowledge-map.md after the iteration145 NAP managed-machine-pool rollout escalation packet. Start from outputs/iteration145-nap-managed-machine-pool-rollout-escalation.md, outputs/iteration144-nap-aksmanagedap-absence-source-triage.md, outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun.md, outputs/iteration137-approuting-nginx-to-istio-migration-execution.md, outputs/iteration135-knowledge-map-refresh.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Run bun capability-model/src/validate.ts outputs/e2e-capability-model.json and quote current counts/status lists. Update the knowledge map so App Routing NGINX-to-Istio is pass, NAP no-Machine-CRUD cleanup is fail with iteration145 no same-input eastus2 rerun/escalation gates, full NAP cleanup remains unknown/gated, Machines API CRUD remains blocked, and all BYO/VPA/App Routing TLS/ManagedSystem/Node Restriction/completed-branch no-rerun gates are preserved. End with a ranked next-frontier recommendation that either creates one bounded parser-visible local task or recommends moving frontmatter to waiting with explicit resume triggers. Do not run az, kubectl, --execute, cluster creation, cloud mutation, Machine APIs, or deleteMachines; do not edit model status unless a validator-backed evidence inconsistency is discovered and documented."
  depends_on: [nap-managed-machine-pool-rollout-escalation-packet]
  attempts: 1

- id: virtualmachines-cli-multisku-failure-reference-packet-refresh
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md as a local/source-backed reference packet for virtualmachines-agentpool-cli-add-multi-sku after the post-NAP knowledge-map refresh. Start from outputs/iteration146-post-nap-escalation-knowledge-map-refresh.md, outputs/input-expectation-knowledge-map.md, outputs/iteration64-virtualmachines-agentpool-staging.md, outputs/iteration65-virtualmachines-multisku-contract.md, outputs/iteration66-virtualmachines-manual-scale-staging.md, outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md, and outputs/e2e-capability-model.json. Reconcile the CLI comma multi-SKU failure with REST mixed-SKU/manual-profile passes, public swagger/source request shapes, and CLI help/serialization behavior; define the exact failing input boundary, adjacent passing paths, and whether the failure is CLI-surface-specific or a broader product contract. Do not run az, kubectl, cluster creation, cloud mutation, Machine APIs, or deleteMachines."
  depends_on: [post-nap-escalation-knowledge-map-refresh]
  attempts: 1

- id: paf-throttling-source-precondition-reference-packet-refresh
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration148-paf-throttling-source-precondition-reference-packet.md as a local/source-backed packet for paf-throttling. Start from outputs/e2e-run-results-summary.md, outputs/first-e2e-run-results.md, outputs/underlay-debug-findings.md, outputs/iteration26-pafthrottling-retry.md, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/e2e-capability-model.json, and relevant source references for Scenario_PAFThrottling. Identify required MSI/underlay/capacity/DedicatedOom preconditions, source assertions, historical missing-identity and capacity evidence, whether the current model fail is product, environment/precondition, stale standalone evidence, or a gated blocker, and the exact non-cloud next unblock action or resume trigger. Do not run standalone/staging, az, kubectl, cluster creation, cloud mutation, Machine APIs, or deleteMachines; do not edit model status unless a validator-backed evidence inconsistency is discovered and documented."
  depends_on: [virtualmachines-cli-multisku-failure-reference-packet-refresh]
  attempts: 1

- id: paf-throttling-model-hygiene
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration149-paf-throttling-model-hygiene.md and reconcile outputs/e2e-capability-model.json with outputs/iteration148-paf-throttling-source-precondition-reference-packet.md. Run the validator, inspect the paf-throttling feature/test/judgment/evidence entries, then either reclassify paf-throttling from stale fail to blocked/gated with precise MSI/capacity/OOM resume triggers, or split the product assertion from environment/test-harness precondition branches if that better preserves model semantics. Update outputs/input-expectation-knowledge-map.md if model status/frontier text changes. Preserve no-rerun gates; do not run standalone/staging, az, kubectl, cluster creation, cloud mutation, Machine APIs, or deleteMachines."
  depends_on: [paf-throttling-source-precondition-reference-packet-refresh]
  attempts: 1

- id: managedsystem-cli-failure-reference-packet-refresh
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration150-managedsystem-cli-failure-reference-packet.md as a local/source-backed reference packet for the current failing ManagedSystem Azure CLI surfaces: managedsystem-pool-cli-create-cluster and managedsystem-pool-cli-add-existing. Start from outputs/managedsystem-pool-feature-standard.md, outputs/managedsystem-pool-api-doc-boundary.md, outputs/managedsystem-pool-evidence-state-matrix.md, outputs/managedsystem-pool-repro-pack.md, outputs/iteration56-managedsystem-staging-refresh.md, outputs/20260519T1646Z-managedsystem-priority-staging.md, outputs/iteration112-managedsystem-rest-add-existing-v2-managedsystem-rest-add-existing.md, outputs/e2e-capability-model.json, outputs/input-expectation-knowledge-map.md, and current CLI/RP/source references as needed. Compare the proven accepted minimal ARM REST add-existing shape against the rejected CLI create/add default payload fields, define exact failing input boundaries and adjacent passing REST/standalone paths, decide whether any model or knowledge-map hygiene is needed, and run the local capability-model validator if the model changes. Do not run az, kubectl, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or ManagedSystem cloud probes; this is local/reference work only."
  depends_on: [paf-throttling-model-hygiene]
  attempts: 1

- id: managedsystem-single-pool-constraint-execution-implementation
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration151-managedsystem-single-pool-constraint-execution-implementation.md and turn probes/managedsystem-single-pool-constraint.ts into an execution-capable but still gated TypeScript probe for the managedsystem-single-pool-constraint unknown. Start from outputs/iteration124-managedsystem-single-pool-constraint-probe-design.md, features/managedsystem-single-pool-constraint.yaml, run-plans/managedsystem-single-pool-constraint.yaml, probes/managedsystem-single-pool-constraint.ts, outputs/iteration123-managedsystem-runtime-restrictions-probe-design.md, outputs/iteration150-managedsystem-cli-failure-reference-packet.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Preserve the clean REST boundary: first ManagedSystem pool via minimal agentPools PUT, second ManagedSystem pool via the same minimal PUT with a different name, and no CLI add path. Implement explicit preflight/safety gates, request-shape evidence, setup-failure vs second-pool-rejection classification, post-rejection pool-list assertions, diagnostics, and whole-resource-group cleanup scaffolding. Cloud mutation must remain disabled unless both --execute and AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-single-pool-constraint are present, and even then the run artifact must record why the iteration88 SKU/image/defaulting gate is cleared. Verify locally with bun probes/managedsystem-single-pool-constraint.ts --check, a non-mutating local run that writes blocked/execution-gated artifacts, and bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or ManagedSystem cloud probes in this task."
  depends_on: [managedsystem-cli-failure-reference-packet-refresh]
  attempts: 1

- id: managedsystem-reconcile-preservation-execution-implementation
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration152-managedsystem-reconcile-preservation-execution-implementation.md and turn probes/managedsystem-reconcile-preservation.ts into an execution-capable but still gated TypeScript probe for the managedsystem-reconcile-preservation unknown. Start from outputs/iteration125-managedsystem-reconcile-preservation-probe-design.md, features/managedsystem-reconcile-preservation.yaml, run-plans/managedsystem-reconcile-preservation.yaml, probes/managedsystem-reconcile-preservation.ts, outputs/iteration123-managedsystem-runtime-restrictions-probe-design.md, outputs/iteration124-managedsystem-single-pool-constraint-probe-design.md, outputs/iteration151-managedsystem-single-pool-constraint-execution-implementation.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Preserve the source-equivalent REST boundary: first ManagedSystem pool via minimal agentPools PUT, managed-cluster GET sanitized with CleanManagedSystemPoolForPUT-equivalent rules, no-op managed-cluster PUT, and final preservation assertions. Implement explicit preflight/safety gates, sanitizer diff/request-shape evidence proving ManagedSystem pool PUT fields keep only name/mode/count and omit or clear type/read-only/default fields, setup-failure vs reconcile-preservation classification, diagnostics, and whole-resource-group cleanup scaffolding. Cloud mutation must remain disabled unless --execute, AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-reconcile-preservation, and a concrete AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE are present, and even then the run artifact must record why the iteration88 SKU/image/defaulting gate is cleared. Verify locally with bun probes/managedsystem-reconcile-preservation.ts --check, a non-mutating local run that writes blocked/execution-gated artifacts, and bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or ManagedSystem cloud probes in this task."
  depends_on: [managedsystem-single-pool-constraint-execution-implementation]
  attempts: 2

- id: managedsystem-runtime-restrictions-execution-implementation
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration153-managedsystem-runtime-restrictions-execution-implementation.md and turn probes/managedsystem-runtime-restrictions.ts into an execution-capable but still gated TypeScript probe for the managedsystem-runtime-restrictions unknown. Start from outputs/iteration123-managedsystem-runtime-restrictions-probe-design.md, features/managedsystem-runtime-restrictions.yaml, run-plans/managedsystem-runtime-restrictions.yaml, probes/managedsystem-runtime-restrictions.ts, outputs/iteration112-managedsystem-rest-add-existing-v2-managedsystem-rest-add-existing.md, outputs/iteration151-managedsystem-single-pool-constraint-execution-implementation.md, outputs/iteration152-managedsystem-reconcile-preservation-execution-implementation.md, outputs/e2e-capability-model.json, and outputs/input-expectation-knowledge-map.md. Preserve the clean REST setup boundary: normal baseline cluster, one ManagedSystem pool via minimal agentPools PUT {properties:{mode:ManagedSystem}}, then runtime-only assertions for ManagedSystem nodes/taints, CoreDNS readiness and managed-system affinity, critical add-on placement/affinity, VAP/VAPBinding presence, and customer nginx Pending/Unschedulable. Implement explicit preflight/safety gates, request-shape and assertion-plan evidence, setup-failure vs runtime-restriction classification, diagnostics, temporary pod cleanup, and whole-resource-group cleanup scaffolding. Cloud mutation must remain disabled unless --execute, AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-runtime-restrictions, and a concrete AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE are present, and even then the run artifact must record why the iteration88 SKU/image/defaulting gate is cleared. Verify locally with bun probes/managedsystem-runtime-restrictions.ts --check, a non-mutating local run that writes blocked/execution-gated artifacts, and bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, reconcile PUT, second ManagedSystem pool, ManagedSystem delete/migration, or ManagedSystem cloud probes in this implementation task."
  depends_on: [managedsystem-reconcile-preservation-execution-implementation]
  attempts: 1

- id: post-managedsystem-implementation-frontier-selection
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration154-post-managedsystem-implementation-frontier-selection.md after all three residual ManagedSystem execution-gated probe implementations. Start from outputs/iteration151-managedsystem-single-pool-constraint-execution-implementation.md, outputs/iteration152-managedsystem-reconcile-preservation-execution-implementation.md, outputs/iteration153-managedsystem-runtime-restrictions-execution-implementation.md, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, and outputs/e2e-capability-model.json. Run bun capability-model/src/validate.ts outputs/e2e-capability-model.json, quote current fail/unknown/blocked lists, refresh the knowledge map/frontier if needed to show that ManagedSystem runtime/single-pool/reconcile are execution-capable but still cloud-gated, and recommend either moving the project to waiting/paused with explicit resume triggers or creating one next bounded local reference-packet/model-hygiene task. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or ManagedSystem cloud probes."
  depends_on: [managedsystem-runtime-restrictions-execution-implementation]
  attempts: 1

- id: normalized-path-migration-app-routing-nap
  status: done
  result: succeeded
  assignee: aks-explorer
  goal: "Produce outputs/iteration156-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for app-routing-nginx-to-istio-migration and machines-agentpool-nap-default-pool-cleanup-no-machine-crud. Preserve branch boundaries: App Routing migration is generic/non-default-domain only, and NAP cleanup no-Machine-CRUD cannot close Machines API CRUD or full NAP cleanup. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or ManagedSystem cloud probes."
  depends_on: [post-managedsystem-implementation-frontier-selection]
  attempts: 1

- id: bootstrap-byo-acr-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Migrate bootstrap-profile-byo-acr-lifecycle into normalized knowledge-map structure. Start from outputs/iteration117-bootstrap-byo-acr-lifecycle.md, outputs/iteration117-bootstrap-byo-acr-v2-timeout-blocker.md, outputs/iteration118-bootstrap-byo-acr-hardened-followup.md, features/bootstrap-profile-byo-acr-lifecycle.yaml, run-plans/bootstrap-profile-byo-acr-lifecycle.yaml, probes/bootstrap-profile-byo-acr-lifecycle.ts, knowledge-map/README.md, and knowledge-map/model.json. Add or update userScenarios, inputDags, and featurePaths so the BYO ACR Cache/Direct/Cache lifecycle is represented with expected behavior, observed blocked/precondition evidence, and no product mismatch claim. Run bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any Bootstrap BYO cloud rerun."
  depends_on: [normalized-path-migration-app-routing-nap]
  attempts: 1

- id: approuting-tls-secret-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration157-approuting-tls-secret-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for app-routing-default-domain-tls-secret. Preserve the valid-input boundary from iterations70/80/81/91: DefaultDomainCertificate CR shape was source-equivalent, TLS secret provisioning mismatched, HTTPS 200 used nginx fallback cert, and rerun remains owner/diagnostic-gated. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any App Routing cloud rerun."
  depends_on: [bootstrap-byo-acr-normalized-path-migration]
  attempts: 1

- id: paf-throttling-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Migrate paf-throttling into normalized knowledge-map structure. Start from outputs/iteration148-paf-throttling-source-precondition-reference-packet.md, outputs/iteration149-paf-throttling-model-hygiene.md, outputs/first-e2e-run-results.md, outputs/underlay-debug-findings.md, outputs/iteration26-pafthrottling-retry.md, outputs/e2e-capability-model.json, knowledge-map/README.md, and knowledge-map/model.json. Add or update userScenarios, inputDags, and featurePaths so MSI/HCP access, target capacity or owner-approved bypass, and the source-owner/source-confirmed DedicatedOom trigger/assertion path are represented as blocked preconditions/behavior, without claiming a PAF product assertion failure. Run bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any PAF rerun."
  depends_on: [approuting-tls-secret-normalized-path-migration]
  attempts: 1

- id: virtualmachines-cli-multisku-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration158-virtualmachines-cli-multisku-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for virtualmachines-agentpool-cli-add-multi-sku. Start from outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md, outputs/iteration64-virtualmachines-agentpool-staging.md, outputs/iteration65-virtualmachines-multisku-contract.md, outputs/iteration66-virtualmachines-manual-scale-staging.md, outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md, knowledge-map/README.md, knowledge-map/model.json, and knowledge-map/views/status-summary.json. Preserve the narrow CLI/help-contract boundary: preview az nodepool add with --vm-set-type VirtualMachines and comma multi-SKU --vm-sizes fails before persistence, while CLI single-SKU add, manual multiple single-size profiles, REST mixed manual profiles, and autoscaled VMs CRUD/upgrade remain adjacent passing paths. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any VirtualMachines cloud rerun."
  depends_on: [paf-throttling-normalized-path-migration]
  attempts: 1

- id: vpa-cert-renewal-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration159-vpa-cert-renewal-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for workload-autoscaler-vpa-cert-renewal-runtime. Start from outputs/iteration107-vpa-cert-renewal-runtime-staging.md, outputs/iteration122-vpa-runtime-rollup-model-hygiene.md, knowledge-map/model.json, and knowledge-map/views/path-summary.json. Preserve the source-equivalent blocked boundary: VPA baseline components were ready and source-shaped near-expiry vpa-tls-certs mutation recovered only via legacy overlay-vpa-cert-webhook-check, but kube-system/vpa-webhook-tls-reconciler was NotFound so the source VerifyVpaCertRenewal branch remains blocked until that CronJob exists or a source owner confirms the legacy path as intended. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any VPA cloud rerun."
  depends_on: [virtualmachines-cli-multisku-normalized-path-migration]
  attempts: 1

- id: virtualmachines-mixed-sku-rest-scale-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration160-virtualmachines-mixed-sku-rest-scale-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for virtualmachines-mixed-sku-rest-scale. Start from outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md, outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md, outputs/iteration158-virtualmachines-cli-multisku-normalized-path-migration.md, outputs/iteration66-virtualmachines-manual-scale-staging.md, outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md, knowledge-map/model.json, and knowledge-map/views/path-summary.json. Preserve the pass boundary: source-equivalent ARM REST mixed manual[] profile create/scale transitions passed, and this path must remain distinct from preview CLI comma multi-SKU failure, CLI single-SKU add, CLI manual-scale multiple single-size profiles, and autoscaled VMs CRUD/upgrade. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any VirtualMachines cloud rerun."
  depends_on: [vpa-cert-renewal-normalized-path-migration]
  attempts: 1

- id: virtualmachines-autoscaled-vms-crud-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration161-virtualmachines-autoscaled-vms-crud-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for virtualmachines-autoscaled-vms-crud. Start from outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md, outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md, outputs/iteration158-virtualmachines-cli-multisku-normalized-path-migration.md, outputs/iteration160-virtualmachines-mixed-sku-rest-scale-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the pass boundary: source-authored Scenario_Autoscaled_VMs_CRUD creates a default/system type=VirtualMachines pool named autoscaleap, converts its virtualMachinesProfile.scale from manual to autoscale min/max, updates autoscale bounds, upgrades Kubernetes, and verifies autoscale profile plus node readiness before/after upgrade. Keep this path distinct from preview CLI comma multi-SKU failure, REST mixed manual[] profile scale, CLI single-SKU add, CLI manual-scale multiple single-size profiles, Machines API CRUD, and NAP cleanup. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any VirtualMachines cloud rerun."
  depends_on: [virtualmachines-mixed-sku-rest-scale-normalized-path-migration]
  attempts: 1

- id: virtualmachines-cli-single-sku-autoscale-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration162-virtualmachines-cli-single-sku-autoscale-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for virtualmachines-agentpool-cli-add-single-sku and virtualmachines-agentpool-cli-autoscale-update-single-sku. Start from outputs/iteration64-virtualmachines-agentpool-staging.md, outputs/iteration65-virtualmachines-multisku-contract.md, outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md, outputs/iteration158-virtualmachines-cli-multisku-normalized-path-migration.md, outputs/iteration161-virtualmachines-autoscaled-vms-crud-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the pass boundaries: preview CLI add with exactly one supported --vm-sizes value persists manual[0], and preview CLI autoscale enable/update persists one autoscale profile with one VM size/min/max. Keep both paths distinct from preview CLI comma multi-SKU failure, REST mixed manual[] profiles, CLI manual-scale multiple single-size profiles, autoscaled default/system pool CRUD/upgrade, Machines API CRUD, and NAP cleanup. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any VirtualMachines cloud rerun."
  depends_on: [virtualmachines-autoscaled-vms-crud-normalized-path-migration]
  attempts: 1

- id: virtualmachines-cli-manual-scale-multiple-profiles-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration163-virtualmachines-cli-manual-scale-multiple-profiles-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for virtualmachines-agentpool-cli-manual-scale-multiple-profiles. Start from outputs/iteration66-virtualmachines-manual-scale-staging.md, outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md, outputs/iteration158-virtualmachines-cli-multisku-normalized-path-migration.md, outputs/iteration160-virtualmachines-mixed-sku-rest-scale-normalized-path-migration.md, outputs/iteration161-virtualmachines-autoscaled-vms-crud-normalized-path-migration.md, outputs/iteration162-virtualmachines-cli-single-sku-autoscale-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the pass boundary: preview CLI manual-scale add/delete creates and removes multiple single-size manual profile entries on a VirtualMachines User pool. Keep this path distinct from preview CLI comma multi-SKU nodepool add failure, CLI single-SKU add-only, CLI autoscale update, REST mixed manual[] profile scale, autoscaled default/system pool CRUD/upgrade, Machines API CRUD, and NAP cleanup. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any VirtualMachines cloud rerun."
  depends_on: [virtualmachines-cli-single-sku-autoscale-normalized-path-migration]
  attempts: 1

- id: approuting-default-domain-istio-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration164-approuting-default-domain-istio-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for app-routing-default-domain-istio. Start from outputs/e2ev3-handwritten-coverage-inventory.md, outputs/iteration128-app-routing-istio-source-design.md, outputs/iteration132-approuting-generic-istio-gateway-source-split.md, outputs/iteration137-approuting-nginx-to-istio-migration-execution.md, outputs/iteration157-approuting-tls-secret-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the unknown/gated default-domain boundary: this source branch is DefaultDomain + Istio/Gateway API and must remain distinct from the generic/non-default-domain NGINX-to-Istio migration pass and the default-domain TLS-secret failure. Model expected behavior and current unknown observations only; do not claim a product verdict or close adjacent App Routing branches. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any App Routing cloud rerun."
  depends_on: [virtualmachines-cli-manual-scale-multiple-profiles-normalized-path-migration]
  attempts: 1

- id: approuting-default-domain-tls-lifecycle-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration165-approuting-default-domain-tls-lifecycle-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for app-routing-default-domain-tls-lifecycle. Start from outputs/e2ev3-handwritten-coverage-inventory.md, outputs/iteration70-app-routing-defaultdomain-tls-staging.md, outputs/iteration80-app-routing-tls-source-hypothesis.md, outputs/iteration81-app-routing-tls-owner-escalation.md, outputs/iteration91-app-routing-tls-gated-followup-tracker.md, outputs/iteration128-app-routing-istio-source-design.md, outputs/iteration157-approuting-tls-secret-normalized-path-migration.md, outputs/iteration164-approuting-default-domain-istio-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the unknown/gated default-domain TLS lifecycle boundary: model the source expected certificate rotation/post-upgrade/lifecycle behaviors and current unknown observations without reclassifying the already-failing initial TLS secret provisioning branch or claiming the default-domain Istio path. Link the rerun gate to owner diagnostics, fixed/known-good build/configuration, or a source-proven live-verifiable TLS-secret precondition. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any App Routing cloud rerun."
  depends_on: [approuting-default-domain-istio-normalized-path-migration]
  attempts: 1

- id: approuting-default-domain-http-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration166-approuting-default-domain-http-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for the non-TLS App Routing default-domain branch: app-routing-default-domain HTTP/DNS reachability plus app-routing-public-api-default-domain-enable state evidence where appropriate. Start from outputs/e2ev3-handwritten-coverage-inventory.md, outputs/iteration68-app-routing-defaultdomain-staging.md, outputs/iteration69-app-routing-defaultdomain-traffic-staging.md, outputs/iteration70-app-routing-defaultdomain-tls-staging.md, outputs/iteration157-approuting-tls-secret-normalized-path-migration.md, outputs/iteration164-approuting-default-domain-istio-normalized-path-migration.md, outputs/iteration165-approuting-default-domain-tls-lifecycle-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the pass boundary: staging proved default-domain profile configured, DNS resolved, and HTTP 200 through NGINX/Ingress for a non-TLS Ingress; it did not prove DefaultDomainCertificate/default-domain-tls, TLS lifecycle, default-domain Istio/Gateway, or generic non-default-domain NGINX-to-Istio migration behavior. Treat older standalone failure evidence as adjacent TLS/default-domain context superseded for HTTP-only reachability by iteration69, not as a reason to copy TLS-secret failure onto the HTTP branch. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any App Routing cloud rerun."
  depends_on: [approuting-default-domain-tls-lifecycle-normalized-path-migration]
  attempts: 1

- id: approuting-public-api-enable-disable-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration167-approuting-public-api-enable-disable-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for app-routing-public-api-enable and app-routing-public-api-disable. Start from outputs/iteration59-app-routing-staging.md, outputs/iteration67-app-routing-disable-staging.md, outputs/iteration166-approuting-default-domain-http-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the narrow public-CLI state boundary: iteration59 proves basic App Routing enablement with defaultDomain.enabled=false and does not claim workload traffic/default-domain/TLS/Istio; iteration67 proves enable->disable state persistence with webAppRouting.enabled=false and identity removal/null and does not claim route cleanup, traffic, default-domain, or TLS behavior. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any App Routing cloud rerun."
  depends_on: [approuting-default-domain-http-normalized-path-migration]
  attempts: 1

- id: approuting-nginx-disablement-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration168-approuting-nginx-disablement-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for app-routing-nginx-disablement / Scenario_Traffic_AppRouting_Nginx_Disablement. Start from outputs/successful-e2e-run.md, knowledge-map/model.json, and knowledge-map/views/path-summary.json. Preserve the standalone dev-suite NGINX-only boundary: the pass proves the source-authored scenario reached UpdateManagedCluster enable-nginx, Verify nginx CRD/pods, and test succeeded, but does not claim public API enable/disable, route cleanup, traffic, default-domain, TLS, Istio, or migration behavior. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any App Routing cloud rerun."
  depends_on: [approuting-public-api-enable-disable-normalized-path-migration]
  attempts: 1

- id: managedsystem-standalone-e2ev3-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration169-managedsystem-standalone-e2ev3-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for managedsystem-pool-standalone-e2ev3 / Scenario_ManagedSystemPool_Enable. Start from outputs/iteration24-managedsystem-pool-pass.md, outputs/managedsystem-pool-feature-intent.md, outputs/managedsystem-pool-evidence-state-matrix.md, outputs/managedsystem-pool-feature-standard.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the standalone e2ev3 enable boundary and keep it distinct from staging REST add-existing, CLI create/add failures, mode immutability, delete, disable migration, runtime restrictions, single-pool constraint, and reconcile preservation branches. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or ManagedSystem cloud probes."
  depends_on: [approuting-nginx-disablement-normalized-path-migration]
  attempts: 1

- id: node-autoprovision-public-api-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration170-node-autoprovision-public-api-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for node-autoprovision-create-auto, node-autoprovision-update-default-pools-none, and node-autoprovision-update-mode-manual. Start from outputs/iteration57-node-autoprovision-staging.md, outputs/iteration58-node-autoprovision-followup.md, outputs/aks-public-api-scenario-candidates.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the pass boundary: iteration57 proves public CLI preview create with nodeProvisioningProfile.mode=Auto/defaultNodePools=Auto plus Azure CNI overlay/Cilium persisted; iteration58 proves defaultNodePools Auto->None and mode Auto->Manual updates persisted. Do not claim Machines/NAP default Machines pool aksmanagedap cleanup, Machine API CRUD, Karpenter workload scheduling, scale-out behavior, or same-input eastus2 reruns. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, Machine APIs, deleteMachines, or any NAP/Machines cloud rerun."
  depends_on: [managedsystem-standalone-e2ev3-normalized-path-migration]
  attempts: 1

- id: workload-identity-public-api-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration171-workload-identity-public-api-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for workload-identity-public-api-create and workload-identity-public-api-idempotent-update. Start from outputs/iteration60-workload-identity-staging.md, outputs/aks-public-api-scenario-candidates.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the pass boundary: create proves public CLI preview create with --enable-managed-identity, --enable-oidc-issuer, and --enable-workload-identity reached Succeeded and persisted oidcIssuerProfile.enabled=true with HTTPS issuerUrl plus securityProfile.workloadIdentity.enabled=true; idempotent update proves az aks update with the same enable flags preserved that state. Do not claim Linux/Windows token projection, OIDC discovery/JWKS, signing-key rotation, post-delete cleanup, v1.33 explicit-enable runtime, disable/re-enable lifecycle, or synchronous RG cleanup completion. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any identity/OIDC cloud rerun."
  depends_on: [node-autoprovision-public-api-normalized-path-migration]
  attempts: 1

- id: workload-identity-runtime-token-projection-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration172-workload-identity-runtime-token-projection-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for workload-identity-runtime-token-projection-linux and workload-identity-runtime-token-projection-windows. Start from outputs/iteration76-workload-identity-oidc-runtime-staging.md, outputs/iteration103-workload-identity-windows-token-projection-staging.md, outputs/e2ev3-handwritten-coverage-inventory.md, outputs/iteration77-identity-runtime-model-consolidation.md, outputs/iteration171-workload-identity-public-api-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the runtime boundary: Linux and Windows pod token projection are workload-identity runtime behavior and must stay distinct from public API create/update state persistence, OIDC discovery/JWKS, OIDC signing-key rotation, post-delete issuer cleanup, OIDC v1.33 explicit-enable behavior, and disable/re-enable lifecycle. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any identity/OIDC cloud rerun."
  depends_on: [workload-identity-public-api-normalized-path-migration]
  attempts: 1

- id: identity-oidc-lifecycle-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration173-identity-oidc-lifecycle-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for oidc-issuer-default-enabled-discovery-jwks-runtime, oidc-issuer-default-enabled-signing-key-rotation, oidc-issuer-default-enabled-post-delete-cleanup, oidc-issuer-v133-explicit-enable-runtime, and workload-identity-disable-reenable-lifecycle. Start from outputs/iteration76-workload-identity-oidc-runtime-staging.md, outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md, outputs/iteration97-oidc-post-delete-cleanup-staging.md, outputs/iteration99-oidc-v133-explicit-enable-staging.md, outputs/iteration119-oidc-signing-key-rotation-model-update.md, outputs/iteration119-oidc-rotation-oidc-signing-key-rotation.md, outputs/iteration77-identity-runtime-model-consolidation.md, outputs/iteration171-workload-identity-public-api-normalized-path-migration.md, outputs/iteration172-workload-identity-runtime-token-projection-normalized-path-migration.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve branch boundaries: default-enabled discovery/JWKS, default-enabled signing-key rotation, default-enabled post-delete cleanup, v1.33 explicit-enable discovery/JWKS, and Workload Identity disable/re-enable lifecycle remain distinct from each other and from public API create/update plus Linux/Windows token projection. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any identity/OIDC cloud rerun."
  depends_on: [workload-identity-runtime-token-projection-normalized-path-migration]
  attempts: 1

- id: bootstrap-profile-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration174-bootstrap-profile-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for bootstrap-profile-artifact-source-direct-create, bootstrap-profile-artifact-source-direct-update, bootstrap-profile-artifact-source-cache-update-auto-registry, and bootstrap-profile-managed-acr-lifecycle. Start from outputs/iteration63-bootstrap-profile-staging.md, outputs/iteration116-bootstrap-managed-acr-lifecycle.md, outputs/aks-public-api-scenario-candidates.md, outputs/e2ev3-handwritten-coverage-inventory.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve the boundaries: public API Direct create/update and Cache auto-registry state persistence are distinct from the source-shaped managed-ACR Cache -> Direct -> Cache lifecycle with image-pull and managed-registry cleanup assertions; do not claim BYO ACR lifecycle, hardened custom VNet behavior, or any rerun. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, ACR creation, network mutation, or any Bootstrap cloud rerun."
  depends_on: [identity-oidc-lifecycle-normalized-path-migration]
  attempts: 1

- id: workload-autoscaler-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration175-workload-autoscaler-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for existing workload-autoscaler KEDA/VPA branches that do not yet have featurePaths: workload-autoscaler-keda-profile-state, workload-autoscaler-keda-runtime, workload-autoscaler-keda-crud, workload-autoscaler-vpa-profile-state, workload-autoscaler-vpa-components-recommendations-runtime, workload-autoscaler-vpa-inplace-update-runtime, workload-autoscaler-vpa-ha-leader-election-runtime, workload-autoscaler-vpa-cert-renewal-runtime, workload-autoscaler-vpa-upgrade-survival-runtime, and workload-autoscaler-vpa-helm-release-runtime. Start from outputs/iteration61-workload-autoscaler-staging.md, outputs/iteration78-workload-autoscaler-runtime-staging.md, outputs/iteration79-vpa-runtime-model-split.md, outputs/iteration84-keda-disable-reenable-crud-staging.md, outputs/iteration93-vpa-residual-runtime-staging.md, outputs/iteration107-vpa-cert-renewal-runtime-staging.md, outputs/iteration115-vpa-upgrade-survival-runtime.md, outputs/iteration122-vpa-runtime-rollup-model-hygiene.md, features/workload-autoscaler-vpa-upgrade-survival.yaml, run-plans/vpa-upgrade-survival-runtime.yaml, probes/vpa-upgrade-survival-runtime.ts, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve branch boundaries: KEDA profile persistence, KEDA runtime scaling, KEDA disable/re-enable CRUD, VPA profile persistence, VPA components/recommendations, VPA in-place update, VPA HA/leader-election, VPA cert-renewal, VPA upgrade survival, and VPA Helm release metadata must remain distinct; keep VPA cert-renewal blocked on the source-equivalence/reconciler gate and do not reclassify it as pass/fail. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any workload-autoscaler cloud rerun."
  depends_on: [bootstrap-profile-normalized-path-migration]
  attempts: 1

- id: security-profile-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration176-security-profile-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for existing security-profile branches that do not yet have featurePaths: image-cleaner-state-interval, image-cleaner-components-lifecycle, image-cleaner-vulnerable-image-erasure, image-cleaner-upgrade-restart-survival, node-restriction-disable-contract, node-restriction-runtime-default, and node-restriction-tag-only-patch-shape. Start from outputs/iteration62-security-profile-staging.md, outputs/iteration74-node-restriction-source-spec-resolution.md, outputs/iteration83-node-restriction-fullput-runtime-staging.md, outputs/iteration86-image-cleaner-runtime-source-gated-staging.md, outputs/iteration95-image-cleaner-vulnerable-erasure-staging.md, outputs/iteration111-image-cleaner-upgrade-restart-survival-staging.md, outputs/iteration120-node-restriction-tag-only-patch-shape.md, outputs/iteration121-node-restriction-tag-only-patch-model-hygiene.md, outputs/node-restriction-source-spec-investigation.md, outputs/aks-public-api-scenario-candidates.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve branch boundaries: Image Cleaner profile/interval state, components disable/re-enable lifecycle, vulnerable-image erasure, and upgrade/restart survival must remain distinct pass branches; Node Restriction full-PUT disable rejection/error shape, runtime default admission, and tag-only PATCH/non-contract must remain distinct branches. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, cloud mutation, or any security-profile cloud rerun."
  depends_on: [workload-autoscaler-normalized-path-migration]
  attempts: 1

- id: machines-nap-full-normalized-path-migration
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Produce outputs/iteration177-machines-nap-full-normalized-path-migration.md and update knowledge-map/model.json plus generated knowledge-map/views by adding normalized userScenarios, inputDags, and featurePaths for the remaining full Machines/NAP branches that do not yet have featurePaths: machines-agentpool-api-crud and machines-agentpool-nap-default-pool-cleanup. Start from outputs/iteration105-machines-agentpool-api-crud-staging.md, outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, outputs/iteration130-machines-nap-default-pool-cleanup-split-model-design.md, outputs/iteration131-nap-cleanup-split-model-edit.md, outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun.md, outputs/iteration144-nap-aksmanagedap-absence-source-triage.md, outputs/iteration145-nap-managed-machine-pool-rollout-escalation.md, outputs/iteration146-post-nap-escalation-knowledge-map-refresh.md, knowledge-map/model.json, knowledge-map/views/path-summary.json, and knowledge-map/views/status-summary.json. Preserve branch boundaries: machines-agentpool-api-crud must remain blocked on missing Machine preview feature registrations or equivalent source environment; full machines-agentpool-nap-default-pool-cleanup must remain unknown/source-equivalent gated because it includes Machine CRUD and NAP managed Machines pool cleanup; machines-agentpool-nap-default-pool-cleanup-no-machine-crud must remain a separate failed split path and must not close either full branch. Validate with bun capability-model/src/validate.ts knowledge-map/model.json and regenerate knowledge-map/views. Do not run az, kubectl, --execute, standalone/staging, cluster creation, Machine APIs, deleteMachines, cloud mutation, or any Machines/NAP cloud rerun."
  depends_on: [security-profile-normalized-path-migration]
  attempts: 1

- id: app-routing-http-reach-fail-hypothesis
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Analyze the app-routing default-domain-http-reachability fail path. Read outputs/iteration69-app-routing-defaultdomain-traffic-staging.md, outputs/iteration70-app-routing-defaultdomain-tls-staging.md, outputs/iteration80-app-routing-tls-source-hypothesis.md, outputs/iteration81-app-routing-tls-owner-escalation.md, knowledge-map/model.json, and relevant App Routing feature/path data. Document root-cause hypothesis: is the default-domain HTTP path actually failing or is it only the TLS branch? If HTTP is genuinely failing, classify as product bug vs test gap vs environment issue. Produce outputs/iteration195-app-routing-http-reach-fail-hypothesis.md with hypothesis, evidence citations, and a test-spec if a distinct HTTP failure exists. Do not run cloud probes."
  depends_on: [machines-nap-full-normalized-path-migration]
  attempts: 1

- id: pass-path-expectation-density-enrichment
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P3
  goal: "Enrich thin pass paths that have fewer than 3 behavioral expectations. Inspect knowledge-map/model.json for pass-status features with sparse expectation coverage. Use feature packets under features/, API specs, public docs, and existing evidence artifacts to add concrete behavioral expectations to at least 5 paths, raising each to 4+ expectations. Update knowledge-map/model.json, validate with bun capability-model/src/validate.ts knowledge-map/model.json, regenerate views, and produce outputs/iteration196-pass-path-expectation-density-enrichment.md. Do not run cloud probes."
  depends_on: [app-routing-http-reach-fail-hypothesis]
  attempts: 1

- id: nap-full-cleanup-test-spec-creation
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P3
  goal: "Create a test-spec for the full NAP cleanup path (machines-agentpool-nap-default-pool-cleanup) that captures expected behavior and known failure modes. Read outputs/iteration127-machines-nap-default-pool-cleanup-source-design.md, outputs/iteration130-machines-nap-default-pool-cleanup-split-model-design.md, outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun.md, outputs/iteration144-nap-aksmanagedap-absence-source-triage.md, outputs/iteration145-nap-managed-machine-pool-rollout-escalation.md, and knowledge-map/model.json. Produce outputs/iteration197-nap-full-cleanup-test-spec.md with: scenario intent from source, input DAG, expected behavior sequence including Machine CRUD, known blockers (feature registration, rollout gates), and explicit execution prerequisites that must be met before a probe can run. Do not run cloud probes."
  depends_on: [app-routing-http-reach-fail-hypothesis]
  attempts: 1

- id: feature-learning-queue-refresh
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Rebuild the prioritized AKS feature-learning queue from the current model state. Inspect outputs/e2e-capability-model.json for unknown/blocked/failing features, review outputs/iteration82-post-escalation-next-probe-selection.md and outputs/iteration75-model-driven-probe-selection.md for prior ranking logic, check devbox /home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/ for any new or changed handwritten cases since the last inventory, and review public AKS API changelog or new preview features. Produce outputs/iteration198-feature-learning-queue-refresh.md ranking the top 5-8 features by: learning value (unknown > blocked > enrichable pass), local-work feasibility (no cloud gate), source availability, and model coverage gap. For each candidate, state the next concrete task type (reference packet, test-spec, probe implementation, or execution gate check). Update Current State in project.md to reflect the new queue."
  depends_on: [nap-full-cleanup-test-spec-creation]
  attempts: 1

- id: keda-profile-state-reference-packet
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Create a reference packet for workload-autoscaler-keda-profile-state. Read devbox source under /home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/ for KEDA/workload-autoscaler scenarios, outputs/iteration198-feature-learning-queue-refresh.md, outputs/iteration84-keda-disable-reenable-crud-staging.md, outputs/iteration78-workload-autoscaler-runtime-staging.md, outputs/e2e-capability-model.json, and knowledge-map/model.json. Produce features/workload-autoscaler-keda-profile-state.yaml with source-derived intent, input paths, expectation paths, evidence links, non-goals, and execution gates. Run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts knowledge-map/model.json to confirm no regression. Do not run cloud probes."
  depends_on: [feature-learning-queue-refresh]
  attempts: 1

- id: vpa-profile-state-reference-packet
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Create a reference packet for workload-autoscaler-vpa-profile-state. Read devbox source under /home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/ for VPA/workload-autoscaler scenarios, outputs/iteration198-feature-learning-queue-refresh.md, outputs/iteration93-vpa-residual-runtime-staging.md, outputs/iteration79-vpa-runtime-model-split.md, outputs/e2e-capability-model.json, and knowledge-map/model.json. Produce features/workload-autoscaler-vpa-profile-state.yaml with source-derived intent, input paths, expectation paths, evidence links, non-goals, and execution gates. Run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts knowledge-map/model.json to confirm no regression. Do not run cloud probes."
  depends_on: [feature-learning-queue-refresh]
  attempts: 1

- id: image-cleaner-state-interval-reference-packet
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Create a reference packet for image-cleaner-state-interval. Read devbox source under /home/hayua/rp/test/e2ev3/ for Image Cleaner scenarios, outputs/iteration198-feature-learning-queue-refresh.md, outputs/iteration95-image-cleaner-vulnerable-erasure-staging.md, outputs/iteration111-image-cleaner-upgrade-restart-survival-staging.md, outputs/e2e-capability-model.json, and knowledge-map/model.json. Produce features/image-cleaner-state-interval.yaml with source-derived intent, input paths, expectation paths, evidence links, non-goals, and execution gates. Run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts knowledge-map/model.json to confirm no regression. Do not run cloud probes."
  depends_on: [feature-learning-queue-refresh]
  attempts: 1

- id: managedsystem-runtime-restrictions-test-spec
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Create a test-spec for managedsystem-runtime-restrictions. Read devbox source under /home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/ for ManagedSystem runtime restriction scenarios, outputs/iteration198-feature-learning-queue-refresh.md, outputs/iteration88-managedsystem-disable-migration-checkpointed.md, knowledge-map/model.json, and outputs/e2e-capability-model.json. Produce outputs/iteration199-managedsystem-runtime-restrictions-test-spec.md with: scenario intent from source, input DAG, expected behavior sequence, known blockers, and explicit execution prerequisites. Validate model with bun capability-model/src/validate.ts knowledge-map/model.json. Do not run cloud probes."
  depends_on: [image-cleaner-state-interval-reference-packet]
  attempts: 1

- id: managedsystem-single-pool-constraint-test-spec
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Create a test-spec for managedsystem-single-pool-constraint. Read devbox source under /home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/ for ManagedSystem single-pool constraint scenarios, outputs/iteration198-feature-learning-queue-refresh.md, knowledge-map/model.json, and outputs/e2e-capability-model.json. Produce outputs/iteration200-managedsystem-single-pool-constraint-test-spec.md with: scenario intent from source, input DAG, expected behavior sequence, known blockers, and explicit execution prerequisites. Validate model with bun capability-model/src/validate.ts knowledge-map/model.json. Do not run cloud probes."
  depends_on: [image-cleaner-state-interval-reference-packet]
  attempts: 1

- id: managedsystem-reconcile-preservation-test-spec
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Create a test-spec for managedsystem-reconcile-preservation. Read devbox source under /home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/ for ManagedSystem reconcile preservation scenarios, outputs/iteration198-feature-learning-queue-refresh.md, knowledge-map/model.json, and outputs/e2e-capability-model.json. Produce outputs/iteration201-managedsystem-reconcile-preservation-test-spec.md with: scenario intent from source, input DAG, expected behavior sequence, known blockers, and explicit execution prerequisites. Validate model with bun capability-model/src/validate.ts knowledge-map/model.json. Do not run cloud probes."
  depends_on: [image-cleaner-state-interval-reference-packet]
  attempts: 1

- id: managedsystem-disable-migration-gate-check
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P3
  goal: "Perform an execution gate check for managedsystem-disable-migration. Read outputs/iteration87-managedsystem-disable-migration-runtime-staging.md, outputs/iteration88-managedsystem-disable-migration-checkpointed.md, outputs/iteration198-feature-learning-queue-refresh.md, and knowledge-map/model.json. Investigate whether the prior fail trigger (SKU/image/defaulting gate) has been resolved by checking devbox source changes, feature registration state, or environment updates. Produce outputs/iteration202-managedsystem-disable-migration-gate-check.md with: current gate status, evidence of change or no-change, and recommended next action (rerun, wait, or close). Do not run cloud probes."
  depends_on: [image-cleaner-state-interval-reference-packet]
  attempts: 1

- id: iteration203-model-enrichment-from-new-packets
  result: dropped
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Enrich knowledge-map/model.json with the new reference packets and test-specs from iterations 197-202."
  depends_on: [managedsystem-disable-migration-gate-check]
  attempts: 2

- id: iteration204-feature-learning-queue-refresh-v2
  status: ready
  assignee: aks-explorer
  priority: P2
  goal: "Rebuild the prioritized AKS feature-learning queue from the updated model state after iteration 203 enrichment. Follow the same method as iteration 198 (outputs/iteration198-feature-learning-queue-refresh.md): inspect model for unknown/blocked/failing features, check devbox source for new/changed cases, and rank the top 5-8 features by learning value, local-work feasibility, source availability, and model coverage gap. Produce outputs/iteration204-feature-learning-queue-refresh-v2.md with the ranked queue and concrete next task type per candidate. Update Current State in project.md."
  depends_on: [iteration203-model-enrichment-from-new-packets]
  attempts: 0

- id: iteration205-keda-profile-state-probe-design
  status: ready
  assignee: aks-explorer
  priority: P2
  goal: "Design a TypeScript probe for workload-autoscaler-keda-profile-state. Read features/workload-autoscaler-keda-profile-state.yaml, outputs/iteration84-keda-disable-reenable-crud-staging.md, outputs/iteration78-workload-autoscaler-runtime-staging.md, and knowledge-map/model.json. Produce probes/workload-autoscaler-keda-profile-state.ts implementing the reference packet scenarios with path-specific verdicts. Include a run-plan at run-plans/workload-autoscaler-keda-profile-state.yaml. Local preflight with --check must pass. Produce outputs/iteration205-keda-profile-state-probe-design.md documenting the design and preflight result. Do not run cloud probes."
  depends_on: [iteration203-model-enrichment-from-new-packets]
  attempts: 0

- id: iteration355-harvest-new-pass-specs
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P1
  goal: "Create feature packets and test-specs for 3 newly-discovered pass-status scenario specs NOT in the project's 56-feature set. Targets: (1) app-routing-nginx-to-istio-migration (pass, 18 assertions, 4 devbox sourceRefs from approutingmigration/), (2) app-routing-nginx-disablement (pass, 5 assertions, devbox sourceRef nginx_disablement.go), (3) vpa-upgrade-survival-runtime (pass, 5 assertions, distinct from vpa-profile-state, cloud replay iter115 evidence). All enter with immediate pass verdicts. Output: sources/feature-packets/ + outputs/ for each. Target: pass rate 19/59 = 32.2%."
  depends_on: []
  attempts: 1

- id: iteration356-updated-coverage-matrix-v18
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P1
  goal: "Update coverage matrix to include all 59 features with verdict status. Output: outputs/iteration356-coverage-gap-matrix-v18.md. Target: 59 features total, 19 pass (32.2%), 2 source-backed (3.4%)."
  depends_on: [iteration355-harvest-new-pass-specs]
  attempts: 1

- id: iteration357-rescan-additional-pass-specs
  result: succeeded
  status: done
  assignee: aks-explorer
  priority: P2
  goal: "Full re-scan of all 74 scenario test-spec files for any additional pass/staging-pass status specs that emerged since the iteration322 freeze. Compare each file's status field and metadata.status field against the project's feature list. Produce delta report. Output: outputs/iteration357-rescan-pass-delta.md."
  depends_on: [iteration356-updated-coverage-matrix-v18]
  attempts: 1

## References

**Resources:**
- devbox:/home/hayua/rp — AKS RP monorepo (SSH: `ssh devbox`)
- devbox:/home/hayua/rp/test/e2ev3/README.md — e2ev3 getting started
- devbox:/home/hayua/rp/.github/copilot-instructions.md — repo conventions
- devbox:/home/hayua/rp/.github/.copilot/domain_knowledge/ — detailed domain docs
- devbox:/home/hayua/rp/test/e2ev3/sigs/rp/nativerp/plans/ — RP SIG test plans
- devbox:/home/hayua/rp/test/e2ev3/cmd/dev/main.go — dev suite entrypoint
- devbox:/home/hayua/rp/hack/e2ev3 — e2e runner script

**Artifacts:**
- See `## Artifacts`; primary current evidence is
  `outputs/first-e2e-run-results.md`.


## Validation
- Staging is accepted as an execution target while standalone is unavailable or lower priority, but execution should be chosen because it improves the knowledge map.
- ManagedSystem Pool and similar work must distinguish RP behavior, CLI behavior, test/setup behavior, and observation context.
- Capability model changes are accepted only after the project-local validator passes.
- Public Azure AKS API/spec research should produce concrete input variables, domains, request shapes, operations, mutability, and constraints.
- Public Azure AKS docs research should produce concrete expectation variables, intended behavior, prerequisites, lifecycle, validation rules, and user-visible outcomes.
- Feature candidates should be selected subsets/intersections of input and expectation space, preferably anchored by solid developer-written e2ev3 checks.
- Existing handwritten e2ev3 cases should be deep-dived and mapped into the feature matrix before being treated as the next run queue or before inventing new candidates from docs.
- ManagedSystem Pool should become the first complete example of the boundary-mapping method before the method is applied broadly.
- Feature pass/fail judgment should cite a feature reference packet or explicitly explain which ground-truth references are missing.
- TypeScript probes and run plans must be reviewable, but they should not wait
  for human approval by default. Agents should self-check preflight, execute
  when safe, and then review whether the process/result honestly reflected the
  source intent.
- Replanning should optimize scenario/expectation density only after single-case TS probes prove they can produce honest structured evidence.
- Dark-side discovery starts only after the baseline map can explain current coverage and name the important unknowns.

## Comments

## Artifacts
- outputs/iteration175-workload-autoscaler-normalized-path-migration.md
- outputs/iteration174-bootstrap-profile-normalized-path-migration.md
- outputs/iteration173-identity-oidc-lifecycle-normalized-path-migration.md
- outputs/iteration172-workload-identity-runtime-token-projection-normalized-path-migration.md
- outputs/iteration171-workload-identity-public-api-normalized-path-migration.md
- outputs/iteration170-node-autoprovision-public-api-normalized-path-migration.md
- outputs/iteration169-managedsystem-standalone-e2ev3-normalized-path-migration.md
- outputs/iteration168-approuting-nginx-disablement-normalized-path-migration.md
- outputs/iteration157-approuting-tls-secret-normalized-path-migration.md
- outputs/iteration156-normalized-path-migration.md
- outputs/iteration148-paf-throttling-source-precondition-reference-packet.md
- outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md
- outputs/iteration144-nap-aksmanagedap-absence-source-triage.md
- outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun.md
- outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun-machines-nap-default-pool-cleanup-no-machine-crud.md
- outputs/iteration143-nap-cleanup-no-machine-crud-az-rest-resource-rerun-machines-nap-default-pool-cleanup-no-machine-crud.json
- outputs/iteration142-nap-cleanup-no-machine-crud-execution.md
- outputs/iteration142-nap-cleanup-no-machine-crud-execution-machines-nap-default-pool-cleanup-no-machine-crud.md
- outputs/iteration142-nap-cleanup-no-machine-crud-execution-machines-nap-default-pool-cleanup-no-machine-crud.json
- outputs/iteration141-nap-cleanup-no-machine-crud-preflight-hygiene.md
- outputs/iteration141-local-machines-nap-default-pool-cleanup-no-machine-crud.md
- outputs/iteration141-local-machines-nap-default-pool-cleanup-no-machine-crud.json
- outputs/iteration136-approuting-nginx-to-istio-migration-execution-implementation.md
- outputs/iteration136-local-app-routing-nginx-to-istio-migration.md
- outputs/iteration136-local-app-routing-nginx-to-istio-migration.json
- outputs/iteration135-knowledge-map-refresh.md
- outputs/iteration134-approuting-nginx-to-istio-migration-probe-design.md
- outputs/iteration134-local-app-routing-nginx-to-istio-migration-design-preflight.md
- outputs/iteration134-local-app-routing-nginx-to-istio-migration-design-preflight.json
- features/app-routing-nginx-to-istio-migration.yaml
- run-plans/app-routing-nginx-to-istio-migration.yaml
- probes/app-routing-nginx-to-istio-migration.ts
- outputs/iteration133-approuting-generic-migration-model-edit.md
- outputs/iteration132-approuting-generic-istio-gateway-source-split.md
- outputs/iteration131-nap-cleanup-split-model-edit.md
- outputs/iteration130-machines-nap-default-pool-cleanup-split-model-design.md
- outputs/iteration129-residual-split-model-selection.md
- outputs/iteration120-post-oidc-rotation-unknown-selection.md
- outputs/iteration119-oidc-signing-key-rotation-model-update.md
- outputs/iteration119-oidc-rotation-oidc-signing-key-rotation.md
- outputs/iteration119-oidc-rotation-oidc-signing-key-rotation.json
- outputs/iteration119-oidc-rotation-oidc-signing-key-rotation-self-review.md
- outputs/iteration118-bootstrap-byo-acr-hardened-followup.md
- outputs/iteration118-post-byo-unknown-selection.md
- outputs/iteration118-preflight-bootstrap-byo-acr-bootstrap-profile-byo-acr-lifecycle.md
- outputs/iteration118-bootstrap-byo-acr-hardened-i118171741-bootstrap-profile-byo-acr-lifecycle.md
- outputs/iteration117-bootstrap-byo-acr-lifecycle.md
- outputs/iteration117-bootstrap-byo-acr-v2-timeout-blocker.md
- outputs/iteration116-post-vpa-ts-probe-selection.md
- outputs/iteration115-vpa-upgrade-survival-runtime.md
- outputs/iteration115-vpa-upgrade-survival-runtime-vpa-upgrade-survival-runtime.md
- outputs/iteration111-image-cleaner-upgrade-restart-survival-staging.md
- outputs/iteration106-post-machines-blocker-unknown-selection.md
- outputs/iteration104-post-wi-windows-unknown-selection.md
- outputs/iteration103-workload-identity-windows-token-projection-staging.md
- outputs/iteration102-post-virtualmachines-unknown-selection.md
- outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md
- outputs/iteration100-post-oidc-v133-unknown-selection.md
- outputs/iteration97-oidc-post-delete-cleanup-staging.md
- outputs/iteration96-post-image-cleaner-unknown-selection.md
- outputs/iteration95-image-cleaner-vulnerable-erasure-staging.md
- outputs/iteration94-next-model-unknown-selection.md
- outputs/iteration93-vpa-residual-runtime-staging.md
- outputs/iteration91-app-routing-tls-gated-followup-tracker.md
- outputs/iteration82-post-escalation-next-probe-selection.md
- outputs/iteration66-virtualmachines-manual-scale-staging.md
- outputs/iteration70-app-routing-defaultdomain-tls-staging.md
- outputs/managedsystem-pool-repro-pack.md
- outputs/iteration57-node-autoprovision-staging.md
- outputs/doc-verification.md
- outputs/deploy-retry-log.md
- outputs/iteration56-managedsystem-staging-refresh.md
- outputs/iteration63-bootstrap-profile-staging.md
- outputs/public-api-input-expectation-expansion.md
- outputs/iteration68-app-routing-defaultdomain-staging.md
- outputs/iteration55-managedsystem-staging-results.md
- outputs/iteration88-msmig-checkpoint.sh
- outputs/iteration88-msmig-checkpoint-v2.sh
- outputs/iteration88-managedsystem-disable-migration-checkpointed.md
- outputs/run-now.sh
- outputs/e2ev3-handwritten-coverage-inventory.md
- outputs/first-e2e-run-results.md
- outputs/iteration80-app-routing-tls-source-hypothesis.md
- outputs/iteration50-provision-blocker.md
- outputs/e2e-capacity-blocker-analysis.md
- outputs/post-deploy-validation.sh
- outputs/README.md
- outputs/input-expectation-knowledge-map.md
- outputs/iteration65-virtualmachines-multisku-contract.md
- outputs/iteration52-budget-checkpoint-removed.md
- outputs/iteration79-vpa-runtime-model-split.md
- outputs/iteration61-workload-autoscaler-staging.md
- outputs/standalone-setup.md
- outputs/iteration86-image-cleaner-runtime-source-gated-staging.md
- outputs/iteration78-workload-autoscaler-runtime-staging.md
- outputs/iteration73-capability-model-source-inventory-update.md
- outputs/iteration26-pafthrottling-retry.md
- outputs/scenario-catalog.md
- outputs/node-restriction-source-spec-investigation.md
- outputs/unblock-runbook.md
- outputs/iteration67-app-routing-disable-staging.md
- outputs/iteration-status.md
- outputs/20260519T1646Z-managedsystem-priority-staging.md
- outputs/iteration62-security-profile-staging.md
- outputs/underlay-debug-findings.md
- outputs/iteration84-keda-disable-reenable-crud-staging.md
- outputs/e2e-run-results-summary.md
- outputs/final-status.md
- outputs/iteration53-managedsystem-pool-inventory-and-blocker.md
- outputs/test-execution-playbook.md
- outputs/iteration49-provision-blocker.md
- outputs/iteration87-managedsystem-disable-migration-runtime-staging.md
- outputs/managedsystem-pool-exploration.md
- outputs/project-status.md
- outputs/standalone-readiness-check.sh
- outputs/iteration76-workload-identity-oidc-runtime-staging.md
- outputs/aks-public-api-scenario-candidates.md
- outputs/writing-e2e-tests.md
- outputs/iteration77-identity-runtime-model-consolidation.md
- outputs/managedsystem-pool-evidence-state-matrix.md
- outputs/high-density-probe-plan.md
- outputs/iteration83-node-restriction-fullput-runtime-staging.md
- outputs/iteration60-workload-identity-staging.md
- outputs/managedsystem-pool-feature-standard-init-tasks.md
- outputs/managedsystem-pool-api-doc-boundary.md
- outputs/iteration48-new-build-blocker.md
- outputs/iteration81-app-routing-tls-owner-escalation.md
- outputs/iteration69-app-routing-defaultdomain-traffic-staging.md
- outputs/first-e2e-run.sh
- outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md
- outputs/troubleshooting.md
- outputs/managedsystem-pool-feature-standard.md
- outputs/run-e2e.sh
- outputs/e2ev3-architecture.md
- outputs/iteration58-node-autoprovision-followup.md
- outputs/managedsystem-pool-feature-intent.md
- outputs/iteration64-virtualmachines-agentpool-staging.md
- outputs/iteration3-status.md
- outputs/second-e2e-run-results.md
- outputs/iteration24-managedsystem-pool-pass.md
- outputs/iteration74-node-restriction-source-spec-resolution.md
- outputs/e2e-capability-model.json
- outputs/iteration59-app-routing-staging.md
- outputs/e2e-run-attempt.md
- outputs/managedsystem-pool-related-context.md
- outputs/iteration33-standalone-environment-dead.md
- outputs/successful-e2e-run.md
- outputs/iteration75-model-driven-probe-selection.md
- outputs/deploy-status.md
- outputs/e2e-quickref.md
- outputs/deploy-failure-analysis.md
