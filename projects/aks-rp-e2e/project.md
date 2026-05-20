---
id: aks-rp-e2e
owner: aks-explorer
status: active
type: milestone
priority: P1
workflow: project
iteration: 82
max_concurrent: 1
max_task_attempts: 2
stop_reason: 
resume_condition: 
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
- knowledge.input-space-modeled: current capability model has 34 AKS input variables.
- knowledge.expectation-space-modeled: current capability model has 61 expectation variables.
- knowledge.feature-mapping-started: current capability model has 46 feature mappings and 48 test-case evidence mappings.
- knowledge.source-inventory-modeled: `outputs/iteration73-capability-model-source-inventory-update.md` converted handwritten e2ev3 source intent into first-class model structure; validator exits 0.
- e2e.existing-cases-cataloged: `outputs/scenario-catalog.md` and e2e artifacts provide the first source for inferring feature intent and coverage.
- knowledge.public-api-candidates-started: `outputs/aks-public-api-scenario-candidates.md` derives additional candidate feature surfaces from public AKS API/docs.
- execution.evidence-collected: staging and standalone artifacts provide pass/fail/blocker evidence for ManagedSystem, App Routing, NAP, workload identity, autoscaler, security, bootstrap, and VirtualMachines paths.

## Current State
Iteration83 queued Node Restriction corrected full-PUT disable contract plus runtime-default probing as the next non-blocked high-value path. App Routing DefaultDomainCertificate TLS remains paused behind owner/CCP diagnostics. The next work should resolve the Node Restriction operation-shape gap left by iteration62 by using source-resolved full PUT semantics and a clear runtime-default evidence method.

## Review Questions

1. **Is the goal closer?**  
   Yes. The project now has the missing handwritten e2ev3 intent inventory, which directly improves the input/expectation knowledge map and exposes where current staging evidence is too shallow.

2. **What did we learn?**  
   The handwritten tests are not thin wrappers. They encode richer product contracts than the current JSON model: runtime behavior, controller resources, disable/re-enable semantics, cleanup, post-upgrade behavior, token projection, TLS certificate quality, and negative/error-shape contracts.

3. **Is the current milestone the right next step?**  
   No. The inventory milestone is complete. The right next step is now local model-completeness edits based on the inventory, not more source cataloging or cloud probes.

4. **Are we closing the loop?**  
   Partially. Iteration 72 closed the “we don’t know what handwritten cases intend” loop. To prevent recurrence of probe-driven drift, the model itself now needs to encode those source-derived surfaces and mark existing staging evidence as partial where appropriate.

5. **Is it verified?**  
   Yes for the inventory artifact: I read `outputs/e2ev3-handwritten-coverage-inventory.md` and confirmed it contains method, scenario catalog, case-to-path mappings, gaps, candidate model updates, and a recommended next action. The next model edits must be verified with `bun src/validate.ts`.

6. **What's blocking progress?**  
   Nothing external blocks the next step. This is local JSON/model work using existing artifacts and source inventory; no staging/cloud execution is needed.

## Stall response: 3 alternative approaches ranked by feasibility

1. **Most feasible — local model-completeness edits from the new inventory.**  
   Add first-class input variables, expectation variables, test cases, features, and evidence links for already-confirmed handwritten/source surfaces. Mark current staging evidence as partial where it only proves ARM state.

2. **Second — focused Node Restriction source/spec contradiction investigation.**  
   Investigate why handwritten intent says Node Restriction is auto-enabled and cannot be disabled while iteration62 staging did not persist it. This is valuable but should follow model updates so the contradiction is represented cleanly.

3. **Third — App Routing TLS source/owner investigation.**  
   Trace DefaultDomainCertificate provisioning assumptions and rotation/upgrade paths. Valuable, but not the immediate next move because the model still lacks many already-known dimensions.

Pick approach #1.

## Historical Decision — Iteration 72 Completed

**Completed by iteration 73.** This historical decision pivoted from inventory to model-completeness. The JSON capability model was updated and validated in `outputs/iteration73-capability-model-source-inventory-update.md`.

Completed plan item to mark off:

- **Inventory existing handwritten e2ev3 cases against the feature matrix and identify real coverage gaps**

---

