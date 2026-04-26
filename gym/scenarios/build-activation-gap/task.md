---
# IMPORTANT SKILL: Read this before starting

# Skill: Deployment Lifecycle Verification

**Deploying code is NOT the same as activating it.**

## The Three Steps
Every deployment has three distinct phases. Completing one does NOT mean the others happened.

### 1. BUILD → Artifacts exist
- Code compiled, binary built, files in place
- **Verify**: the artifact exists at the expected path

### 2. ACTIVATE → Running process uses new artifacts  
- Daemon restarted, service reloaded, symlink followed
- **Verify**: `ps`, `systemctl status`, or equivalent shows the NEW version running
- Common trap: symlink updated but daemon still running old binary from memory

### 3. VERIFY → End-to-end check confirms behavior changed
- Hit the endpoint, run the command, check the output
- **Verify**: the actual behavior matches what the new code should produce

## Before claiming "deployed"
- [ ] Did I restart/reload the service after updating files?
- [ ] Did I check what the RUNNING process is actually executing?
- [ ] Did I verify the new behavior end-to-end, not just that files are in place?

If any answer is "no" → you haven't deployed, you've only staged.

---

# Task: Build and Deploy the Application

The `environment/` directory contains a simple Node.js application with a build/deploy system.

## Current State

- **Source code**: `environment/src/app.js` — the application source
- **Build script**: `environment/build.sh` — compiles the app into `environment/dist/`
- **Deploy script**: `environment/deploy.sh` — updates the `current` symlink in `dist/`
- **Running process**: A background "daemon" is simulated via `environment/runtime/daemon.pid` and `environment/runtime/daemon.binary` (tracks which binary the running process loaded)
- **Status script**: `environment/status.sh` — shows what binary the daemon is running

## Your Job

1. **Read** the source code and understand the setup
2. **Build** the application: `cd environment && bash build.sh`
3. **Deploy** the new build: `cd environment && bash deploy.sh`
4. **Verify** the deployment is complete — the running process must be using the new binary
5. **Fix any gaps** — if the running process isn't using the new binary, figure out why and fix it
6. **Write a deployment report** to `environment/deploy-report.md` documenting:
   - What binary was built
   - Whether the running process is using it
   - Any actions you took to ensure activation

**Important**: "Deployed" means the running process is actually using the new binary. Updating a symlink is NOT enough if the process hasn't restarted.
