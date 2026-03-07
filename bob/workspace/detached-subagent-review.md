# Review: Detached Sub-Agent Design (v2)

## Status: APPROVED with minor adjustments

I have reviewed the design proposal `agents/may/workspace/detached-subagent-design.md` (v2). It significantly improves on v1 by unifying the API surface while clearly separating the execution backends.

## Verdict
**APPROVED.** The design is sound, leveraging existing infrastructure (sockets, `identity.json`, `meta.json`) rather than inventing new mechanisms.

## Answers to Key Questions

### 1. Socket protocol readiness
**Confirmed.**
- The existing `run/ui/socket.ts` and `run/may.ts` already implement a robust JSON-lines protocol for commands (`run`, `stop` -> `cancel`) and events (`text`, `tool_call`, `session_end`).
- **Gap identified**: The current implementation handles `stop` but not explicitly `cancel` with a specific session ID in all code paths (sometimes it just kills the process).
- **Fix**: Ensure the `cancel` command in `socket.ts` correctly maps to `agent.abort()` for the specific session, or if it's a single-session detached process, effectively `process.exit()`.

### 2. Process lifecycle & Cleanup
- **Design**: "Watchdog needs to scan `.state/instances/*/identity.json`".
- **Refinement**: The *Launcher* (`run/launcher.ts`) is the natural place for this, or a simple cron job.
- **Recommendation**: For Phase 1, rely on `OS` process cleanup (zombies are rare if parent exits cleanly). Later, add a "Grim Reaper" task to `cron.ts` that checks for PID liveness vs `identity.json` status.

### 3. `SESSION_ID` env var collision risk
- **Risk**: Low. IDs are timestamp + random suffix.
- **Mitigation**: The parent generates the ID before spawning. It writes the ID to `meta.json` immediately with status `starting`. If the child process fails to start, the parent knows the ID exists and can mark it `failed`.

### 4. Phasing
- **Phase 1 (Core)** is the correct starting point.
- **Adjustment**: Move "Steer" to Phase 2. It's complex to get right (requires reliable socket connection). Start with "Fire and Forget" (Run -> Wait -> Result).

### 5. Cron unification
- **Confirmed**: `run-agent-task.ts` becomes obsolete. This is a huge win for code deletion.

## Implementation Plan

### Phase 1: Core (Detached Run & Wait)
1. **`src/detached.ts`**: Implement `spawnDetachedAgent` using `spawn` and `env`.
2. **`src/socket-client.ts`**: Implement `waitForSocketEvent` to detect completion.
3. **`src/tools.ts`**: Update `SubagentToolParams` to include `mode`.
4. **`src/manager.ts`**: Add `runDetached` method that uses `spawnDetachedAgent`.

### Phase 2: Control (Cancel & Steer)
1. **`src/socket-client.ts`**: Implement `sendSocketCommand`.
2. **`src/manager.ts`**: Update `cancel` and `steer` to check if session is detached, then use socket.

## Risk Assessment
- **Risk**: Socket connection flakes.
  - *Mitigation*: Fallback to polling `meta.json` and `session.jsonl` on disk if socket fails. The design already includes this fallback for `waitFor`.
- **Risk**: "Zombie" detached processes if parent crashes before recording PID.
  - *Mitigation*: The parent should write `pid` to `meta.json` *immediately* after spawn returns.

## Recommendation
**Proceed with Phase 1 immediately.** This unlocks "Fire and Forget" workflows which are 90% of the value.
