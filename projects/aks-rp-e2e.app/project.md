---
id: aks-rp-e2e.app
owner: aks-explorer
status: active
type: milestone
priority: P1
iteration: 218
max_concurrent: 5
max_task_attempts: 2
project_policy: aggressive-push
wait_reason: ""
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
`evidence/archive/rest-first-staging-replay-review.md`.

The canonical REST-first golden-path baseline is now ManagedSystem Pool REST
add-existing, captured in
`evidence/archive/managedsystem-rest-golden-path-contract.md`. That branch has
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

Accepted run plans and probes should be tracked under `suites/` and
`replays/`. Runtime evidence stays under `evidence/archive/`. This keeps the system
auditable: future agents can inspect what the probe intended, what it actually
ran, and whether its coverage claim was honest.

Execution strategy details live in `replays/execution/README.md`.

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
- knowledge.source-inventory-modeled: `evidence/archive/iteration73-capability-model-source-inventory-update.md` converted handwritten e2ev3 source intent into first-class model structure; validator exits 0.
- e2e.existing-cases-cataloged: `evidence/archive/scenario-catalog.md` and e2e artifacts provide the first source for inferring feature intent and coverage.
- knowledge.public-api-candidates-started: `evidence/archive/aks-public-api-scenario-candidates.md` derives additional candidate feature surfaces from public AKS API/docs.
- execution.evidence-collected: staging and standalone artifacts provide pass/fail/blocker evidence for ManagedSystem, App Routing, NAP, workload identity, autoscaler, security, bootstrap, and VirtualMachines paths.

## Current State
**Iteration 218 — project active; replay-implementation frontier is live.**

The task tree has active work: 8 ready leaves, 1 active leaf (expired lease),
1 proposed leaf, and 15 decomposed containers. Total 763 tasks: 628 accepted,
110 superseded, 8 ready, 1 active, 1 proposed, 15 decomposed.

**Ready replay-implementation tasks (8):**
- `jwt-external-idp-replay-impl` — JWT Authenticator external IDP login replay
- `jwt-incluster-idp-replay-impl` — JWT Authenticator in-cluster IDP login replay
- `pm-security-patch-replay-impl` — Planned Maintenance security patch replay
- `pm-update-schedule-replay-impl` — Planned Maintenance update-schedule replay
- `pm-autoupgrade-scheduling-replay-impl` — Planned Maintenance autoupgrade scheduling replay
- `trusted-access-dataplane-replay-impl` — Trusted Access dataplane token gateway replay
- `ds-pss-level-change-replay-impl` — Deployment Safeguards PSS level-change replay
- `ds-basic-replay-author-v2-rework-review` — DS basic enable/disable rework review

**Active (expired lease):**
- `ds-private-cluster-replay-impl-rework-review` — DS private cluster rework review
  (lease expired 2026-06-10T08:01:31Z; should be released for pickup)

**Proposed:**
- `staging-execution-feedback-rollup-v2` — classify 11 not_ready spec-runner runs

The knowledge model has 125 features: 51 pass, 6 fail, 3 blocked, 3 unknown,
and 62 unset. 30 of the 62 unset features have matching spec files;
32 unset features (mostly KMS v2+ variants) still need specs. All unset/unknown
features require cloud execution to resolve — they have feature packets and
input/expectation enumeration, but no staging/devbox/standalone evidence.

**Planner/control-loop rule.** Planning is no longer represented as ordinary
task-tree work. `project-planner` is the control loop: it repairs stale state,
rolls up completed work, refills the ordinary frontier under the four value-loop
lanes, records planner attempts in `planner-runs.jsonl`, and then signals the
worker picker through `project.tasks.ready`. Legacy `project-control`,
`project-planning-loop*`, or `project-frontier-replan-*` nodes are history only
and must not be leased as active project tasks.

**Domain model state** remains stable enough for this refocus: ManagedSystem
REST add-existing is the canonical REST-first baseline, and the project should
continue applying that source -> spec -> replay -> evidence -> model feedback
pattern across AKS RP features.

Current non-pass frontier is still gated rather than missing local model work. Blocked paths are Bootstrap BYO ACR lifecycle, Machines API CRUD, PAF throttling, and VPA cert renewal. Unknown paths are App Routing default-domain Istio, App Routing default-domain TLS lifecycle, full NAP default Machines pool cleanup, and the three execution-capable-but-gated ManagedSystem probes (`managedsystem-reconcile-preservation`, `managedsystem-runtime-restrictions`, `managedsystem-single-pool-constraint`). Current fail paths are documented product/test-surface failures with artifacts: App Routing default-domain/TLS-secret, NAP cleanup no-Machine-CRUD split, ManagedSystem disable migration, ManagedSystem CLI create/add, and VirtualMachines CLI comma multi-SKU.

