# AKS RP E2Ev3 Testing — Documentation Index

## Status
**Framework understood. Standalone environment down (Key Vault DNS NXD) — need human to redeploy.**

To unblock: run `hack/aksbuilder_localdeploy.sh` on the devbox at `/home/hayua/rp`.

## Deliverables

| Document | Description | Lines |
|----------|-------------|-------|
| [e2ev3-architecture.md](e2ev3-architecture.md) | Core framework architecture: Plan/Scenario/Suite/Mutator types, DAG engine (go-workflow), SIG structure, suite hierarchy | 184 |
| [standalone-setup.md](standalone-setup.md) | How to deploy and configure a standalone AKS RP environment for local e2e testing | 142 |
| [writing-e2e-tests.md](writing-e2e-tests.md) | Step-by-step guide to authoring new e2ev3 tests: plans, scenarios, mutators, suite registration | 200 |
| [e2e-quickref.md](e2e-quickref.md) | Cheat sheet: common commands, flags, debugging tips | 138 |
| [e2e-run-attempt.md](e2e-run-attempt.md) | Log of actual test run attempt — binary builds and authenticates, fails at env access | 44 |
| [doc-verification.md](doc-verification.md) | Verification of all docs against live repo code | 27 |

## Key Facts

- **Entry point:** `test/e2ev3/hack/e2ev3 dev --build-version <VER> -s <SCENARIO> --debug`
- **Framework core:** `runtime/test/types.go` — Plan, Scenario, Suite, Mutator
- **DAG engine:** `github.com/Azure/go-workflow` with `flow.BatchPipe`
- **Standalone entrypoint:** `localdev.Main` applies standalone-specific mutators
- **Build system:** Bazel via `hack/aksbuilder.sh`
- **24 SIGs** own test content under `test/e2ev3/sigs/`
- **Suites:** dev (local), mv (master validation), prod, longhaul

## Next Steps

1. **Human action needed:** Redeploy standalone environment (`hack/aksbuilder_localdeploy.sh`)
2. After deploy, run a dev suite scenario end-to-end to validate the documented workflow
3. Capture successful run output as proof of completeness
