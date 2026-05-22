---
id: aks-rp-e2e
owner: aks-explorer
status: active
type: milestone
priority: P1
project_policy: aggressive-push
iteration: 121
max_concurrent: 1
max_task_attempts: 2
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
- knowledge.expectation-space-modeled: current capability model has 67 expectation variables.
- knowledge.feature-mapping-started: current capability model has 62 feature mappings and 68 test-case evidence mappings; current validator has 7 failing features, 10 unknown feature IDs, and 2 blocked features after iteration116.
- knowledge.source-inventory-modeled: `outputs/iteration73-capability-model-source-inventory-update.md` converted handwritten e2ev3 source intent into first-class model structure; validator exits 0.
- e2e.existing-cases-cataloged: `outputs/scenario-catalog.md` and e2e artifacts provide the first source for inferring feature intent and coverage.
- knowledge.public-api-candidates-started: `outputs/aks-public-api-scenario-candidates.md` derives additional candidate feature surfaces from public AKS API/docs.
- execution.evidence-collected: staging and standalone artifacts provide pass/fail/blocker evidence for ManagedSystem, App Routing, NAP, workload identity, autoscaler, security, bootstrap, and VirtualMachines paths.

## Current State
Active; five reference-backed TypeScript probe paths have now been exercised or built: ManagedSystem REST add-existing, VPA upgrade-survival, Bootstrap profile managed-ACR lifecycle, Bootstrap profile BYO-ACR lifecycle, and OIDC default-enabled signing-key rotation.

`outputs/iteration120-node-restriction-tag-only-patch-shape.md` is the latest completed artifact. It resolves `node-restriction-tag-only-patch-shape` locally as a non-contract/no-future-probe branch: public swagger models ManagedCluster PATCH as `ManagedClusters_UpdateTags` with a tag-only `TagsObject` body across checked API versions; prior RP source evidence decodes PATCH as `PatchRequestBody { Tags map[string]string }`; and the full Node Restriction disable validator/error contract belongs to full ManagedCluster PUT, already passed in iteration83. The artifact recommends local model hygiene rather than any staging, az, kubectl, cluster creation, or cloud mutation for this branch.

`outputs/iteration119-oidc-signing-key-rotation-model-update.md` remains the latest model-changing pass. The OIDC signing-key rotation probe created one Kubernetes `1.34` staging cluster in eastus2, confirmed OIDC default-enabled discovery/JWKS with initial key count 2, executed all eight source-authored `rotation.go` cases through ARM `POST rotateServiceAccountSigningKeys`, observed the expected JWKS key counts for each case, and cleaned up to `az group exists=false`. `oidc-issuer-default-enabled-signing-key-rotation` is now pass in `outputs/e2e-capability-model.json`; the validator exits 0 with 35 input variables, 67 expectation variables, 62 feature mappings, 68 test-case evidence mappings, 7 failing feature IDs, 9 unknown feature IDs, and 2 blocked feature IDs.

`outputs/iteration118-bootstrap-byo-acr-hardened-followup.md` remains the latest BYO-ACR outcome. The allowed hardened BYO-ACR follow-up is closed as blocked, not a product verdict: preflight was clean, one execution hit a stale generated-name collision that cleaned up, and a fresh-name execution reached source-shaped custom VNet plus two Premium public BYO ACRs/cache rules before `az aks create --no-wait` failed pre-create because `Standard_D4_v3` is not allowed in eastus2 for this staging subscription. Cleanup was verified to `az group exists=false`. The BYO branch remains unknown in `outputs/e2e-capability-model.json`, intentionally unchanged.

`outputs/iteration116-bootstrap-managed-acr-lifecycle.md` remains the Bootstrap managed-ACR model-changing pass. `bootstrap-profile-managed-acr-lifecycle` is pass in `outputs/e2e-capability-model.json`: the source-shaped Cache -> Direct -> Cache lifecycle assigned an AKS-managed ACR, succeeded nginx `PullAlways` image pulls in each phase, removed managed ACR/private endpoint/private DNS resources on Direct disable, re-enabled Cache with a new managed registry, and verified resource-group cleanup.

The previous VPA upgrade-survival TS probe remains pass in `outputs/iteration115-vpa-upgrade-survival-runtime.md`: VPA profile enabled, components/recommendations passed before and after upgrade, Kubernetes upgraded from `1.34.7` to `1.35.4`, and cleanup reached `az group exists=false`. ManagedSystem REST add-existing remains pass in `outputs/iteration112-managedsystem-rest-add-existing-v2-managedsystem-rest-add-existing.md` for the minimal REST PUT/defaulting contract.

