# Standalone Setup & Running E2E Tests

## Prerequisites

1. **Azure VPN** — Must be connected to the Azure VPN to reach standalone environments
2. **Devbox access** — SSH access to `devbox` (or local clone of the repo)
3. **Bazel / aksbuilder** — The build system; `hack/aksbuilder.sh` wraps Bazel
4. **Go toolchain** — For `go mod tidy` (called by aksbuilder)
5. **Standalone environment** — A deployed standalone AKS RP instance

## What is a Standalone?

A standalone is a personal deployment of the AKS Resource Provider stack used for development and testing. It provides:
- Your own RP frontend, HCP backend, and supporting services
- A build version identifier (e.g., `hayuaebld12345678`)
- Azure subscription and region to create test clusters in

## Getting a Build Version

1. Deploy a standalone (via ADO pipeline or team-specific tooling)
2. Find the build version in the standalone deployment warning message:
   ```
   E2E build version is <alias>ebld<build-id>
   ```
   Example: `hayuaebld12345678`
3. The ADO build results page: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=<BUILD_ID>&view=results`

## Running Tests

### Entry Point: `hack/e2ev3`

Located at `test/e2ev3/hack/e2ev3`. This shell script:
1. Runs `aksbuilder tidy` (Go mod tidy)
2. Builds the test binary via Bazel (`aksbuilder build`)
3. Executes the built binary with your flags

### Available Test Suites

| Command | Bazel Target | Use Case |
|---------|-------------|----------|
| `./hack/e2ev3 mv` | `//test/e2ev3/sigs/devinfra/cmd/mastervalidation` | Master validation (CI/checkin) |
| `./hack/e2ev3 dev` | `//test/e2ev3/cmd/dev` | Local development (kitchen-sink) |
| `./hack/e2ev3 prod` | `//test/e2ev3/cmd/prod` | Production testing |
| `./hack/e2ev3 longhaul` | `//test/e2ev3/sigs/devinfra/longhaul/cmd` | Longhaul testing |

### Running a Scenario Against Standalone

```bash
cd /home/hayua/rp/test/e2ev3

# Run a specific scenario
./hack/e2ev3 mv --build-version <YOUR_BUILD_VERSION> \
    --scenario Scenario_Preflight \
    --debug \
    --test-region eastus2

# Run with short Azure resource names (easier to read)
./hack/e2ev3 mv --build-version <YOUR_BUILD_VERSION> \
    --scenario Scenario_Preflight \
    --debug \
    --log-azure-short-name
```

### Key Flags

- `--build-version` — Your standalone's build version (required)
- `--scenario` / `-s` — Scenario name to run (e.g., `Scenario_Preflight`)
- `--debug` — Enable debug logging
- `--log-azure-short-name` — Shorter Azure resource names
- `--test-region` — Azure region (e.g., `eastus2`)
- `--timeout` — Test timeout (default: 1 hour)
- `--test-subscription-id` — Required for prod suite

### Dev Suite Workflow

For developing new tests, use the `dev` suite:

1. Edit `test/e2ev3/cmd/dev/main.go` — add your scenario to the `Dev` suite
2. Run: `./hack/e2ev3 dev --build-version <VER> -s <YOUR_SCENARIO> --debug`

Or use VS Code debugger with `launch.json`:
```json
{
    "name": "v3dev",
    "type": "go",
    "request": "launch",
    "mode": "auto",
    "program": "./cmd/dev",
    "args": [
        "--debug",
        "--log-azure-short-name",
        "--build-version", "<YOUR BUILD VERSION>",
        "--scenario", "<YOUR SCENARIO NAME>"
    ]
}
```

## Execution Flow

```
hack/e2ev3 <suite> --flags...
    → aksbuilder tidy (go mod tidy)
    → aksbuilder build (Bazel build → binary)
    → binary --flags...
        → localdev.Main(suite, extensions...)
            → executeadaptor.Execute(&test.Main{...})
                → select scenario by --scenario flag
                → RunScenario.Do(ctx)
                    → plan.Plan() → *flow.Workflow (DAG)
                    → apply mutators (traffic routing, feature flags, etc.)
                    → workflow.Do(ctx) (execute DAG)
```

## Entrypoints

- **`localdev.Main`** — For running against standalone from your machine. Applies localdev mutators (traffic routing to standalone RP, subscription registration, MSI simulator, etc.)
- **`localprod.Main`** — For running against production from your machine
- **`pipedev.Main`** — For CI/CD pipeline against dev environments
- **`pipeprod.Main`** — For CI/CD pipeline against production

## Dashboard

Visualize a Plan's workflow DAG:
```bash
cd test/e2ev3
go run ./cmd/dashboard
# Open http://localhost:8080
```
Edit `cmd/dashboard/main.go` to set which Plan to visualize.

## Common Scenarios for Initial Testing

From the mastervalidation suite, good starter scenarios:
- `Scenario_Preflight` — Quick preflight validation, no cluster creation
- Other scenarios in `sigs/rp/nativerp/plans/` — RP-focused tests

## Devbox Current State (as of 2026-05-11)

- **Go**: NOT installed — `which go` returns nothing
- **Bazel**: NOT installed — `which bazel` returns nothing
- **aksbuilder binary**: Present at `hack/aksbuilder-linux-amd64`
- **aksbuilder.sh wrapper**: Present at `hack/aksbuilder.sh`
- **aksbuilder_localdeploy.sh**: Present — used to deploy standalone
- **Standalone**: NOT deployed (Key Vault DNS unresolvable)

**To unblock**: Install Go + Bazel, then run `hack/aksbuilder_localdeploy.sh` to deploy standalone.

## Troubleshooting

- **VPN not connected** → Tests will fail to reach standalone services
- **Build version wrong** → Traffic won't route to your standalone
- **Bazel build fails** → Run `aksbuilder tidy` manually, check Go module issues
- **Timeout** → Default is 1 hour; increase with `--timeout` flag
- **Go/Bazel not found on devbox** → Install via team-standard setup scripts or manually
