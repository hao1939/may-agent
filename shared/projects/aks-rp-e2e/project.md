---
id: aks-rp-e2e
owner: may
status: waiting
type: milestone
priority: P1
workflow: project
iteration: 20
stop_reason: Both directives complete — green run + ManagedSystem pool exploration done
resume_condition: Human reviews and closes or extends scope
---

# Project: AKS RP E2E — Run And Understand E2E Quality

## Goal
Actually run AKS RP e2ev3 cases against the standalone environment on devbox (`/home/hayua/rp`) so we can understand code quality from real execution results. Success = at least one scenario reaches a clear pass, or we collect precise, reproducible blocker evidence and the next unblock action; the existing framework/setup documentation is supporting context, not the finish line.

## Signals
- e2e.framework-documented: 1 (e2ev3 architecture documented in outputs/)
- e2e.local-run-executed: 1 (a dev-suite scenario executed against standalone)
- e2e.scenario-pass: 1 (Scenario_Traffic_AppRouting_Nginx_Disablement PASSED)
- e2e.green-run-evidence: 1 (outputs/successful-e2e-run.md)
- e2e.failure-evidence: 1 (failed scenarios and likely owners/actions documented)

## Current State
Active: ManagedSystem pool evidence is mixed and needs one targeted repair.

1. **I believe**: The previous "ManagedSystem pool complete" summary was too broad. The artifact proves ARM REST add-existing-pool works in staging, and proves Azure CLI create/add paths fail due default payload fields. It does not prove the standalone e2ev3 `Scenario_ManagedSystemPool_Enable` passed or failed.
2. **I'm uncertain about**: The final standalone e2ev3 result for `Scenario_ManagedSystemPool_Enable`; the run was interrupted while polling `CreateAgentPool`.
3. **I'd change my mind if**: We rerun/resume the standalone scenario and capture the final e2ev3 verdict.
## Capability Map
- `Scenario_Traffic_AppRouting_Nginx_Disablement`: pass. Green evidence is in `outputs/successful-e2e-run.md`.
- `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`: fail. Evidence points to TLS secret provisioning.
- `Scenario_PAFThrottling`: fail. Evidence points to missing MSI identity.
- Duplicate-registered scenarios: blocked by framework/test-selection ambiguity; use source inspection before retrying exact scenario names.
- ManagedSystem ARM REST add-existing-pool: pass in staging. Evidence is in `outputs/managedsystem-pool-exploration.md`.
- ManagedSystem Azure CLI create/add: fail. CLI sends default fields that RP rejects for ManagedSystem pools.
- ManagedSystem standalone e2ev3 scenario: unknown. `Scenario_ManagedSystemPool_Enable` was started against standalone but interrupted before final verdict.

## Capability Model
- Source: `outputs/e2e-capability-model.json`
- Validator: `capability-model/src/validate.ts`
- Scope: project-local to `aks-rp-e2e`; do not promote to shared infra until this model proves useful through real iterations.
- Boundary: observation context (`standalone`, `staging`, `dev`, `devbox`, build version, execution surface) is a filter for where/how evidence was collected, not AKS input space.
- Current deterministic summary: 5 observation filters, 8 AKS input variables, 10 AKS state/behavior expectation variables, 7 feature mappings, 7 test-case evidence mappings.
- Current feature status: 2 pass (`app-routing-nginx-disablement`, `managedsystem-pool-rest-add-existing`), 4 fail (`app-routing-default-domain`, `paf-throttling`, CLI create/add ManagedSystem paths), 1 unknown (`managedsystem-pool-standalone-e2ev3`).
- Rule: agents may propose model changes, but the model is accepted only when the TypeScript validator passes.

## Weaknesses
- TLS secret provisioning weakness: DefaultDomain failed because required TLS secret was not provisioned.
- MSI identity weakness: PAFThrottling failed because MSI identity was missing.
- Scenario-selection weakness: duplicate registrations make several scenario names ambiguous.
- ManagedSystem standalone e2ev3 gap: `Scenario_ManagedSystemPool_Enable` was started but interrupted before final verdict.
- ManagedSystem CLI bug: `az aks create --enable-managed-system-pool` and `az aks nodepool add --mode ManagedSystem` send default fields that RP rejects.

