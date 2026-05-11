# How to Write a New E2Ev3 Test

## Quick Reference

| Concept | What it is |
|---------|-----------|
| **Plan** | Struct implementing `Plan()` → DAG of test steps via `go-workflow` |
| **Scenario** | Named wrapper: `test.NewScenario("Name", new(YourPlan))` |
| **Suite** | Collection of scenarios (dev, mv, prod, longhaul) |
| **Mutator** | Workflow transformer applied at scenario or suite level |
| **SIG** | Team ownership dir under `test/e2ev3/sigs/` |

## Step-by-Step: Adding a New Test

### 1. Choose Your SIG Directory

Tests live under `test/e2ev3/sigs/<sig>/<subsig>/plans/`. The reference SIG is:
```
test/e2ev3/sigs/rp/nativerp/plans/
```

### 2. Create the Plan File

Create `plans/your_test.go`:

```go
package plans

import (
    "context"
    flow "github.com/Azure/go-workflow"
    "go.goms.io/aks/rp/swagger/awesome"
    "go.goms.io/aks/rp/test/e2ev3/runtime/test"
    "go.goms.io/aks/rp/test/e2ev3/runtime/test/plans"
    "go.goms.io/aks/rp/test/e2ev3/sigs"
)

// 1. Declare the scenario (package-level var)
var Scenario_Your_Test = test.NewScenario("Scenario_Your_Test", new(YourTest))

// 2. Define the plan struct — embed a base plan
type YourTest struct {
    plans.SingleCluster  // provides Provision(), Teardown(), UseManaged Cluster(), etc.
}

// Ensure interface compliance
var _ plans.SingleClusterTestPlan = new(YourTest)

// 3. Metadata — description, owning SIG, tags
func (t *YourTest) Metadata() test.Metadata {
    return test.Metadata{
        Description: "Validates your feature",
        Owner:       sigs.RP,  // use your SIG constant from sigs/owners.go
        Tags:        map[string]string{},
    }
}

// 4. Customize the cluster creation request (optional)
func (t *YourTest) ManagedClusterToCreate(ctx context.Context, mc *awesome.ManagedCluster) error {
    // Modify mc.Properties as needed for your test
    return nil
}

// 5. Build the test DAG
func (t *YourTest) Plan() *flow.Workflow {
    provision, teardown := t.Provision(t), t.Teardown()

    // Define test steps (handlers)
    myStep := &MyCustomHandler{/* ... */}

    return flow.Pipe(provision, myStep, teardown)
    // Or use flow.BatchPipe for parallel steps
}
```

### 3. Register the Scenario

Add your scenario to the SIG's `GetTestScenarios()` function (usually in `plans/plans.go`):

```go
func GetTestScenarios() []test.Scenario {
    return []test.Scenario{
        // ... existing scenarios ...
        Scenario_Your_Test,  // ← add here
    }
}
```

### 4. Add Mutators (Optional)

Mutators transform the workflow DAG. Use them for cross-cutting concerns:

```go
// Chain mutators onto a scenario
var Scenario_Your_Test = test.NewScenario("Scenario_Your_Test", new(YourTest)).
    Mutate(mutate.AlwaysTeardown)  // ensures teardown runs even on failure
```

Common built-in mutators (`test/e2ev3/mutate/`):
- `AlwaysTeardown` — run teardown even if test fails
- `HackTrafficToRPIngress` — route traffic to standalone RP
- `CustomizeManagedCluster` — modify cluster spec
- `CustomizeAgentPool` — modify agent pool spec
- `CollectNodeLogs` — gather node logs on failure
- `MockProvision` — skip real provisioning (for fast iteration)
- `DontPanic` — recover from panics gracefully

To write a custom mutator:
```go
var MyMutator = test.WorkflowMutator(func(w *flow.Workflow) *flow.Workflow {
    // Modify workflow: add steps, change conditions, etc.
    return w
})
```

### 5. Base Plans Available

The framework provides several base plan types in `runtime/test/plans/`:

| Base Plan | Provides |
|-----------|----------|
| `SingleCluster` | One managed cluster: Provision → Test → Teardown |
| `MultiCluster` | Multiple clusters in the same test |
| `Teardown` | Standalone teardown step |

`SingleCluster` gives you:
- `Provision(plan)` / `Teardown()` — lifecycle steps
- `UseManagedCluster()` — access the cluster resource
- `UseResourceGroup()` — access the resource group
- `UseK8sCredential()` — get kubeconfig for kubectl operations
- `GetKubeVersion(ctx, selector)` — pick a Kubernetes version

### 6. Workflow Composition with go-workflow

Tests are DAGs. Key composition patterns:

```go
// Sequential: A → B → C
flow.Pipe(stepA, stepB, stepC)

// Parallel batch then sequential:
// [A, B, C] all run in parallel → then D
flow.BatchPipe([]flow.Steppable{stepA, stepB, stepC}, stepD)

// Conditional execution:
flow.Step(myStep).When(flow.Always)     // run even if deps fail
flow.Step(myStep).When(someCondition)   // custom condition
```

### 7. Running Your Test

```bash
# From the repo root:
test/e2ev3/hack/e2ev3 dev \
    --build-version <your-build-version> \
    --scenario Scenario_Your_Test \
    --debug
```

For standalone environments, the `localdev.Main` entrypoint automatically applies:
- Traffic routing mutators (route to your standalone RP)
- Subscription registration
- MSI simulator

## Test Lifecycle Summary

