---
id: aks-rp-e2e
owner: aks-explorer
status: active
type: milestone
priority: P1
iteration: 190
max_concurrent: 1
max_task_attempts: 2
project_policy: aggressive-push
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

Phases:
- **Learning:** extract scenario intent from Go e2ev3 source, public API/docs,
  and existing artifacts into the capability model.
- **Experimenting:** save reviewable TypeScript probes that map one learned
  case or branch to explicit API/CLI/kubectl actions and expectation checks.
- **Replanning:** after the first two phases are solid, generate high-density
  run plans and TS probes that combine compatible cases in one cluster lifecycle.

Accepted run plans and probes should be tracked under `scenarios/run-plans/` and
`probes/`. Runtime evidence stays under `evidence/outputs/`. This keeps the system
auditable: future agents can inspect what the probe intended, what it actually
ran, and whether its coverage claim was honest.

Execution strategy details live in `scenarios/execution/README.md`.

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
- knowledge.source-inventory-modeled: `evidence/outputs/iteration73-capability-model-source-inventory-update.md` converted handwritten e2ev3 source intent into first-class model structure; validator exits 0.
- e2e.existing-cases-cataloged: `evidence/outputs/scenario-catalog.md` and e2e artifacts provide the first source for inferring feature intent and coverage.
- knowledge.public-api-candidates-started: `evidence/outputs/aks-public-api-scenario-candidates.md` derives additional candidate feature surfaces from public AKS API/docs.
- execution.evidence-collected: staging and standalone artifacts provide pass/fail/blocker evidence for ManagedSystem, App Routing, NAP, workload identity, autoscaler, security, bootstrap, and VirtualMachines paths.

## Current State
Project App V2 task-tree execution is active. Coverage gap analysis is complete in `evidence/outputs/coverage-gap-analysis.md`: all 63 features have testCases, 4 are blocked with no execution evidence, 11 have unknown results, 7 have failing results, and 57 of 63 features currently have only one testCase. The current ready local leaf is `failure-triage` in `tasks/tree.json`; it should classify the 7 failing testCases as real bugs, stale expectations, or environment/test-surface issues. This is safe local analytical work with no cloud, staging, kubectl, or Azure auth gate.

Iteration190 owner-loop handled the unread discussion tail after `---read @iter189---`: a new human request narrowed the selected live run to `path.managedsystem.mode-immutability` and `path.managedsystem.rest-add-existing.minimal-rest`. The requested replan command exited 0 and produced distinct two-path live-selected artifacts under `decisions/replans/live-selected/`: `replan.managedsystem.mode-immutability__managedsystem.rest-add-existing.minimal-rest.json` and `.ts`. Metrics were baseline cluster CRUD 2, replanned cluster CRUD 1, cluster CRUD saved 1, behavior assertions 5, expectation density 5, and diagnostic-clean group count 1. A non-mutating dry-run sanity check exited 0 and canonical model validation passed with `uncoveredFeatureIds=[]`. The required auth gate then failed before any mutation: `az account get-access-token --resource https://management.azure.com/ -o json` returned exit 127 with `/bin/bash: line 4: az: command not found`. Live execution did not start, so there is no elapsed cloud run time, cleanup status, or failed product assertion. The blocker is recorded in `evidence/outputs/iteration190-live-selected-two-path-blocker.md`.

Iteration189 had already handled the prior four-path replan request for `path.managedsystem.mode-immutability`, `path.managedsystem.rest-add-existing.minimal-rest`, `path.managedsystem.cli-create-default-payload`, and `path.managedsystem.cli-add-default-payload`: it added `scenarios/test-specs/managedsystem-cli-create-default-payload.json`, `scenarios/test-specs/managedsystem-cli-add-default-payload.json`, index entries, `scenarios/run-plans/managedsystem-cli-rest-combined.yaml`, and `probes/managedsystem-cli-rest-combined.ts`. Local verification passed with `bun probes/managedsystem-cli-rest-combined.ts --check --run-id=iteration189-local-check`, and canonical validation passed with `bun model/tools/src/validate.ts model/knowledge-map/model.json`. The four-path live execution was also blocked before mutation because local `az` was unavailable; see `evidence/outputs/iteration189-managedsystem-cli-rest-combined-replan.md` and `evidence/outputs/iteration189-live-selected-execution-blocker.md`.