## Next Action
Rerun or resume `Scenario_ManagedSystemPool_Enable` on devbox against standalone build `hayuaebld163822451`, capture the final e2ev3 verdict, and update `outputs/managedsystem-pool-exploration.md` plus `outputs/e2e-capability-model.json`.

## Plan
1. ✅ Run e2e scenarios and collect results (1 pass, 2 actionable findings)
2. ✅ Explore "managedsystem pool" feature enough to split REST/CLI/standalone evidence
3. 🔄 Capture final standalone e2ev3 verdict for `Scenario_ManagedSystemPool_Enable`

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
- One dev-suite scenario passes against the standalone environment: `Scenario_Traffic_AppRouting_Nginx_Disablement`
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
- outputs/scenario-catalog.md
- outputs/unblock-runbook.md
- outputs/iteration-status.md
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
- outputs/e2e-capability-model.json
- outputs/e2e-run-attempt.md
- outputs/successful-e2e-run.md
- outputs/deploy-status.md
- outputs/e2e-quickref.md
- outputs/deploy-failure-analysis.md

## Context
- Documentation deliverables are complete: `outputs/e2ev3-architecture.md`, `outputs/standalone-setup.md`, and `outputs/scenario-catalog.md`.
- Use `ssh_exec` for exact devbox command output, and `cc_worker` for exploratory delegated work. Do not treat a local `bash` path-guard warning as remote-access failure.
- Build version `hayuaebld163822451` is valid enough for e2ev3: config blob loads, the dev binary builds, and `akse2e.NewTestContext` succeeds.
- Non-login SSH commands on devbox do not include `/usr/local/go/bin` on PATH. Prefix e2ev3 commands with `export PATH=/usr/local/go/bin:$PATH`.
- `--list-scenarios` is not a real e2ev3 flag; discover dev-suite scenarios from `test/e2ev3/cmd/dev/main.go`.
- Some scenarios have duplicate registrations, so exact scenario selection can fail with "multiple scenario ... found".
- Green run evidence exists: `Scenario_Traffic_AppRouting_Nginx_Disablement` passed in session `202605121821-EftCJ`; see `outputs/successful-e2e-run.md`.
- Additional failed runs produced quality findings: DefaultDomain failed because TLS secret was not provisioned; PAFThrottling failed because MSI identity was missing; see `outputs/e2e-run-results-summary.md`.
- Build version used for current evidence: `hayuaebld163822451`, suite: `dev`.

## Linked Context
- `outputs/successful-e2e-run.md` — authoritative green-run evidence for `Scenario_Traffic_AppRouting_Nginx_Disablement`.
- `outputs/e2e-capability-model.json` — deterministic model of input space, expectation space, feature mappings, test-case paths, and evidence.
- `capability-model/src/index.ts` — project-local TypeScript engine for validating and summarizing the capability model.
- `outputs/e2e-run-results-summary.md` — current summary of passed/failed scenarios and code-quality findings.
- `outputs/first-e2e-run-results.md` — first real dev-suite run evidence from session `s_1778577667535_0`.
- `outputs/e2ev3-architecture.md` — e2ev3 framework concepts: Plan, Scenario, Suite, Mutator, and DAG workflow structure.
- `outputs/standalone-setup.md` — standalone environment setup notes and build-version behavior.
- `outputs/scenario-catalog.md` — scenario discovery notes and candidate scenario list.
- `devbox:/home/hayua/rp/test/e2ev3/cmd/dev/main.go` — source of registered dev-suite scenarios.
- `devbox:/home/hayua/rp/test/e2ev3/hack/e2ev3` — runner entry script; use with `export PATH=/usr/local/go/bin:$PATH`.
- Sessions `s_1778502610207_137`, `s_1778575778461_3` — verified `cc_worker` + `ssh devbox` access.
- Session `202605121821-EftCJ` — green run evidence for `Scenario_Traffic_AppRouting_Nginx_Disablement`.