The live ManagedSystem branch now has an approved credentialed execution path: the user confirmed `devbox` is assigned `hao-devbox-msi`, and the non-mutating auth preflight in `evidence/archive/20260602T100036Z-devbox-msi-auth-preflight.md` succeeded (`ssh devbox`, `/usr/bin/az`, ARM token acquisition for subscription `26fe00f8-9173-4872-9134-bb1d2e00343a`). The old Azure CLI provisioning question is superseded. The next live task is `managedsystem-devbox-msi-two-path-live-run`, currently proposed and still gated: before any mutation, the worker must re-check devbox ARM auth, use the selected run artifacts, record the exact command/run id/result/cleanup evidence, and not fake a result if auth/capacity fails. The new CLI+REST combined ManagedSystem probe must not run cloud mutation unless an owner/operator supplies `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-cli-rest-combined`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the prior ManagedSystem SKU/image/defaulting gate is clear. The older add/immutability/delete combined probe remains separately gated with `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-add-immutability-delete-combined`.

## Current Phase

The reference-backed TypeScript probe pattern has now been exercised or built on six runtime/product branches and extended with several local design-gated skeletons. ManagedSystem REST add-existing, VPA upgrade-survival, Bootstrap profile managed-ACR lifecycle, OIDC signing-key rotation, and App Routing NGINX-to-Istio migration produced cloud pass evidence; Bootstrap BYO-ACR produced bounded blocker evidence; ManagedSystem runtime/single-pool/reconcile and Machines/NAP cleanup now have reviewable local designs but remain execution-gated.

The generic App Routing NGINX-to-Istio migration probe has passed in staging via the iteration137 explicitly gated execution. It preserved the non-default-domain boundary and does not claim or unblock the failed/default-domain TLS branches.

The NAP cleanup no-Machine-CRUD split has failed in the selected staging eastus2 environment: iteration143 created a source-shaped NAP Auto cluster and persisted `nodeProvisioningProfile.mode=Auto` / `defaultNodePools=Auto`, but `aksmanagedap` was NotFound before Manual update; cleanup reached `az group exists=false` with no Machine CRUD or `deleteMachines` calls. Iteration144/145 triaged this as likely rollout/environment mismatch because checked-in `enable-managed-machine-agent-pool` and `regionallooper-reconcile-nap-cluster-enabled` rules do not enable staging eastus2. Do not blind-rerun the same eastus2 input unless owner/rollout/source/environment inputs materially change.

`evidence/archive/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md` is the latest local reference packet. It closes the parser-visible VirtualMachines CLI comma multi-SKU packet task without cloud mutation: the failing boundary is specifically `az aks nodepool add --vm-set-type VirtualMachines --vm-sizes <sku1,sku2>` on the preview CLI surface, where help advertises a two-SKU comma-list but active `aks-preview` source rejects `len(--vm-sizes) != 1` before constructing the request. Adjacent product/API paths remain separate and passing: CLI add with one SKU, CLI manual-scale multiple single-size profiles, REST mixed manual `manual[]` profiles, CLI/REST single-size autoscale update, and autoscaled VMs CRUD/upgrade. No model edit was needed; the validator still exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 56 evidence references, 8 failing feature IDs, 7 unknown feature IDs, and 2 blocked feature IDs.

