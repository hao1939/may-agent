# Brief: Common Sense Infra — Send() Completion Feedback

## Context
Common Sense item 5.2 notes that `agents.send()` (async delegation) lacks a completion feedback loop. The sender fires the task but never knows when/if it completes. This breaks the "Promise-Deliver-Report" cycle across agents.

## Problem
- Agent A sends task to Agent B via `send()`.
- Agent A proceeds.
- Agent B finishes the task.
- Agent A has no way to know, other than manually checking B's logs or waiting for B to send a message back (which B might forget).

## Proposal
Enhance the `finish()` tool to close the loop on `send()` tasks.

### Mechanism
1. **Task ID**: `send()` returns a distinct Task ID (e.g., `task_123`).
2. **Context Injection**: When Agent B picks up the task (from todo.md), the system (or Agent B) associates the session with `task_123`.
3. **Completion Signal**: When Agent B calls `finish()`, the system checks if the session was linked to a Task ID.
4. **Notification**: If linked, the system writes a notification to Agent A's `workspace/notifications.md` (or similar): "Task task_123 completed by Agent B: [Outcome]".

*Alternative*: For now, just ensuring `finish()` updates a shared "Task Registry" might be enough. But a notification is better.

## Deliverables
1. **Design**: A lightweight "Task Registry" or "Callback" mechanism for `send()`.
2. **Implementation**: Update `send()` to generate IDs, and `finish()` to resolve them.

## Impact
- Closes the async loop.
- Allows Agent A to "fire and forget" but still get a "receipt" later.
- Reduces polling and manual checks.

## Next Steps
- Tech-Lead to design the implementation details.
