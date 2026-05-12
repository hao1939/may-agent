# Standalone Deploy Retry — 2026-05-12

## Previous Deploy Failure (2026-05-11)
The `hack/aksbuilder_localdeploy.sh` run from iteration 2 failed with 4 errors:
1. **`deployer/server` — missing `@rules_cc`** — Bazel repo/bzlmod config issue
2. **`e2eimages/mnist-gpu` — OOM Killed** — 14 parallel bazel servers × 2.5GB JVM exceeded 31GB RAM
3. **`clirunner` — duplicate `CLI_RUNNER_SP_ID`** — config/env conflict
4. **`cseappsample` — missing input file** — build dependency issue

## Cleanup Performed (this iteration)
| Action | Before | After |
|--------|--------|-------|
| Kill orphaned bazel servers | 8 processes (~7GB RAM) | 0 |
| Remove `~/.aksbuilder/bazeloutput` | 32GB | freed |
| Remove `/tmp/ev2artifactdir*` | 1.4GB | freed |
| Remove `~/.cache/bazel` | 2.9GB | freed |
| **Disk usage** | **95% (29GB free)** | **88% (64GB free)** |
| Preserved `bazeloutput-v8` | 84GB | kept (cache hits) |

## Retry Deploy
- `git pull --rebase` completed on repo
- `localdeploy` re-initiated in tmux session `deploy` at ~01:12 UTC 2026-05-12
- Log: `~/localdeploy.log`
- Initial status: bazel analysis phase progressing (192 packages loaded, 7001 targets)

## Monitoring Commands
```bash
# Check build progress
ssh devbox 'tail -30 ~/localdeploy.log'

# Check if still running
ssh devbox 'tmux list-sessions'

# Check for errors
ssh devbox 'grep -i "error\|fail\|killed" ~/localdeploy.log | tail -10'

# Check resource usage during build
ssh devbox 'free -h; ps aux --sort=-%mem | head -5'
```

## Expected Timeline
- Bazel build: 30-60 minutes
- Full localdeploy (build + deploy): 1-2 hours
- After completion: Key Vault DNS should resolve, e2e tests can run

## Next Steps After Deploy Succeeds
1. Run `outputs/standalone-readiness-check.sh` — all checks should pass
2. Get BUILD_VERSION from deploy output or `~/localdeploy.log`
3. Run first e2e test: `test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`