## (a) Concrete output

Produce:

1. Updated `outputs/e2e-capability-model.json`

Add source-derived model structure for the highest-confidence gaps from `outputs/e2ev3-handwritten-coverage-inventory.md`.

Minimum required additions:

### Input variables

Add first-class inputs for:

- `workloadAutoScalerProfile.keda.enabled`
- `workloadAutoScalerProfile.verticalPodAutoscaler.enabled`
- `securityProfile.imageCleaner.enabled`
- `securityProfile.imageCleaner.intervalHours`
- `securityProfile.nodeRestriction.enabled`
- `identity.runtime.os` with Linux/Windows branches
- `identity.kubernetesVersion.branch` for OIDC default-enabled vs explicit-enable behavior
- `bootstrapProfile.registry.kind` for AKS-managed vs BYO ACR
- `bootstrapProfile.lifecycle.operation` for Direct/Cache disable/re-enable/switch-registry
- `appRouting.controller.kind` for nginx/Ingress vs Istio/Gateway API
- `appRouting.tls.lifecycle` for initial cert, rotation, post-upgrade
- `managedSystem.runtime.validation`
- `managedSystem.disable.operation`
- `agentPool.mode=Machines` or equivalent Machines API input
- `nodeProvisioning.defaultMachinesPool`

Use existing naming conventions where possible; do not invent conflicting duplicates.

### Expectation variables

Add first-class expectations for:

- KEDA resources present, absent after disable, workload scaled, survives upgrade
- VPA Helm/components ready, recommendations generated, in-place update observed, HA/cert behavior
- Image Cleaner components present/absent, vulnerable image removed, interval persisted, survives upgrade/restart
- Node Restriction disable rejected with expected error shape
- Workload Identity Linux/Windows token projection
- OIDC discovery/JWKS/signing-key rotation/document deletion
- Bootstrap image pull success, registry cleanup on disable, BYO registry ID match
- App Routing TLS cert hostname/expiry/rotation/post-upgrade reachability
- App Routing Istio/Gateway default-domain reachability
- ManagedSystem taints, critical add-on placement, VAP/VAPBinding, customer workload unschedulable, disable migration
- Machines API CRUD and NAP default Machines pool cleanup

### Test cases / feature links

Add test cases for the handwritten cases discovered in iteration72, at least:

- `Scenario_Keda`
- `Scenario_Keda_CRUD`
- `Scenario_Overlay_VPA_*` or a representative grouped VPA test case
- `Scenario_ImageCleaner`
- `Node_Restriction`
- `Scenario_WorkloadIdentity`
- `Scenario_OIDC_Issuer`
- `Scenario_OIDC_Issuer_v133`
- `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_Managed_ACR`
- `Scenario_NetworkIsolatedCluster_Bootstrap_Profile_BYO_ACR`
- `Scenario_Traffic_AppRouting_DefaultDomain_Istio_HelloWorld`
- `Scenario_Mixed_SKU_Scale`
- `Scenario_Autoscaled_VMs_CRUD`
- `Scenario_MachinesAgentPool`
- `Scenario_MachinesAgentPoolNAPEnabled`
- ManagedSystem create-time/runtime/disable cases if not already represented distinctly

Important: distinguish **source-derived intended contract** from **observed pass/fail evidence**. Do not mark source-only scenarios as passing unless an existing artifact actually proves them.

### Evidence links

Add or adjust evidence links so:

- `outputs/iteration61-workload-autoscaler-staging.md` links only to KEDA/VPA profile persistence, not runtime scaling/recommendations.
- `outputs/iteration62-security-profile-staging.md` links to Image Cleaner state/interval and Node Restriction contradiction/failure, not runtime Image Cleaner erasure.
- `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` remains HTTP/DNS only.
- `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` links to TLS secret provisioning failure, not generic HTTPS success.
- `outputs/e2ev3-handwritten-coverage-inventory.md` is added as source-intent evidence, not execution evidence.

2. Produce `outputs/iteration73-capability-model-source-inventory-update.md`

This short artifact should summarize:

- what model sections changed,
- which handwritten scenarios were added,
- which existing evidence is only partial,
- which source-derived gaps remain unexecuted,
- validator command/output,
- recommended next action after the model update.

