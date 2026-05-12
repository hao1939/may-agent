---
id: aks-rp-e2e
owner: may
status: active
type: milestone
priority: P1
workflow: project
iteration: 3
stop_reason: 
resume_condition: 
---

# Project: AKS RP E2E — Learn & Setup

## Goal
Learn and set up e2e testing for the AKS Resource Provider Go monorepo (hosted on devbox at `/home/hayua/rp`). Success = able to run e2e tests against a standalone environment, understand the e2ev3 framework architecture, and document the workflow for future development.

## Signals
- e2e.framework-documented: 0 → 1 (e2ev3 architecture documented in outputs/)
- e2e.local-run-success: 0 → 1 (successfully ran at least one scenario against standalone)
- e2e.sample-test-written: 0 → 1 (wrote or modified a test plan following the pattern)

## Current State
Active: the "Worker cannot SSH to devbox" blocker was false. `cc_worker` can run
`ssh devbox '...'` and returned real devbox output in sessions
`s_1778502610207_137` and `s_1778575778461_3`. For exact command output, prefer
the `ssh_exec` tool because `cc_worker` is a delegated LLM worker and may reason
or change the command. Build version
`hayuaebld163822451` has a readable config blob and the e2ev3 dev binary builds
successfully. The next step is to finish a real scenario run and record exact
stdout/stderr in `outputs/first-e2e-run-results.md`.

## Plan (Iteration 4)
- [x] Connect to devbox and explore repo structure
- [x] Map e2ev3 framework architecture
- [x] Read domain knowledge docs
- [x] Document e2ev3 framework patterns in outputs/e2ev3-architecture.md
- [x] Understand standalone setup — outputs/standalone-setup.md
- [x] Verify devbox access through `cc_worker`
- [x] Verify build version `hayuaebld163822451` loads e2ev3 config
- [ ] Run one real dev-suite scenario via `ssh_exec`
- [ ] Capture result and next actionable blocker in `outputs/first-e2e-run-results.md`

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
- (none yet — outputs/e2ev3-architecture.md pending)


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
