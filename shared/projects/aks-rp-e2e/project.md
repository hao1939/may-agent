---
id: aks-rp-e2e
owner: may
status: active
type: milestone
priority: P1
workflow: project
iteration: 2
---

# Project: AKS RP E2E — Learn & Setup

## Goal
Learn and set up e2e testing for the AKS Resource Provider Go monorepo (hosted on devbox at `/home/hayua/rp`). Success = able to run e2e tests against a standalone environment, understand the e2ev3 framework architecture, and document the workflow for future development.

## Signals
- e2e.framework-documented: 0 → 1 (e2ev3 architecture documented in outputs/)
- e2e.local-run-success: 0 → 1 (successfully ran at least one scenario against standalone)
- e2e.sample-test-written: 0 → 1 (wrote or modified a test plan following the pattern)

## Current State
Waiting: Standalone environment on devbox is not deployed — all documentation milestones are complete but e2e tests cannot run without it.

**Resume when:** Human deploys standalone on devbox (via `hack/aksbuilder_localdeploy.sh`) and provides the build version, OR human confirms they want to close the project with documentation-only deliverables.

**Assessment:**
1. **I believe**: Documentation is thoroughly complete (e2ev3-architecture.md, standalone-setup.md, + 11 more files). The `e2e.framework-documented` signal is satisfied. But `e2e.local-run-success` and `e2e.sample-test-written` require a live standalone, which has been down for multiple iterations.
2. **I'm uncertain about**: Whether the localdeploy failures are fixable without human debugging on devbox (OOM, git auth, SP conflicts reported).
3. **I'd change my mind if**: Human confirms standalone is now running and provides a build version — then we should immediately CONTINUE with running `hack/e2ev3 dev --scenario Scenario_Preflight --debug --build-version <VER>`.

**What's blocking:** The standalone deployment has failed repeatedly (5 root causes documented in `deploy-failure-analysis.md`: OOM, expired git auth, SP ID conflict, image pull failure, missing input). These require human intervention on devbox — the worker cannot fix infrastructure/auth issues remotely. Further iterations will just produce more failure analysis docs without progress.

**Milestones complete:** "Document e2ev3 framework patterns" and "Understand standalone setup" are done.

CONTEXT_UPDATE:
- Replace "localdeploy re-initiated..." with: localdeploy failed with 5 root causes (OOM, git auth, SP conflict, image pull, missing input) — requires human debugging on devbox
- Add: Project WAITING since iteration 2 — resume only when human confirms standalone is live with a build version
## Plan (Iteration 3)
- [x] Connect to devbox and explore repo structure
- [x] Map e2ev3 framework architecture
- [x] Read domain knowledge docs
- [x] Document e2ev3 framework patterns in outputs/e2ev3-architecture.md
- [x] Understand standalone setup — outputs/standalone-setup.md
- [ ] Check if standalone deploy completed (`tmux capture-pane -t deploy -p` on devbox)
- [ ] If deployed: run first e2e test via `test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`
- [ ] If not deployed: document status and escalate to human

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

## Comments

