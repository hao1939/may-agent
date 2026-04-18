# Launcher Design Review

## 1. Correctness Assessment

The design is **structurally sound** and a significant improvement over the current Bash-based loops. It aligns well with **P10 (Crash Recovery as First-Class Concern)** and **P14 (Deterministic Guardrails)**.

### Strengths
- **Unification:** Replaces fragmented restart logic (Docker loop vs. script loop) with a single source of truth.
- **Backoff Logic:** The exponential backoff with jitter is correctly designed to prevent "thundering herd" restarts on persistent failures.
- **Signal Forwarding:** The signal propagation strategy (`SIGTERM` -> `child.kill` -> wait for exit) is the correct pattern for wrapper processes.

### Logical Flaws & Risks

1. **The "Non-Zero" Ambiguity (Conflating Crash vs. Reload)**
   - **Current Proposal:** "Child shuts down with a non-zero exit code... Launcher sees non-zero, respawns."
   - **Risk:** This conflates an *intentional hot-reload* with a *crash*.
   - **Impact:**
     1. The launcher will apply backoff (2s+) to a hot-reload, making the developer wait unnecessarily during iteration.
     2. Logs will look like failures ("Process exited with code 1") when it was a successful update.
   - **Correction:** Distinguish intentional restart from crash.

2. **Zombie Process Risk (Docker PID 1)**
   - **Context:** The proposal states `launcher.ts` will be PID 1 in Docker.
   - **Risk:** Node.js processes as PID 1 do not default to reaping zombie processes (orphaned grandchildren). If `may.ts` spawns a grandchild (e.g., a detached exec) and `may.ts` restarts, the grandchild becomes a zombie attached to the launcher. Over time, this leaks resources.
   - **Correction:** Use `tini` in Docker or explicit `waitpid` logic, though `tini` is simpler (P1).

## 2. Gap Analysis

### Missing: "Restart Immediately" Signal
The design lacks a mechanism to bypass backoff for intentional reloads. When I run a command to update code, I want the agent back *now*, not in 2-4 seconds.

### Missing: Timeout on Shutdown
The code sketch sends `SIGTERM` and waits indefinitely.
- **Scenario:** `may.ts` hangs in a cleanup loop or ignores SIGTERM.
- **Result:** The launcher (and Docker container) hangs forever until the OS/Docker Daemon force-kills it.
- **Fix:** Launcher should wait e.g., 5 seconds after `SIGTERM`, then send `SIGKILL` if the child is still alive.

### Underspecified: `npx` Overhead
Spawning `npx tsx` adds a layer of package resolution startup time to every loop.
- **Fix:** Resolve the path to `tsx` once or use `process.execPath` (node) with the loader argument to shave startup time.

## 3. Implementation Recommendation

**Do not implement as-is.** Adopt these three changes to separate "Crash" from "Reload".

### A. Protocol: Use Specific Exit Codes
Define strict exit codes for `may.ts`:
- **0**: Stop (User requested shutdown). Launcher exits.
- **1 (or generic non-zero)**: Crash/Error. Launcher restarts with **backoff**.
- **100 (Custom)**: Intentional Restart (Hot-reload). Launcher restarts **immediately** (reset backoff).

### B. Updated Code Logic
Refined `child.on('exit')` logic:

```typescript
child.on("exit", (code) => {
  child = null;
  
  // Case 1: Intentional Stop
  if (shuttingDown || code === 0) {
    process.exit(0);
  }

  // Case 2: Intentional Hot-Reload (New)
  if (code === 100) {
    console.log("[launcher] Hot-reload requested. Restarting immediately.");
    backoffMs = 2000; // Reset backoff
    spawnChild();
    return;
  }

  // Case 3: Crash
  // ... existing backoff logic ...
});
```

### C. Docker Integration
Don't rely on the launcher to be a perfect init system.
- **Change:** In `Dockerfile`, use `tini` as the entrypoint if possible, or ensure the launcher is strictly managing only `may.ts`.
- **Recommendation:** `ENTRYPOINT ["/sbin/tini", "--", "npx", "tsx", "run/launcher.ts"]` ensures zombies are reaped, allowing the launcher to stay simple (P1).

### D. Socket Command Update
The socket handler in `may.ts` must be updated to support the new protocol:
- Current: `process.exit(1)` (implied by proposal)
- Required: `process.exit(100)`
