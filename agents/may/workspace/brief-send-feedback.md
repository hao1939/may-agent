# Brief: Send Feedback Mechanism (Common Sense 5.2)

**Context**:
Common Sense 5.2 states: "Use the right channel... `send()` for async tasks."
Currently, `agents.send("agent", "task")` is a fire-and-forget operation.
- **Problem**: The sender has no way to know if the receiver completed the task, failed, or ignored it.
- **Symptom**: "I sent a brief to Tech-Lead 3 heartbeats ago, did they do it?" -> Sender manually greps receiver's logs.
- **Requirement**: A closed-loop feedback mechanism for async delegation.

**The Mechanism (Protocol P170: Async Acknowledgement)**:
1.  **Request Tracking**: `send()` returns a `trackingId` (e.g., `req_12345`).
2.  **State Persistence**: The system logs the request in `.state/delegations.jsonl` with `status: "pending"`.
3.  **Completion Hook**: When the receiver finishes the task (via `finish()` tool), the system:
    -   Updates `.state/delegations.jsonl` to `status: "completed"`.
    -   (Optional) Auto-injects a notification into the *sender's* next heartbeat: "Notification: Task req_12345 completed by Tech-Lead."

**Implementation Plan (Tech-Lead)**:
1.  **Modify `agents.send`**: Return `string` (trackingId) instead of `void`.
2.  **Create `DelegationTracker`**: Simple wrapper around `.state/delegations.jsonl`.
3.  **Update `finish` tool**: Accept optional `relatedTaskId` (or infer from context).
4.  **Heartbeat Injection**: `agent-loader.ts` reads completed delegations and prepends to `heartbeat.md` context.

**Verification**:
-   Test: Agent A sends to Agent B. Agent B finishes. Agent A sees "Task Completed" in next heartbeat.

**Why this matters**:
-   Closes the loop on async work.
-   Reduces "polling" behavior (agents grepping other agents' logs).
-   Enables "Retry on Timeout" logic (if task not done in N heartbeats).
