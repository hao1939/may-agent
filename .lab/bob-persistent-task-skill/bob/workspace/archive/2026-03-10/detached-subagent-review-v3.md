# Design Review: Detached Sub-Agents (v3)

## Verdict: ✅ READY FOR IMPLEMENTATION

This v3 design is the correct level of simplification. It aligns perfectly with the "Manager Owns Delivery" philosophy and leverages the newly implemented notification system to remove the need for complex socket coordination in Phase 1.

## Philosophy Check

### Aligned ✅

*   **P1 Simplest Thing That Works:** Removing socket-based `waitFor` and status checks in favor of shared disk (registry/session.jsonl) cuts 80% of the complexity. We don't need a request/response protocol for data that is already sitting on the disk.
*   **P10 Crash Recovery:** The "detached = survives restart" definition is satisfied. The notification mechanism (file fallback) is inherently crash-proof and works across process boundaries without a daemon.
*   **P15 Minimal Viable:** The implementation plan (~50 lines) is realistic and focused. It avoids over-engineering "steer" capabilities that we don't need yet.
*   **P40 Infra Owns Plumbing:** The agent just sets `mode="detached"`. The manager handles the process spawning, PID tracking, and notification routing.

## Technical Review

### 1. Notification Bridge (Sound)
The reliance on `task-completion-notifications.md` is the key enabler here.
*   **Mechanism:** Detached process finishes -> Manager can't find parent in RAM -> Writes to `undelivered-notifications.jsonl` -> Parent `fs.watch` picks it up.
*   **Assessment:** This transforms "cross-process communication" into "file I/O", which is exactly how our system prefers to work (P11 File System as Memory). It is robust and simple.

### 2. Process Lifecycle (Sound)
*   **Spawn:** Standard `child_process.spawn` with `detached: true`.
*   **Cancel:** `process.kill(SIGTERM)` is the correct coarse-grained control.
*   **Observation:** Polling the registry is acceptable for v1.

### 3. Critical Gap: Logging (⚠️ ACTION REQUIRED)
The design specifies `stdio: "ignore"`.
*   **Risk:** If the detached process fails to start (e.g., bad import, syntax error, OOM) or crashes before the agent logger initializes, it will fail silently (P6 violation). We will have a PID but no agent execution and no error message.
*   **Fix:** Do not use `ignore`. Redirect stdout/stderr to a log file in `.state/logs/detached-{sessionId}.log`. This provides a flight recorder for "launch failures."

### 4. Minor Risk: PID Reuse
*   **Risk:** If a detached agent finishes/dies and the OS recycles the PID, `subagents.cancel(sessionId)` might kill an innocent process.
*   **Mitigation (Future):** Not a blocker for v1, but we should eventually store `startTime` alongside PID and check `process.uptime()` or start time before killing. For now, the risk is acceptable.

## Implementation Recommendations

1.  **Modify Phase 1 Step 1 (Spawn):**
    Change `stdio: "ignore"` to:
    ```typescript
    const logFd = fs.openSync(path.join(projectRoot, '.state/logs', `detached-${sessionId}.log`), 'a');
    // ...
    stdio: ['ignore', logFd, logFd]
    ```
    This ensures we can debug startup crashes.

2.  **Environment Variables:**
    Ensure `run/may.ts` explicitly reads `process.env.PARENT_SESSION_ID` and passes it to the `Manager` constructor or initialization, so the manager knows who to address the notification to.

## Conclusion

This is a solid, minimal design. It solves the core problem (long-running tasks, cron jobs) without introducing a fragile new control plane. Proceed with Phase 1.
