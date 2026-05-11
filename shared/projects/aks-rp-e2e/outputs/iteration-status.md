# E2E Project — Iteration Status

**Last checked:** 2026-05-11 ~20:00 UTC (iteration 2)

## Standalone Deploy Status: IN PROGRESS 🔄

`aksbuilder_localdeploy.sh` is actively running on devbox with **14+ bazel server processes** building sub-workspaces in parallel (~12GB RAM consumed). Key workspaces being built:

- `rp` (main) — PID 744976, started 11:41, 2.1GB
- `e2eimages` — PID 1084805, started 19:35, 655MB
- `builder` (mazel) — PID 1326418, started 19:52, 835MB
- Plus 11 others: cseappsample, helm3releaser, goappsample, distroless, binariespublish, deployerappsample, clirunner, deployboximage, imagetool, syncvalidation, queuewatcher

This is the multi-workspace container image build phase. Once complete, it will deploy to the standalone environment.

## Toolchain Status
- **Go 1.24.3**: ✅ Installed at `/usr/local/go/bin/go`
- **Bazel**: ✅ Bundled inside aksbuilder (running)
- **Key Vault DNS**: ❌ NXDOMAIN (expected — environment not yet deployed)

## Documentation Status: COMPLETE ✅
All 13 output files delivered. No further doc work needed.

## Next Steps (after deploy completes)
1. Run `outputs/standalone-readiness-check.sh` on devbox
2. Find the generated environment config / build version
3. Run: `test/e2ev3/hack/e2ev3 dev --scenario <name> --debug`

## Blocker
Waiting for `aksbuilder_localdeploy.sh` to finish building and deploying. Check progress:
```bash
ssh devbox 'ps aux | grep bazel | grep -v grep | wc -l'
# When this drops to 0, build is done. Then check for deploy phase.
```
