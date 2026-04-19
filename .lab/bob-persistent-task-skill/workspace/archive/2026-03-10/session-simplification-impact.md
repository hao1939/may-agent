# Session Simplification: Impact Analysis

## Context
We are simplifying the session model from a complex 3-type system (Chat/Heartbeat/Task) to a binary model:
1. **Chat Session** (`persistent: true`): Long-lived, interactive, maintains "User Intent".
2. **Task Session** (`persistent: false`): Ephemeral, single-purpose unit of work.

## Impact on System Design

### 1. Philosophy Alignment (P15 Agent as Feature Unit)
- **Before**: "Heartbeat Session" was a weird hybrid — persistent but not chat.
- **After**: Heartbeat is just a Task Session triggered by a timer. It wakes up, does work, and dies.
- **Verdict**: **Strong Alignment**. The "Unit of Work" is now clearly defined as "A Task Session".

### 2. Operational Impact
- **Zombie Process Elimination**: The old Heartbeat sessions would sometimes hang or accumulate state. New ephemeral sessions guarantee a fresh start every time.
- **State Management**: Chat session holds the *context*. Task session holds the *work*. Clear separation.

### 3. Developer Experience
- **Simpler Debugging**: If a task fails, you replay the exact command that spawned it. No hidden state from 3 hours ago.
- **Clearer Logs**: Logs are scoped to "Task ID", not "Infinite Stream of Consciousness".

## Risks & Mitigations

### Risk 1: Context Loss
- **Scenario**: A complex multi-step task (e.g., "Refactor module X") used to run in a persistent session. Now it runs as a chain of ephemeral tasks.
- **Mitigation**: Use the **Workspace** (`implementation-plan.md`) to persist state between tasks. (P11 File System as Memory).

### Risk 2: Performance Overhead
- **Scenario**: Spawning a new process for every heartbeat (every 10m) adds startup cost.
- **Mitigation**: Node.js startup is fast (<100ms). The overhead is negligible compared to LLM latency.

### Risk 3: "Chat" becoming a Monolith
- **Scenario**: Because Chat is the only persistent session, users might dump everything into it.
- **Mitigation**: Enforce **Delegation**. Chat (May) should do almost no work itself — it should immediately spawn Task Sessions (Coder, Tech Lead) for any request > 1 turn.

## Conclusion
The simplification is a net positive. It aligns with our "Crash Recovery" (P10) and "File System as Memory" (P11) principles by forcing state out of memory and onto disk.

**Recommendation**: Proceed with full implementation. Update `system-design.md` immediately to reflect this change (done).
