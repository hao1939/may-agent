---
id: aks-rp-e2e
owner: may
status: active
type: milestone
priority: P1
workflow: project
iteration: 8
stop_reason: 
resume_condition: 
---

# Project: AKS RP E2E — Run And Understand E2E Quality

## Goal
Actually run AKS RP e2ev3 cases against the standalone environment on devbox (`/home/hayua/rp`) so we can understand code quality from real execution results. Success = at least one scenario reaches a clear pass, or we collect precise, reproducible blocker evidence and the next unblock action; the existing framework/setup documentation is supporting context, not the finish line.

## Signals
- e2e.framework-documented: 1 (e2ev3 architecture documented in outputs/)
- e2e.local-run-executed: 1 (a dev-suite scenario executed against standalone)
- e2e.scenario-pass: 1 (Scenario_Traffic_AppRouting_Nginx_Disablement PASSED)
- e2e.green-run-evidence: 1 (outputs/successful-e2e-run.md)
- e2e.blocker-evidence: 1 (capacity/MSI blockers are documented, but need one focused next unblock path)

## Current State
**First green e2e pass achieved!** `Scenario_Traffic_AppRouting_Nginx_Disablement` passed on 2026-05-12 against standalone build `hayuaebld163822451`. The blocker was 5 leftover clusters from failed tests consuming all capacity — cleaned up by calling the standalone RP's DELETE API directly via mTLS.

## Plan
- [x] Connect to devbox and explore repo structure
- [x] Map e2ev3 framework architecture
- [x] Read domain knowledge docs
- [x] Document e2ev3 framework patterns in outputs/e2ev3-architecture.md
- [x] Understand standalone setup — outputs/standalone-setup.md
- [x] Verify devbox access through `cc_worker`
- [x] Verify build version `hayuaebld163822451` loads e2ev3 config
- [x] Run one real dev-suite scenario via `ssh_exec`
- [x] Capture result and next actionable blocker in `outputs/first-e2e-run-results.md`
- [x] Run a second no-underlay scenario and capture capacity failure evidence
- [ ] Identify the smallest scenario and region/SKU override path most likely to pass
- [ ] Run one focused validation using that path
- [ ] Produce `outputs/successful-e2e-run.md` for a green run, or a blocker artifact with exact evidence and owner/action

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
- E2E test suite passes against local deployment
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
- outputs/final-status.md
- outputs/test-execution-playbook.md
- outputs/project-status.md
- outputs/standalone-readiness-check.sh
- outputs/writing-e2e-tests.md
- outputs/first-e2e-run.sh
- outputs/troubleshooting.md
- outputs/run-e2e.sh
- outputs/e2ev3-architecture.md
- outputs/iteration3-status.md
- outputs/second-e2e-run-results.md
- outputs/e2e-run-attempt.md
- outputs/deploy-status.md
- outputs/e2e-quickref.md
- outputs/deploy-failure-analysis.md

## Context
- e2ev3 framework lives at `test/e2ev3/`; core types are Plan, Scenario, Suite, and Mutator in `runtime/test/types.go`.
- Tests are DAGs built with `github.com/Azure/go-workflow`, usually via `flow.BatchPipe`.
- Entry script: `test/e2ev3/hack/e2ev3 <suite> --build-version <VER> -s <SCENARIO> --debug`.
- Suites: `mv`, `dev`, `prod`, `longhaul`; `dev` is the local development suite.
- Build system is `hack/aksbuilder.sh` invoked by `test/e2ev3/hack/e2ev3`; Bazel is bundled by aksbuilder.
- Documentation deliverables are complete: `outputs/e2ev3-architecture.md`, `outputs/standalone-setup.md`, and `outputs/scenario-catalog.md`.
- Use `ssh_exec` for exact devbox command output, and `cc_worker` for exploratory delegated work. Do not treat a local `bash` path-guard warning as remote-access failure.
- `cc_worker` + `ssh devbox` is verified in session `s_1778502610207_137` and again in session `s_1778575778461_3`.
- Build version `hayuaebld163822451` is valid enough for e2ev3: config blob loads from `https://akse2eci.blob.core.windows.net/config/hayuaebld163822451`, the dev binary builds, and `akse2e.NewTestContext` succeeds.
- `--list-scenarios` is not a real e2ev3 flag; discover dev-suite scenarios from `test/e2ev3/cmd/dev/main.go`.
- Known dev-suite scenarios include `Scenario_Traffic_AppRouting_DefaultDomain_HelloWorld`, `Scenario_Traffic_ApiProxy_Cert_Rotation`, `Scenario_If_Match`, `Scenario_RBAC_Disabled`, `Scenario_ComponentVersion`, and `Scenario_CNI_Overlay`.
- `Scenario_ComponentVersion` was a poor first choice because it matched multiple registered scenarios. `Scenario_If_Match` appeared unique and was selected for the next run in session `s_1778575778461_3`.
- Direct `kubectl get pods -n aks-rp` on devbox currently uses a stale kubeconfig DNS name and fails NXDOMAIN; that does not prove e2ev3 build-version routing is broken because e2ev3 config blob loading succeeds.
- Non-login SSH commands on devbox do not include `/usr/local/go/bin` on PATH. Prefix e2ev3 commands with `export PATH=/usr/local/go/bin:$PATH`.
- `Scenario_If_Match` and several other dev-suite scenarios are registered more than once; selection fails with "multiple scenario ... found". `Scenario_PAFThrottling` is unique enough to execute.
- Real run evidence: session `s_1778577667535_0`, commit `6e0f14a67`, output `outputs/first-e2e-run-results.md`.
- Second run (`Scenario_Traffic_AppRouting_Nginx_Disablement`) confirmed framework is fully operational without underlay credentials. Failed only on transient `AKSCapacityHeavyUsage` in eastus2.
- Two proven working scenarios: `Scenario_PAFThrottling` (needs underlay post-cluster-create), `Scenario_Traffic_AppRouting_Nginx_Disablement` (no underlay needed, capacity-blocked).
- Remaining blockers are external: (1) eastus2 capacity for cluster creation, (2) devbox MSI not assigned for underlay-dependent scenarios. Neither is fixable by iteration work.
- Root cause identified: `AKSCapacityHeavyUsage` error is NOT regional capacity — it's because the standalone RP has 0 underlays registered. The async goal resolver cannot select an underlay for cluster creation.
- Tried 5 regions (eastus2, westus2, westus3, centralus, southcentralus) — all fail identically because the issue is underlay registration, not Azure capacity.
- GreenPhase header bypasses sync capacity check but async underlay selection still fails.
- Standard SKU bypasses free-tier block but doesn't help with missing underlays.
- ALL dev-suite scenarios require cluster creation → no scenario can pass without a registered underlay.
- Unblock action: register an underlay cluster in the standalone RP (needs real infrastructure setup by repo owner).
