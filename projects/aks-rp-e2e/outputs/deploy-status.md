# Standalone Deployment Status — 2026-05-12

## Current State: BLOCKED (localdeploy build phase fails)

### Build Version
`hayua-local-1778548706` — partially built, images pushed to ACR, but config blob not uploaded.

### What Works
- ✅ e2ev3 dev binary builds and runs (`test/e2ev3/hack/e2ev3 dev`)
- ✅ Build version is accepted by the test framework
- ✅ Go 1.24.3 + Bazel (bundled via aksbuilder) available on devbox
- ✅ Test binary loads scenarios, authenticates, constructs DAG

### What Fails
The test binary exits with:
```
FromBlob(https://akse2eci.blob.core.windows.net/config/hayua-local-1778548706): [Failed]
RESPONSE 404: 404 The specified blob does not exist.
ERROR CODE: BlobNotFound
```

This config blob is created during the **deploy phase** of `aksbuilder_localdeploy.sh`, which never runs because the **build phase** fails.

### localdeploy Build Errors (all recurring)

| Sub-workspace | Error | Likely Fix |
|---|---|---|
| **deployboximage** | Failed to pull ubuntu base image | Network/registry issue |
| **cseappsample** | Missing input `//:cseappsample-linux-amd64` | BUILD file issue |
| **e2eimages/mnist-gpu** | Killed (OOM) | Needs >2.5GB JVM heap for bazel |
| **clirunner** | `multiple CLI_RUNNER_SP_ID with different value` | Config conflict |
| **ccp/core-addon-synth** | Git auth token expired (exit 36) | Re-auth before build |

### Options to Unblock

1. **Skip failing sub-workspaces** — Ask team if localdeploy can be configured to skip non-essential workspaces (deploybox, mnist-gpu, cseappsample are not needed for e2e tests).
2. **Use a teammate's build version** — Run `test/e2ev3/hack/e2ev3 dev --build-version <their-version>` with someone else's working standalone.
3. **Use prod target** — Run `test/e2ev3/hack/e2ev3 prod --test-subscription-id <sub>` against production (no localdeploy needed).
4. **Fix individual errors** — Each error has a different root cause; fixing all of them is labor-intensive.

### Previous Standalone
A standalone was previously deployed with hostname:
```
standalone_251222a3w0rd_svc_0_eastus2_099nwrwc.hcp.eastus2.azmk8s.io
```
(Found in cached kube config at `test/e2e/.kube/cache/`)

### Timeline
- 2026-05-11 ~19:34 UTC — localdeploy initiated in tmux `deploy` session
- 2026-05-12 ~02:23 UTC — Failed with `exit status 1`
- tmux session no longer running

### Recommended Next Step
Ask team for a working build version, or investigate if `aksbuilder localdeploy` has a `--skip-workspace` flag.