3. Run validator:

```bash
cd /app/projects/aks-rp-e2e/capability-model
bun src/validate.ts ../outputs/e2e-capability-model.json
```

The iteration is not complete unless validator exits 0, or the blocker artifact precisely explains the schema issue.

---

## (b) What’s different

This is not another inventory pass and not another cloud probe. Iteration 72 already produced the catalog. The next iteration must change the persistent model so future workers cannot ignore the richer handwritten intent or accidentally treat ARM-state probes as full runtime coverage.

---

## (c) First step

Run this exact local command first to inspect the existing model shape before editing:

```bash
cd /app/projects/aks-rp-e2e && python3 - <<'PY'
import json
from pathlib import Path

m = json.loads(Path('outputs/e2e-capability-model.json').read_text())
for sec in ['inputVariables','expectationVariables','features','testCases','evidence','judgments']:
    items = m.get(sec, [])
    print(f'\n## {sec}: {len(items)} items')
    for item in items[:5]:
        print(json.dumps({k: item.get(k) for k in item.keys()}, indent=2)[:1200])
        print('---')
PY
```

Then read `outputs/e2ev3-handwritten-coverage-inventory.md` and make the smallest validator-compatible JSON update that captures the source-derived gaps.

---

HISTORICAL_NEXT_ACTION_UPDATE_COMPLETED: `outputs/e2e-capability-model.json` was updated from the handwritten e2ev3 inventory and validated in `outputs/iteration73-capability-model-source-inventory-update.md`. The active next action is now the Node Restriction source/spec investigation in the main `## Next Action` section.

PLAN_UPDATE:
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
11. ✅ Validate workload autoscaler profile KEDA/VPA public API behavior in staging and update the capability model
12. ✅ Select the next public API candidate based on iteration61 results
13. ✅ Validate security profile image cleaner/node restriction public API behavior in staging and update the capability model
14. ✅ Select the next public API candidate based on iteration62 results
15. ✅ Validate bootstrap profile artifact source public API behavior with a contract-first staging probe and update the capability model if verdicted
16. ✅ Select the next public API candidate based on iteration63 results
17. ✅ Validate non-ManagedSystem VirtualMachines agent pool public preview behavior and update the capability model
18. ✅ Close the VirtualMachines multi-SKU contract gap with a source/spec-first staging follow-up
19. ✅ Close the App Routing public API disable gap with a focused staging toggle probe
20. ✅ Validate App Routing default-domain public API/state enablement in staging
21. ✅ Validate App Routing default-domain traffic reachability with a real staging workload
22. ✅ Validate App Routing DefaultDomainCertificate/TLS-secret behavior in staging
23. ✅ Consolidate the current capability model into an explicit input/expectation knowledge map, using the handwritten ManagedSystem Pool e2ev3 case as the first worked boundary example
24. ✅ Inventory existing handwritten e2ev3 cases against the feature matrix and identify real coverage gaps
25. ✅ Update the capability model from handwritten e2ev3 source intent and existing evidence, marking partial coverage explicitly
26. 🔄 Investigate the Node Restriction source/spec contradiction before selecting another run
27. ⏳ Expand the map from AKS public API/docs into candidate input paths and expected behavior paths
28. ⏳ Select high-density future probes that cover multiple paths or explore high-uncertainty dark-side regions