`evidence/archive/iteration153-managedsystem-runtime-restrictions-execution-implementation.md` is the latest local implementation artifact. It closes the runtime-restrictions implementation task without cloud mutation: `replays/managedsystem-runtime-restrictions.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-runtime-restrictions`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the clean REST setup boundary from iteration123/151/152: normal baseline cluster, exactly one ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, then runtime-only assertions for ManagedSystem node labels/taints, CoreDNS readiness/managed-system affinity, critical add-on placement/affinity, VAP/VAPBinding presence, customer nginx Pending/Unschedulable, temporary pod cleanup, setup-failure vs runtime-restrictions classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun replays/managedsystem-runtime-restrictions.ts --check`, non-mutating `--run-id=iteration153-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0). The model remains unchanged and `managedsystem-runtime-restrictions` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`evidence/archive/iteration152-managedsystem-reconcile-preservation-execution-implementation.md` remains the reconcile-preservation implementation artifact. It closes the reconcile-preservation implementation task without cloud mutation: `replays/managedsystem-reconcile-preservation.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-reconcile-preservation`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the source-equivalent REST boundary from iteration125/151: first ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, managed-cluster GET sanitized with CleanManagedSystemPoolForPUT-equivalent rules so ManagedSystem profiles keep only `name`/`mode`/`count` and omit `type` plus read-only/default fields, no-op managed-cluster PUT, preservation assertions, setup-failure vs reconcile-preservation classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun replays/managedsystem-reconcile-preservation.ts --check`, non-mutating `--run-id=iteration152-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0); an owner-loop rerun also passed with `--run-id=iteration152-local-gated-rerun`. The model remains unchanged and `managedsystem-reconcile-preservation` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`evidence/archive/iteration151-managedsystem-single-pool-constraint-execution-implementation.md` remains the single-pool implementation artifact. It closes the single-pool implementation task without cloud mutation: `replays/managedsystem-single-pool-constraint.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-single-pool-constraint`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the clean REST boundary from iteration124/150: first ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, second ManagedSystem pool via the same minimal body with only the pool name changed, post-rejection agentPools list assertions, setup-failure vs second-pool-rejection classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun replays/managedsystem-single-pool-constraint.ts --check`, non-mutating `--run-id=iteration151-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0). The model remains unchanged and `managedsystem-single-pool-constraint` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`evidence/archive/iteration150-managedsystem-cli-failure-reference-packet.md` remains the latest ManagedSystem CLI failure reference packet. It closes the ManagedSystem CLI create/add failure refresh without cloud mutation: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` fail because the preview CLI sends ordinary/default node-pool fields (`OSTypeCasePreserved`, `availabilityProfile`, `count`, `networkProfile`, `osType`, `scaleSetPriority`, `workloadRuntime`, and add-specific `scaleDownMode`) that RP rejects for ManagedSystem pools. The accepted adjacent path remains the minimal ARM REST add-existing body `{"properties":{"mode":"ManagedSystem"}}`, proven by iteration56/20260519/iteration112. No model edit was needed; the validator still exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 7 failing feature IDs, 7 unknown feature IDs, and 3 blocked feature IDs. Do not rerun the same CLI failure unless a new `aks-preview`/Azure CLI version, CLI source fix, or owner request gives a material trigger.

`evidence/archive/iteration149-paf-throttling-model-hygiene.md` remains the latest local model-changing artifact. It reconciles the iteration148 source/precondition packet into `evidence/archive/e2e-capability-model.json`: `paf-throttling` is now **blocked/gated** instead of stale fail, with current observations `identity.msi.available=unknown` and `paf.throttling.behavior=unknown` because no artifact reached a failed `Verify PAF Objects` assertion. The validator exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 60 evidence references, 7 failing feature IDs, 7 unknown feature IDs, and 3 blocked feature IDs. Do not rerun standalone/staging PAF until MSI/HCP access, eastus2/underlay capacity or owner-approved bypass, and a source-owner/source-confirmed `DedicatedOom` trigger/assertion path are all available.

`evidence/archive/iteration148-paf-throttling-source-precondition-reference-packet.md` remains the source/precondition packet behind the iteration149 model edit. It classified the prior `paf-throttling` model fail as stale/ambiguous standalone evidence rather than a confirmed PAF product failure: the first run failed before PAF assertions because the devbox lacked the `akse2ehcp-e2e` MSI; the post-MSI retry reached the dedicated/OOM stress gate but `Verify PAF Objects` was skipped because no kube-apiserver OOMKilled/137 event appeared within the source timeout; later `AKSCapacityHeavyUsage` evidence is a standalone capacity gate.

Human review remains asynchronous. Agents should continue to leave reviewable artifacts and execute bounded preflight/probes when safe, but same-branch cloud reruns require a material trigger or a changed probe input that tests a distinct coverage claim. No further BYO rerun is allowed without a new source/environment/build signal. ManagedSystem cloud execution should wait for a source-shaped request plan with explicit SKU/location/preflight gates, cleanup plan, sanitizer/request-shape evidence where applicable, and clear assertion boundaries. Machines/NAP Machine API cloud execution should wait for the Machine preview feature registrations or an equivalent source environment. App Routing migration execution is complete for the generic branch; preserve the checked-in gates and preflights for any future adjacent App Routing work.

This keeps the project on the agreed phase order: learn -> ground -> experiment -> refine -> next single-case TS probe -> replan.

## Linked Context
- `model/knowledge-map/README.md` — normalized knowledge-map model, visualization contract, and human/LLM update protocol
- `model/knowledge-map/feature-workflow.md` — repeatable deeper/wider workflow for turning one feature into model-backed knowledge
- `model/knowledge-map/model.json` — canonical accepted knowledge model; prefer this over legacy generated summaries under `evidence/archive/`
- `model/knowledge-map/views/` — generated status, graph, path-summary, and evidence views derived from the canonical model
- `model/knowledge-map/deep-dives/managedsystem-pool.md` — worked deep feature example: sources, scenarios, input DAGs, expectations, verification, quality, risks, and improvement loop
- `replays/execution/README.md` — phased learning/experimenting/replanning strategy for TS probes
- `replays/execution/test-runner-engine.md` — project-local runner engine that links feature-page test requests, durable run state, evidence, diagnosis, and model updates
- `replays/execution/automation.md` — operating model for cron/supervisor triggers, always-on controller behavior, lane selection, execution gates, and agent compliance
- `agents/aks-explorer/cron.json` — disabled project-local trigger template for regular learning, weekly replanning review, and manual verification wake-ups
- `features/README.md` — stable feature reference-packet directory
- `suites/README.md` — tracked reviewable run-plan directory
- `replays/README.md` — tracked TypeScript probe directory
- `replays/lib/README.md` — shared helper library directory for probes
- `evidence/archive/iteration155-knowledge-map-normalization.md` — local review aligning current project findings to the normalized scenario/DAG/behavior model
- `evidence/archive/coverage-gap-assessment.md` — ranked coverage gap analysis: 98 features, 48 pass, 6 fail, 3 blocked, 41 unknown; next-phase recommendation
- `evidence/archive/iteration185-owner-loop-duplicate-resume-reconciliation.md` — owner-loop reconciliation that handled duplicate ManagedSystem replan resume comments without queuing new work
- `evidence/archive/iteration189-managedsystem-cli-rest-combined-replan.md` — CLI+REST ManagedSystem combined replan for CLI create/add default-payload negative paths plus REST add and mode immutability
- `evidence/archive/iteration189-live-selected-execution-blocker.md` — four-path live-selected execution blocker showing artifact regeneration succeeded but local `az` is unavailable for the required ARM token gate
- `evidence/archive/iteration190-live-selected-two-path-blocker.md` — two-path live-selected execution blocker for ManagedSystem mode immutability plus REST add-existing; regeneration succeeded, auth gate failed because `az` is unavailable
- `evidence/archive/20260602T100036Z-devbox-msi-auth-preflight.md` — accepted non-mutating devbox/hao-devbox-msi ARM auth preflight that supersedes the old local Azure CLI provisioning blocker
- `decisions/replans/live-selected/` — regenerated live-selected replan JSON/TS artifacts for the four-path and two-path ManagedSystem selections
- `suites/managedsystem-cli-rest-combined.yaml` — gated combined plan for the selected CLI+REST ManagedSystem paths
- `replays/managedsystem-cli-rest-combined.ts` — execution-gated TypeScript probe for the selected CLI+REST ManagedSystem paths
- `features/managedsystem-pool.yaml` — stable ManagedSystem Pool reference packet
- `suites/managedsystem-rest-add-existing.yaml` — first single-case TS probe plan
- `replays/managedsystem-rest-add-existing.ts` — executable reference-backed probe
- `features/workload-autoscaler/vpa-upgrade-survival.yaml` — second reference-backed TS probe feature packet
- `suites/vpa-upgrade-survival-runtime.yaml` — VPA upgrade-survival TS probe plan
- `replays/vpa-upgrade-survival-runtime.ts` — executable VPA upgrade-survival probe
- `evidence/archive/iteration115-vpa-upgrade-survival-runtime.md` — VPA upgrade-survival pass summary and model update evidence
- `features/bootstrap-profile/managed-acr-lifecycle.yaml` — Bootstrap managed-ACR reference packet
- `suites/bootstrap-profile-managed-acr-lifecycle.yaml` — Bootstrap managed-ACR TS probe plan
- `replays/bootstrap-profile-managed-acr-lifecycle.ts` — executable Bootstrap managed-ACR probe
- `evidence/archive/iteration116-bootstrap-managed-acr-lifecycle.md` — Bootstrap managed-ACR pass summary and model update evidence
- `features/bootstrap-profile/byo-acr-lifecycle.yaml` — Bootstrap BYO-ACR reference packet
- `suites/bootstrap-profile-byo-acr-lifecycle.yaml` — Bootstrap BYO-ACR TS probe plan
- `replays/bootstrap-profile-byo-acr-lifecycle.ts` — executable Bootstrap BYO-ACR probe, hardened after the v2 timeout
- `evidence/archive/iteration117-bootstrap-byo-acr-lifecycle.md` — Bootstrap BYO-ACR initial blocked attempt and cleanup evidence
- `evidence/archive/iteration117-bootstrap-byo-acr-v2-timeout-blocker.md` — detailed BYO-ACR v2 create timeout blocker evidence
- `evidence/archive/iteration116-post-vpa-ts-probe-selection.md` — local selection artifact that chose the now-completed Bootstrap managed-ACR lifecycle probe
- `tasks/README.md` — task tree index and execution rules
- `tasks/tree.json` — current project execution task tree
- `tasks/archive/managedsystem-pool/wave-01-feature-standard.yaml` — archived ManagedSystem Pool parallel feature-standard task wave
- `evidence/archive/input-expectation-knowledge-map.md` — consolidated input/expectation knowledge map and ranked gaps
- `evidence/archive/e2ev3-handwritten-coverage-inventory.md` — handwritten e2ev3 source inventory mapping scenarios to input paths, expectation paths, current evidence coverage, and model gaps
- `evidence/archive/iteration73-capability-model-source-inventory-update.md` — validated capability-model update from handwritten e2ev3 source inventory
- `evidence/archive/iteration74-node-restriction-source-spec-resolution.md` — Node Restriction source/spec contradiction resolution and operation-shape correction
- `evidence/archive/iteration75-model-driven-probe-selection.md` — ranked high-density future probes from the validated model
- `evidence/archive/iteration76-workload-identity-oidc-runtime-staging.md` — Workload Identity Linux token projection and OIDC discovery/JWKS runtime pass evidence
- `evidence/archive/iteration77-identity-runtime-model-consolidation.md` — branch-accurate Identity/OIDC model consolidation
- `evidence/archive/iteration78-workload-autoscaler-runtime-staging.md` — KEDA runtime pass and bounded VPA component/recommendation evidence
- `evidence/archive/iteration79-vpa-runtime-model-split.md` — branch-accurate VPA runtime model split and next-probe reranking
- `evidence/archive/iteration80-app-routing-tls-source-hypothesis.md` — source-first comparison showing App Routing DefaultDomainCertificate TLS failure is not explained by malformed customer CR/input
- `evidence/archive/iteration81-app-routing-tls-owner-escalation.md` — owner escalation packet and diagnostic rerun gate for App Routing TLS
- `evidence/archive/iteration91-app-routing-tls-gated-followup-tracker.md` — explicit App Routing TLS follow-up tracker with owner/diagnostic/fixed-build rerun gates and no-blind-rerun rule
- `evidence/archive/iteration99-oidc-v133-explicit-enable-staging.md` — OIDC v1.33 explicit-enable discovery/JWKS staging pass evidence
- `evidence/archive/iteration100-post-oidc-v133-unknown-selection.md` — post-OIDC v1.33 unknown-selection artifact selecting VirtualMachines mixed-SKU REST scale as the next non-gated branch
- `evidence/archive/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md` — VirtualMachines mixed-SKU REST scale staging pass evidence for `Scenario_Mixed_SKU_Scale`
- `evidence/archive/iteration102-post-virtualmachines-unknown-selection.md` — post-VirtualMachines unknown-selection artifact selecting Workload Identity Windows token projection as the next non-gated branch
- `evidence/archive/iteration103-workload-identity-windows-token-projection-staging.md` — Workload Identity Windows token-projection staging pass evidence for `Scenario_WorkloadIdentity` Windows branch
- `evidence/archive/iteration92-next-model-unknown-selection.md` — local selection artifact that selected the focused VPA residual runtime probe
- `evidence/archive/iteration93-vpa-residual-runtime-staging.md` — VPA Helm, HA/leader-election, and in-place-update staging pass evidence
- `evidence/archive/iteration94-next-model-unknown-selection.md` — local selection artifact choosing Image Cleaner vulnerable-image erasure as the next non-gated runtime branch
- `evidence/archive/iteration82-post-escalation-next-probe-selection.md` — post-App-Routing ranking that selected Node Restriction
- `evidence/archive/iteration83-node-restriction-fullput-runtime-staging.md` — Node Restriction corrected full-PUT disable contract and runtime-default staging pass evidence
- `evidence/archive/iteration84-keda-disable-reenable-crud-staging.md` — KEDA disable/re-enable CRUD lifecycle staging pass evidence
- `evidence/archive/iteration85-workload-identity-disable-reenable-lifecycle-staging.md` — Workload Identity disable/re-enable lifecycle staging pass evidence
- `evidence/archive/managedsystem-pool-feature-standard.md` — integrated ManagedSystem Pool feature-standard packet and next execution recommendation
- `evidence/archive/managedsystem-pool-feature-standard-init-tasks.md` — narrative draft for the ManagedSystem Pool feature-standard parallel task wave
- `evidence/archive/iteration88-managedsystem-disable-migration-checkpointed.md` — checkpointed ManagedSystem rerun showing current add-phase SKU/image gate and cleanup status
- `evidence/archive/iteration24-managedsystem-pool-pass.md` — pass evidence for `Scenario_ManagedSystemPool_Enable`
- `evidence/archive/underlay-debug-findings.md` — root cause analysis, MSI fix, retry results
- `evidence/archive/e2e-run-results-summary.md` — original e2e run results, including older App Routing default-domain traffic/TLS failure context
- `evidence/archive/managedsystem-pool-exploration.md` — ManagedSystem Pool feature exploration and refreshed conclusions
- `evidence/archive/iteration55-managedsystem-staging-results.md` — initial staging ManagedSystem Pool evidence
- `evidence/archive/iteration56-managedsystem-staging-refresh.md` — refreshed staging ManagedSystem Pool CLI/REST classification matrix
- `evidence/archive/20260519T1646Z-managedsystem-priority-staging.md` — fresh priority re-test confirming ManagedSystem Pool REST/CLI/delete verdict
- `evidence/archive/aks-public-api-scenario-candidates.md` — prioritized public API feature scenarios
- `evidence/archive/iteration57-node-autoprovision-staging.md` — NAP staging create evidence
- `evidence/archive/iteration58-node-autoprovision-followup.md` — NAP staging update evidence
- `evidence/archive/iteration59-app-routing-staging.md` — App Routing public CLI staging enablement evidence
- `evidence/archive/iteration60-workload-identity-staging.md` — OIDC issuer + workload identity public CLI staging evidence
- `evidence/archive/iteration61-workload-autoscaler-staging.md` — workload autoscaler KEDA/VPA public CLI profile-state evidence
- `evidence/archive/iteration62-security-profile-staging.md` — Image Cleaner pass and Node Restriction tag-only PATCH/non-contract evidence
- `evidence/archive/iteration63-bootstrap-profile-staging.md` — bootstrapProfile.artifactSource contract-first staging evidence
- `evidence/archive/iteration64-virtualmachines-agentpool-staging.md` — non-ManagedSystem VirtualMachines agent-pool single-SKU pass and multi-SKU failure evidence
- `evidence/archive/iteration65-virtualmachines-multisku-contract.md` — VirtualMachines single-SKU autoscale/update contract evidence and misleading multi-SKU add help classification
- `evidence/archive/iteration66-virtualmachines-manual-scale-staging.md` — VirtualMachines manual-scale multi-profile add/delete staging evidence
- `evidence/archive/iteration67-app-routing-disable-staging.md` — App Routing public CLI disable pass and persisted disabled-state evidence
- `evidence/archive/iteration68-app-routing-defaultdomain-staging.md` — App Routing default-domain public API/state pass evidence
- `evidence/archive/iteration69-app-routing-defaultdomain-traffic-staging.md` — App Routing default-domain HTTP traffic reachability pass evidence
- `evidence/archive/iteration70-app-routing-defaultdomain-tls-staging.md` — App Routing DefaultDomainCertificate/TLS-secret staging failure and fallback-cert HTTPS evidence
- `evidence/archive/e2e-capability-model.json` — project-local capability model and evidence map
- `evidence/archive/scripts/README.md` — reusable scripts produced for cleanup/run/capacity/MSI work
- `evidence/archive/iteration33-standalone-environment-dead.md` — blocker evidence: old standalone builds recycled
- `devbox:/home/hayua/rp` — AKS RP checkout and staging execution context

## Task Management
- `project.md` is the project control plane and navigation root. It should stay readable: goal, current state, next action, validation rules, key context links, and the active task pointer.
- Current project execution state lives in `tasks/tree.json`. That task tree is the operational view of how the project is broken down and what is blocked, ready, active, or accepted.
- `tasks/README.md` explains the task tree rules. `scenarios/` is reserved for AKS e2e domain scenarios, test specs, run plans, and execution strategy.
- Durable findings, evidence, feature packets, and run results live under `evidence/archive/`.
- Keep one task responsible for one durable output artifact. Parallel tasks must write to different outputs; integration tasks merge them afterward.
- The project execution engine works breadth-first from `tasks/tree.json`, executes ready leaf tasks until blocked or gated, verifies claims before acceptance, and rolls accepted work up to parent tasks.

## Capability Map
- `Scenario_Traffic_AppRouting_Nginx_Disablement`: pass. Green evidence is in `evidence/archive/successful-e2e-run.md`.
- `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`: partially reconciled. Fresh staging HTTP default-domain traffic passes (`evidence/archive/iteration69-app-routing-defaultdomain-traffic-staging.md`), but TLS/DefaultDomainCertificate certificate provisioning fails in staging (`evidence/archive/iteration70-app-routing-defaultdomain-tls-staging.md`) and older standalone evidence also points to TLS secret provisioning failure.
- `Scenario_PAFThrottling`: blocked/gated after iteration149 model hygiene. Current evidence does not prove a PAF product failure: the first run lacked `akse2ehcp-e2e` MSI, the post-MSI retry reached `DedicatedOom` but timed out before `Verify PAF Objects`, and later standalone evidence hit eastus2 `AKSCapacityHeavyUsage`. Do not rerun until MSI/HCP access, target capacity or owner-approved bypass, and source-owner/source-confirmed OOM trigger/assertion path are all available.
- Duplicate-registered scenarios: blocked by framework/test-selection ambiguity; use source inspection before retrying exact scenario names.
- ManagedSystem ARM REST add-existing-pool: pass in staging. Evidence is in `evidence/archive/managedsystem-pool-exploration.md`.
- ManagedSystem Azure CLI create/add: fail. CLI sends default fields that RP rejects for ManagedSystem pools.
- ManagedSystem standalone e2ev3 scenario: pass. Evidence is in `evidence/archive/iteration24-managedsystem-pool-pass.md`.

## Capability Model
- Source: `evidence/archive/e2e-capability-model.json`
- Validator: `model/tools/src/validate.ts`
- Scope: project-local to `aks-rp-e2e`; do not promote to shared infra until this model proves useful through real iterations.
- Boundary: observation context (`standalone`, `staging`, `dev`, `devbox`, build version, execution surface) is a filter for where/how evidence was collected, not AKS product input space.
- Purpose: model the relation between AKS inputs, expected behavior, existing tests, observed behavior, and evidence. It is a coverage and discovery map, not just a result ledger.
- Mapping rule: each feature must map to one or more AKS input paths and expectation paths; each test case should map the concrete input path it exercised, the expected behavior path it intended to verify, and the observed path it actually produced.
- Current deterministic summary: 113 AKS input variables, 218 AKS state/behavior expectation variables, 98 feature mappings, 70 test-case evidence mappings, 69 judgments, 143 evidence references.
- Current feature status from model.json after iteration 218: 125 features total — 51 pass, 6 fail (`app-routing-default-domain-tls-secret`, CLI create/add ManagedSystem paths, `virtualmachines-agentpool-cli-add-multi-sku`, `managedsystem-disable-migration`, `machines-agentpool-nap-default-pool-cleanup-no-machine-crud`), 3 unknown (`app-routing-default-domain-istio`, `app-routing-default-domain-tls-lifecycle`, `machines-agentpool-nap-default-pool-cleanup`), 3 blocked (`paf-throttling`, `workload-autoscaler-vpa-cert-renewal-runtime`, `machines-agentpool-api-crud`), and 62 unset (KMS v2 ×15, KMS v2+ ×28, planned-maintenance ×7, deployment-safeguards ×7, trusted-access ×2, jwt-authenticator ×2, bootstrap-byo-acr-lifecycle ×1). 30 of the 62 unset features have matching spec files; 32 need specs authored.
- Rule: agents may propose model changes, but the model is accepted only when the TypeScript validator passes.

## Weaknesses
- TLS secret provisioning weakness: DefaultDomain failed because required TLS secret was not provisioned.
- PAF precondition weakness: PAFThrottling evidence is gated by standalone/test-harness prerequisites (historical missing `akse2ehcp-e2e` MSI, eastus2 `AKSCapacityHeavyUsage`, and an unconfirmed `DedicatedOom` OOMKilled/137 trigger), not by an observed PAF object assertion failure.
- Scenario-selection weakness: duplicate registrations make several scenario names ambiguous.
- Standalone teardown leak: e2ev3 fires DELETE on the resource group and immediately returns ("success to start deleting resource group without wait it done"). If the test process is interrupted before ARM finishes, the standalone RP datastore keeps a `Succeeded` cluster that counts against per-underlay capacity and eventually trips `AKSCapacityHeavyUsage` for new runs.
- ManagedSystem CLI bug: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` send default fields that RP rejects.

