# Standalone RP E2E Reusable Scripts

Scripts for managing AKS clusters in the standalone RP environment on devbox.

## Scripts

| Script | Purpose |
|--------|---------|
| `cleanup-standalone-clusters.sh` | List and delete AKS clusters via `aksdev` CLI |
| `run-e2e-scenario.sh` | Run a single e2ev3 scenario against standalone |
| `check-underlay-capacity.sh` | Check underlay cluster count and HCP capacity |
| `fix-msi-identity.sh` | Fix missing `akse2ehcp-e2e` MSI on devbox VM |

## Environment

- **RP Root**: `/home/hayua/rp` (set `RP_ROOT` to override)
- **aksdev binary**: `$RP_ROOT/bin/aksdev`
- **Config**: `$RP_ROOT/azureconfig.yaml` (set `AZURECONFIG` to override)
- **Build**: `hayuaebld163822451` (set `BUILD_VERSION` for e2e runs)

## Quick Reference

```bash
# Copy scripts to devbox
scp outputs/scripts/*.sh devbox:/home/hayua/rp/

# List clusters
ssh devbox "cd /home/hayua/rp && ./cleanup-standalone-clusters.sh"

# Delete all dangling clusters
ssh devbox "cd /home/hayua/rp && ./cleanup-standalone-clusters.sh --delete"

# Run a scenario
ssh devbox "cd /home/hayua/rp && BUILD_VERSION=hayuaebld163822451 ./run-e2e-scenario.sh Nginx_Disablement"

# Check capacity before running tests
ssh devbox "cd /home/hayua/rp && ./check-underlay-capacity.sh"
```

## Key Facts

- The `aksdev` binary wraps the standalone RP private API (mTLS ingress)
- `aksdev cluster list/delete/delete-batch` are the cluster management commands
- Each underlay supports ~60 HCPs; check capacity before bulk runs
- The `akse2ehcp-e2e` MSI must be on the VM for HCP provisioning to work
