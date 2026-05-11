# Journal: aks-rp-e2e

## Iteration 1 — Exploration (2026-05-11)

### What we learned
- AKS RP is a Go monorepo with Bazel build, hosted on devbox at /home/hayua/rp
- SSH access configured: `ssh devbox` (20.24.129.235, user hayua)
- E2E has two generations: `test/e2e` (legacy v2) and `test/e2ev3` (current)
- E2Ev3 is a modular DAG-based test framework using `go-workflow`
- Tests organized by 25 SIGs: rp, ccp, network, traffic, node, windows, etc.

### E2Ev3 Pattern
1. **Scenario** = `test.NewScenario("name", new(PlanStruct))`
2. **Plan** implements `Metadata()` + `Plan() *flow.Workflow`
3. **Workflow** composes handlers via `flow.BatchPipe` (DAG phases)
4. **Handlers** = reusable steps (CreateResourceGroup, ClaimVMSize, Preflight, etc.)
5. **Suites** group scenarios for pipelines (checkin, mastervalidation, prod)
6. **Mutators** modify scenarios (ARM64, EdgeZone, ReuseCluster, MockStepper)

### Key paths
- `test/e2ev3/sigs/` — 25 SIG directories with plans
- `test/e2ev3/handlers/` — reusable handlers (aks, azure, k8s, log, sku, to)
- `test/e2ev3/suites/` — pipeline suites (checkin, autoreversion)
- `test/e2ev3/cmd/dev/main.go` — dev suite for local debugging
- `test/e2ev3/hack/e2ev3` — CLI runner
- `.github/.copilot/domain_knowledge/` — architecture docs

### How to run
```bash
./hack/e2ev3 mv --build-version <BUILD_VER> --scenario Scenario_Preflight --debug
```
Requires standalone environment + Azure VPN.

### Decisions
- Focus on e2ev3 (not legacy e2e) — it's the active framework
- Start with RP SIG tests (preflight, agent_pool) as they're closest to core RP

## Iteration 0 — Project Setup
- Created project scaffolding
### Iteration 1 (comment) — 2026-05-11T12:30:10.198Z
**Comment**: (No comments yet.)

## 2026-05-11 — hao
Master, please push on iteration 2 of this project. The Plan has unchecked items:
- Document e2ev3 framework patterns in `outputs/e2ev3-architecture.md`
- Understand standalone setup — how to get a build version, prerequisites

Use cc_worker via SSH to gather the info from devbox (`ssh devbox`, repo at `/home/hayua/rp`). Save findings to outputs/ in this project directory. Then re-plan iteration 3.
**Reviewer**: CONTINUE — **Beliefs:**
1. **I believe**: This is iteration 1 with no prior worker output — the project hasn't started actual exploration yet.
2. **I'm uncertain about**: Whether SSH access to devbox works from cc_worker, and the structure of the e2ev3 framework in the repo.
3. **I'd change my mind if**: SSH access doesn't work, in which case we'd need a different approach.

CONTINUE

**(a) Concrete output:** Two files: `outputs/e2ev3-architecture.md` (framework patterns, key types, test lifecycle) and `outputs/standalone-setup.md` (how to build, prerequisites, how to run e2e tests).

**(b) What's different:** First attempt.

**(c) First step:** Use cc_worker to SSH into devbox and explore the repo structure. Start with:
1. `ssh devbox 'find /home/hayua/rp -type d -name "e2ev3" -o -name "e2e"' | head -40` to locate the e2e framework
2. `ssh devbox 'ls /home/hayua/rp/test/'` or similar to find test directories
3. Read key framework files (test runner, base test types, config) to understand architecture
4. Look for Makefiles or scripts related to standalone setup: `ssh devbox 'grep -r "standalone" /home/hayua/rp/Makefile* /home/hayua/rp/hack/ --include="*.sh" --include="Makefile*" -l'`
5. Check for any existing docs: `ssh devbox 'find /home/hayua/rp/docs -name "*e2e*" -o -name "*standalone*"'`

Save all findings to the two output files. Focus on answering: What is the test lifecycle? How do tests register/discover? What infra do they need? How do you get a build version and run against standalone?

