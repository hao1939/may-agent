# E2E Testing Project — Status (Iteration 4)

**Updated:** 2026-05-12

## Documentation: ✅ COMPLETE
All deliverables produced and verified:
- `e2ev3-architecture.md` — framework patterns, types, DAG lifecycle (210 lines)
- `standalone-setup.md` — prerequisites, build versions, entry points (155 lines)
- `scenario-catalog.md` — 632 scenarios across 22 active SIGs
- `doc-verification.md` — verified all claims against live repo
- Plus: quickref, troubleshooting, writing-tests, readiness-check

## Standalone Deploy: 🔄 IN PROGRESS
- **Initiated:** ~2026-05-11 19:34 UTC via `aksbuilder_localdeploy.sh` in tmux `deploy`
- **Log:** `~/localdeploy.log` on devbox
- **Current phase (as of iter 4):** Image push — building and pushing container images to ACR
- **Key Vault DNS:** Still NXDOMAIN (expected until resources are provisioned)
- **Go 1.24.3:** ✅ Installed on devbox
- **Bazel:** ✅ Bundled in aksbuilder

## What's Next (once deploy completes)
1. Verify KV DNS resolves: `nslookup aks-rp-e2e-kv.vault.azure.net`
2. Run readiness check: `bash outputs/standalone-readiness-check.sh`
3. Run first e2e test: `test/e2ev3/hack/e2ev3 dev --scenario <pick-simple-one> --debug`
4. Document results in `outputs/first-e2e-run-results.md`

## Blockers
- Deploy must complete before any e2e test can run
- Human should monitor: `ssh devbox 'tail -20 ~/localdeploy.log'`