Current non-pass frontier is still gated rather than missing local model work. Blocked paths are Bootstrap BYO ACR lifecycle, Machines API CRUD, PAF throttling, and VPA cert renewal. Unknown paths are App Routing default-domain Istio, App Routing default-domain TLS lifecycle, full NAP default Machines pool cleanup, and the three execution-capable-but-gated ManagedSystem probes (`managedsystem-reconcile-preservation`, `managedsystem-runtime-restrictions`, `managedsystem-single-pool-constraint`). Current fail paths are documented product/test-surface failures with artifacts: App Routing default-domain/TLS-secret, NAP cleanup no-Machine-CRUD split, ManagedSystem disable migration, ManagedSystem CLI create/add, and VirtualMachines CLI comma multi-SKU.

The live ManagedSystem branch is waiting on an execution environment unblock, but the project itself remains active through blocked-frontier review. Resume the two-path live selected run only when Azure CLI is available in the project workspace and `az account get-access-token --resource https://management.azure.com/ -o json` succeeds, or when the owner provides an approved credentialed execution host/path and that same auth gate succeeds there. Do not fake auth or create another same-branch cloud rerun task solely because the project woke up. The new CLI+REST combined ManagedSystem probe must not run cloud mutation unless an owner/operator supplies `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-cli-rest-combined`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the prior ManagedSystem SKU/image/defaulting gate is clear. The older add/immutability/delete combined probe remains separately gated with `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-add-immutability-delete-combined`.

## Current Phase

The reference-backed TypeScript probe pattern has now been exercised or built on six runtime/product branches and extended with several local design-gated skeletons. ManagedSystem REST add-existing, VPA upgrade-survival, Bootstrap profile managed-ACR lifecycle, OIDC signing-key rotation, and App Routing NGINX-to-Istio migration produced cloud pass evidence; Bootstrap BYO-ACR produced bounded blocker evidence; ManagedSystem runtime/single-pool/reconcile and Machines/NAP cleanup now have reviewable local designs but remain execution-gated.

The generic App Routing NGINX-to-Istio migration probe has passed in staging via the iteration137 explicitly gated execution. It preserved the non-default-domain boundary and does not claim or unblock the failed/default-domain TLS branches.

The NAP cleanup no-Machine-CRUD split has failed in the selected staging eastus2 environment: iteration143 created a source-shaped NAP Auto cluster and persisted `nodeProvisioningProfile.mode=Auto` / `defaultNodePools=Auto`, but `aksmanagedap` was NotFound before Manual update; cleanup reached `az group exists=false` with no Machine CRUD or `deleteMachines` calls. Iteration144/145 triaged this as likely rollout/environment mismatch because checked-in `enable-managed-machine-agent-pool` and `regionallooper-reconcile-nap-cluster-enabled` rules do not enable staging eastus2. Do not blind-rerun the same eastus2 input unless owner/rollout/source/environment inputs materially change.

`evidence/outputs/iteration147-virtualmachines-cli-multisku-failure-reference-packet.md` is the latest local reference packet. It closes the parser-visible VirtualMachines CLI comma multi-SKU packet task without cloud mutation: the failing boundary is specifically `az aks nodepool add --vm-set-type VirtualMachines --vm-sizes <sku1,sku2>` on the preview CLI surface, where help advertises a two-SKU comma-list but active `aks-preview` source rejects `len(--vm-sizes) != 1` before constructing the request. Adjacent product/API paths remain separate and passing: CLI add with one SKU, CLI manual-scale multiple single-size profiles, REST mixed manual `manual[]` profiles, CLI/REST single-size autoscale update, and autoscaled VMs CRUD/upgrade. No model edit was needed; the validator still exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 56 evidence references, 8 failing feature IDs, 7 unknown feature IDs, and 2 blocked feature IDs.

