# Standalone Deploy Failure Analysis
**Date:** 2026-05-12  
**Deploy initiated:** ~2026-05-11 19:34 UTC via `aksbuilder_localdeploy.sh`  
**Deploy ended:** 2026-05-12 02:23 UTC (failed after ~7 hours)

## Root Cause

The `localdeploy` command failed during the Bazel build phase. Multiple workspace builds failed:

### Error 1: cseappsample — missing input file
```
ERROR: /home/hayua/rp/devinfraservices/aksbuilder/samples/cseappsample/BUILD.bazel:16:12
  Writing: bazel-out/k8-fastbuild/bin/cseappsample-cse-pkg.tar.gz failed:
  missing input file '//:cseappsample-linux-amd64'
```
**Likely cause:** Binary wasn't built before packaging. May need `go build` or a Bazel target dependency fix.

### Error 2: e2eimages — mnist-gpu.image.ev2 killed
```
ERROR: /home/hayua/rp/devinfraservices/aksdistroless/e2eimages/BUILD.bazel:174:8
  Executing genrule //:mnist-gpu.image.ev2 failed: (Killed)
```
**Likely cause:** OOM kill during image build. The devbox may not have enough memory for GPU image builds.

### Error 3: clirunner — multiple CLI_RUNNER_SP_ID
```
"msg":"multiple CLI_RUNNER_SP_ID with different value"
```
**Likely cause:** Configuration conflict — multiple service principal IDs defined.

### Error 4: ccp/core-addon-synth — exit status 36
```
"msg":"failed to do preparations, err: exit status 36"
```
Also: `jq: error: Could not open file .../azure-cns-addon//Chart.yaml: No such file or directory`

## Current State

- **Key Vault:** `aks-rp-e2ev3-standalone.vault.azure.net` → **NXDOMAIN** (standalone not deployed)
- **Bazel servers:** 3 still running (rp, devimages, builder) — consuming ~3.3GB RAM
- **tmux session:** `deploy` session no longer exists

## Recommended Actions

### Option A: Retry with targeted deploy (skip non-essential workspaces)
```bash
# Kill lingering Bazel servers first
ssh devbox 'ps aux | grep "bazel(" | grep -v grep | awk "{print \$2}" | xargs kill'

# Check if localdeploy supports --workspace or component filtering
ssh devbox 'cd /home/hayua/rp && hack/aksbuilder_localdeploy.sh --help'
```

### Option B: Deploy only the RP + e2e infra (not all components)
Look for a more targeted deploy that skips cseappsample, mnist-gpu, clirunner:
```bash
# Check if there's a minimal/e2e-only deploy option
ssh devbox 'grep -r "localdeploy" /home/hayua/rp/hack/ --include="*.sh" -l'
```

### Option C: Use a pre-built build version from CI
Instead of building locally, use a known-good build version from CI/CD:
```bash
# Find recent build versions
ssh devbox 'grep -r "BUILD_VERSION\|build.version" /home/hayua/rp/test/e2ev3/ --include="*.go" -l | head -5'
```

### Option D: Run e2e tests against a shared/team standalone
If the team has a shared standalone environment, configure the test runner to point there instead of a local one.

## Questions for Human

1. Has `localdeploy` ever succeeded on this devbox before?
2. Is there a team-shared standalone environment we can target instead?
3. Can we use `--verbose_failures` flag on retry to get more details?
4. Should we kill the 3 lingering Bazel servers (they're using ~3.3GB RAM)?