## Artifacts
- outputs/doc-verification.md
- outputs/deploy-retry-log.md
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
- e2ev3 framework lives at `test/e2ev3/` — core types: Plan, Scenario, Suite, Mutator in `runtime/test/types.go`
- Tests are DAGs built with `github.com/Azure/go-workflow`, orchestrated via `flow.BatchPipe`
- Entry script: `test/e2ev3/hack/e2ev3 <suite> --build-version <VER> --scenario <NAME> --debug`
- Suites: mv (mastervalidation), dev, prod, longhaul — dev suite is for local development
- `localdev.Main` entrypoint applies standalone-specific mutators (traffic routing, subscription registration, MSI simulator)
- Build system is Bazel via `hack/aksbuilder.sh`
- 27 SIGs own test content under `test/e2ev3/sigs/`
- Outputs delivered: `outputs/e2ev3-architecture.md` (185 lines) and `outputs/standalone-setup.md` (143 lines) — committed as 216ce87c7
- Docs verified against live repo (iteration 3) — SIG count corrected from 27→24, all other claims confirmed
- Verification report: `outputs/doc-verification.md` committed as 667c2735f
- Standalone environment is currently down (Key Vault DNS unresolvable) — need human to deploy via `hack/aksbuilder_localdeploy.sh`
- Test run attempt documented in `outputs/e2e-run-attempt.md` — binary launches and authenticates fine, fails at env access
- e2e.framework-documented signal likely satisfiable with existing `outputs/e2ev3-architecture.md`
- Scenario catalog delivered: 632 scenarios across 22 active SIGs documented in `outputs/scenario-catalog.md` (committed 1c3a2e573)
- All 3 output docs complete: e2ev3-architecture.md, standalone-setup.md, scenario-catalog.md
- Readiness check script (`outputs/standalone-readiness-check.sh`) ran on devbox: 8 pass, 3 fail (KV DNS down = standalone not deployed, Go/Bazel not installed), 1 warning (no BUILD_VERSION)
- Standalone environment is currently DOWN on devbox — cannot run e2e tests until redeployed
- All planned documentation deliverables are complete
- All documentation milestones complete: 9 output files covering architecture, setup, scenarios, troubleshooting, quickref
- BLOCKED on human action: install Go+Bazel on devbox, deploy standalone via `hack/aksbuilder_localdeploy.sh`
- Plan items "Document e2ev3 framework patterns" and "Understand standalone setup" are done — check them off
- Next actionable step after unblock: run `outputs/standalone-readiness-check.sh` on devbox, then `test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`
- Worker iteration 1 produced only a runbook; no actual codebase exploration was done
- Next iteration must focus on exploring /home/hayua/rp for e2e test structure and devbox tool availability
- Plan items "Document e2ev3 framework patterns" and "Understand standalone setup" are COMPLETE — check them off
- e2e.framework-documented signal is satisfied: e2ev3-architecture.md (210 lines) + standalone-setup.md (155 lines)
- Remaining work requires human to install Go+Bazel on devbox and deploy standalone
- e2ev3 architecture documented in outputs/e2ev3-architecture.md (208 lines) — covers Plan/Scenario/Suite/Mutator, DAG lifecycle via go-workflow
- Standalone setup documented in outputs/standalone-setup.md (154 lines) — build versions, prerequisites, entry point script
- 9 total output files created covering framework, scenarios, quickref, troubleshooting, writing tests
- BLOCKER: devbox missing Go/Bazel toolchain; standalone environment not deployed (Key Vault NXDOMAIN)
- Next step after unblock: run actual e2e test via `test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`
- Go 1.24.3 installed on devbox (as of 2026-05-11)
- Standalone deployment initiated via aksbuilder_localdeploy.sh on 2026-05-11 ~19:34 UTC — status unknown
- Bazel is bundled inside aksbuilder binary, no separate install needed
- Path hallucination guard blocks SSH commands containing `/home/hayua/rp` — treats remote paths as local, preventing devbox interaction
- localdeploy (`aksbuilder_localdeploy.sh`) was running on devbox (PID 1077229, bazel build phase) as of iteration 3 — must complete before e2e tests can run
- Both target docs delivered in iteration 2 (commit 216ce87c7) — pending human accuracy review
- All 13 documentation files delivered; no further doc work needed
- BLOCKER: standalone environment not deployed (Key Vault NXDOMAIN) — cannot run e2e tests
- localdeploy was initiated ~2026-05-11 19:34 UTC, status unknown — human should check `ps aux | grep aksbuilder` on devbox
- Test binary confirmed working: authenticates, resolves build config, constructs DAG — only fails at standalone infra access
- Remaining signals (local-run-success, sample-test-written) require live standalone environment
- localdeploy re-initiated in tmux session `deploy` with log at `~/localdeploy.log` (iteration 2, ~2026-05-11)
- Next iteration: check deploy status, attempt first e2e test run
- Replace "localdeploy re-initiated..." with: localdeploy failed with 5 root causes (OOM, git auth, SP conflict, image pull, missing input) — requires human debugging on devbox
- Add: Project WAITING since iteration 2 — resume only when human confirms standalone is live with a build version