`evidence/outputs/iteration153-managedsystem-runtime-restrictions-execution-implementation.md` is the latest local implementation artifact. It closes the runtime-restrictions implementation task without cloud mutation: `probes/managedsystem-runtime-restrictions.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-runtime-restrictions`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the clean REST setup boundary from iteration123/151/152: normal baseline cluster, exactly one ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, then runtime-only assertions for ManagedSystem node labels/taints, CoreDNS readiness/managed-system affinity, critical add-on placement/affinity, VAP/VAPBinding presence, customer nginx Pending/Unschedulable, temporary pod cleanup, setup-failure vs runtime-restrictions classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun probes/managedsystem-runtime-restrictions.ts --check`, non-mutating `--run-id=iteration153-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0). The model remains unchanged and `managedsystem-runtime-restrictions` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`evidence/outputs/iteration152-managedsystem-reconcile-preservation-execution-implementation.md` remains the reconcile-preservation implementation artifact. It closes the reconcile-preservation implementation task without cloud mutation: `probes/managedsystem-reconcile-preservation.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-reconcile-preservation`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the source-equivalent REST boundary from iteration125/151: first ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, managed-cluster GET sanitized with CleanManagedSystemPoolForPUT-equivalent rules so ManagedSystem profiles keep only `name`/`mode`/`count` and omit `type` plus read-only/default fields, no-op managed-cluster PUT, preservation assertions, setup-failure vs reconcile-preservation classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun probes/managedsystem-reconcile-preservation.ts --check`, non-mutating `--run-id=iteration152-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0); an owner-loop rerun also passed with `--run-id=iteration152-local-gated-rerun`. The model remains unchanged and `managedsystem-reconcile-preservation` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`evidence/outputs/iteration151-managedsystem-single-pool-constraint-execution-implementation.md` remains the single-pool implementation artifact. It closes the single-pool implementation task without cloud mutation: `probes/managedsystem-single-pool-constraint.ts` is now execution-capable but gated behind `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-single-pool-constraint`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the iteration88 SKU/image/defaulting gate is cleared. The implemented runtime path preserves the clean REST boundary from iteration124/150: first ManagedSystem pool via minimal `{"properties":{"mode":"ManagedSystem"}}`, second ManagedSystem pool via the same minimal body with only the pool name changed, post-rejection agentPools list assertions, setup-failure vs second-pool-rejection classification, diagnostics, and whole resource-group cleanup verification. Local verification passed (`bun probes/managedsystem-single-pool-constraint.ts --check`, non-mutating `--run-id=iteration151-local-gated` producing `blocked`/`execution-gated` artifacts, and model validator exit 0). The model remains unchanged and `managedsystem-single-pool-constraint` remains unknown until an explicitly gated cloud execution produces target-branch evidence.