LINKED_CONTEXT_UPDATE:
- `outputs/input-expectation-knowledge-map.md` — consolidated input/expectation knowledge map and ranked gaps
- `outputs/e2ev3-handwritten-coverage-inventory.md` — handwritten e2ev3 source inventory mapping scenarios to input paths, expectation paths, current evidence coverage, and model gaps
- `outputs/iteration24-managedsystem-pool-pass.md` — pass evidence for `Scenario_ManagedSystemPool_Enable`
- `outputs/underlay-debug-findings.md` — root cause analysis, MSI fix, retry results
- `outputs/e2e-run-results-summary.md` — original e2e run results, including older App Routing default-domain traffic/TLS failure context
- `outputs/managedsystem-pool-exploration.md` — ManagedSystem Pool feature exploration and refreshed conclusions
- `outputs/iteration55-managedsystem-staging-results.md` — initial staging ManagedSystem Pool evidence
- `outputs/iteration56-managedsystem-staging-refresh.md` — refreshed staging ManagedSystem Pool CLI/REST classification matrix
- `outputs/20260519T1646Z-managedsystem-priority-staging.md` — fresh priority re-test confirming ManagedSystem Pool REST/CLI/delete verdict and strengthening the capability model
- `outputs/aks-public-api-scenario-candidates.md` — prioritized public API feature scenarios
- `outputs/iteration57-node-autoprovision-staging.md` — NAP staging create evidence
- `outputs/iteration58-node-autoprovision-followup.md` — NAP staging update evidence
- `outputs/iteration59-app-routing-staging.md` — App Routing public CLI staging enablement evidence
- `outputs/iteration60-workload-identity-staging.md` — OIDC issuer + workload identity public CLI staging evidence
- `outputs/iteration61-workload-autoscaler-staging.md` — workload autoscaler KEDA/VPA public CLI staging evidence
- `outputs/iteration62-security-profile-staging.md` — Image Cleaner pass and Node Restriction absent/unpersisted staging evidence
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
## Review Questions

1. **Is the goal closer?**  
   Yes. The project now has the explicit input/expectation knowledge-map artifact that was missing. This shifts the project from probe accumulation to structured coverage reasoning.

2. **What did we learn?**  
   The map exposed two important next local gaps: the JSON model under-represents some evidenced surfaces, and the project is still biased toward recent staging probes rather than a full handwritten e2ev3 intent inventory.

3. **Is the current milestone the right next step?**  
   Yes. The next planned milestone is now the right one: **Inventory existing handwritten e2ev3 cases against the feature matrix and identify real coverage gaps**.

4. **Are we closing the loop?**  
   Partially. Iteration 71 prevents recurrence of the “run another probe by default” loop by creating a decision artifact. To close the loop further, the next worker should turn handwritten case intent into a reusable inventory, not just read a few files ad hoc.

5. **Is it verified?**  
   Yes for the artifact: I read `outputs/input-expectation-knowledge-map.md` and confirmed it contains the required ManagedSystem and App Routing boundary sections plus ranked future candidates. The model was intentionally unchanged, so no validator run was required.

6. **What's blocking progress?**  
   Nothing blocks local/source inventory. Remote source access may be needed via `ssh devbox`, but this is source inspection only, not staging/cloud execution.

Completed plan item to mark off:

- **Consolidate the current capability model into an explicit input/expectation knowledge map, using the handwritten ManagedSystem Pool e2ev3 case as the first worked boundary example**

---

## Decision

**CONTINUE**

### (a) Concrete output

Produce:

1. `outputs/e2ev3-handwritten-coverage-inventory.md`

This should be a local/source-derived inventory of handwritten e2ev3 cases mapped to the feature/input/expectation framework.

Required sections:

#### 1. Inventory method

State exactly where source was inspected, for example paths under:

- `devbox:/home/hayua/rp/test/e2ev3/sigs/...`

Use `ssh devbox` for source inspection. Do **not** run staging, `az`, cluster creation, or cloud probes.

#### 2. Scenario catalog

Create a table of handwritten e2ev3 scenarios discovered. Include at least:

- scenario name,
- source path,
- plan/suite/sig area,
- feature area,
- whether it is currently represented in `outputs/e2e-capability-model.json`,
- linked project evidence artifact if any.

Prioritize sigs/areas already relevant to the model:

- ManagedSystem Pool / agentpool,
- App Routing / traffic,
- Node Auto Provisioning,
- workload identity/OIDC,
- workload autoscaler,
- security profile,
- bootstrap profile,
- VirtualMachines agent-pool surfaces.

If some areas have no obvious handwritten case, say that explicitly.

#### 3. Case-to-path mapping

For each important scenario, map:

- AKS input path(s),
- expected behavior/assertion path(s),
- setup/preconditions,
- runtime/assertion steps,
- cleanup expectations,
- whether the current staging evidence fully covers, partially covers, or does not cover the handwritten scenario.

#### 4. Gaps discovered from handwritten intent

List gaps where handwritten developer intent is stronger/different than current model/staging evidence.

Examples to look for:

