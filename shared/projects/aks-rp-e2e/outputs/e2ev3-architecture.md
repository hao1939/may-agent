# E2Ev3 Framework Architecture

## Overview

E2Ev3 is the current-generation E2E test framework for the AKS Resource Provider. It lives at `test/e2ev3/` within the Go monorepo at `/home/hayua/rp`. It uses **Bazel** for builds and **`github.com/Azure/go-workflow`** for test orchestration as DAGs.

## Core Type System (`runtime/test/types.go`)

### Plan (interface)
```go
type Plan interface {
    Metadata() Metadata   // description, owner (SIG), tags
    Plan() *flow.Workflow  // DAG of test steps using go-workflow
}
```
A Plan defines **what** a test does: resource setup, test cases, teardown — all as a workflow DAG.

### Scenario (interface)
```go
type Scenario interface {
    ScenarioName() string
    TestPlan() Plan
    Mutators() []Mutator
}
```
A Scenario wraps a Plan with a name and optional mutators. Created via:
```go
var Scenario_Preflight = test.NewScenario("Scenario_Preflight", new(Preflight))
```
`ScenarioBuilder[T Plan]` is the generic concrete implementation. Supports `.Name()`, `.Args()`, `.Mutate()` chaining.

### Suite (interface)
```go
type Suite interface {
    SuiteName() string
    ListScenarios(...func(Scenario) bool) []Scenario
}
```
A Suite is a collection of Scenarios. Examples: `MasterValidation`, `Dev`, `Prod`, `Longhaul`.

### Mutator (interface)
```go
type Mutator interface {
    MutateFor(Scenario) runtime.Extension  // Extension = func(*flow.Workflow) *flow.Workflow
}
```
Mutators are cross-cutting middleware that modify the workflow DAG. Two convenience types:
- `ScenarioMutator` — has access to the Scenario being mutated
- `WorkflowMutator` — directly transforms the Workflow

## Test Lifecycle (RunScenario)

From `runtime/test/run_scenario.go`:

1. **Get Plan** from Scenario via `TestPlan()`
2. **Set timeout** (default 1 hour)
3. **SkipIf** — if Plan implements `SkipIf(ctx) bool`, skip if true
4. **Parse flags** — Plans can register `pflag` flags
5. **Build workflow** — call `plan.Plan()` to get the `*flow.Workflow` DAG
6. **Apply mutators** — each mutator wraps/modifies the workflow
7. **Execute** — `w.Do(ctx)` runs the DAG

## Plan Pattern (Example: Preflight)

From `sigs/rp/nativerp/plans/preflight.go`:

```go
type Preflight struct{}

func (p *Preflight) Metadata() test.Metadata { ... }

func (p *Preflight) Plan() *flow.Workflow {
    w := new(flow.Workflow)
    // Declare handlers (reusable steps)
    createRG := new(azresources.CreateResourceGroup)
    deleteRG := new(azresources.DeleteResourceGroup)
    // Wire them into a DAG
    return w.Add(flow.BatchPipe(
        flow.Steps(plans.StartTestPlan),        // stage marker
        flow.Steps(createRG, resolveKubeVersions, resolveVMSize),
        flow.Steps(validate),                    // sub-workflow of test cases
        flow.Steps(plans.StartTeardown),         // stage marker
        flow.Steps(deleteRG),
    ))
}
```

Key patterns:
- **`flow.BatchPipe`** — sequential batches; steps within a batch run in parallel
- **`flow.Step(handler).Input(fn)`** — wire dependencies between handlers
- **Handlers** implement `Do(ctx) error` and carry state as struct fields
- **Stage markers** (`plans.StartTestPlan`, `plans.StartTeardown`) delimit phases

## Directory Structure