`outputs/iteration109-virtualmachines-autoscaled-vms-crud-staging.md` remains pass for source-shaped `Scenario_Autoscaled_VMs_CRUD`; the run used generated-client/source-equivalent `2026-03-02-preview`, `AKSHTTPCustomFeatures=Microsoft.ContainerService/VMsAgentPoolAutoscalePreview`, eastus2 `Standard_D2s_v4`, Kubernetes `1.33.11` -> `1.34.7`, and default pool `autoscaleap` type `VirtualMachines`.

`vpa-cert-renewal-runtime-staging` remains complete and explicitly blocked for exact source-equivalent closure in `outputs/iteration107-vpa-cert-renewal-runtime-staging.md`. Do not rerun it until an AKS build/chart/environment has `kube-system/vpa-webhook-tls-reconciler`, or a source-owner/source update confirms the legacy `overlay-vpa-cert-webhook-check` job is the intended cert-renewal path.

`machines-agentpool-api-crud` remains blocked on missing staging subscription features `Microsoft.ContainerService/PutMachinePreview` and `Microsoft.ContainerService/DeleteSpecificMachinesPreview`; do not rerun Machines CRUD or select NAP default Machines pool cleanup until those features are registered in subscription `26fe00f8-9173-4872-9134-bb1d2e00343a` or an equivalent source environment is provided.

The next plausible frontier is local model hygiene for `node-restriction-tag-only-patch-shape`, following `outputs/iteration120-node-restriction-tag-only-patch-shape.md`: retire or reclassify the branch so it no longer appears as an execution-worthy unknown, validate the model, and update the knowledge-map row. Preserve existing gates for BYO reruns, VPA cert renewal, Machines/NAP Machine API work, App Routing TLS/Istio, ManagedSystem gated branches, and Node Restriction cloud PATCH reruns; do not rerun completed Image Cleaner/VPA/OIDC/ManagedSystem/Bootstrap managed-ACR branches unless source semantics, environment, or probe inputs materially change.

## Current Phase

The reference-backed TypeScript probe pattern has now been exercised on five features/branches. ManagedSystem REST add-existing proved the first worked example; iteration115 copied the refined diagnostics pattern to `workload-autoscaler-vpa-upgrade-survival-runtime`; iteration116 copied it to `bootstrap-profile-managed-acr-lifecycle`; iteration117/118 built and bounded `bootstrap-profile-byo-acr-lifecycle` without a product verdict; iteration119 copied the pattern to `oidc-issuer-default-enabled-signing-key-rotation` and produced a validator-backed pass.

`outputs/iteration119-oidc-rotation-oidc-signing-key-rotation.md` and `outputs/iteration119-oidc-signing-key-rotation-model-update.md` close the selected post-BYO OIDC frontier. The probe executed source-authored rotation cases `case_2`, `case_2_legacy`, `case_4`, `case_5`, `case_6`, `case_7`, `case_8`, and `case_1`; every case reached its expected JWKS key count and cleanup passed.

Next phase: perform the local model hygiene recommended by `outputs/iteration120-node-restriction-tag-only-patch-shape.md`. The source/spec operation-shape resolution is done and says no future cloud PATCH probe is justified under current swagger/RP source; the remaining work is to make `outputs/e2e-capability-model.json` and the knowledge map reflect that this is non-contract/source-resolved rather than an execution-worthy unknown.

Human review remains asynchronous. Agents should continue to leave reviewable artifacts and execute bounded preflight/probes when safe, but same-branch cloud reruns require a material trigger or a changed probe input that tests a distinct coverage claim; no further BYO rerun is allowed without a new source/environment/build signal, and the next Node Restriction task is local-only.

This keeps the project on the agreed phase order: learn -> ground -> experiment
-> refine -> next single-case TS probe -> replan.