- assertions that check runtime behavior beyond ARM state,
- hidden preconditions,
- negative/error-shape expectations,
- cleanup/delete behavior,
- controller-specific checks,
- traffic/TLS/DNS checks,
- identity/runtime token checks.

#### 5. Candidate model updates

Do **not** edit the JSON model yet unless the relation is already unambiguous and evidenced. Instead, list proposed model additions such as:

- new `inputVariables`,
- new `expectationVariables`,
- new `testCases`,
- new feature-to-test links,
- missing evidence links.

Call out workload autoscaler/security-profile model gaps from the knowledge map if the inventory confirms they should be first-class.

#### 6. Recommended next action

End with one recommended next step after the inventory:

- either local model-completeness edits,
- App Routing TLS source/owner investigation,
- public API/docs expansion,
- or a single justified future cloud probe.

The recommendation must be based on the inventory, not on habit.

### (b) What’s different

This is the first attempt at the handwritten-case inventory phase. Iteration 71 built the map from the existing capability model and result artifacts; the next iteration should now use handwritten e2ev3 source as primary intent material and compare it against that map.

### (c) First step

Run this source-inspection command first, using remote source access only:

```bash
cd /app/projects/aks-rp-e2e && ssh devbox 'cd /home/hayua/rp && find test/e2ev3 -path "*/.git" -prune -o -type f \( -name "*.go" -o -name "*.yaml" -o -name "*.yml" \) | grep -Ei "managedsystem|managed.system|app.?routing|default.?domain|node.?auto|provision|workload.?identity|oidc|workload.?autoscaler|keda|vpa|image.?cleaner|node.?restriction|bootstrap|virtualmachines|virtual.?machines" | sort'
```

Then inspect only the relevant plan/scenario/step/assertion files needed to fill `outputs/e2ev3-handwritten-coverage-inventory.md`.

---

HISTORICAL_NEXT_ACTION_UPDATE_COMPLETED: `outputs/e2ev3-handwritten-coverage-inventory.md` was produced. The active next action is now the Node Restriction source/spec investigation in the main `## Next Action` section.

PLAN_UPDATE:
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
11. ✅ Validate workload autoscaler profile KEDA/VPA public API behavior in staging and update the capability model
12. ✅ Select the next public API candidate based on iteration61 results
13. ✅ Validate security profile image cleaner/node restriction public API behavior in staging and update the capability model
14. ✅ Select the next public API candidate based on iteration62 results
15. ✅ Validate bootstrap profile artifact source public API behavior with a contract-first staging probe and update the capability model if verdicted
16. ✅ Select the next public API candidate based on iteration63 results
17. ✅ Validate non-ManagedSystem VirtualMachines agent pool public preview behavior and update the capability model
18. ✅ Close the VirtualMachines multi-SKU contract gap with a source/spec-first staging follow-up
19. ✅ Close the App Routing public API disable gap with a focused staging toggle probe
20. ✅ Validate App Routing default-domain public API/state enablement in staging
21. ✅ Validate App Routing default-domain traffic reachability with a real staging workload
22. ✅ Validate App Routing DefaultDomainCertificate/TLS-secret behavior in staging
23. ✅ Consolidate the current capability model into an explicit input/expectation knowledge map, using the handwritten ManagedSystem Pool e2ev3 case as the first worked boundary example
24. 🔄 Inventory existing handwritten e2ev3 cases against the feature matrix and identify real coverage gaps
25. ⏳ Expand the map from AKS public API/docs into candidate input paths and expected behavior paths
26. ⏳ Select high-density future probes that cover multiple paths or explore high-uncertainty dark-side regions
## Owner Judgment
Keep the project active, but change the default next action from execution-first
to map-first. The previous execution loop proved the system can collect useful
evidence. Now the owner should ask the worker to build and validate the coverage
map before selecting more staging/standalone probes. ManagedSystem Pool should
be made into the first solid worked example for feature-boundary mapping. The
recent TLS/DefaultDomainCertificate follow-up is now evidence, not just a known
gap: default-domain TLS-secret provisioning still fails in staging even though
HTTPS can return 200 through nginx's fake fallback certificate.

