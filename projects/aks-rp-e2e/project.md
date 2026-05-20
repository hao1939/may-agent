---
id: aks-rp-e2e
owner: aks-explorer
status: active
type: milestone
priority: P1
project_policy: aggressive-push
iteration: 97
max_concurrent: 1
max_task_attempts: 2
---

# Project: AKS RP E2E - Input/Expectation Knowledge Map

## Goal
Build a durable map between AKS input space and expected behavior space, then use that map to understand current e2e coverage and plan higher-value tests. Success is not just "run another scenario"; success is a growing knowledge model where each feature maps to one or more AKS input paths, each test maps to expected and observed behavior paths, and every execution result improves the model.

Execution evidence still matters, but it is no longer the whole project goal. First build the knowledge map from existing handwritten e2ev3 cases, RP/e2ev3 source, AKS public APIs/docs, and existing run artifacts. After the current coverage state is clear, move to the advanced phase: discover unreached or surprising regions of the input/expectation space where AKS RP quality can improve.

## Core Strategy
- Treat AKS behavior as two connected spaces:
  - **Input space:** API shape, request path, feature flags, cluster/nodepool/add-on/security/network/profile settings, environment, and operation type.
  - **Expectation space:** accepted/rejected contract, persisted state, defaulting, immutability, runtime behavior, traffic reachability, cleanup behavior, and error shape.
- A **feature** is a selected subset/intersection of input space and expectation space that is meaningful enough to test. Strong features should be anchored by one or more solid developer-written e2ev3 checks when they exist.
- A **test** is evidence for an expectation path under a concrete input path and observation context.
- Existing handwritten e2ev3 cases are the primary source for feature inference. They were written by AKS developers, so each case likely encodes a meaningful product contract, historical bug, boundary, or customer scenario. Do not guess feature importance when a handwritten case can tell us what developers already cared about.
- Public API/spec is the best source for understanding AKS input space: resources, properties, operations, request shapes, allowed values, mutability, and constraints.
- Public docs are the best source for understanding expectation space: intended behavior, user-visible contract, lifecycle, prerequisites, validation rules, and operational outcomes.
- Staging probes and RP source are supporting knowledge sources. Execution is the final authority for observed behavior, but source/docs are valid inputs for building candidate paths and coverage hypotheses.
- Start with one selected feature and make the process solid before generalizing. ManagedSystem Pool is the first worked example because it already has REST, CLI, standalone e2ev3, staging, positive, negative, and boundary evidence. The process should then be reusable for other features: infer feature intent from handwritten tests, enumerate input space from API/spec, enumerate expectation space from docs/tests/source, map evidence, find gaps, and plan the next high-density probe.
- Optimize future runs for coverage density: prefer tests that cover multiple important input/expectation paths in one run, or that resolve a high-uncertainty gap in the map.
- Do the dark-side discovery only after the baseline map is credible: first know what we cover, then deliberately search the regions we never reached.

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
- knowledge.feature-mapping-started: current capability model has 62 feature mappings and 66 test-case evidence mappings; current validator has 7 failing features, 19 unknown features, and 0 blocked features.
- knowledge.source-inventory-modeled: `outputs/iteration73-capability-model-source-inventory-update.md` converted handwritten e2ev3 source intent into first-class model structure; validator exits 0.
- e2e.existing-cases-cataloged: `outputs/scenario-catalog.md` and e2e artifacts provide the first source for inferring feature intent and coverage.
- knowledge.public-api-candidates-started: `outputs/aks-public-api-scenario-candidates.md` derives additional candidate feature surfaces from public AKS API/docs.
- execution.evidence-collected: staging and standalone artifacts provide pass/fail/blocker evidence for ManagedSystem, App Routing, NAP, workload identity, autoscaler, security, bootstrap, and VirtualMachines paths.

## Current State
Active; the OIDC post-delete cleanup task is complete and the project has advanced to a bounded next non-gated unknown. The legacy `aks-rp-e2e-iteration` workflow remains superseded; do not restart it.

