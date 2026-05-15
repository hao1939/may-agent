# e2ev3 Scenario Catalog

> Auto-generated from live repo exploration. Last updated: 2026-05-11.

## Summary

- **Total `NewScenario()` calls:** 632 (includes parameterized/dynamic variants)
- **Active SIGs with scenarios:** 22 of 24 directories
- **SIGs without scenarios:** `consts` (constants only), `fqdnpolicy`

## Scenarios Per SIG

| SIG | Count | Notable Areas |
|-----|------:|---------------|
| speculor | 116 | Speculative execution, preview features |
| security | 93 | Security policies, defender, encryption |
| rp | 89 | Core RP CRUD, managed cluster operations |
| ccp | 73 | Connected cluster proxy |
| traffic | 51 | Istio, service mesh, ALB, ingress |
| node | 45 | Node pool operations, OS, image |
| autoscale | 38 | Cluster autoscaler, VPA, KEDA |
| network | 33 | CNI, VNET, dual-stack, Swift, overlay |
| industry | 18 | Industry-specific configurations |
| secops | 15 | Security operations |
| serverless | 12 | Virtual nodes, ACI |
| dplat | 11 | Data platform |
| workload | 8 | Workload identity |
| devinfra | 7 | Dev infrastructure testing |
| managementplane | 6 | Management plane operations |
| runtime | 5 | Runtime components (containerd, etc.) |
| gpu | 4 | GPU node pools, drivers |
| airlock | 3 | Airlock features |
| windows | 2 | Windows node pools |
| dataplane | 1 | Data plane operations |
| arm64 | 1 | ARM64 SKU support |
| acccvm | 1 | Confidential computing VMs |

## Suite Structure

There is **no** `suites/dev/` directory. The suites live at:

```
test/e2ev3/suites/
├── autoreversion/       # Autoreversion pipeline suite
│   └── autoreversion.go
└── checkin/             # MasterValidation / CI pipeline suites
    ├── mastervalidation.go
    ├── edgezone.go
    ├── arm64sku.go
    ├── virtualmachine.go
    └── cmd/             # Binary entrypoints for checkin variants
```

The **`dev` suite** is built inline in `cmd/dev/main.go` — it imports all SIG plans and registers them dynamically. This is the suite used for standalone local testing.

## Running a Specific Scenario

```bash
# From repo root:
test/e2ev3/hack/e2ev3 dev \
  --build-version <VER> \
  --scenario Scenario_Vmagent_Pod_Status \
  --timeout 30m \
  --debug
```

Key flags:
- `-s, --scenario string` — exact scenario name (required for single-test runs)
- `--timeout duration` — default 1h
- `--debug` — verbose logging

## Finding Scenario Names

Scenario names are Go variables, not always string literals. To find them:

```bash
# All scenario names (grep for NewScenario calls):
grep -rh "NewScenario(" test/e2ev3/sigs/ --include="*.go" | head -50

# Scenarios for a specific SIG:
grep -rh "NewScenario(" test/e2ev3/sigs/network/ --include="*.go"

# Find by keyword:
grep -rh "NewScenario(" test/e2ev3/sigs/ --include="*.go" | grep -i "dualstack"
```

## Corrections to Prior Docs

- **SIG count:** 24 directories — re-confirmed May 2026 (`ls` shows 24 dirs + BUILD.bazel + owners.go)
- **`suites/dev/` does not exist** — dev suite is inline in `cmd/dev/main.go`
- **`--list-scenarios` flag does not exist** — must grep source to find scenario names