## Context
- Current direction: build the AKS input/expectation knowledge map first; use staging/standalone execution only when a run has clear coverage value proven by the map.
- Staging is an acceptable and unblocked execution target; standalone evidence remains useful history when available.
- Existing e2ev3 cases are not just tests to run; they are the primary source material for feature-matrix coverage. Deep dive handwritten case code to infer developer intent, input paths, expected behavior, assertions, setup, and historical boundaries.
- AKS public API specs are source material for input-space expansion after handwritten case intent is understood.
- AKS public docs are source material for expectation-space expansion after handwritten case intent is understood.
- ManagedSystem Pool staging evidence is refreshed again in `outputs/20260519T1646Z-managedsystem-priority-staging.md`: direct REST add/delete passes; CLI preview create/add fails due to default-field payload behavior; mode immutability remains supported by iteration56 evidence.
- Node Auto Provisioning staging evidence exists: create with `mode=Auto/defaultNodePools=Auto` passes; update to `defaultNodePools=None` passes; update `mode=Auto -> Manual` passes when default pools are `None`.
- Web App Routing/App Routing staging evidence exists: public CLI enable/disable passes and persists state; default-domain API/state enablement passes with an autogenerated `*.eastus2.aksapp.io` domain.
- App Routing default-domain HTTP traffic reachability passes in staging: `outputs/iteration69-app-routing-defaultdomain-traffic-staging.md` created a fresh cluster, enabled default domain, deployed hello-world/Service/non-TLS Ingress on `test.<domain>`, observed DNS to the App Routing LB, and curl returned HTTP 200.
- App Routing DefaultDomainCertificate/TLS-secret provisioning fails in staging: `outputs/iteration70-app-routing-defaultdomain-tls-staging.md` created the CR targeting `default/default-domain-tls`, but after ~28 minutes the CR had no Available condition and the TLS secret remained NotFound. HTTPS with `curl -k` reached the backend only via nginx's fake self-signed fallback certificate, so it is not a managed TLS success.
- OIDC issuer + workload identity staging evidence exists: public CLI create-time enablement and idempotent update pass and persist enabled state.
- Workload autoscaler staging evidence exists: public CLI `az aks update --enable-keda` and `--enable-vpa` pass and persist `workloadAutoScalerProfile` state.
- Security profile staging evidence exists: Image Cleaner public CLI update passes and persists `securityProfile.imageCleaner`; Node Restriction exact CLI flag is absent and direct ARM REST PATCH did not persist `securityProfile.nodeRestriction`.
- Bootstrap profile staging evidence exists: active `aks-preview` exposes bootstrap flags; `artifactSource=Direct` create/update persists; `artifactSource=Cache` update succeeds with an AKS-provisioned registry ID.
- Non-ManagedSystem VirtualMachines agent-pool staging evidence exists: preview CLI single-SKU add passes and persists `virtualMachinesProfile.scale.manual`; preview CLI help-style multi-SKU add fails; autoscale update supports one SKU/profile; manual-scale add/delete supports multiple single-SKU manual profiles.
- Use az CLI preview where relevant, but direct ARM REST is acceptable when CLI behavior is itself under test.
- RP source and staging tooling are on devbox at `/home/hayua/rp`; use `ssh devbox` or the available remote/delegation tool for devbox commands, not local bash path access.
- Do not spend iteration time trying to git-add ignored project output artifacts; verify by reading artifacts and running the capability-model validator.

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
- `outputs/managedsystem-pool-feature-standard-init-tasks.md` — narrative draft for the ManagedSystem Pool feature-standard parallel task wave
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
- `outputs/iteration62-security-profile-staging.md` — Image Cleaner pass and Node Restriction absent/unpersisted staging evidence
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
- Current deterministic summary: 5 observation filters, 34 AKS input variables, 61 AKS state/behavior expectation variables, 46 feature mappings, 48 test-case evidence mappings, 26 judgments, 22 evidence references.
- Current feature status: 22 pass, 7 fail (`app-routing-default-domain`, `paf-throttling`, CLI create/add ManagedSystem paths, `virtualmachines-agentpool-cli-add-multi-sku`, `app-routing-default-domain-tls-secret`, `node-restriction-disable-contract`), 17 unknown, 0 blocked.
- Rule: agents may propose model changes, but the model is accepted only when the TypeScript validator passes.