`outputs/iteration97-oidc-post-delete-cleanup-staging.md` executed the source-gated OIDC default-enabled post-delete issuer cleanup probe in staging. The run passed: source preflight confirmed the `>=1.34` default-enabled OIDC branch, discovery/JWKS URL construction, source-expected post-delete HTTP `404`, 30m/30s wait budget, no-wait managed-cluster then resource-group delete shape, and no skip condition. A Kubernetes `1.34` cluster was created without explicit OIDC enablement and ARM defaulted `oidcIssuerProfile.enabled=true`; discovery and JWKS returned HTTP `200` before delete; source-equivalent no-wait delete requests succeeded; discovery and JWKS returned HTTP `404 WebContentNotFound` about 5m49s after delete start; cleanup reached `ResourceGroupNotFound`. The capability model was updated so `oidc-issuer-default-enabled-post-delete-cleanup` is `pass`; validator exits 0 with 35 input variables, 67 expectation variables, 7 failing features, 19 unknown features, and 0 blocked features.

The current active task is now `post-oidc-unknown-selection`: locally rank the remaining non-gated model unknowns after the OIDC pass and select the next bounded execution branch, producing `outputs/iteration98-post-oidc-unknown-selection.md`. This is a selection/model task only: do not run staging, `az`, `kubectl`, cluster creation, or cloud probes in this task.

The latest ManagedSystem checkpointed rerun is `outputs/iteration88-managedsystem-disable-migration-checkpointed.md`. It confirmed no leftover `msmig*` resources from the interrupted iteration87 run, preserved checkpoint scripts/logs, and attempted two fresh staging adds. Both attempts failed in `wait_pool` before runtime placement because the RP selected `Standard_D8pds_v5` (Arm64-only) while using an x64 Ubuntu node image. Cleanup was requested and a later broad devbox resource check showed no `msmig` resource groups. The capability model remains intentionally unchanged; `managedsystem-disable-migration` remains `fail` on the clearer iteration86 runtime evidence.

Resume-menu item 2 is complete: `outputs/iteration91-app-routing-tls-gated-followup-tracker.md` now makes the App Routing DefaultDomainCertificate TLS-secret branch explicitly gated. The allowed App Routing TLS rerun triggers are owner response, CCP/default-domain-svc diagnostic access, a fixed/known-good build/configuration, or a source-proven chart/config mismatch that can be verified live. Do not run a blind customer-cluster-only App Routing TLS rerun.

The project is not globally blocked: ManagedSystem migration-positive and App Routing TLS are gated, but the knowledge map has other high-value unknowns. Use `outputs/iteration96-post-image-cleaner-unknown-selection.md` as the latest ranking baseline, remove the now-passed OIDC post-delete branch, account for any newly changed model state, then choose the next concrete branch.

## Owner Review of Latest Comments
- Reviewed `discussion.md`; the tail after the last read markers contains only older audit suggestions and no newer human instruction that supersedes the current model-driven branch selection.
- The stale-state concern remains addressed: App Routing TLS has an explicit gated tracker, VPA residual runtime, Image Cleaner vulnerable-image erasure, and OIDC post-delete cleanup are complete.
- ManagedSystem migration-positive and App Routing TLS remain gated; neither should be retried blindly.

## Review Questions

1. **Is the goal closer?**  
   Yes. Iteration97 converted OIDC default-enabled post-delete issuer cleanup from unknown to pass evidence and reduced model unknowns from 20 to 19.

2. **What did we learn?**  
   On Kubernetes `1.34`, OIDC issuer defaults on without an explicit enable flag, discovery/JWKS are reachable before deletion, and issuer documents return the source-expected `404 WebContentNotFound` within the 30 minute source budget after source-equivalent no-wait cluster/resource-group deletion.

3. **Is the current milestone the right next step?**  
   Yes. Since the selected OIDC branch is closed, the right next milestone is a bounded local selection pass over the remaining non-gated unknowns before any new cloud mutation.

4. **Are we closing the loop?**  
   Yes. The parser-visible task block now has exactly one active task, `post-oidc-unknown-selection`, with a single durable output target and an explicit no-cloud constraint.

5. **Is it verified?**  
   Yes. A fresh capability-model validator run exits 0 with 35 input variables, 67 expectation variables, 7 failing features, 19 unknown features, and 0 blocked features after the iteration97 model update.

