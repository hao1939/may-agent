# Iteration 3 Status — 2026-05-12

## Current State: BLOCKED on standalone deployment

### What's Done ✅
All documentation deliverables complete (9 files in outputs/). Framework architecture, standalone setup, scenario catalog, quickref, troubleshooting — all verified against live repo.

### What's Blocking ❌
**Standalone deploy failed** (last attempt: 2026-05-12 ~02:23 UTC). Errors:
1. **Git auth expired**: `fatal: Verification code expired before contacting the server`
2. **CLI_RUNNER_SP_ID conflict**: `error: multiple CLI_RUNNER_SP_ID with different value`
3. **Bazel build failure**: clirunner genrule failed (Exit 1)

No new deploy has been attempted since.

### Devbox Tool Status
| Tool | Status |
|------|--------|
| Go | Installed at `/usr/local/go/bin/go` (v1.24.3) but NOT on PATH |
| Bazelisk | Available via aksbuilder (`~/.aksbuilder/bin/bazelisk-linux-amd64-v1.19.0`) |
| aksbuilder | Working — `aksbuilder tidy` was running on pts/0 |

### Human Actions Needed
1. **Fix git auth on devbox**: `ssh devbox` → re-authenticate git credentials
2. **Resolve CLI_RUNNER_SP_ID conflict**: Check `~/.aksbuilder/config` or env vars for duplicate SP IDs
3. **Re-run localdeploy**: `cd /home/hayua/rp && hack/aksbuilder_localdeploy.sh 2>&1 | tee ~/localdeploy.log`
4. **Verify**: After deploy completes, run `outputs/standalone-readiness-check.sh`

### Next Steps After Unblock
```bash
# On devbox, after successful deploy:
export PATH="/usr/local/go/bin:$PATH"
cd /home/hayua/rp
test/e2ev3/hack/e2ev3 dev --scenario <pick-a-simple-scenario> --debug
```

Recommend starting with a simple scenario from SIG node-bootstrapping or similar.