## Weaknesses
- TLS secret provisioning weakness: DefaultDomain failed because required TLS secret was not provisioned.
- MSI identity weakness: PAFThrottling failed because MSI identity was missing.
- Scenario-selection weakness: duplicate registrations make several scenario names ambiguous.
- Standalone teardown leak: e2ev3 fires DELETE on the resource group and immediately returns ("success to start deleting resource group without wait it done"). If the test process is interrupted before ARM finishes, the standalone RP datastore keeps a `Succeeded` cluster that counts against per-underlay capacity and eventually trips `AKSCapacityHeavyUsage` for new runs.
- ManagedSystem CLI bug: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` send default fields that RP rejects.

## Next Action
Produce `outputs/iteration83-node-restriction-fullput-runtime-staging.md` by executing the selected Node Restriction probe in staging. Start with a written preflight that prevents repeating the old tag-only PATCH mistake: use the correct full ManagedCluster GET/PUT operation shape for `securityProfile.nodeRestriction.enabled`, record API version and payload hygiene, test that disabling NodeRestriction on RBAC Kubernetes `>=1.24` is rejected, and collect the best available runtime-default evidence. Update the capability model and knowledge map only for branches with clear evidence, then validate the model. Do not combine this run with App Routing, VPA/KEDA, Image Cleaner, or ManagedSystem work.

## Backlog
- UI graph for the knowledge model: the current quality panel is mostly a table/list view. It is missing the critical visualization for the core idea: an **input-space graph**, an **expectation-space graph**, and **feature mappings as paths across both spaces**. Keep this as a backlog design task for now, not part of the current handwritten-source inventory. When picked up, the UI should make the knowledge model visible: how a feature selects paths from both spaces, which tests/evidence attach to those paths, and where staging/standalone coverage is missing, blocked, failing, or not yet explored.

## Migration Notes
### 2026-05-20 — Reactivated for task-driven execution
- Reactivated because the current task chain is parser-visible and the next
  step does not require external unblock.
- The active next task is `post-app-routing-escalation-next-probe-selection`.
- This reactivation lets the project handler dispatch the `aks-explorer` task
  directly instead of waiting on a legacy owner-loop workflow path.

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
11. ✅ Validate workload autoscaler profile KEDA/VPA public API behavior in staging and update the capability model
12. ✅ Select the next public API candidate based on iteration61 results
13. ✅ Validate security profile image cleaner/node restriction public API behavior and update the capability model
14. ✅ Select the next public API candidate based on iteration62 results
15. ✅ Validate bootstrap profile artifact source public API behavior with a contract-first staging probe and update the capability model if verdicted
16. ✅ Select the next public API candidate based on iteration63 results
17. ✅ Validate non-ManagedSystem VirtualMachines agent pool public preview behavior and update the capability model
18. ✅ Close the VirtualMachines multi-SKU contract gap with a source/spec-first staging follow-up
19. ✅ Close the App Routing public API disable gap with a focused staging toggle probe
20. ✅ Validate App Routing default-domain public API/state enablement in staging
21. ✅ Validate App Routing default-domain traffic reachability with a real staging workload
22. ✅ Validate App Routing DefaultDomainCertificate/TLS-secret behavior in staging
23. ✅ Consolidate the current capability model into an explicit input/expectation knowledge map, using the handwritten ManagedSystem Pool e2ev3 case as the first worked boundary example
24. ✅ Inventory existing handwritten e2ev3 cases against the feature matrix and identify real coverage gaps
25. ✅ Update the capability model from handwritten e2ev3 source intent and existing evidence, marking partial coverage explicitly
26. ✅ Investigate the Node Restriction source/spec contradiction before selecting another run
27. ✅ Rank high-density future probes from the validated model, public API/docs candidates, source-derived intent, and existing evidence
28. ✅ Execute the selected high-density Workload Identity + OIDC runtime token/discovery probe with explicit coverage and non-goals
29. ✅ Consolidate identity/OIDC runtime evidence into branch-accurate model and knowledge-map status before selecting the next cloud probe
30. ✅ Execute the next ranked high-density runtime probe: source-scoped KEDA/VPA runtime behavior in staging
31. ✅ Split VPA runtime evidence into branch-accurate model features and rerank the next cloud probe
32. ✅ Investigate App Routing DefaultDomainCertificate TLS-secret failure from source and produce a rerun-or-escalation hypothesis
33. ✅ Prepare App Routing DefaultDomainCertificate TLS owner-escalation packet and diagnostic rerun gate
34. ✅ Select the next non-blocked high-value feature path after App Routing TLS escalation
35. 🔄 Execute the Node Restriction corrected full-PUT disable contract and runtime-default probe

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
  status: pending
  assignee: aks-explorer
  goal: Execute the Node Restriction corrected full-PUT disable contract probe in staging. Start from `outputs/node-restriction-source-spec-investigation.md`, `outputs/iteration74-node-restriction-source-spec-resolution.md`, and `outputs/iteration62-security-profile-staging.md`. Use a staging cluster with Node Restriction enabled, then attempt disable via full PUT (not PATCH) with the source-resolved correct request shape. Also probe runtime-default behavior to determine whether the feature has a default state when not explicitly set. Produce `outputs/iteration83-node-restriction-full-put-disable-staging.md` with exact commands, request bodies, API version, response evidence, runtime kubectl checks if applicable, cleanup status, and verdict table. Update `outputs/e2e-capability-model.json` only for branches that receive clear pass/fail evidence; run `cd /app/projects/aks-rp-e2e/capability-model && bun src/validate.ts ../outputs/e2e-capability-model.json` if the model changes.
  depends_on: [post-app-routing-escalation-next-probe-selection]
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
- Dark-side discovery starts only after the baseline map can explain current coverage and name the important unknowns.

## Comments

## Artifacts
- outputs/iteration82-post-escalation-next-probe-selection.md
- outputs/iteration66-virtualmachines-manual-scale-staging.md
- outputs/iteration70-app-routing-defaultdomain-tls-staging.md
- outputs/iteration57-node-autoprovision-staging.md
- outputs/doc-verification.md
- outputs/deploy-retry-log.md
- outputs/iteration56-managedsystem-staging-refresh.md
- outputs/iteration63-bootstrap-profile-staging.md
- outputs/public-api-input-expectation-expansion.md
- outputs/iteration68-app-routing-defaultdomain-staging.md
- outputs/iteration55-managedsystem-staging-results.md
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
- outputs/e2e-run-results-summary.md
- outputs/final-status.md
- outputs/iteration53-managedsystem-pool-inventory-and-blocker.md
- outputs/test-execution-playbook.md
- outputs/iteration49-provision-blocker.md
- outputs/managedsystem-pool-exploration.md
- outputs/project-status.md
- outputs/standalone-readiness-check.sh
- outputs/iteration76-workload-identity-oidc-runtime-staging.md
- outputs/aks-public-api-scenario-candidates.md
- outputs/writing-e2e-tests.md
- outputs/iteration77-identity-runtime-model-consolidation.md
- outputs/high-density-probe-plan.md
- outputs/iteration60-workload-identity-staging.md
- outputs/managedsystem-pool-feature-standard-init-tasks.md
- outputs/iteration48-new-build-blocker.md
- outputs/iteration81-app-routing-tls-owner-escalation.md
- outputs/iteration69-app-routing-defaultdomain-traffic-staging.md
- outputs/first-e2e-run.sh
- outputs/troubleshooting.md
- outputs/run-e2e.sh
- outputs/e2ev3-architecture.md
- outputs/iteration58-node-autoprovision-followup.md
- outputs/iteration64-virtualmachines-agentpool-staging.md
- outputs/iteration3-status.md
- outputs/second-e2e-run-results.md
- outputs/iteration24-managedsystem-pool-pass.md
- outputs/iteration74-node-restriction-source-spec-resolution.md
- outputs/e2e-capability-model.json
- outputs/iteration59-app-routing-staging.md
- outputs/e2e-run-attempt.md
- outputs/iteration33-standalone-environment-dead.md
- outputs/successful-e2e-run.md
- outputs/iteration75-model-driven-probe-selection.md
- outputs/deploy-status.md
- outputs/e2e-quickref.md
- outputs/deploy-failure-analysis.md