6. **What’s blocking progress?**  
   The project as a whole is not blocked. Specific branches remain gated or deprioritized: ManagedSystem migration-positive awaits a SKU/image fix or allowed override; App Routing TLS awaits owner diagnostics/fix; OIDC signing-key rotation needs a cheap trigger/source clarification; Windows Workload Identity and upgrade/cert-survival branches are viable but higher cost.

## Resume Menu (ranked)

1. **Select the next post-OIDC non-gated model unknown — current active task.**  
   Produce `outputs/iteration98-post-oidc-unknown-selection.md` by reading the post-iteration97 model, `outputs/iteration96-post-image-cleaner-unknown-selection.md`, and current evidence/gates. Rank at least Workload Identity Windows, VirtualMachines mixed-SKU REST scale, VPA cert renewal, Image Cleaner upgrade/restart survival, bootstrap profile lifecycle, and OIDC signing-key rotation/v1.33 explicit-enable by coverage, source anchor, cost/risk, required access, and gating. End with one concrete recommended execution branch and exact source preflight reads.

2. **If the ranking finds no plausible non-gated cloud branch, write a local blocker/escalation artifact.**  
   Capture why each remaining unknown is gated or too risky, name the external owner/action needed, and set project status to waiting with a concrete resume trigger.

3. **Do not run gated branches blindly.**  
   ManagedSystem migration-positive and App Routing TLS require their documented gate changes before rerun; OIDC signing-key rotation needs trigger/source clarification; VPA/Image Cleaner upgrade survival and Workload Identity Windows should be selected only when their cost/risk is explicitly accepted.

## Decision

`outputs/iteration97-oidc-post-delete-cleanup-staging.md` is complete and closes **OIDC default-enabled post-delete issuer cleanup** as pass. Proceed with one active parser-visible local selection task, `post-oidc-unknown-selection`, to choose the next non-gated unknown before any additional staging/cloud mutation.

## (a) Concrete output

`outputs/iteration97-oidc-post-delete-cleanup-staging.md` is the completed staging evidence artifact. `project.md` now creates the single next parser-visible local selection task for `outputs/iteration98-post-oidc-unknown-selection.md`.

## (b) What’s different

The previous state had selected OIDC post-delete cleanup as an execution task. That branch is now executed and passed with model validation. The new state selects a local post-OIDC unknown-selection task based on the validated post-iteration97 model and keeps App Routing TLS and ManagedSystem migration-positive behind their existing gates.

## (c) First step on resume

Read this `## Current State`, then read `outputs/iteration97-oidc-post-delete-cleanup-staging.md`, `outputs/iteration96-post-image-cleaner-unknown-selection.md`, `outputs/e2e-capability-model.json`, and `outputs/input-expectation-knowledge-map.md`. Run the capability-model validator and use its current unknown list as the source of truth for `outputs/iteration98-post-oidc-unknown-selection.md`; do not create a cluster in the selection task.

## Linked Context
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
- Current deterministic summary: 35 AKS input variables, 67 AKS state/behavior expectation variables, 62 feature mappings, 66 test-case evidence mappings, 50 judgments, 37 evidence references.
- Current feature status: 36 pass, 7 fail (`app-routing-default-domain`, `paf-throttling`, CLI create/add ManagedSystem paths, `virtualmachines-agentpool-cli-add-multi-sku`, `app-routing-default-domain-tls-secret`, `managedsystem-disable-migration`), 19 unknown, 0 blocked.
- Rule: agents may propose model changes, but the model is accepted only when the TypeScript validator passes.