## Next Action
**Execute the ready replay-implementation frontier.**

The task tree has 8 ready leaves and 1 active leaf with an expired lease. These
are concrete replay-authoring tasks for Deployment Safeguards, JWT Authenticator,
Planned Maintenance, and Trusted Access. Each task authors a TypeScript probe
file against an existing spec and feature packet. This is safe local work
(no cloud mutation) and should proceed immediately.

Priority order for the ready frontier:
1. Release expired lease on `ds-private-cluster-replay-impl-rework-review`
2. Execute `ds-basic-replay-author-v2-rework-review` (unblock DS basic path)
3. Execute `ds-pss-level-change-replay-impl` (DS PSS level change)
4. Execute `pm-security-patch-replay-impl` (Planned Maintenance)
5. Execute `pm-update-schedule-replay-impl` (Planned Maintenance)
6. Execute `pm-autoupgrade-scheduling-replay-impl` (Planned Maintenance)
7. Execute `jwt-external-idp-replay-impl` (JWT Authenticator)
8. Execute `jwt-incluster-idp-replay-impl` (JWT Authenticator)
9. Execute `trusted-access-dataplane-replay-impl` (Trusted Access)
10. Promote `staging-execution-feedback-rollup-v2` from proposed to ready

After replay authoring, the next step is gated cloud execution of the authored
probes via devbox ARM auth.

