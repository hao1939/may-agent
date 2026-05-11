# E2Ev3 Quick Reference

## Run Tests

```bash
# Against standalone (most common for dev)
cd /home/hayua/rp
test/e2ev3/hack/e2ev3 dev --build-version <BUILD_VERSION> --debug -s <SCENARIO_NAME>

# Master validation suite
test/e2ev3/hack/e2ev3 mv --build-version <BUILD_VERSION> --debug -s <SCENARIO_NAME>

# Production
test/e2ev3/hack/e2ev3 prod --build-version <BUILD_VERSION> --test-subscription-id=<SUB_ID> --test-region eastus2 -s <SCENARIO_NAME>
```

**Get build version:** From standalone deploy warning: `E2E build version is hayuaebld<BUILD_ID>`

## Common Flags

| Flag | Description |
|------|-------------|
| `--build-version` | Standalone build version (required) |
| `-s, --scenario` | Scenario name to run |
| `--debug` | Enable debug logging |
| `--test-region` | Azure region (default from config) |
| `--test-resource-group` | Reuse existing RG (skip create) |
| `--test-managed-cluster` | Reuse existing cluster (skip create) |
| `--log-azure-short-name` | Shorter Azure resource names |
| `--timeout` | Test timeout (default 1h) |

## Write a New Test

### 1. Create plan file: `sigs/<your-sig>/plans/my_feature.go`

```go
package plans

import (
    "context"
    flow "github.com/Azure/go-workflow"
    "go.goms.io/aks/rp/swagger/awesome"
    "go.goms.io/aks/rp/test/e2ev3/handlers/kubever"
    "go.goms.io/aks/rp/test/e2ev3/handlers/sku"
    "go.goms.io/aks/rp/test/e2ev3/handlers/to"
    "go.goms.io/aks/rp/test/e2ev3/runtime/test"
    "go.goms.io/aks/rp/test/e2ev3/runtime/test/plans"
    "go.goms.io/aks/rp/test/e2ev3/sigs"
)

// 1. Export scenario variable
var Scenario_My_Feature = test.NewScenario("Scenario_My_Feature", new(MyFeature))

// 2. Define plan struct (embed SingleCluster for standard lifecycle)
type MyFeature struct {
    plans.SingleCluster
    vmSize *string
}

// 3. Implement Metadata()
func (m *MyFeature) Metadata() test.Metadata {
    return test.Metadata{
        Description: "my feature test",
        Owner:       sigs.RP, // use your SIG owner from sigs/owners.go
    }
}

// 4. Implement ManagedClusterToCreate() — configure the cluster
func (m *MyFeature) ManagedClusterToCreate(ctx context.Context, mc *awesome.ManagedCluster) error {
    mc.Properties.AgentPoolProfiles[0].VMSize = m.vmSize
    mc.Properties.KubernetesVersion = m.GetKubeVersion(ctx, func(kv kubever.KubeVersions) (string, error) {
        return kv.DefaultVersion()
    })
    mc.Properties.NetworkProfile = &awesome.ContainerServiceNetworkProfile{
        NetworkPlugin: to.Ptr(awesome.NetworkPluginAzure),
    }
    return nil
}

// 5. Implement Plan() — define the workflow DAG
func (m *MyFeature) Plan() *flow.Workflow {
    provision, teardown := m.Provision(m), m.Teardown()
    m.vmSize = m.UseVMSize(sku.DefaultClaim)

    myValidation := flow.Func("ValidateMyFeature", func(ctx context.Context) error {
        // your test logic here
        return nil
    })

    return m.Add(flow.Pipe(provision, myValidation, teardown))
}
```

### 2. Register in suite

Add to `cmd/dev/main.go` imports and scenario list, or your sig's suite file.

### 3. Run

```bash
test/e2ev3/hack/e2ev3 dev --build-version <VER> --debug -s Scenario_My_Feature
```

## Key Patterns

- **`plans.SingleCluster`** — embed for standard create/teardown lifecycle
- **`flow.Pipe(a, b, c)`** — sequential steps
- **`flow.BatchPipe(flow.Steps(a), flow.Steps(b,c))`** — a then b+c in parallel
- **`flow.Func("name", fn)`** — inline step from a function
- **`cluster.UseIn(step)`** — wire cluster ref into a step
- **`kubeConfig.UseIn(step)`** — wire k8s credentials into a step
- **`.Mutate(mutate.AlwaysTeardown)`** — always run teardown even on failure

## SIGs (24 total)

```
acccvm  airlock  arm64  autoscale  ccp  consts  dataplane  devinfra
dplat  fqdnpolicy  gpu  industry  managementplane  network  node  rp
runtime  secops  security  serverless  speculor  traffic  windows  workload
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `dial tcp: lookup *.vault.azure.net: NXDOMAIN` | Standalone not deployed | Deploy standalone first |
| `401 token expired` / `IDE token expired` | Copilot/LiteLLM token stale | Re-auth: `az login` |
| `go: command not found` | Go not in PATH | `export PATH="/usr/local/go/bin:$PATH"` |
| Bazel tidy timeout | First build downloads deps | Wait or use pre-built binary |
| All steps `[Skipped]` | Early step failed | Check first `[Failed]` step |

## Pre-built Binary (skip Bazel build)

```bash
# Find and run directly:
find ~/.aksbuilder/bazeloutput-v8/ -path "*/cmd/dev/dev_/dev" -type f
/path/to/dev --debug -s Scenario_Preflight --build-version <VER>
```
