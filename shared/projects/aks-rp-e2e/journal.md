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
