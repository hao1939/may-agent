# Infrastructure Brief: Async Task Tracking (Fixing `send()` Black Hole)

**Problem**: The `agents.send()` tool is "fire-and-forget". The sender has no way to know if/when the task was completed, other than grepping logs. This violates **Common Sense 1.4 (Signal Completion)** and **1.5 (Escalation)**.

**Solution**: Transform `send()` from a "text appender" into a "Task Lifecycle Manager".

## 1. The Task Ledger (`.state/tasks.jsonl`)
Every `send()` call creates a structured record:
```json
{
  "id": "task_12345",
  "sender": "bob",
  "target": "may",
  "content": "Update philosophy.md",
  "status": "pending", // pending, in_progress, done, blocked, failed
  "created_at": "...",
  "updated_at": "..."
}
```

## 2. Updated `send()` Tool
*   **Input**: `agent`, `message`
*   **Action**: 
    1. Generates `taskId`.
    2. Appends to `.state/tasks.jsonl`.
    3. Writes to target's `todo.md` WITH the `taskId` (e.g., `[task_12345] Update philosophy.md`).
*   **Output**: "Task sent. ID: task_12345"

## 3. Updated `finish()` Tool (or new `update_task`)
*   **Input**: `taskId` (optional), `status`, `outcome`
*   **Action**: Updates the record in `.state/tasks.jsonl`.
*   **Automation**: If an agent marks a todo item as `[x]` in `todo.md` that contains `[task_ID]`, the system auto-updates the ledger.

## 4. New `check_task(taskId)` Tool
*   **Input**: `taskId`
*   **Output**: Current status and outcome.

## 5. Notification (Optional V2)
*   When a task enters `done` or `blocked` state, the system auto-appends a notification to the *sender's* `todo.md`: `[Notification] Task task_12345 (Update philosophy...) completed by May.`

## Implementation Steps
1.  Create `src/lib/tasks.ts` (Ledger logic).
2.  Update `agents.send` in `manager.ts` to write to ledger.
3.  Update `finish` tool (designed in `brief-finish-tool.md`) to accept `taskId`.
