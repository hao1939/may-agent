# Design: Send() Feedback Mechanism (Common Sense 5.2)

**Problem**: `agents.send(target, msg)` is currently fire-and-forget. The sender has no way to know:
1. Did the target receive it? (Delivery)
2. Did the target accept/process it? (Ack)
3. Did the target complete it? (Resolution)

This violates **Common Sense 5.2 (Use the right channel)** because without feedback, agents blindly trust `send()`, leading to "silent failure" loops where tasks disappear into the void.

## Proposed Mechanism: `SIGNALS.md` Receipts

We already use `SIGNALS.md` for handoffs. We should extend it (or a similar mechanism) for `send()` todos.

### 1. Delivery Receipt (System-Level)
When `agents.send("may", "do X")` is called:
- The system currently writes to `agents/may/workspace/todo.md`.
- **Change**: The system should ALSO write a receipt line to `agents/shared/SIGNALS.md` (or a new `MESSAGES.log`).
- **Format**: `[SEND] [timestamp] [sender] -> [target]: [message-hash] [status: DELIVERED]`

### 2. Acknowledgment (Agent-Level)
When the target agent wakes up and processes the todo:
- It currently just deletes the line from `todo.md`.
- **Change**: The target should update the receipt to `[PROCESSING]`.

### 3. Closure (Notification)
When the task is done:
- The target can `agents.send(sender, "Task X complete")` (manual closure).
- **Better**: The system automatically generates a "Completion Receipt" if the todo was linked to a specific ID.

### The "ID" Problem
`send()` currently takes just a string. It returns nothing.
- **Fix**: `send()` should return a `messageId` (UUID).
- The sender can then check `agents.peek_status(messageId)` (new tool feature).

## Recommendation for Infra (Tech-Lead)

1. **Update `agents.send()` signature**: Return a `messageId`.
2. **Log sends**: In `agents.ts`, log every send to `.state/messages.jsonl` with status `PENDING`.
3. **Expose status**: Create a `check_message(messageId)` tool for agents to poll status.
    - If message is still in target's `todo.md` → `PENDING`
    - If message is gone from `todo.md` → `PROCESSED` (Basic inference)

### Low-Tech MVP (No code change)
Standardize the *message format* to include a tracking ID.
Sender: `agents.send("may", "[TRACK-123] Review brief...")`
Receiver: When done, `agents.send("bob", "[TRACK-123] Done")`

This puts the burden on agents (Behavioral). We want Infra.

### Infra Brief
request: "Make `send()` return a tracking ID and expose a status check."
rationale: "Closes the open loop of async delegation."

## Next Steps
Brief Tech-Lead to implement `send()` return value and logging.