`evidence/outputs/iteration150-managedsystem-cli-failure-reference-packet.md` remains the latest ManagedSystem CLI failure reference packet. It closes the ManagedSystem CLI create/add failure refresh without cloud mutation: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` fail because the preview CLI sends ordinary/default node-pool fields (`OSTypeCasePreserved`, `availabilityProfile`, `count`, `networkProfile`, `osType`, `scaleSetPriority`, `workloadRuntime`, and add-specific `scaleDownMode`) that RP rejects for ManagedSystem pools. The accepted adjacent path remains the minimal ARM REST add-existing body `{"properties":{"mode":"ManagedSystem"}}`, proven by iteration56/20260519/iteration112. No model edit was needed; the validator still exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 7 failing feature IDs, 7 unknown feature IDs, and 3 blocked feature IDs. Do not rerun the same CLI failure unless a new `aks-preview`/Azure CLI version, CLI source fix, or owner request gives a material trigger.

`evidence/outputs/iteration149-paf-throttling-model-hygiene.md` remains the latest local model-changing artifact. It reconciles the iteration148 source/precondition packet into `evidence/outputs/e2e-capability-model.json`: `paf-throttling` is now **blocked/gated** instead of stale fail, with current observations `identity.msi.available=unknown` and `paf.throttling.behavior=unknown` because no artifact reached a failed `Verify PAF Objects` assertion. The validator exits 0 with 35 input variables, 71 expectation variables, 63 feature mappings, 69 test-case mappings, 60 evidence references, 7 failing feature IDs, 7 unknown feature IDs, and 3 blocked feature IDs. Do not rerun standalone/staging PAF until MSI/HCP access, eastus2/underlay capacity or owner-approved bypass, and a source-owner/source-confirmed `DedicatedOom` trigger/assertion path are all available.

`evidence/outputs/iteration148-paf-throttling-source-precondition-reference-packet.md` remains the source/precondition packet behind the iteration149 model edit. It classified the prior `paf-throttling` model fail as stale/ambiguous standalone evidence rather than a confirmed PAF product failure: the first run failed before PAF assertions because the devbox lacked the `akse2ehcp-e2e` MSI; the post-MSI retry reached the dedicated/OOM stress gate but `Verify PAF Objects` was skipped because no kube-apiserver OOMKilled/137 event appeared within the source timeout; later `AKSCapacityHeavyUsage` evidence is a standalone capacity gate.

Human review remains asynchronous. Agents should continue to leave reviewable artifacts and execute bounded preflight/probes when safe, but same-branch cloud reruns require a material trigger or a changed probe input that tests a distinct coverage claim. No further BYO rerun is allowed without a new source/environment/build signal. ManagedSystem cloud execution should wait for a source-shaped request plan with explicit SKU/location/preflight gates, cleanup plan, sanitizer/request-shape evidence where applicable, and clear assertion boundaries. Machines/NAP Machine API cloud execution should wait for the Machine preview feature registrations or an equivalent source environment. App Routing migration execution is complete for the generic branch; preserve the checked-in gates and preflights for any future adjacent App Routing work.

This keeps the project on the agreed phase order: learn -> ground -> experiment -> refine -> next single-case TS probe -> replan.

## Linked Context
- `model/knowledge-map/README.md` — normalized knowledge-map model, visualization contract, and human/LLM update protocol
- `model/knowledge-map/feature-workflow.md` — repeatable deeper/wider workflow for turning one feature into model-backed knowledge
- `model/knowledge-map/model.json` — canonical accepted knowledge model; prefer this over legacy generated summaries under `evidence/outputs/`
- `model/knowledge-map/views/` — generated status, graph, path-summary, and evidence views derived from the canonical model
- `model/knowledge-map/deep-dives/managedsystem-pool.md` — worked deep feature example: sources, scenarios, input DAGs, expectations, verification, quality, risks, and improvement loop
- `scenarios/execution/README.md` — phased learning/experimenting/replanning strategy for TS probes
- `scenarios/execution/automation.md` — operating model for cron/supervisor triggers, always-on controller behavior, lane selection, execution gates, and agent compliance
- `.app/agents/aks-explorer/cron.json` — disabled project-local trigger template for regular learning, weekly replanning review, and manual verification wake-ups
- `sources/feature-packets/README.md` — stable feature reference-packet directory
- `scenarios/run-plans/README.md` — tracked reviewable run-plan directory
- `probes/README.md` — tracked TypeScript probe directory
- `probes/lib/README.md` — shared helper library directory for probes
- `evidence/outputs/iteration155-knowledge-map-normalization.md` — local review aligning current project findings to the normalized scenario/DAG/behavior model
- `evidence/outputs/iteration185-owner-loop-duplicate-resume-reconciliation.md` — owner-loop reconciliation that handled duplicate ManagedSystem replan resume comments without queuing new work
- `evidence/outputs/iteration189-managedsystem-cli-rest-combined-replan.md` — CLI+REST ManagedSystem combined replan for CLI create/add default-payload negative paths plus REST add and mode immutability
- `evidence/outputs/iteration189-live-selected-execution-blocker.md` — four-path live-selected execution blocker showing artifact regeneration succeeded but local `az` is unavailable for the required ARM token gate
- `evidence/outputs/iteration190-live-selected-two-path-blocker.md` — two-path live-selected execution blocker for ManagedSystem mode immutability plus REST add-existing; regeneration succeeded, auth gate failed because `az` is unavailable
- `decisions/replans/live-selected/` — regenerated live-selected replan JSON/TS artifacts for the four-path and two-path ManagedSystem selections
- `scenarios/run-plans/managedsystem-cli-rest-combined.yaml` — gated combined plan for the selected CLI+REST ManagedSystem paths
- `probes/managedsystem-cli-rest-combined.ts` — execution-gated TypeScript probe for the selected CLI+REST ManagedSystem paths
- `sources/feature-packets/managedsystem-pool.yaml` — stable ManagedSystem Pool reference packet
- `scenarios/run-plans/managedsystem-rest-add-existing.yaml` — first single-case TS probe plan
- `probes/managedsystem-rest-add-existing.ts` — executable reference-backed probe
- `sources/feature-packets/workload-autoscaler-vpa-upgrade-survival.yaml` — second reference-backed TS probe feature packet
- `scenarios/run-plans/vpa-upgrade-survival-runtime.yaml` — VPA upgrade-survival TS probe plan
- `probes/vpa-upgrade-survival-runtime.ts` — executable VPA upgrade-survival probe
- `evidence/outputs/iteration115-vpa-upgrade-survival-runtime.md` — VPA upgrade-survival pass summary and model update evidence
- `sources/feature-packets/bootstrap-profile-managed-acr-lifecycle.yaml` — Bootstrap managed-ACR reference packet
- `scenarios/run-plans/bootstrap-profile-managed-acr-lifecycle.yaml` — Bootstrap managed-ACR TS probe plan
- `probes/bootstrap-profile-managed-acr-lifecycle.ts` — executable Bootstrap managed-ACR probe
- `evidence/outputs/iteration116-bootstrap-managed-acr-lifecycle.md` — Bootstrap managed-ACR pass summary and model update evidence
- `sources/feature-packets/bootstrap-profile-byo-acr-lifecycle.yaml` — Bootstrap BYO-ACR reference packet
- `scenarios/run-plans/bootstrap-profile-byo-acr-lifecycle.yaml` — Bootstrap BYO-ACR TS probe plan
- `probes/bootstrap-profile-byo-acr-lifecycle.ts` — executable Bootstrap BYO-ACR probe, hardened after the v2 timeout
- `evidence/outputs/iteration117-bootstrap-byo-acr-lifecycle.md` — Bootstrap BYO-ACR initial blocked attempt and cleanup evidence
- `evidence/outputs/iteration117-bootstrap-byo-acr-v2-timeout-blocker.md` — detailed BYO-ACR v2 create timeout blocker evidence
- `evidence/outputs/iteration116-post-vpa-ts-probe-selection.md` — local selection artifact that chose the now-completed Bootstrap managed-ACR lifecycle probe
- `tasks/README.md` — task tree index and execution rules
- `tasks/tree.json` — current project execution task tree
- `tasks/archive/managedsystem-pool/wave-01-feature-standard.yaml` — archived ManagedSystem Pool parallel feature-standard task wave
- `evidence/outputs/input-expectation-knowledge-map.md` — consolidated input/expectation knowledge map and ranked gaps
- `evidence/outputs/e2ev3-handwritten-coverage-inventory.md` — handwritten e2ev3 source inventory mapping scenarios to input paths, expectation paths, current evidence coverage, and model gaps
- `evidence/outputs/iteration73-capability-model-source-inventory-update.md` — validated capability-model update from handwritten e2ev3 source inventory
- `evidence/outputs/iteration74-node-restriction-source-spec-resolution.md` — Node Restriction source/spec contradiction resolution and operation-shape correction
- `evidence/outputs/iteration75-model-driven-probe-selection.md` — ranked high-density future probes from the validated model
- `evidence/outputs/iteration76-workload-identity-oidc-runtime-staging.md` — Workload Identity Linux token projection and OIDC discovery/JWKS runtime pass evidence
- `evidence/outputs/iteration77-identity-runtime-model-consolidation.md` — branch-accurate Identity/OIDC model consolidation
- `evidence/outputs/iteration78-workload-autoscaler-runtime-staging.md` — KEDA runtime pass and bounded VPA component/recommendation evidence
- `evidence/outputs/iteration79-vpa-runtime-model-split.md` — branch-accurate VPA runtime model split and next-probe reranking
- `evidence/outputs/iteration80-app-routing-tls-source-hypothesis.md` — source-first comparison showing App Routing DefaultDomainCertificate TLS failure is not explained by malformed customer CR/input
- `evidence/outputs/iteration81-app-routing-tls-owner-escalation.md` — owner escalation packet and diagnostic rerun gate for App Routing TLS
- `evidence/outputs/iteration91-app-routing-tls-gated-followup-tracker.md` — explicit App Routing TLS follow-up tracker with owner/diagnostic/fixed-build rerun gates and no-blind-rerun rule
- `evidence/outputs/iteration99-oidc-v133-explicit-enable-staging.md` — OIDC v1.33 explicit-enable discovery/JWKS staging pass evidence
- `evidence/outputs/iteration100-post-oidc-v133-unknown-selection.md` — post-OIDC v1.33 unknown-selection artifact selecting VirtualMachines mixed-SKU REST scale as the next non-gated branch
- `evidence/outputs/iteration101-virtualmachines-mixed-sku-rest-scale-staging.md` — VirtualMachines mixed-SKU REST scale staging pass evidence for `Scenario_Mixed_SKU_Scale`
- `evidence/outputs/iteration102-post-virtualmachines-unknown-selection.md` — post-VirtualMachines unknown-selection artifact selecting Workload Identity Windows token projection as the next non-gated branch
- `evidence/outputs/iteration103-workload-identity-windows-token-projection-staging.md` — Workload Identity Windows token-projection staging pass evidence for `Scenario_WorkloadIdentity` Windows branch
- `evidence/outputs/iteration92-next-model-unknown-selection.md` — local selection artifact that selected the focused VPA residual runtime probe
- `evidence/outputs/iteration93-vpa-residual-runtime-staging.md` — VPA Helm, HA/leader-election, and in-place-update staging pass evidence
- `evidence/outputs/iteration94-next-model-unknown-selection.md` — local selection artifact choosing Image Cleaner vulnerable-image erasure as the next non-gated runtime branch
- `evidence/outputs/iteration82-post-escalation-next-probe-selection.md` — post-App-Routing ranking that selected Node Restriction
- `evidence/outputs/iteration83-node-restriction-fullput-runtime-staging.md` — Node Restriction corrected full-PUT disable contract and runtime-default staging pass evidence
- `evidence/outputs/iteration84-keda-disable-reenable-crud-staging.md` — KEDA disable/re-enable CRUD lifecycle staging pass evidence
- `evidence/outputs/iteration85-workload-identity-disable-reenable-lifecycle-staging.md` — Workload Identity disable/re-enable lifecycle staging pass evidence
- `evidence/outputs/managedsystem-pool-feature-standard.md` — integrated ManagedSystem Pool feature-standard packet and next execution recommendation
- `evidence/outputs/managedsystem-pool-feature-standard-init-tasks.md` — narrative draft for the ManagedSystem Pool feature-standard parallel task wave
- `evidence/outputs/iteration88-managedsystem-disable-migration-checkpointed.md` — checkpointed ManagedSystem rerun showing current add-phase SKU/image gate and cleanup status
- `evidence/outputs/iteration24-managedsystem-pool-pass.md` — pass evidence for `Scenario_ManagedSystemPool_Enable`
- `evidence/outputs/underlay-debug-findings.md` — root cause analysis, MSI fix, retry results
- `evidence/outputs/e2e-run-results-summary.md` — original e2e run results, including older App Routing default-domain traffic/TLS failure context
- `evidence/outputs/managedsystem-pool-exploration.md` — ManagedSystem Pool feature exploration and refreshed conclusions
- `evidence/outputs/iteration55-managedsystem-staging-results.md` — initial staging ManagedSystem Pool evidence
- `evidence/outputs/iteration56-managedsystem-staging-refresh.md` — refreshed staging ManagedSystem Pool CLI/REST classification matrix
- `evidence/outputs/20260519T1646Z-managedsystem-priority-staging.md` — fresh priority re-test confirming ManagedSystem Pool REST/CLI/delete verdict
- `evidence/outputs/aks-public-api-scenario-candidates.md` — prioritized public API feature scenarios
- `evidence/outputs/iteration57-node-autoprovision-staging.md` — NAP staging create evidence
- `evidence/outputs/iteration58-node-autoprovision-followup.md` — NAP staging update evidence
- `evidence/outputs/iteration59-app-routing-staging.md` — App Routing public CLI staging enablement evidence
- `evidence/outputs/iteration60-workload-identity-staging.md` — OIDC issuer + workload identity public CLI staging evidence
- `evidence/outputs/iteration61-workload-autoscaler-staging.md` — workload autoscaler KEDA/VPA public CLI profile-state evidence
- `evidence/outputs/iteration62-security-profile-staging.md` — Image Cleaner pass and Node Restriction tag-only PATCH/non-contract evidence
- `evidence/outputs/iteration63-bootstrap-profile-staging.md` — bootstrapProfile.artifactSource contract-first staging evidence
- `evidence/outputs/iteration64-virtualmachines-agentpool-staging.md` — non-ManagedSystem VirtualMachines agent-pool single-SKU pass and multi-SKU failure evidence
- `evidence/outputs/iteration65-virtualmachines-multisku-contract.md` — VirtualMachines single-SKU autoscale/update contract evidence and misleading multi-SKU add help classification
- `evidence/outputs/iteration66-virtualmachines-manual-scale-staging.md` — VirtualMachines manual-scale multi-profile add/delete staging evidence
- `evidence/outputs/iteration67-app-routing-disable-staging.md` — App Routing public CLI disable pass and persisted disabled-state evidence
- `evidence/outputs/iteration68-app-routing-defaultdomain-staging.md` — App Routing default-domain public API/state pass evidence
- `evidence/outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` — App Routing default-domain HTTP traffic reachability pass evidence
- `evidence/outputs/iteration70-app-routing-defaultdomain-tls-staging.md` — App Routing DefaultDomainCertificate/TLS-secret staging failure and fallback-cert HTTPS evidence
- `evidence/outputs/e2e-capability-model.json` — project-local capability model and evidence map
- `evidence/outputs/scripts/README.md` — reusable scripts produced for cleanup/run/capacity/MSI work
- `evidence/outputs/iteration33-standalone-environment-dead.md` — blocker evidence: old standalone builds recycled
- `devbox:/home/hayua/rp` — AKS RP checkout and staging execution context

## Task Management
- `.app/project.md` is the project control plane and navigation root. It should stay readable: goal, current state, next action, validation rules, key context links, and the active task pointer.
- Current project execution state lives in `tasks/tree.json`. That task tree is the operational view of how the project is broken down and what is blocked, ready, active, or accepted.
- `tasks/README.md` explains the task tree rules. `scenarios/` is reserved for AKS e2e domain scenarios, test specs, run plans, and execution strategy.
- Durable findings, evidence, feature packets, and run results live under `evidence/outputs/`.
- Keep one task responsible for one durable output artifact. Parallel tasks must write to different outputs; integration tasks merge them afterward.
- The project execution engine works breadth-first from `tasks/tree.json`, executes ready leaf tasks until blocked or gated, verifies claims before acceptance, and rolls accepted work up to parent tasks.

## Capability Map
- `Scenario_Traffic_AppRouting_Nginx_Disablement`: pass. Green evidence is in `evidence/outputs/successful-e2e-run.md`.
- `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`: partially reconciled. Fresh staging HTTP default-domain traffic passes (`evidence/outputs/iteration69-app-routing-defaultdomain-traffic-staging.md`), but TLS/DefaultDomainCertificate certificate provisioning fails in staging (`evidence/outputs/iteration70-app-routing-defaultdomain-tls-staging.md`) and older standalone evidence also points to TLS secret provisioning failure.
- `Scenario_PAFThrottling`: blocked/gated after iteration149 model hygiene. Current evidence does not prove a PAF product failure: the first run lacked `akse2ehcp-e2e` MSI, the post-MSI retry reached `DedicatedOom` but timed out before `Verify PAF Objects`, and later standalone evidence hit eastus2 `AKSCapacityHeavyUsage`. Do not rerun until MSI/HCP access, target capacity or owner-approved bypass, and source-owner/source-confirmed OOM trigger/assertion path are all available.
- Duplicate-registered scenarios: blocked by framework/test-selection ambiguity; use source inspection before retrying exact scenario names.
- ManagedSystem ARM REST add-existing-pool: pass in staging. Evidence is in `evidence/outputs/managedsystem-pool-exploration.md`.
- ManagedSystem Azure CLI create/add: fail. CLI sends default fields that RP rejects for ManagedSystem pools.
- ManagedSystem standalone e2ev3 scenario: pass. Evidence is in `evidence/outputs/iteration24-managedsystem-pool-pass.md`.

## Capability Model
- Source: `evidence/outputs/e2e-capability-model.json`
- Validator: `model/tools/src/validate.ts`
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
Run the ready `failure-triage` leaf from `tasks/tree.json`. It should read `evidence/outputs/coverage-gap-analysis.md` and `model/knowledge-map/model.json`, produce `evidence/outputs/failure-triage.md`, and classify the seven failing testCases with evidence-backed rationale. After it is accepted, the engine should roll up the parent and create/continue the next local analytical task if the project still has useful safe work.

Status is `active` with a blocked frontier under review. Iteration190 handled the unread discussion tail after `---read @iter189---`: the two-path ManagedSystem live-selected replan for `path.managedsystem.mode-immutability` and `path.managedsystem.rest-add-existing.minimal-rest` regenerated successfully into `decisions/replans/live-selected/`; a non-mutating dry-run sanity check and canonical model validation both exited 0, but the owner-specified ARM token gate failed before mutation because `az` is not installed in this workspace. The blocker artifact is `evidence/outputs/iteration190-live-selected-two-path-blocker.md`.

The project execution engine should first run the blocked-frontier review tasks in `tasks/tree.json`. Those tasks must decide whether current blockers are real, stale, too coarse, missing evidence, wrongly blocked, locally unblockable, or genuinely external. If safe local work exists, create ready child tasks and continue. If only external gates remain, record the exact resume condition and keep the relevant task blocked.

Resume only when one of these triggers exists:

1. Azure CLI is available in the project workspace and `az account get-access-token --resource https://management.azure.com/ -o json` succeeds for the two-path live selected run, or the owner provides an approved credentialed execution host/path where the same auth gate succeeds.
2. ManagedSystem owner/operator authorizes execution of the CLI+REST combined probe and supplies `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-cli-rest-combined`, and a concrete `AKS_RP_E2E_MANAGEDSYSTEM_GATE_NOTE` explaining why the ManagedSystem SKU/image/defaulting gate is cleared.
3. ManagedSystem owner/operator authorizes the older add/immutability/delete combined probe and supplies `--execute`, `AKS_RP_E2E_ALLOW_CLOUD_MUTATION=managedsystem-add-immutability-delete-combined`, and a concrete ManagedSystem gate note.
4. ManagedSystem owner/operator authorizes another ManagedSystem cloud probe and supplies that branch-specific `AKS_RP_E2E_ALLOW_CLOUD_MUTATION` value plus a concrete gate note.
5. App Routing owner provides default-domain TLS-secret diagnostics, a fixed build/config, or a live-verifiable precondition for default-domain TLS/Istio.
6. Machines API preview features `Microsoft.ContainerService/PutMachinePreview` and `Microsoft.ContainerService/DeleteSpecificMachinesPreview` are registered, or an equivalent source environment is provided.
7. NAP managed-machine-pool rollout/config changes, source expectations change, or a source-equivalent environment is identified for `aksmanagedap` creation.
8. VPA cert-renewal source/environment ambiguity is resolved.
9. Bootstrap BYO ACR gets a new source/environment/build signal plus SKU/location feasibility preflight.
10. PAF gets MSI/HCP access, target capacity or owner-approved bypass, and source-owner confirmation for the `DedicatedOom` OOM trigger/assertion path.
11. A human explicitly requests a different bounded local model-hygiene/reference-packet/replanning task.

