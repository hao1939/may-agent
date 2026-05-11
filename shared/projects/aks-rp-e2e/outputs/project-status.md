# AKS RP E2Ev3 Project — Status Summary

**Last updated:** 2026-05-11 (iteration 2, re-check 2 — blockers unchanged)

## Goal
Learn and set up e2e testing for the AKS Resource Provider Go monorepo. Success = able to run e2e tests against a standalone environment, understand the e2ev3 framework architecture, and document the workflow.

## Deliverables — Complete ✅

| Document | Description | Lines |
|----------|-------------|-------|
| `e2ev3-architecture.md` | Framework internals: Plan/Scenario/Suite/Mutator types, DAG execution via go-workflow | ~185 |
| `standalone-setup.md` | How to deploy & configure a standalone environment for local e2e | ~143 |
| `scenario-catalog.md` | 632 scenarios across 22 active SIGs | ~large |
| `writing-e2e-tests.md` | Step-by-step guide to authoring new e2ev3 tests | present |
| `e2e-quickref.md` | Cheat-sheet for running tests | present |
| `troubleshooting.md` | Common failures and fixes | present |
| `doc-verification.md` | Verification of docs against live repo | present |
| `standalone-readiness-check.sh` | Script to validate environment prerequisites | present |
| `e2e-run-attempt.md` | Log of attempted test run | present |

## Blocked ❌

**Cannot run e2e tests.** The standalone environment is DOWN (re-confirmed 2026-05-11 iteration 3):
- Key Vault DNS (`aks-rp-standalone.vault.azure.net`) → NXDOMAIN (still)
- Go, Bazel, Bazelisk — none installed on devbox
- Docker is running ✓, entry script exists ✓, 26 SIG dirs present ✓
- **Action needed (human):**
  1. Install Go + Bazel on devbox
  2. Run `hack/aksbuilder_localdeploy.sh` to provision standalone environment
  3. Re-run `outputs/standalone-readiness-check.sh` to validate
  4. Then execute: `cd /home/hayua/rp && test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`

## Knowledge Gained

1. **e2ev3 framework** lives at `test/e2ev3/` — Plans are DAGs built with `github.com/Azure/go-workflow`
2. **Core types:** Plan, Scenario, Suite, Mutator (in `runtime/test/types.go`)
3. **Entry point:** `test/e2ev3/hack/e2ev3` script → `localdev.Main` for standalone
4. **Suites:** mv (master validation), dev (local), prod, longhaul
5. **Build system:** Bazel via `hack/aksbuilder.sh`
6. **SIG count:** 26 directories under `test/e2ev3/sigs/` (confirmed via SSH)
7. **Standalone mutators** handle traffic routing, subscription registration, MSI simulation
