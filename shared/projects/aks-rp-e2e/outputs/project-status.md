# AKS RP E2Ev3 Project — Status Summary

**Last updated:** 2025-06-04 (iteration 1, current session)

## Goal
Learn and set up e2e testing for the AKS Resource Provider Go monorepo. Success = able to run e2e tests against a standalone environment, understand the e2ev3 framework architecture, and document the workflow.

## Deliverables — Complete ✅

| Document | Lines | Description |
|----------|-------|-------------|
| `e2ev3-architecture.md` | 208 | Framework internals: Plan/Scenario/Suite/Mutator types, DAG execution via go-workflow |
| `standalone-setup.md` | 154 | How to deploy & configure a standalone environment for local e2e |
| `scenario-catalog.md` | 91 | 632 scenarios across 22 active SIGs |
| `writing-e2e-tests.md` | 290 | Step-by-step guide to authoring new e2ev3 tests |
| `e2e-quickref.md` | 138 | Cheat-sheet for running tests |
| `troubleshooting.md` | 109 | Common failures and fixes |
| `doc-verification.md` | 27 | Verification of docs against live repo |
| `standalone-readiness-check.sh` | 90 | Script to validate environment prerequisites |
| `e2e-run-attempt.md` | 44 | Log of attempted test run |
| `unblock-runbook.md` | 80 | Steps to unblock the standalone environment |
| `README.md` | 34 | Index of all output files |

**Total:** 1,307 lines across 12 files

## Blocked ❌ — Cannot Run E2E Tests

The standalone environment on devbox (`/home/hayua/rp`) is **DOWN**:

- Key Vault DNS (`aks-rp-standalone.vault.azure.net`) → NXDOMAIN
- Go, Bazel, Bazelisk — not installed on devbox
- Docker ✓, entry script ✓, SIG directories ✓

### Human Action Required

1. **Install Go + Bazel** on devbox
2. **Deploy standalone:** `hack/aksbuilder_localdeploy.sh`
3. **Validate:** `bash outputs/standalone-readiness-check.sh`
4. **Run test:** `cd /home/hayua/rp && test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`

## Knowledge Summary

| Concept | Detail |
|---------|--------|
| Framework location | `test/e2ev3/` |
| Core types | Plan, Scenario, Suite, Mutator (`runtime/test/types.go`) |
| DAG engine | `github.com/Azure/go-workflow`, `flow.BatchPipe` |
| Entry script | `test/e2ev3/hack/e2ev3 <suite> --build-version <VER> --scenario <NAME> --debug` |
| Standalone entry | `localdev.Main` — applies standalone mutators |
| Suites | mv (master validation), dev (local), prod, longhaul |
| Build system | Bazel via `hack/aksbuilder.sh` |
| SIGs | 24 active (26 directories, 2 inactive) |
| Standalone mutators | Traffic routing, subscription registration, MSI simulation |

## What's Left

Once unblocked, the only remaining goal milestone is:
- **Run an actual e2e test** against standalone and document the output