## Weaknesses
- TLS secret provisioning weakness: DefaultDomain failed because required TLS secret was not provisioned.
- MSI identity weakness: PAFThrottling failed because MSI identity was missing.
- Scenario-selection weakness: duplicate registrations make several scenario names ambiguous.
- Standalone teardown leak: e2ev3 fires DELETE on the resource group and immediately returns ("success to start deleting resource group without wait it done"). If the test process is interrupted before ARM finishes, the standalone RP datastore keeps a `Succeeded` cluster that counts against per-underlay capacity and eventually trips `AKSCapacityHeavyUsage` for new runs.
- ManagedSystem CLI bug: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` send default fields that RP rejects.

## Next Action
The OIDC post-delete cleanup staging artifact `outputs/iteration97-oidc-post-delete-cleanup-staging.md` is complete and model-validated. Next task: produce `outputs/iteration98-post-oidc-unknown-selection.md`, a local selection artifact that ranks the remaining 19 model unknowns after removing the now-passed OIDC post-delete branch and chooses the next bounded non-gated execution branch. Start with the post-iteration97 validator output, `outputs/iteration96-post-image-cleaner-unknown-selection.md`, `outputs/input-expectation-knowledge-map.md`, and the linked evidence for the highest-ranked residuals. Do not run staging, `az`, `kubectl`, cluster creation, or cloud probes in this selection task. Continue to keep ManagedSystem migration-positive and App Routing TLS behind their existing gates.

## Backlog
- UI graph for the knowledge model: the current quality panel is mostly a table/list view. It is missing the critical visualization for the core idea: an **input-space graph**, an **expectation-space graph**, and **feature mappings as paths across both spaces**. Keep this as a backlog design task for now, not part of the current handwritten-source inventory. When picked up, the UI should make the knowledge model visible: how a feature selects paths from both spaces, which tests/evidence attach to those paths, and where staging/standalone coverage is missing, blocked, failing, or not yet explored.

## Migration Notes
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
26. ▶️ Select the next post-OIDC non-gated model unknown

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
  status: running
  assignee: aks-explorer
  goal: "Produce outputs/iteration98-post-oidc-unknown-selection.md selecting the next non-gated model-unknown branch after OIDC default-enabled post-delete cleanup passed. Start from outputs/iteration97-oidc-post-delete-cleanup-staging.md, outputs/iteration96-post-image-cleaner-unknown-selection.md, outputs/input-expectation-knowledge-map.md, outputs/e2e-capability-model.json, outputs/e2ev3-handwritten-coverage-inventory.md, and the current validator unknown list (19 unknowns). Rank Workload Identity Windows, VirtualMachines mixed-SKU REST scale, VPA cert renewal/upgrade survival, Image Cleaner upgrade/restart survival, bootstrap profile lifecycle, OIDC signing-key rotation/v1.33 explicit-enable, and any other viable non-gated unknowns by input paths covered, expectation paths checked, source/e2ev3 anchor, cost/risk, required access, and gating status. End with one concrete recommended branch, exact preflight reads for a later execution task, and expected model/knowledge-map update. Do not run staging, az, kubectl, cluster creation, or cloud probes in this selection task."
  depends_on: [oidc-post-delete-cleanup-staging]
  attempts: 0

- id: image-cleaner-vulnerable-erasure-staging
  result: succeeded
  status: done
  assignee: aks-explorer
  goal: "Execute the Image Cleaner vulnerable-image erasure staging probe selected by outputs/iteration94-next-model-unknown-selection.md. Start from outputs/iteration86-image-cleaner-runtime-source-gated-staging.md, outputs/input-expectation-knowledge-map.md, outputs/e2ev3-handwritten-coverage-inventory.md, and the iteration94 preflight commands. Before creating any cluster, confirm from devbox source the vulnerable image constant, node/containerd run-command inspection path, eraser collector selector, and source wait budget. Then create a small staging cluster with Image Cleaner enabled, disable Image Cleaner, pull/prove the vulnerable image exists on nodes while disabled, re-enable Image Cleaner, wait for eraser collectors to complete, prove the vulnerable image is absent, clean up the resource group, and produce outputs/iteration95-image-cleaner-vulnerable-erasure-staging.md with exact commands, raw evidence snippets, cleanup status, and a verdict table. Update outputs/e2e-capability-model.json only if image-cleaner-vulnerable-image-erasure gets clear pass/fail evidence, then run cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json. Do not combine with Image Cleaner upgrade/restart survival, VPA/KEDA, Workload Identity/OIDC, App Routing, ManagedSystem, Node Restriction, bootstrap, VirtualMachines, or unrelated probes."
  depends_on: [vpa-residual-runtime-staging]
  attempts: 2

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
- Dark-side discovery starts only after the baseline map can explain current coverage and name the important unknowns.

## Comments

## Artifacts
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
