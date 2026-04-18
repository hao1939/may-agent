# Crash Recovery Design (V2)

## Problem
In the original design, session state was in-memory. If the process crashed:
1. `activeSessions` map was lost.
2. The session status in `registry.json` remained "running" forever.
3. Upon restart, the system had no idea what was running or how to resume.
4. Agents would "amnesia" — forgetting they were in the middle of a task.

## Solution: Sentinel Files & JSONL Rehydration

### 1. Sentinel Files (`[STARTED]`)
When a session starts, we write a zero-byte file:
`.state/sessions/<sessionId>/[STARTED]`

When a session finishes (success or error), we delete it.

**On Restart:**
The manager scans `.state/sessions/*/`.
- If `[STARTED]` exists: The session was running when the process died.
- **Action:** Mark as "interrupted" (or attempt resume).
- **Cleanup:** Delete `[STARTED]`.

### 2. Workflow State (`.state/workflows/`)
Workflows are multi-step processes (e.g., Coder -> QA).
Each workflow run has a JSON file: `.state/workflows/<runId>.json`.
Status: `running` | `completed` | `failed`.

**On Restart:**
The manager scans `.state/workflows/`.
- If status is `running`: The workflow died mid-execution.
- **Action:** Mark as `interrupted`.

### 3. V2 Architecture (Ephemeral Processes)
In V2, we are moving to **ephemeral sessions**.
Each task runs in its own process (or at least its own robust async context).
This makes recovery easier:
- **Task Session**: If the process dies, the parent (Runner) sees the exit code.
- **Runner**: If the Runner dies, the OS restarts it. The Runner checks for orphaned `[STARTED]` files.

### 4. Implementation Details (Current)
I have implemented the sentinel mechanism in `src/lib/manager.ts`:
- `run()`: Writes `[STARTED]`.
- `handleCompletion()`: Deletes `[STARTED]`.
- `resumeStaleSessions()`: Scans for orphans.

### 5. Verification
I created `test/crash-recovery.test.ts` which simulates a "crash" (process exit without cleanup) and verifies that the next run detects and updates the status.

## Future: Resume Capability
Currently, we mark crashed sessions as `interrupted`.
In the future, we can **resume** them by:
1. Re-reading `session.jsonl` (the conversation history).
2. Re-hydrating the `Agent` object with those messages.
3. Appending a system message: "You were interrupted. Please continue."
4. Calling `agent.run()`.

This is enabled by the `resumeSession` method in `src/lib/manager.ts`.
