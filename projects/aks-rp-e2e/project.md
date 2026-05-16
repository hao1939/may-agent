---
id: aks-rp-e2e
owner: may
status: paused
type: milestone
priority: P1
workflow: project
iteration: 33
---

# Project: AKS RP E2E — Run And Understand E2E Quality

## Goal
Actually run AKS RP e2ev3 cases against the standalone environment on devbox (`/home/hayua/rp`) so we can understand code quality from real execution results. Success = at least one scenario reaches a clear pass, or we collect precise, reproducible blocker evidence and the next unblock action; the existing framework/setup documentation is supporting context, not the finish line.

## Signals
- e2e.framework-documented: 1 (e2ev3 architecture documented in outputs/)
- e2e.local-run-executed: 1 (a dev-suite scenario executed against standalone)
- e2e.scenario-pass: 2 (`Scenario_Traffic_AppRouting_Nginx_Disablement`, `Scenario_ManagedSystemPool_Enable`)
- e2e.green-run-evidence: 1 (`outputs/successful-e2e-run.md`, `outputs/iteration24-managedsystem-pool-pass.md`)
- e2e.failure-evidence: 1 (failed scenarios and likely owners/actions documented)

## Current State
Blocked: The standalone RP environment on devbox has been recycled — both builds are dead (DNS gone, blob containers deleted, no RP pods running). No e2e tests can execute until a new standalone environment is deployed via CI pipeline.

Resume when: A new standalone RP build is deployed on devbox and confirmed healthy (curl to localhost:8443 returns a response).

1. **I believe**: The standalone environment is genuinely dead — the worker verified DNS, blob storage, and pod status are all gone.
2. **I'm uncertain about**: Whether/when the human will deploy a new standalone build.
3. **I'd change my mind if**: Someone confirms a new build is live on devbox.

LINKED_
## Context
## Context
- Standalone RP environment is DOWN — both builds (hayuaebld145579920, hayuaebld163822451) recycled
- Previous passes: Scenario_Traffic_AppRouting_Nginx_Disablement, Scenario_ManagedSystemPool_Enable confirmed on standalone
- Scenario_PAFThrottling never got a clean retry (was blocked by capacity, now blocked by dead environment)
- Reusable scripts saved to `outputs/scripts/`: cleanup-standalone-clusters.sh, run-e2e-scenario.sh, check-underlay-capacity.sh, fix-msi-identity.sh + README
- RP source: /home/hayua/rp on devbox

## Linked Context
## Linked Context
- `outputs/iteration24-managedsystem-pool-pass.md` — pass evidence for `Scenario_ManagedSystemPool_Enable`
- `outputs/underlay-debug-findings.md` — Root cause analysis, MSI fix, retry results
- `outputs/e2e-run-results-summary.md` — Original e2e run results (pre-fix)
- `outputs/managedsystem-pool-exploration.md` — ManagedSystem pool feature exploration
- `outputs/e2e-capability-model.json` — project-local capability model and evidence map
- `outputs/scripts/README.md` — reusable scripts produced for cleanup/run/capacity/MSI work
- `outputs/iteration33-standalone-environment-dead.md` — blocker evidence: both builds recycled
- `devbox:/home/hayua/rp` — Standalone RP installation (currently dead)

## Capability Map
- `Scenario_Traffic_AppRouting_Nginx_Disablement`: pass. Green evidence is in `outputs/successful-e2e-run.md`.
- `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`: needs reconciliation. Earlier model evidence points to TLS secret provisioning failure; later run notes say core steps passed with an upgrade timeout.
- `Scenario_PAFThrottling`: fail/pending retry. Earlier evidence points to missing MSI identity; retry after MSI fix and standalone cleanup is the next quality signal.
- Duplicate-registered scenarios: blocked by framework/test-selection ambiguity; use source inspection before retrying exact scenario names.
- ManagedSystem ARM REST add-existing-pool: pass in staging. Evidence is in `outputs/managedsystem-pool-exploration.md`.
- ManagedSystem Azure CLI create/add: fail. CLI sends default fields that RP rejects for ManagedSystem pools.
- ManagedSystem standalone e2ev3 scenario: pass. Evidence is in `outputs/iteration24-managedsystem-pool-pass.md`.