Until a matching trigger exists, preserve the recorded gates for Machines/NAP, PAF, App Routing default-domain TLS/Istio, Bootstrap BYO-ACR cloud reruns, VPA cert renewal, Node Restriction PATCH, same-input NAP eastus2, and ManagedSystem cloud probes. Do not run `kubectl`, `--execute`, standalone/staging, cluster creation, Machine APIs, `deleteMachines`, or ManagedSystem cloud probes without the relevant trigger. It is acceptable to rerun the owner-specified non-mutating `az account get-access-token` gate only when `az` becomes available or an approved credentialed host/path is supplied. Local blocked-review, model hygiene, reference-packet review, task-tree cleanup, and non-mutating evidence checks may continue when they are explicitly represented as ready tasks.

## Backlog
- UI graph for the knowledge model: the current quality panel is mostly a table/list view. It is missing the critical visualization for the core idea: an **input-space graph**, an **expectation-space graph**, and **feature mappings as paths across both spaces**. Keep this as a backlog design task for now, not part of the current handwritten-source inventory. When picked up, the UI should make the knowledge model visible: how a feature selects paths from both spaces, which tests/evidence attach to those paths, and where staging/standalone coverage is missing, blocked, failing, or not yet explored.

## Migration Notes
The detailed historical migration log was archived when Project App V2 task-tree execution became the current model.

