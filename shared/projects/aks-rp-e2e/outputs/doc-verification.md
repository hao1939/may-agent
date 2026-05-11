# Documentation Verification Report

Verified on 2026-05-11 against live repo at `devbox:/home/hayua/rp`.

## e2ev3-architecture.md

| Claim | Status | Evidence |
|-------|--------|----------|
| Framework at `test/e2ev3/` | ✅ | `ls` confirms directory with expected contents |
| Core types in `runtime/test/types.go` | ✅ | `grep` confirms `Plan`, `Scenario`, `ScenarioBuilder`, `ScenarioMutator` |
| `go-workflow` / `BatchPipe` usage | ✅ | Found in `mutate/` package (5+ files) |
| 27 SIGs under `sigs/` | ❌ Fixed → **24 SIGs** | `find -maxdepth 1 -type d` counted 24 |
| SIG names list | ✅ | All 24 names verified: acccvm, airlock, arm64, autoscale, ccp, consts, dataplane, devinfra, dplat, fqdnpolicy, gpu, industry, managementplane, network, node, rp, runtime, secops, security, serverless, speculor, traffic, windows, workload |
| `localdev` entrypoint | ✅ | `cmd/dev/main.go` and per-SIG dev commands found |

## standalone-setup.md

| Claim | Status | Evidence |
|-------|--------|----------|
| Entry script `hack/e2ev3` | ✅ | File exists, header confirms usage pattern |
| Suites: mv, dev, prod | ✅ | `case $1 in` switch in script matches |
| `hack/aksbuilder.sh` for builds | ✅ | File exists at `/home/hayua/rp/hack/aksbuilder.sh` |
| Flags: `--build-version`, `-s`, `--debug`, `--test-region` | ✅ | All visible in script header comments |

## Corrections Applied

1. **SIG count**: 27 → 24 (fixed in `e2ev3-architecture.md`)
