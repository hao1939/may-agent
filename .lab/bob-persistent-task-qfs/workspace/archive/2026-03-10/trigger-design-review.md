# Design Review: On-Demand Task Triggering

## Summary
**Verdict: Conditional Approval (Requires Revision)**

The proposed design correctly identifies the need for immediate, detached task execution that survives process restarts. However, the implementation details are confused between two different execution models (spawn vs. socket), and the reliance on `cron-task.sh` introduces unnecessary fragility.

Hao's key question is spot on: `cron-task.sh` is anachronistic debt. We are a Node.js agent system; we should not be shelling out to bash+python+socat to talk to a Unix socket we created in Node.js.

## 1. The Two "Trigger" Models are Conflated

The design doc confuses two fundamentally different ways to "trigger" work:

### Model A: Spawn a New Process (The `cron.ts` way)
- **Mechanism**: `spawn("bash", ["may.sh", "task", ...])`
- **Isolation**: High. New OS process.
- **Persistence**: High. Survives parent restart (detached).
- **Concurrency**: Parallel by default (OS managed).
- **Use Case**: Long-running, heavy, or risky tasks that shouldn't crash the main agent.

### Model B: Talk to Existing Agent (The `cron-task.sh` way)
- **Mechanism**: Connect to `.state/may.sock` -> send `{"type":"run"}`
- **Isolation**: None. Runs inside the existing agent process (as a sub-agent session or parallel session).
- **Persistence**: Low. If the main agent process dies, this session dies.
- **Concurrency**: Limited by the runtime's ability to handle parallel sessions.
- **Use Case**: Quick tasks, lightweight control, steering.

**Critique**: The design proposes "Method 2 (Cron Implementation)" which uses Model A (spawn), but then discusses `cron-task.sh` which uses Model B (socket). 

**Decision**: The requirement is "survives process restarts". **Only Model A (Spawn) satisfies this.** Model B is just `subagents.run()` with extra steps. If the main process dies, the socket connection dies, and the task dies.

## 2. The `cron-task.sh` Anachronism

Hao is right. `cron-task.sh` exists because it was easier to write `socat | python` in 5 minutes than to write a standalone JS client. But it introduces:
- **Dependencies**: `socat` (must be installed), `python3` (for JSON escaping).
- ** fragility**: Shell quoting issues are inevitable.
- **Opacity**: Harder to debug or log from within the Node app.

**Fix**: Delete `cron-task.sh`. Replace it with a 20-line TS utility function `triggerSocketTask(socketPath, payload)` that uses `net.createConnection`.

## 3. The `may.sh` Container Issue

The design notes: "`may.sh` doesn't exist in the container".
- **Fact**: `cron.ts` currently tries to spawn `resolve(projectRoot, "may.sh")`.
- **Risk**: If we use the "Spawn" model inside a container where `may.sh` is missing, it will fail.
- **Solution**: The trigger logic must detect the environment.
  - If `may.sh` exists: use it.
  - If not (container): use `node --loader ts-node/esm run/launcher.ts task ...` directly.
  - Better: Standardize on one entry point that works everywhere.

## 4. Proposed Revisions

### A. The "Trigger" Tool Action
The tool `cron.trigger` should **Spawn a New Process** (Model A).
- It should NOT try to talk to an existing socket.
- It creates a new detached process.
- It returns the *new* process's job ID.

### B. Implementation Details
1. **Refactor `cron.ts`**: Extract the spawn logic into a `TaskSpawner` class.
   - `spawnTask(agent, task, opts)`
   - Handles the `may.sh` vs `node` entry point logic.
   - Handles detachment and timeout.
2. **Remove `cron-task.sh`**: If we ever need to trigger via socket, do it in TS.
3. **Tracking**: The "socket path" returned by the trigger should be the *new* process's socket, not the main agent's socket.
   - **Crucial**: Each spawned task needs its own unique socket path (e.g., `.state/tasks/job-123.sock`), otherwise multiple tasks collide on `default.sock`.

### C. Answers to Open Questions
1. **Naming**: `adhoc-<agent>-<timestamp>` is fine.
2. **Overlap**: Allow parallel. The user explicitly asked for a trigger; don't block it because another is running.
3. **Timeout**: Default 10m is safe. Allow override.
4. **`may.sh`**: See above. Use direct `node` command if script missing.
5. **Socket Path**: The spawned process must accept a `--socket` arg to listen on a specific path. Currently, `launcher.ts` might default to `default.sock`. This needs a code change to support unique sockets per adhoc job.

## Recommendation

1. **Approve** the intent (On-Demand Triggers).
2. **Reject** the reliance on `cron-task.sh`.
3. **Require** the implementation to use Node.js `net` module for socket comms if needed, but primarily use **process spawning** for the actual trigger mechanism.
4. **Require** `launcher.ts` / `may.ts` update to support custom socket paths for adhoc jobs.

---

### Actionable Next Steps for Developer

1. **Delete `cron-task.sh`**.
2. **Create `run/cli/trigger-task.ts`** (or similar lib function) that replaces the bash script using `net.createConnection`.
3. **Update `cron.ts`** to expose `triggerTask` which spawns a fresh process.
4. **Update `may.ts`** to accept a `--socket <path>` argument so adhoc jobs don't clash on the default socket.