- Archive: `.app/archive/project-pre-v2-task-engine.md`
- Current runtime frame: `.app/project.md`
- Current execution tree: `tasks/tree.json`
- Current domain evidence: `evidence/outputs/`, `model/knowledge-map/`, `scenarios/`, and `probes/`

## Plan
Current project execution is driven by the breadth-first task tree. The engine selects ready leaf tasks from `tasks/tree.json`, verifies claims before acceptance, rolls up parent state, creates parent-review or blocked-review tasks when audit/replan is needed, and keeps going until truly blocked, gated, complete, or interrupted by an infra budget guard.

Blocked is not a passive stop state. When the ready frontier is empty, the engine creates or runs blocked-review tasks that inspect whether blockers are real, stale, too coarse, missing evidence, wrongly blocked, locally unblockable, or genuinely external. The project should wait only after that review confirms no safe local unblock, split, correction, or evidence-gathering task remains.

Workers should not edit `tasks/tree.json` directly. A worker produces a claim and evidence for one leaf; the engine owns task updates, parent rollup, review-task creation, and continuation events. If a wake slice ends while ready work remains, the engine emits another `project.execution.requested` event so the project stays active.

The project watcher is enabled through `.app/app.ts`: the `regular-learning` schedule emits `project.tick` every hour, and the app converts that tick into the same `project.execution.requested` event used by comments, steering, and the `advance-project`/`watch` actions. The project-local trigger in `.app/agents/aks-explorer/cron.json` consumes that event and runs the task-tree workflow.

## Tasks

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
  `evidence/outputs/first-e2e-run-results.md`.


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
- Accepted and raw evidence: `evidence/outputs/`
- Knowledge model and generated views: `model/knowledge-map/`
- Feature packets: `sources/feature-packets/`
- Run plans: `scenarios/run-plans/`
- Probes: `probes/`
- Full legacy artifact ledger: `.app/archive/project-pre-v2-task-engine.md#artifacts`

## Active Task
- id: project-frontier-replan-4
- status: active
- source: tasks/tree.json
- outputs: evidence/outputs/project-frontier-replan-4.md

## Task Index
- tasks/README.md
- tasks/tree.json
