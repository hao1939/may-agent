# E2E Testing Project — Status Checkpoint

**Date:** 2026-05-12  
**Status:** BLOCKED — standalone environment not deployed; localdeploy failed

## Latest Check (iteration 2, 2026-05-12)

### Standalone Deploy Status: FAILED ❌
Previous `aksbuilder_localdeploy.sh` run (started ~2026-05-11 19:34 UTC) is **no longer running**. No tmux/screen session captured output, so logs are lost. Only 2 idle bazel server processes remain. **No evidence the deploy succeeded:**
- No BUILD_VERSION artifact found anywhere
- Key Vault DNS still NXDOMAIN
- No deploy config files generated

### Toolchain Status
- **Go 1.24.3**: ✅ Installed at `/usr/local/go/bin/go` (not on default PATH)
- **Bazel**: ✅ Bundled inside aksbuilder
- **Key Vault DNS**: ❌ `aksbuilder-standalone-keyvault.vault.azure.net` returned NXDOMAIN

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
- Fails only at standalone infrastructure access (Key Vault DNS / env readiness)

## What's Blocked

**Standalone environment is not deployed.** The previous localdeploy run failed silently (process gone, no output captured, KV DNS still NXDOMAIN).

### To Unblock (human action required)

```bash
# Re-run localdeploy in tmux so output is captured:
ssh devbox
tmux new-session -s localdeploy
export PATH=/usr/local/go/bin:$PATH
cd ~/rp
bash hack/aksbuilder_localdeploy.sh ~/rp 2>&1 | tee ~/localdeploy.log
# Wait for completion, then note the BUILD_VERSION from output
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
