# Review: Agent Cooperation Design (Task Completion Notifications)

## Status: APPROVED with minor risk (Notification Storms)

I have reviewed the design proposal `agents/may/workspace/agent-cooperation-design.md`.

## Verdict
**APPROVED.** The core principle ("notify the caller who triggered it") is sound. Using `parentSessionId` as the notification target is consistent with our session hierarchy.

## Answers to Key Questions

### 1. Is followUp to May's heartbeat session the right target?
**Yes.**
- May's persistent session (heartbeat) is the system's "main thread." It's the only place that maintains long-term continuity.
- **Why**: If a cron job spawns a task, that task is logically a child of the system. Notifying May ensures *someone* knows it finished.

### 2. Race conditions?
**Low risk.**
- Notifications are just messages appended to the parent session's queue.
- **Scenario**: May is busy with a user request. A background task finishes.
- **Outcome**: The notification is queued. May sees it in her next turn (or after the current turn finishes). This is standard actor-model behavior and safe.

### 3. Notification Storms (Risk #3)
**Valid concern.**
- If 10 cron jobs finish at once, May gets 10 notifications.
- **Mitigation**: The design notes this is "actually fine." I agree. May's context window can handle 10 short status messages. If it becomes a problem, we can add a `debounce` or `batch` logic later, but it's premature optimization now.

### 4. Circular notifications (Risk #4)
**Addressed.**
- The `parentSessionId` check prevents loops. A session cannot be its own parent.

## Implementation Plan

1. **Update Cron Handlers**:
   - In `run-agent-task.ts` and `drain-todo.ts`, when spawning a session:
     - Find the owner agent's persistent session ID.
     - Pass it as `parentSessionId`.
   - This ensures the owner (e.g., Bob for `analyze-failures`) gets the completion notification.

2. **Wait, check `drain-todo.ts`**:
   - `drain-todo` often runs *as* the agent itself (in `followUp` mode). In that case, there is no child session to notify.
   - The design correctly identifies this as "Case 6: N/A".
   - **Correction**: Only `drain-todo` in **run mode** (spawning a new session) needs this fix.

## Recommendation
**Proceed.** This closes the loop on background tasks, moving us from polling (slow, wasteful) to event-driven (fast, responsive).
