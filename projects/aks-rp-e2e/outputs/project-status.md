# AKS RP E2E Testing — Project Status

**Last updated:** 2026-05-11 ~20:00 UTC (iteration 3)

## Current State: BLOCKED — Waiting for Localdeploy to Complete

### What's Done ✅
- **Documentation complete**: 9 output files covering e2ev3 architecture, standalone setup, scenario catalog, quickref, troubleshooting, writing tests
- **Go installed**: v1.24.3 at `/usr/local/go/bin/go` (not on default PATH)
- **Bazel**: bundled inside aksbuilder, no separate install needed
- **Localdeploy initiated**: `hack/aksbuilder_localdeploy.sh` started ~19:34 UTC on 2026-05-11

### What's In Progress 🔄
- **aksbuilder localdeploy** is running on devbox (PID 1077229)
  - Currently in **bazel build phase** (`--build_tag_filters=ev2 //...`)
  - Bazel server using ~1.9GB RAM
  - No env files or standalone config generated yet — expected after build completes

### What's Blocked ⛔
- **Cannot run e2e tests** until localdeploy finishes (builds binaries + deploys standalone environment)
- Expected outputs after localdeploy: Key Vault provisioned, env config generated, RP deployed to standalone

### Next Steps (once localdeploy completes)
1. Check localdeploy output: `ssh devbox 'ps aux | grep aksbuilder | grep -v grep'` — if no processes, it's done
2. Find generated config: `ssh devbox 'find /home/hayua/rp -maxdepth 3 -name "*.env" -mmin -120 2>/dev/null'`
3. Run readiness check: `ssh devbox 'bash /path/to/standalone-readiness-check.sh'`
4. Run a dev e2e test:
   ```bash
   ssh devbox 'export PATH=/usr/local/go/bin:$PATH && cd /home/hayua/rp && test/e2ev3/hack/e2ev3 dev --scenario <pick-one> --debug'
   ```
5. Document the actual test execution flow and results

### Key Files on Devbox
| Path | Purpose |
|------|---------|
| `/home/hayua/rp/test/e2ev3/hack/e2ev3` | e2e test entry script |
| `/home/hayua/rp/hack/aksbuilder_localdeploy.sh` | Standalone deploy wrapper (calls `aksbuilder.sh localdeploy`) |
| `/usr/local/go/bin/go` | Go 1.24.3 (not on default PATH) |
| `~/azureconfig.yaml` | Azure config for localdeploy |

### Output Files Produced
| File | Lines | Content |
|------|-------|---------|
| `e2ev3-architecture.md` | ~210 | Framework types, lifecycle, DAG orchestration |
| `standalone-setup.md` | ~155 | Prerequisites, build versions, running tests |
| `scenario-catalog.md` | ~100 | 632 scenarios across 22 SIGs |
| `writing-e2e-tests.md` | ~300 | How to write new e2e tests |
| `e2e-quickref.md` | ~120 | Quick reference card |
| `troubleshooting.md` | ~80 | Common issues and fixes |
| `standalone-readiness-check.sh` | ~100 | Readiness check script |
| `doc-verification.md` | ~50 | Verification of docs against live repo |
| `e2e-run-attempt.md` | ~60 | First run attempt (failed: env not deployed) |
