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


---

# Second-Look Verification Skill

## When to Use
Before calling `finish()` on ANY task, pause and run through this checklist.

## Pre-Completion Checklist (MANDATORY)

**Do NOT call finish() until you've answered all 4 questions:**

### 1. Existing Data & State
> Does my change affect data, files, or state that existed BEFORE my changes?

- If you modified a data format: **check existing persisted data** still works with the new code
- If you changed an API: **test with existing callers**, not just new ones
- Run the app/tests against REAL existing data, not just new test cases

### 2. Untested Code Paths  
> Are there code paths that interact with my changes but the tests DON'T cover?

- **Read the source code** (not just tests) to find functions that use what you changed
- If you find untested paths, trace them manually or write a quick verification
- Tests passing ≠ everything works. Tests only cover what someone thought to test.

### 3. Verify Stated Assumptions
> What did the task description or context TELL me was true? Have I confirmed it?

- If context says "X is already done" → **check the filesystem/code** to verify
- If a summary file says "the cause was Y" → **read the raw evidence** (logs, source)
- Never trust documentation or context over actual system state

### 4. Live Activation Check
> If I deployed or changed something, is the RUNNING system actually using my changes?

- Built + deployed ≠ activated. Check the running process.
- Symlink updated ≠ daemon restarted. Verify end-to-end.
- Config changed ≠ service reloaded. Confirm the change took effect.

## After the Checklist
If ANY question reveals a gap, **investigate and fix before finishing**. Then re-run the checklist.
