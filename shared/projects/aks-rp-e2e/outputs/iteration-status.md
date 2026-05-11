# E2E Testing Project — Status Checkpoint

**Date:** 2026-05-12  
**Status:** BLOCKED — standalone environment not yet ready for test execution

## Latest Check (2026-05-11 ~20:00 UTC)

### Standalone Deploy Status: IN PROGRESS 🔄
`aksbuilder_localdeploy.sh` is actively running on devbox with **14+ bazel server processes** building sub-workspaces in parallel (~12GB RAM consumed). Observed workspaces included:

- `rp` (main) — PID 744976, started 11:41, 2.1GB
- `e2eimages` — PID 1084805, started 19:35, 655MB
- `builder` (mazel) — PID 1326418, started 19:52, 835MB
- Plus 11 others: cseappsample, helm3releaser, goappsample, distroless, binariespublish, deployerappsample, clirunner, deployboximage, imagetool, syncvalidation, queuewatcher

This appears to be the multi-workspace container image build phase. Deployment had not finished at the time of the check.

### Toolchain Status
- **Go 1.24.3**: ✅ Installed at `/usr/local/go/bin/go`
- **Bazel**: ✅ Bundled inside aksbuilder / actively running
- **Key Vault DNS**: ❌ `aks-rp-e2e-kv.vault.azure.net` returned NXDOMAIN during the check

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

**Standalone environment is not yet ready.** The environment was still being built during the latest check, and the checked Key Vault DNS name returned NXDOMAIN.

### To Unblock (human / devbox follow-up)

```bash
# 1. Verify deployment finished
ssh devbox 'ps aux | grep bazel | grep -v grep | wc -l'

# 2. If deploy is complete, identify the actual generated environment / build version
#    (look in localdeploy output or generated config files)

# 3. Verify Key Vault resolves for the deployed environment
nslookup <actual-kv-name>.vault.azure.net

# 4. Run readiness check
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
