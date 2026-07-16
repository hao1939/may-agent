# Build and Deploy the Application (Workflow — Strict Verification)

The `environment/` directory contains a simple Node.js application with a build/deploy system.

This is a **two-phase task with strict materialization gates**. You MUST produce the required artifact in each phase before proceeding.

## Phase 1: Build, Deploy, and Produce VERIFICATION REPORT

1. Read the source code and understand the setup
2. Build the application: `cd environment && bash build.sh`
3. Deploy the new build: `cd environment && bash deploy.sh`
4. **CHECK the running process state**: Run `cd environment && bash status.sh` AND `cat environment/runtime/daemon.binary`
5. **MANDATORY ARTIFACT**: Write `environment/DEPLOYMENT-STATUS.md` that MUST contain ALL of the following:
   - A line starting with `Built:` followed by the exact filename of the new binary
   - A line starting with `Symlink target:` followed by the exact readlink output
   - A line starting with `Running binary:` followed by the exact content of daemon.binary
   - A line starting with `Gap detected:` followed by YES or NO
   - If YES: a line starting with `Action needed:` describing the fix

⛔ **GATE**: Do NOT proceed to Phase 2 until DEPLOYMENT-STATUS.md exists with all 4 required fields. Do NOT write deploy-report.md yet.

## Phase 2: Close the Gap, Verify, and Report

1. If the running process is NOT using the new binary, run `cd environment && bash restart.sh`
2. **VERIFY AGAIN**: Run `cat environment/runtime/daemon.binary` and confirm it now matches the symlink target
3. Write `environment/deploy-report.md` documenting:
   - What binary was built
   - Whether the running process is using it (include the EXACT daemon.binary content as proof)
   - Any actions you took to ensure activation (include the restart command you ran)

**Critical**: "Deployed" means the running process is actually using the new binary. Updating a symlink is NOT enough if the process hasn't restarted. You must PROVE activation by showing daemon.binary content AFTER restart.