```
test/e2ev3/
├── runtime/              # Core framework
│   ├── test/
│   │   ├── types.go      # Plan, Scenario, Suite, Mutator interfaces
│   │   ├── run_scenario.go  # Execution engine
│   │   ├── main.go       # Main entry (test.Main struct)
│   │   ├── plans/        # Built-in plan helpers (single_cluster, multi_cluster, stage, skip_if)
│   │   ├── suites/       # Suite utilities (runner, static, with_mutators)
│   │   ├── scenarios/    # Scenario utilities (with_mutators, with_name)
│   │   └── mutators/     # Mutator utilities (join)
│   ├── akse2e/           # AKS-specific test context (Azure config, credentials)
│   ├── config/           # Config loading (flags, env, blob)
│   ├── entrypoint/       # Entry points per environment
│   │   ├── localdev/     # For running against standalone (Main function)
│   │   ├── localprod/    # For running against production locally
│   │   ├── pipedev/      # Pipeline dev environment
│   │   └── pipeprod/     # Pipeline production environment
│   ├── runner/           # Lower-level runner context
│   ├── telemetry/        # OpenTelemetry tracing
│   └── flag/             # Flag parsing
├── handlers/             # Shared reusable test step implementations
│   ├── aks/              # AKS internal handlers
│   ├── azure/            # Azure resource handlers (azcontainerservice, azresources, etc.)
│   ├── k8s/              # Kubernetes handlers
│   ├── log/              # Logging handler
│   ├── sku/              # SKU/VM size resolution
│   ├── env/              # Environment decoration
│   └── to/               # Pointer/utility helpers
├── mutate/               # Shared mutators (traffic routing, feature flags, naming, etc.)
├── sigs/                 # SIG-owned test content (24 SIGs)
│   ├── rp/               # SIG RP (nativerp, hcp, virtualmachine, etc.)
│   ├── network/          # SIG Network (swiftv1, swiftv2, acns, datapath, etc.)
│   ├── ccp/              # SIG CCP (coredns, localdns, metricsserver, etc.)
│   ├── node/             # SIG Node (azurelinux, nativenode, httpproxy)
│   ├── traffic/          # SIG Traffic (apiproxy, approuting, istio, etc.)
│   ├── windows/          # SIG Windows
│   ├── security/         # SIG Security
│   ├── devinfra/         # SIG DevInfra (owns mastervalidation suite)
│   └── ...               # airlock, autoscale, dataplane, dplat, gpu, etc.
├── suites/               # Cross-SIG test suites
│   ├── checkin/          # Checkin pipeline suites (mastervalidation, arm64sku, etc.)
│   └── autoreversion/
├── cmd/                  # Binary entrypoints
│   ├── dev/main.go       # Dev suite (kitchen-sink, uses localdev.Main)
│   └── prod/             # Prod suite
├── hack/e2ev3            # Shell entrypoint script (builds via Bazel, runs binary)
├── runner/               # Runner config/generation utilities
├── validate/             # Validation helpers (agent pool, etc.)
├── options/              # Test option types
└── spec/                 # Spec files (non-Go)
```

## SIGs (24 directories under `sigs/`)

acccvm, airlock, arm64, autoscale, ccp, consts, dataplane, devinfra, dplat, fqdnpolicy, gpu, industry, managementplane, network, node, rp, runtime, secops, security, serverless, speculor, traffic, windows, workload

Each SIG typically has: `plans/`, `handlers/`, `suites/`, `cmd/`, `pipelines/`

## Handlers

Handlers are Go structs implementing `Do(ctx context.Context) error`. They:
- Accept input via struct fields (set by `flow.Step(h).Input(fn)`)
- Expose output via exported fields (read by downstream steps)
- Common handlers: `CreateResourceGroup`, `DeleteResourceGroup`, `CreateManagedCluster`, `ResolveKubeVersions`, `ClaimVMSize`

## Mutators (localdev defaults)

When running locally via `localdev.Main`, these mutators are automatically applied:
- `HackTrafficToRPIngressInE2E` — routes traffic to standalone RP ingress
- `RegisterSubscriptionAndDefaultFeatures` — registers sub with feature flags
- `AddPreflightForPutManagedCluster` — adds preflight validation
- `RandomResourceNameWithBuildVersion` — unique resource naming
- `TagTestEnvToResources` — tags resources with test environment info
- `SetMsiSimulatorHeaders` / `SetSharedIdentity` — identity setup
- `EnableAKSFeaturesDeclaredByTestPlan` — enables features from plan metadata
- `SpecifyAKSAPIVersionDeclaredByTestPlan` — sets API version
- `PrintWorkflowSteps` — logs workflow step execution
- `CollectNodeLogsForFailedTest` — collects node logs on failure
- `DontPanic` — panic recovery

## go-workflow Library

The framework uses `github.com/Azure/go-workflow` for DAG-based test orchestration:
- `flow.Workflow` — the DAG container
- `flow.Step(handler)` — wraps a handler as a workflow step
- `flow.BatchPipe(batches...)` — sequential batches of parallel steps
- `flow.Steps(s1, s2)` — group steps into a batch
- Steps within a batch run in parallel; batches run sequentially