## Backlog
- UI graph for the knowledge model: the current quality panel is mostly a table/list view. It is missing the critical visualization for the core idea: an **input-space graph**, an **expectation-space graph**, and **feature mappings as paths across both spaces**. Keep this as a backlog design task for now, not part of the current handwritten-source inventory. When picked up, the UI should make the knowledge model visible: how a feature selects paths from both spaces, which tests/evidence attach to those paths, and where staging/standalone coverage is missing, blocked, failing, or not yet explored.

## Migration Notes
The detailed historical migration log was archived when Project App V2 task-tree execution became the current model.

- Archive: `archive/project-pre-v2-task-engine.md`
- Current runtime frame: `project.md`
- Current execution tree: `tasks/tree.json`
- Current domain evidence: `evidence/archive/`, `model/knowledge-map/`, `scenarios/`, and `replays/`

## Plan
Current project execution is driven by the breadth-first task tree. The engine selects ready leaf tasks from `tasks/tree.json`, verifies claims before acceptance, rolls up parent state, creates parent-review or blocked-review tasks when audit/replan is needed, and keeps going until truly blocked, gated, complete, or interrupted by an infra budget guard.

Blocked is not a passive stop state. When the ready frontier is empty, the engine creates or runs blocked-review tasks that inspect whether blockers are real, stale, too coarse, missing evidence, wrongly blocked, locally unblockable, or genuinely external. The project should wait only after that review confirms no safe local unblock, split, correction, or evidence-gathering task remains.

