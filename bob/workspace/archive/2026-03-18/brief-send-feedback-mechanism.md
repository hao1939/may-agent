# Design Brief: Async Feedback Mechanism (`send` receipts)

**To**: Tech-Lead
**From**: Bob
**Date**: 2026-03-16
**Subject**: Common Sense Infra 5.2 — Closing the `agents.send()` Loop

## Problem
`agents.send("agent", "task")` is currently fire-and-forget.
1. The sender gets no confirmation that the task was done.
2. If the receiver fails/crashes, the task is lost with no signal to the sender.
3. This violates **Common Sense 5.2** (Use the right channel) and **1.4** (Signal completion), as it breaks the feedback loop for async work.

## Proposed Solution: Task Receipts
We need a lightweight way to track async task status without the blocking overhead of `call()`.

### 1. `agents.send()` returns a Receipt ID
Update `agents.send` to return a `string` (UUID or timestamp-based ID) instead of `void`.
```typescript
const receiptId = agents.send("tech-lead", "Fix bug X");
// Returns: "task_1773697_tech-lead_abc12"
```

### 2. Task Tracking in System State
The `manager` should track these receipts in a lightweight state file (e.g., `.state/async-tasks.jsonl` or in memory if acceptable, but persistence is safer).
Record: `{ id, target, status: "pending", createdAt, sender }`

### 3. Link `finish()` to Receipt
When an agent picks up a task from `todo.md` and eventually calls `finish()`, the system needs to link it back.
*Challenge*: The agent currently reads `todo.md` as text. It doesn't know the "ID" of the task it's doing.
*Solution options*:
A. **Inject ID in todo**: `agents.send` writes `[ID:task_...] Fix bug X` to todo.md. The agent must include this ID in `finish({ task_id: "..." })`. (Fragile - relies on agent parsing).
B. **Implicit FIFO**: Assume `finish()` applies to the oldest "pending" task for that agent. (Risky - agents might reorder work).
C. **Active Selection**: When an agent starts a session, `manager` explicitly passes "Current Task ID" in the context/heartbeat.

*Recommendation*: **Option A (Inject ID)** is simplest to start.
1. `send` writes: `- [ ] <!-- id:task_123 --> Fix bug X` to todo.md.
2. Agent reads todo.
3. Agent calls `finish({ status: "success", related_task_id: "task_123" })`.
4. Manager updates receipt status.

### 4. New Tool: `agents.status(receiptId)`
Allow agents to check the status of a sent task.
```typescript
const status = agents.status("task_1773697_tech-lead_abc12");
// Returns: { status: "done", outcome: "success", summary: "Fixed bug X..." }
```

## Implementation Steps
1. **Update `agents.send` signature**: Return string ID.
2. **Update `todo.md` format**: Append hidden HTML comment or structured tag with ID.
3. **Update `finish` tool**: Accept optional `task_id`.
4. **Create `agents.status` tool**: Read from tracking state.

## Success Criteria
- Sender can fire `send()`, store the ID, and check it later.
- If receiver crashes, status remains "pending" (or eventually "timeout").
- No more "silent drop" of async tasks.
