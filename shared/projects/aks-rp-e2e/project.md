---
id: aks-rp-e2e
owner: may
status: active
type: milestone
priority: P1
workflow: project
iteration: 1
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
**Iteration 1**: Exploration complete. Connected to devbox via SSH. Mapped the e2ev3 framework:
- Repo: Go monorepo at `/home/hayua/rp`, Bazel build system
- E2E lives in `test/e2ev3/` — modular framework with handlers, plans, suites, mutators
- Architecture: ARM → RP frontend → Service Bus → HCP async execution → AgentBaker
- 25 SIGs organize tests (rp, ccp, network, traffic, node, windows, etc.)
- Test pattern: Scenario → Plan struct (Metadata + Plan workflow) → Handlers → Assertions
- Runner: `./hack/e2ev3 mv --build-version <VER> --scenario <NAME>`
- Requires standalone environment + Azure VPN
- Domain knowledge in `.github/.copilot/domain_knowledge/`
- Two e2e generations: `test/e2e` (legacy) and `test/e2ev3` (current)

**Gap**: Haven't run any tests yet, no standalone environment set up, framework patterns not documented locally.

## Plan (Iteration 1)
- [x] Connect to devbox and explore repo structure
- [x] Map e2ev3 framework architecture (handlers, plans, suites, mutators, runtime)
- [x] Read domain knowledge docs (build_and_test, copilot-instructions)
- [ ] Document e2ev3 framework patterns in outputs/e2ev3-architecture.md
- [ ] Understand standalone setup — how to get a build version, prerequisites
- [ ] Re-plan: review findings, define next concrete steps

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


## Comments
