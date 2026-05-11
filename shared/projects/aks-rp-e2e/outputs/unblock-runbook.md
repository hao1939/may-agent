# Unblock Runbook: Getting E2E Tests Running

**Status**: All documentation is complete. This runbook covers the concrete steps needed to go from "docs done" to "tests running."

## Prerequisites (Human Actions Required)

### 1. Install Go on Devbox
```bash
# Check current state
go version  # expect: command not found

# Install (adjust version as needed)
wget https://go.dev/dl/go1.22.4.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.4.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc
go version
```

### 2. Install Bazel on Devbox
```bash
# Check current state
bazel version  # expect: command not found

# Install via Bazelisk (recommended)
go install github.com/bazelbuild/bazelisk@latest
sudo ln -s $(go env GOPATH)/bin/bazelisk /usr/local/bin/bazel
bazel version
```

### 3. Deploy Standalone Environment
```bash
cd /home/hayua/rp
# This deploys all standalone infra (AKS cluster, Key Vault, etc.)
hack/aksbuilder_localdeploy.sh
```

### 4. Verify Deployment
```bash
# Run the readiness check
bash /app/agents/shared/projects/aks-rp-e2e/outputs/standalone-readiness-check.sh

# Expected: all 11 checks PASS, 0 FAIL
# Key indicator: Key Vault DNS resolves (was failing before)
```

## First Test Run

Once all checks pass:

```bash
cd /home/hayua/rp

# Get your build version (from latest build or local build)
export BUILD_VERSION=$(cat hack/build_version 2>/dev/null || echo "latest")

# Run a single scenario from the dev suite
test/e2ev3/hack/e2ev3 dev \
  --build-version $BUILD_VERSION \
  --scenario CreateCluster \
  --debug

# Watch logs for:
#   ✓ "plan compiled" — DAG built successfully
#   ✓ "executing step" — test steps running
#   ✗ "key vault" errors — standalone not fully up
```

## After First Successful Run

1. **Explore scenarios**: See `outputs/scenario-catalog.md` for all 632 scenarios across 22 SIGs
2. **Write new tests**: See `outputs/writing-e2e-tests.md` for patterns
3. **Troubleshoot**: See `outputs/troubleshooting.md` for common issues
4. **Quick reference**: See `outputs/e2e-quickref.md` for command cheat sheet

## What to Tell the Agent Next

Once unblocked, provide:
- "Standalone is deployed, run the readiness check and attempt an e2e test"
- Or: "New goal: [describe what you want to test or build]"
