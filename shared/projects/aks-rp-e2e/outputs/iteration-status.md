# E2E Testing Project — Iteration 3 Status

**Date**: 2025-05-12  
**Status**: BLOCKED — standalone environment not deployed

## What's Done
- ✅ 13 documentation files (1389+ lines) covering e2ev3 architecture, standalone setup, scenario catalog, quickref, troubleshooting, test-writing guide
- ✅ Docs verified against live repo (SIG count corrected 27→24)
- ✅ Test binary confirmed working (authenticates, builds DAG — fails only at standalone infra access)
- ✅ Go 1.24.3 installed on devbox
- ✅ Bazel bundled in aksbuilder (no separate install needed)

## What's Blocking
1. **Standalone environment not deployed** — Key Vault `e2e-standalone-kv.vault.azure.net` returns NXDOMAIN
2. **localdeploy process no longer running** — `aksbuilder_localdeploy.sh` was started ~2026-05-11 19:34 UTC but the process is gone; two Bazel server processes remain alive (PIDs 744976, 1326418) but no active deploy job
3. **Go not on PATH** — `go` command not found (may need `export PATH=$PATH:/usr/local/go/bin` or similar)

## Human Actions Needed

### 1. Check deploy outcome
```bash
# On devbox:
# Check if aksbuilder left any logs
find ~/.aksbuilder -name "*.log" -newer /tmp/ 2>/dev/null | xargs tail -20
# Or re-run deploy
cd /home/hayua/rp && hack/aksbuilder_localdeploy.sh
```

### 2. Verify standalone is up
```bash
nslookup e2e-standalone-kv.vault.azure.net
# Should resolve to an IP, not NXDOMAIN
```

### 3. Fix Go PATH
```bash
export PATH=$PATH:/usr/local/go/bin
go version  # should show 1.24.3
```

### 4. Run first e2e test
```bash
cd /home/hayua/rp
# Get build version from aksbuilder output or:
export BUILD_VERSION=$(cat .build-version 2>/dev/null || echo "unknown")
test/e2ev3/hack/e2ev3 dev --scenario CreateCluster --debug
```

## Once Unblocked — Automation Ready
The `outputs/first-e2e-run.sh` script automates steps 2-4. Run it after standalone is deployed:
```bash
bash outputs/first-e2e-run.sh
```

## Documentation Index
| File | Lines | Content |
|------|-------|---------|
| e2ev3-architecture.md | ~210 | Framework types, DAG lifecycle, SIG structure |
| standalone-setup.md | ~155 | Prerequisites, build versions, entry points |
| scenario-catalog.md | ~120 | 632 scenarios across 22 SIGs |
| writing-e2e-tests.md | ~200 | How to write new e2e tests |
| e2e-quickref.md | ~90 | Quick reference card |
| troubleshooting.md | ~50 | Common issues and fixes |
| unblock-runbook.md | ~70 | Steps to unblock standalone |
| test-execution-playbook.md | ~50 | Run playbook |
| first-e2e-run.sh | ~80 | Automated first-run script |
| standalone-readiness-check.sh | ~70 | Environment readiness checker |
| doc-verification.md | ~40 | Verification report |
| e2e-run-attempt.md | ~40 | Prior run attempt log |
| project-status.md | ~60 | Project status (superseded by this file) |
