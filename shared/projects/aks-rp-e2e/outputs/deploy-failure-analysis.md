# Standalone Deploy Failure Analysis

**Date**: 2026-05-12  
**Deploy initiated**: ~2026-05-11 19:34 UTC via `aksbuilder_localdeploy.sh`  
**Deploy failed**: 2026-05-12 00:41:19 UTC  
**Log**: `~/localdeploy.log` on devbox

## Summary

The localdeploy ran for ~5 hours building and pushing container images. Several sub-workspace builds succeeded (base-os-builder, unittest images pushed to ACR), but the overall deploy failed due to build errors in 4 sub-workspaces.

## Errors (in order)

### 1. cseappsample — Missing input file
```
ERROR: cseappsample/BUILD.bazel:16:12: Writing cseappsample-cse-pkg.tar.gz failed:
  missing input file '//:cseappsample-linux-amd64'
```
**Likely cause**: The cseappsample binary wasn't built before the packaging step. Could be a build ordering issue or missing dependency.

### 2. e2eimages — OOM Killed
```
ERROR: e2eimages/BUILD.bazel:174:8: Executing genrule //:mnist-gpu.image.ev2 failed: (Killed)
```
**Likely cause**: The mnist-gpu image build was OOM-killed. This is a resource constraint on the devbox. Consider:
- Increasing devbox memory
- Adding `--jobs=4` or lower to reduce parallel bazel actions
- Skipping GPU test images if not needed

### 3. clirunner — Config conflict
```
ERROR: "multiple CLI_RUNNER_SP_ID with different value"
```
**Likely cause**: Environment or config has conflicting service principal IDs. Check `.env` files or deployment config for duplicate `CLI_RUNNER_SP_ID` entries.

### 4. Main RP workspace — Missing rules_cc
```
ERROR: Skipping '//deployer/server/...': No repository visible as '@rules_cc' from main repository
```
**Likely cause**: Bazel workspace is missing the `rules_cc` external dependency. May need `bazel sync` or the WORKSPACE file is stale. Try:
```bash
cd /home/hayua/rp && bazelisk fetch @rules_cc//...
```

## Orphaned Bazel Servers

8 bazel server processes are still running from the failed deploy, consuming ~3GB+ RAM:
```
PID 744976  - bazel(rp)
PID 1413046 - bazel(distroless)
PID 1413050 - bazel(cseappsample)
PID 1413051 - bazel(e2eimages)
PID 1413063 - bazel(devinfraimagereplication)
PID 1413077 - bazel(clirunner)
PID 1414690 - bazel(devimages)
PID 1534402 - bazel(builder)
```

**Clean up with**: `bazelisk shutdown` in each workspace, or `pkill -f "bazel\("`

## What Succeeded

These images were pushed to `aksdeploymente2eeastus.azurecr.io`:
- `base-os-builder:hayua-local-1778544338-linux-amd64`
- `base-os-builder-cache:hayua-local-1778544338-linux-amd64`
- `unittest:hayua-local-1778544338-linux-amd64`

## Recommended Next Steps

1. **Kill orphaned bazel servers** to free memory:
   ```bash
   pkill -f "bazel\("
   ```

2. **Re-run localdeploy** — the errors may be transient (OOM) or fixable:
   ```bash
   cd /home/hayua/rp
   tmux new -s deploy
   nohup hack/aksbuilder_localdeploy.sh 2>&1 | tee ~/localdeploy2.log
   ```

3. **Alternative: skip full deploy, use existing build version** — if another team member has a working standalone, get their build version:
   ```bash
   # Check if there's an existing working build version
   grep -r "build.version\|BUILD_VERSION" /home/hayua/rp/test/e2ev3/ --include="*.env" --include="*.sh" -l
   ```

4. **Alternative: run e2e binary directly** against an existing standalone (if Key Vault becomes reachable):
   ```bash
   export PATH=/usr/local/go/bin:$PATH
   cd /home/hayua/rp/test/e2ev3
   hack/e2ev3 dev --build-version=<KNOWN_VERSION> -s <scenario> --test-region eastus2 --debug
   ```

## Environment Status

| Component | Status |
|-----------|--------|
| Go 1.24.3 | ✅ Installed at `/usr/local/go/bin/go` |
| Bazel | ✅ Via aksbuilder (bundled bazelisk) |
| e2ev3 script | ✅ Exists at `test/e2ev3/hack/e2ev3` |
| Key Vault DNS | ❌ NXDOMAIN — standalone not deployed |
| Standalone env | ❌ Deploy failed |
| Orphaned processes | ⚠️ 8 bazel servers consuming RAM |