## Linked Context
- `execution/README.md` — phased learning/experimenting/replanning strategy for TS probes
- `features/README.md` — stable feature reference-packet directory
- `run-plans/README.md` — tracked reviewable run-plan directory
- `probes/README.md` — tracked TypeScript probe directory
- `probe-lib/README.md` — shared helper library directory for probes
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
- `Scenario_PAFThrottling`: fail/pending retry. Earlier evidence points to missing MSI identity; retry after MSI fix and standalone cleanup is the next quality signal.
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
- Current deterministic summary: 35 AKS input variables, 67 AKS state/behavior expectation variables, 62 feature mappings, 68 test-case evidence mappings, 56 judgments, 48 evidence references.
- Current feature status from validator: 7 fail (`app-routing-default-domain`, `paf-throttling`, CLI create/add ManagedSystem paths, `virtualmachines-agentpool-cli-add-multi-sku`, `app-routing-default-domain-tls-secret`, `managedsystem-disable-migration`), 9 unknown feature IDs, and 2 blocked (`workload-autoscaler-vpa-cert-renewal-runtime`, `machines-agentpool-api-crud`). `workload-autoscaler-vpa-upgrade-survival-runtime` is pass after iteration115, `bootstrap-profile-managed-acr-lifecycle` is pass after iteration116, and `oidc-issuer-default-enabled-signing-key-rotation` is pass after iteration119.
- Rule: agents may propose model changes, but the model is accepted only when the TypeScript validator passes.

## Weaknesses
- TLS secret provisioning weakness: DefaultDomain failed because required TLS secret was not provisioned.
- MSI identity weakness: PAFThrottling failed because MSI identity was missing.
- Scenario-selection weakness: duplicate registrations make several scenario names ambiguous.
- Standalone teardown leak: e2ev3 fires DELETE on the resource group and immediately returns ("success to start deleting resource group without wait it done"). If the test process is interrupted before ARM finishes, the standalone RP datastore keeps a `Succeeded` cluster that counts against per-underlay capacity and eventually trips `AKSCapacityHeavyUsage` for new runs.
- ManagedSystem CLI bug: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` send default fields that RP rejects.

## Next Action
Perform local-only model hygiene for `node-restriction-tag-only-patch-shape`, as recommended by `outputs/iteration120-node-restriction-tag-only-patch-shape.md`.

The task should:

- update `outputs/e2e-capability-model.json` so `node-restriction-tag-only-patch-shape` is no longer an execution-worthy unknown; prefer either retiring it as a non-contract note or adding precise PATCH-shape expectation semantics that record source/spec resolution;
- cite `outputs/iteration120-node-restriction-tag-only-patch-shape.md`, `outputs/iteration74-node-restriction-source-spec-resolution.md`, `outputs/iteration83-node-restriction-fullput-runtime-staging.md`, and `outputs/iteration62-security-profile-staging.md` as the evidence chain;
- run `cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts outputs/e2e-capability-model.json` and include the validator result in a short output artifact;
- update the relevant knowledge-map row or note so future selection does not rediscover this as a cloud PATCH candidate;
- if the model schema makes a clean retirement awkward, write a precise local blocker with the schema reason and propose the smallest schema-compatible representation.

Do not run staging, `az`, `kubectl`, cluster creation, or cloud mutation in this task. Preserve existing gates for BYO, VPA cert renewal, Machines/NAP Machine API work, App Routing TLS/Istio, ManagedSystem prereq-sensitive branches, and Node Restriction cloud PATCH reruns. Do not rerun completed ManagedSystem, VPA, OIDC, Bootstrap managed-ACR, or Image Cleaner branches unless source semantics, environment, or probe inputs materially change.

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
46. 🔄 Retire or reclassify Node Restriction tag-only PATCH as source-resolved/non-contract in the capability model

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
  status: pending
  assignee: aks-explorer
  goal: "Perform local-only model hygiene for node-restriction-tag-only-patch-shape after outputs/iteration120-node-restriction-tag-only-patch-shape.md resolved it as a non-contract/no-future-probe branch. Update outputs/e2e-capability-model.json so this branch no longer appears as an execution-worthy unknown, either by retiring it as a non-contract note or by adding precise PATCH-shape expectation semantics that record source/spec resolution. Update the relevant row or note in outputs/input-expectation-knowledge-map.md so future selection does not rediscover this as a cloud PATCH candidate. Produce a short artifact under outputs/ with the exact model/knowledge-map edits and validator output. Run cd /app/projects/aks-rp-e2e && bun capability-model/src/validate.ts outputs/e2e-capability-model.json. Do not run staging, az, kubectl, cluster creation, or cloud mutation."
  depends_on: [node-restriction-tag-only-patch-source-shape]
  attempts: 0

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
