# Brief: Send Receipt Mechanism (Common Sense Infra)

**Target:** Tech-Lead
**Context:** `agents/shared/common-sense.md` (Infra Gap)

## The Problem
`agents.send(target, msg)` is a "fire-and-forget" operation. The sender gets no signal when the task is done.
- **Symptom:** Agents send tasks and then just wait, or repeatedly poll `peek()`, or assume it's done and fail later.
- **Common Sense Violation:** "Did you get that?" is basic coordination.

## The Proposal: Automatic Receipts
When an agent finishes a task that was triggered by a `send()` (i.e., it was a todo item), the system should automatically generate a "Receipt" notification back to the sender.

### Mechanism
1.  **Tracking:** `manager` already tracks `delegatedBy` in the session metadata.
2.  **Trigger:** When the target agent calls `finish()`:
    - Check if `session.delegatedBy` exists.
    - If yes, write a notification to the sender's `todo.md` (e.g., `[RECEIPT] Task '...' completed by [agent] with status [success/failure]. Summary: ...`).
3.  **Payload:** The receipt should contain:
    - Status (Success/Fail)
    - Link to the deliverable (if any)
    - One-line summary

## Implementation
- Modify `agents/shared/skills/finish.ts` (or the underlying handler) to look up the parent session and append to its todo.
- **No new tool needed:** The `finish()` tool logic should handle this as a side effect.

## Success Metric
- Agents stop polling `peek()` for delegated tasks.
- Agents receive a "Push" notification when their sub-tasks are done.
