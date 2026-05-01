# Build and Deploy the Application (Workflow)

The `environment/` directory contains a simple Node.js application with a build/deploy system.

This is a two-phase task.

## Phase 1: Build, Deploy, and Verify State (write DEPLOYMENT-STATUS.md BEFORE declaring done)

1. Read the source code and understand the setup
2. Build the application: `cd environment && bash build.sh`
3. Deploy the new build: `cd environment && bash deploy.sh`
4. **VERIFY the running process state**: Run `cd environment && bash status.sh` (or check `runtime/daemon.binary`)
5. Write `environment/DEPLOYMENT-STATUS.md` documenting:
   - What binary was built (the filename in dist/)
   - What the `current` symlink points to
   - What binary the running daemon is ACTUALLY executing (from daemon.binary)
   - Whether there is a GAP between the deployed binary and the running binary
   - If there's a gap, what action is needed to close it

Do NOT write a final deploy-report.md or declare the task complete until DEPLOYMENT-STATUS.md is written.

## Phase 2: Close the Gap and Report

Based on your status check:
1. If the running process is NOT using the new binary, restart it (run `cd environment && bash restart.sh`)
2. Verify again that `daemon.binary` now matches the deployed binary
3. Write `environment/deploy-report.md` documenting:
   - What binary was built
   - Whether the running process is using it (after your fix)
   - Any actions you took to ensure activation

**Important**: "Deployed" means the running process is actually using the new binary. Updating a symlink is NOT enough if the process hasn't restarted.