Workers should not edit `tasks/tree.json` directly. A worker produces a claim and evidence for one leaf; the engine owns task updates, parent rollup, review-task creation, and continuation events. If a wake slice ends while ready work remains, the engine emits another `project.execution.requested` event so the project stays active.

The project watcher is enabled through `app.ts`: the `regular-learning` schedule emits `project.tick` every hour, and the app converts that tick into the same `project.execution.requested` event used by comments, steering, and the `advance-project`/`watch` actions. The project-local trigger in `agents/aks-explorer/cron.json` consumes that event and runs the task-tree workflow.

## Task Summary
Active execution frontier is in `tasks/tree.json`. Summary of ready work:

- [ ] `ds-private-cluster-replay-impl-rework-review` — active (expired lease, release for pickup)
- [ ] `ds-basic-replay-author-v2-rework-review` — rework review for DS basic enable/disable
- [ ] `ds-pss-level-change-replay-impl` — author DS PSS level-change replay probe
- [ ] `pm-security-patch-replay-impl` — author Planned Maintenance security patch replay
- [ ] `pm-update-schedule-replay-impl` — author Planned Maintenance update-schedule replay
- [ ] `pm-autoupgrade-scheduling-replay-impl` — author Planned Maintenance autoupgrade scheduling replay
- [ ] `jwt-external-idp-replay-impl` — author JWT Authenticator external IDP login replay
- [ ] `jwt-incluster-idp-replay-impl` — author JWT Authenticator in-cluster IDP login replay
- [ ] `trusted-access-dataplane-replay-impl` — author Trusted Access dataplane token gateway replay

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
  `evidence/archive/first-e2e-run-results.md`.


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
Use the domain workspace indexes instead of a copied artifact ledger in this runtime file.