```
Scenario Registration (package init)
        ↓
Suite Selection (dev/mv/prod)
        ↓
Mutator Application (suite-level + scenario-level)
        ↓
Workflow Execution:
    Provision (create RG, create cluster)
        ↓
    Test Steps (your custom handlers)
        ↓
    Teardown (delete cluster, delete RG)
```

## File Structure Template

```
test/e2ev3/sigs/<your-sig>/
├── plans/
│   ├── plans.go              # GetTestScenarios() registry
│   ├── your_test.go          # Plan + Scenario definition
│   └── helpers.go            # Shared test utilities
└── (other test packages)
```

## Real Example: VmagentPodStatus (sig-airlock)

This is a real plan from `sigs/airlock/plans/vmagent_pod_status.go`, annotated:

```go
package plans

import (
    "context"
    flow "github.com/Azure/go-workflow"
    "go.goms.io/aks/rp/swagger/awesome"
    "go.goms.io/aks/rp/test/e2ev3/handlers/hcp"       // underlay access
    "go.goms.io/aks/rp/test/e2ev3/handlers/kubever"    // k8s version selection
    "go.goms.io/aks/rp/test/e2ev3/handlers/sku"        // VM SKU claims
    "go.goms.io/aks/rp/test/e2ev3/handlers/to"         // pointer helpers
    "go.goms.io/aks/rp/test/e2ev3/runtime/test"
    "go.goms.io/aks/rp/test/e2ev3/runtime/test/plans"
    "go.goms.io/aks/rp/test/e2ev3/sigs"
    "go.goms.io/aks/rp/test/e2ev3/sigs/airlock/handlers"
)

// Package-level scenario registration — this is how the framework discovers tests
var Scenario_Vmagent_Pod_Status = test.NewScenario("Scenario_Vmagent_Pod_Status", new(VmagentPodStatus))

// Plan struct: embed SingleCluster for standard lifecycle + extra capabilities
type VmagentPodStatus struct {
    plans.SingleCluster        // Provision/Teardown lifecycle
    hcp.UnderlayCredentials    // Mixin: access to HCP underlay k8s
    systemPool *string         // VM size pointer (filled by UseVMSize)
}

// Compile-time interface check
var _ plans.SingleClusterTestPlan = new(VmagentPodStatus)

func (vps *VmagentPodStatus) Metadata() test.Metadata {
    return test.Metadata{
        Owner: sigs.Airlock,
        Tags:  map[string]string{"vmagent": "true", "validate-pod-status": "true"},
    }
}

// Customize the cluster spec before creation
func (vps *VmagentPodStatus) ManagedClusterToCreate(ctx context.Context, mc *awesome.ManagedCluster) error {
    mc.Properties.AgentPoolProfiles[0].VMSize = vps.systemPool
    mc.Properties.AgentPoolProfiles[0].OSType = to.Ptr(awesome.OSTypeLinux)
    mc.Properties.AgentPoolProfiles[0].Count = to.Ptr(int32(2))
    // GetKubeVersion: deferred — resolved at runtime from available versions
    mc.Properties.KubernetesVersion = vps.GetKubeVersion(ctx, func(kv kubever.KubeVersions) (string, error) {
        return randomSupportedVersion(kv)
    })
    return nil
}

// The DAG: provision → get underlay creds → validate pod status → teardown
func (vps *VmagentPodStatus) Plan() *flow.Workflow {
    provision, teardown := vps.Provision(vps), vps.Teardown()
    validateVMAgentPodStatus := new(handlers.ValidateVMAgentPodStatus)
    underlayCred := vps.UseUnderlayCredentials()  // claim underlay creds
    vps.systemPool = vps.UseVMSize(sku.DefaultClaim) // claim a VM SKU

    validate := new(flow.Workflow)
    validate.Add(
        flow.Step(validateVMAgentPodStatus).
            Input(func(ctx context.Context, v *handlers.ValidateVMAgentPodStatus) error {
                v.Namespace = *vps.CreateManagedCluster.GetResponse().Properties.ResourceUID
                v.Credential.UseK8sCredential(underlayCred)
                return nil
            }),
    )

    // BatchPipe: sequential phases, each phase can have parallel steps
    return vps.SingleCluster.Add(
        vps.UseManagedCluster().UseIn(vps.GetUnderlayCredential),
        underlayCred.UseIn(validateVMAgentPodStatus),
        flow.BatchPipe(
            flow.Steps(provision),
            flow.Steps(vps.GetUnderlayCredential),
            flow.Steps(validate),
            flow.Steps(teardown),
        ),
    )
}
```

**Key patterns visible here:**
- `UseVMSize(sku.DefaultClaim)` / `UseUnderlayCredentials()` — resource claims resolved at runtime
- `flow.Step().Input(...)` — late-binding: wire outputs from previous steps as inputs
- `vps.CreateManagedCluster.GetResponse()` — access results from embedded SingleCluster's provision step
- `SingleCluster.Add(...)` — compose the final workflow with dependency declarations + BatchPipe ordering

## Tips

1. **Start with `Nodeless_CRUD` as a template** — it's a clean, complete example in `sigs/rp/nativerp/plans/nodeless_crud.go`
2. **Use `--scenario` flag** to run just your test during development
3. **Add `AlwaysTeardown` mutator** to avoid leaked resources during development
4. **Use the `dev` suite** — it's designed for local development with standalone environments
5. **Check `sigs/owners.go`** for the full list of SIG constants you can use in Metadata
6. **Handlers** (in `test/e2ev3/handlers/`) provide pre-built steps for common Azure operations (create cluster, create agent pool, upgrade, start/stop, etc.)
