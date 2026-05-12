# Standalone Deploy Failure Analysis

**Date**: 2026-05-11 (localdeploy run at ~02:23 UTC)  
**Status**: FAILED — 5 workspace build failures, standalone not deployed  
**KV DNS**: `aks-sa-kv.vault.azure.net` → NXDOMAIN (environment does not exist)

## Root Causes (5 failures)

### 1. `e2eimages` — OOM Killed (mnist-gpu)
- Bazel build of mnist-gpu image exceeds available memory
- **Fix**: Reduce parallelism: `--jobs=4` or `--local_ram_resources=8192` in bazel flags
- Alternative: skip mnist-gpu if not needed for your scenarios

### 2. `ccp/core-addon-synth` — Git auth expired
- `fatal: Verification code expired` — PAT or device-flow token used for private repo access has expired
- **Fix**: Re-authenticate git credentials on devbox (`gh auth login` or refresh PAT in git credential store)

### 3. `clirunner` — CLI_RUNNER_SP_ID conflict
- Environment variable `CLI_RUNNER_SP_ID` conflicts with existing config
- **Fix**: Unset or correct the value in your shell env / `.env` file before running localdeploy

### 4. `deployboximage` — Ubuntu image pull failure
- Docker/containerd cannot pull the base ubuntu image (registry auth or network issue)
- **Fix**: `docker login` to the relevant ACR, or check network/proxy settings

### 5. `cseappsample` — Missing input file
- Build expects a file that doesn't exist in the workspace
- **Fix**: May be a stale workspace — try `bazel clean --expunge` in the cseappsample workspace before retry

## Recommended Recovery Steps

```bash
# 1. Kill orphaned bazel servers (freeing ~3GB RAM)
ssh devbox 'kill 1638752 1702812'

# 2. Re-authenticate git
ssh devbox 'cd /home/hayua/rp && gh auth login'

# 3. Clear stale bazel state
ssh devbox 'cd /home/hayua/rp && bazel clean --expunge'

# 4. Retry with reduced parallelism
ssh devbox 'tmux new -d -s deploy "cd /home/hayua/rp && hack/aksbuilder_localdeploy.sh 2>&1 | tee ~/localdeploy2.log"'
```

## What Success Looks Like

When localdeploy succeeds:
- All workspace images built and pushed
- Key Vault `aks-sa-kv.vault.azure.net` resolves (or the correct KV for your subscription)
- `standalone-readiness-check.sh` passes all checks
- Can run: `test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`

## Current Blockers for E2E Testing

| Blocker | Owner | Action |
|---------|-------|--------|
| Git auth expired | Human | `gh auth login` on devbox |
| OOM on e2eimages | Human | Reduce bazel parallelism or add swap |
| CLI_RUNNER_SP_ID conflict | Human | Fix env var |
| Standalone not deployed | Human | Successful localdeploy run |
| KV DNS unresolvable | Blocked by above | Will resolve after deploy |