## Capability Model
- Source: `outputs/e2e-capability-model.json`
- Validator: `capability-model/src/validate.ts`
- Scope: project-local to `aks-rp-e2e`; do not promote to shared infra until this model proves useful through real iterations.
- Boundary: observation context (`standalone`, `staging`, `dev`, `devbox`, build version, execution surface) is a filter for where/how evidence was collected, not AKS input space.
- Current deterministic summary: 5 observation filters, 8 AKS input variables, 10 AKS state/behavior expectation variables, 7 feature mappings, 7 test-case evidence mappings.
- Current feature status: 3 pass (`app-routing-nginx-disablement`, `managedsystem-pool-rest-add-existing`, `managedsystem-pool-standalone-e2ev3`), 4 fail (`app-routing-default-domain`, `paf-throttling`, CLI create/add ManagedSystem paths), 0 unknown.
- Rule: agents may propose model changes, but the model is accepted only when the TypeScript validator passes.

## Weaknesses
- TLS secret provisioning weakness: DefaultDomain failed because required TLS secret was not provisioned.
- MSI identity weakness: PAFThrottling failed because MSI identity was missing.
- Scenario-selection weakness: duplicate registrations make several scenario names ambiguous.
- Standalone teardown leak: e2ev3 fires DELETE on the resource group and immediately returns ("success to start deleting resource group without wait it done"). If the test process is interrupted before ARM finishes, the standalone RP datastore keeps a `Succeeded` cluster that counts against per-underlay capacity and eventually trips `AKSCapacityHeavyUsage` for new runs.
- ManagedSystem CLI bug: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` send default fields that RP rejects.

## Next Action
Add or wire a pre-flight cleanup step for standalone leaked clusters, then retry `Scenario_PAFThrottling` with the MSI fix in place. Update `outputs/e2e-capability-model.json` and linked evidence from the fresh run result.

## Plan
1. ✅ Run e2e scenarios and collect initial results
2. ✅ Explore "managedsystem pool" enough to split REST/CLI/standalone evidence
3. ✅ Capture final standalone e2ev3 verdict for `Scenario_ManagedSystemPool_Enable`
4. 🔄 Prevent standalone teardown leaks from poisoning future runs
5. 🔄 Retry `Scenario_PAFThrottling` and update the capability model with the new verdict

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
- Standalone pass evidence exists for `Scenario_Traffic_AppRouting_Nginx_Disablement`
- Standalone pass evidence exists for `Scenario_ManagedSystemPool_Enable`
- Failed scenarios have reproducible evidence and likely owner/action documented in `outputs/e2e-run-results-summary.md`
- Documentation milestones are complete and verified
- Devbox access is verified through remote tools, not local `bash`
- Build version `hayuaebld163822451` loads config from blob

## Comments

## Artifacts
- outputs/doc-verification.md
- outputs/deploy-retry-log.md
- outputs/run-now.sh
- outputs/first-e2e-run-results.md
- outputs/e2e-capacity-blocker-analysis.md
- outputs/post-deploy-validation.sh
- outputs/README.md
- outputs/standalone-setup.md
- outputs/iteration26-pafthrottling-retry.md
- outputs/scenario-catalog.md
- outputs/unblock-runbook.md
- outputs/iteration-status.md
- outputs/underlay-debug-findings.md
- outputs/e2e-run-results-summary.md
- outputs/final-status.md
- outputs/test-execution-playbook.md
- outputs/managedsystem-pool-exploration.md
- outputs/project-status.md
- outputs/standalone-readiness-check.sh
- outputs/writing-e2e-tests.md
- outputs/first-e2e-run.sh
- outputs/troubleshooting.md
- outputs/run-e2e.sh
- outputs/e2ev3-architecture.md
- outputs/iteration3-status.md
- outputs/second-e2e-run-results.md
- outputs/iteration24-managedsystem-pool-pass.md
- outputs/e2e-capability-model.json
- outputs/e2e-run-attempt.md
- outputs/iteration33-standalone-environment-dead.md
- outputs/successful-e2e-run.md
- outputs/deploy-status.md
- outputs/e2e-quickref.md
- outputs/deploy-failure-analysis.md