- Current task state: `tasks/tree.json`
- Accepted and raw evidence: `evidence/archive/`
- Knowledge model and generated views: `model/knowledge-map/`
- Feature packets: `features/`
- Run plans: `suites/`
- Probes: `replays/`
- Full legacy artifact ledger: `archive/project-pre-v2-task-engine.md#artifacts`

## Active Task
- id: ds-private-cluster-replay-code-author-rework-review
- status: active
- source: .app/tasks/tree.json
- outputs: evidence/archive/ds-private-cluster-replay-code-author-rework-review.md

## Ready Frontier (owner-loop iteration 218)

**State:** 1 active leaf (expired lease), 8 ready leaves, 1 proposed leaf,
15 decomposed containers. 628 accepted, 110 superseded. Total 763 tasks.

**Ready leaves (replay authoring — safe local work):**
1. `jwt-external-idp-replay-impl` — Author JWT Authenticator external IDP login TS probe
2. `jwt-incluster-idp-replay-impl` — Author JWT Authenticator in-cluster IDP login TS probe
3. `pm-security-patch-replay-impl` — Author Planned Maintenance security patch TS probe
4. `pm-update-schedule-replay-impl` — Author Planned Maintenance update-schedule TS probe
5. `pm-autoupgrade-scheduling-replay-impl` — Author Planned Maintenance autoupgrade scheduling TS probe
6. `trusted-access-dataplane-replay-impl` — Author Trusted Access dataplane token gateway TS probe
7. `ds-pss-level-change-replay-impl` — Author Deployment Safeguards PSS level-change TS probe
8. `ds-basic-replay-author-v2-rework-review` — Rework review for DS basic enable/disable

**Active (expired lease — needs release):**
- `ds-private-cluster-replay-impl-rework-review` — expired 2026-06-10T08:01:31Z

**Proposed (promote when ready leaves settle):**
- `staging-execution-feedback-rollup-v2` — classify 11 not_ready spec-runner runs

**Transition:** Project is active with a healthy ready frontier. Workers should
pick up ready leaves for replay authoring (all safe local work, no cloud
mutation needed).

## Over-Claim Correction Status
The `azureManagedNodes` assertion in `specs/managedsystem-rest-add-existing.json` has been demoted from `verdictImpact: claim` to `verdictImpact: audit` with a correction note. The model behavior entry also updated. REST add-existing product/API pass verdict is preserved. Runtime placement / azureManagedNodes requires separate staging evidence before it can be restored to claim.

## Superseded Chains (iteration 192)
19 OIDC rework-review tasks and 6 OIDC parent tasks superseded. These were spinning at rework-review depth 3–6+ with interrupted/blocked/no-progress claims. The OIDC probe work itself (accepted at depth 0) is preserved; only the unproductive rework chains were cut. If OIDC probe work needs to resume, create a fresh bounded task rather than continuing the superseded chains.

## Task Index
- .app/tasks/README.md
- .app/tasks/tree.json
