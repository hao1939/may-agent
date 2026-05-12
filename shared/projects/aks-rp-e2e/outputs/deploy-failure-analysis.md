# Standalone Deploy Failure Analysis (2026-05-12)

## Summary
`aksbuilder_localdeploy.sh` ran ~2026-05-11 19:34 UTC in tmux session `deploy`.
It processed ~5924 lines of output before failing. The tmux session exited.

## Build Version Generated
`hayua-local-1778544338` (timestamp-based, from image tags in log)

## Failures (in order of occurrence)

### 1. deployboximage — Docker Pull Failure (line ~1847)
```
Error in fail: Pull command failed
ERROR: Analysis of target '//:deploybox.image.ev2' failed
```
- Could not pull `@ubuntu-linux-amd64//image` — auth or network issue

### 2. cseappsample — Missing Input (line ~2478)
```
ERROR: Writing cseappsample-cse-pkg.tar.gz failed: missing input file '//:cseappsample-linux-amd64'
```

### 3. e2eimages — OOM Kill (line ~4839)
```
ERROR: Executing genrule //:mnist-gpu.image.ev2 failed: (Killed): bash failed
```
- Devbox is memory-constrained with 8+ parallel bazel servers

### 4. clirunner — Config Conflict (line ~5293)
```
"multiple CLI_RUNNER_SP_ID with different value"
```

### 5. Main RP Workspace — Missing Bazel Dep (line ~5543)
```
ERROR: No repository visible as '@rules_cc' from main repository
ERROR: error loading package under directory 'deployer/server'
```
- Likely needs `git pull` to pick up dependency fixes

### 6. Final (line ~5889)
```
{"level":"error","msg":"failed to build, err: error happened: exit status 1"}
```

## Orphaned Bazel Servers
8 bazel server processes still running (from ~1.4GB total), started during the failed deploy.
Kill with: `ssh devbox 'pkill -f "bazel.*server"'` or let them idle-timeout.

## Recommended Next Steps
1. `ssh devbox 'cd /home/hayua/rp && git pull'` — pick up latest fixes
2. Kill orphaned bazel servers to free memory
3. Retry: `ssh devbox 'cd /home/hayua/rp && nohup hack/aksbuilder_localdeploy.sh > ~/localdeploy2.log 2>&1 &'`
4. If OOM persists, add `--local_ram_resources=HOST_RAM*.5` to bazel flags
5. Ask team if there's a known working commit or pre-built standalone
