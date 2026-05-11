# E2E Testing Project — Status Checkpoint

**Date:** 2026-05-12  
**Status:** BLOCKED — standalone environment not deployed

## What's Done

### Documentation (13 files in `outputs/`)
| File | Lines | Content |
|------|-------|---------|
| `e2ev3-architecture.md` | 208 | Core types, lifecycle, directory structure, SIG list |
| `standalone-setup.md` | 154 | Prerequisites, running tests, execution flow, devbox state |
| `scenario-catalog.md` | — | 632 scenarios across 22 active SIGs |
| `e2e-quickref.md` | — | One-page cheat sheet: run, write, debug |
| `writing-e2e-tests.md` | — | Step-by-step guide with real examples (VmagentPodStatus) |
| `troubleshooting.md` | — | 8 common failures with fixes |
| `e2e-run-attempt.md` | — | Documented test binary launch (auth works, infra access fails) |
| `doc-verification.md` | — | Verified all docs against live repo |
| `standalone-readiness-check.sh` | — | 11-check diagnostic script |
| + 4 more support files | — | README, project-status, test-execution-playbook, unblock-runbook |

### Validated Understanding
- e2ev3 framework architecture: Plan → Scenario → Suite → DAG execution via go-workflow
- Build system: Bazel via aksbuilder (bundled, no separate install)
- Entry point: `test/e2ev3/hack/e2ev3 <suite> --build-version <VER> -s <NAME> --debug`
- Test binary confirmed working: authenticates via Azure CLI, resolves build config, constructs DAG
- Fails only at standalone infrastructure access (Key Vault DNS NXDOMAIN)

## What's Blocked

**Standalone environment is not deployed.** The Key Vault DNS for the standalone RP returns NXDOMAIN, meaning the standalone infrastructure has been torn down or was never fully deployed.

### To Unblock (human action required on devbox)

```bash
# 1. Verify Go is installed
go version  # expect go1.24.3

# 2. Deploy standalone
cd /home/hayua/rp
hack/aksbuilder_localdeploy.sh /home/hayua/rp

# 3. Wait for deployment (can take 30-60 min)
# 4. Note the build version from output: "E2E build version is hayuaebld<ID>"

# 5. Verify Key Vault resolves
nslookup <kv-name>.vault.azure.net

# 6. Run readiness check
bash outputs/standalone-readiness-check.sh
```

### After Unblock — First Test Run

```bash
cd /home/hayua/rp
test/e2ev3/hack/e2ev3 dev \
    --build-version <BUILD_VERSION> \
    --scenario Scenario_Preflight \
    --debug
```

## Remaining Goals

| Goal | Status |
|------|--------|
| Understand e2ev3 framework | ✅ Done |
| Document the workflow | ✅ Done (13 files) |
| Run e2e test against standalone | ❌ Blocked on infra |
| Write a sample test | ❌ Blocked on infra (need to verify it runs) |

## Signals

| Signal | Status |
|--------|--------|
| `e2e.framework-documented` | ✅ Satisfied |
| `e2e.local-run-success` | ❌ Blocked |
| `e2e.sample-test-written` | ❌ Blocked |
