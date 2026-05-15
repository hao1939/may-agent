# Agent Cooperation Design — Task Completion Notifications

## Principle

**When a task finishes, notify the caller who triggered it.**

Session-to-session, not agent-to-agent. One agent can have multiple sessions; the notification goes to the specific session (or its owner) that dispatched the work.

## Current Implementation (manager.ts:596-628)

```
session completes →
  if parentSessionId is alive → followUp to parent session
  else if parent agent has a persistent session → followUp to that
  else → nobody to notify (silent)
```

Skips workflow step sessions (workflow tool handles coordination internally).

## All Task Dispatch Cases

| # | Who triggers | How | parentSessionId? | Notification | Status |
|---|---|---|---|---|---|
| 1 | Agent session → sub-agent | `subagents.run(agent, task)` | ✅ set to caller's session | Parent session or persistent fallback | ✅ Working |
| 2 | Agent session → delegate | `subagents.delegate(agent, task)` | ✅ set to caller's session | Same as #1, but caller blocks until done | ✅ Working (though delegate already waits) |
| 3 | Workflow → agent step | `workflow-tool.ts ctx.runAgent()` | ✅ set, but skipped (`workflowRunId` filter) | Workflow tool handles internally | ✅ Working |
| 4 | User `@agent` command | `run/may.ts runDirect()` | ✅ set to May's chat session | May's chat session gets notified | ✅ Working |
| 5 | Cron handler → agent | `ctx.manager.run(agent, task)` | ❌ none | Nobody notified | ⚠️ Gap |
| 6 | Cron drain-todo (followUp mode) | `ctx.manager.followUp(sid, msg)` | N/A (not a new session) | N/A — message goes to persistent session | ✅ N/A |
| 7 | Cron drain-todo (run mode) | `ctx.manager.run(agent, task)` | ❌ none | Nobody notified | ⚠️ Gap |
| 8 | Evaluator auto-eval | `manager.run("evaluator", prompt)` | ❌ none | Nobody (meta-agent, intentional) | ✅ By design |
| 9 | Interface startup | `run/may.ts manager.run(interfaceAgent)` | ❌ none | Nobody (top-level) | ✅ By design |

## The Gap: Cron-triggered sessions (Cases 5 & 7)

When cron spawns a session (e.g., `run-agent-task` handler runs Bob for `analyze-failures`), the session has no `parentSessionId`. When Bob finishes, nobody is notified. The result sits until the next heartbeat or manual check.

### Should we fix this?

**Yes, but carefully.** Cron jobs are fire-and-forget by design — the handler returns immediately after spawning the session. There's no "caller session" to notify. But there IS a logical owner: **the agent whose cron triggered the work.**

For cron-triggered sessions:
- `analyze-failures` runs Bob → Bob's heartbeat should know when it's done
- `optimize` runs Optimizer → Optimizer's heartbeat should know
- `coaching` runs Coach → Coach should know
- `run-agent-task` is generic → the agent named in the cron entry is the owner

### Fix: Set parentSessionId for cron-spawned sessions

In `run-agent-task.ts` and `drain-todo.ts` (run mode), when calling `ctx.manager.run()`:

```typescript
// Find the cron-owning agent's persistent session as parent
const ownerSession = findPersistentSession(ctx.manager, ownerAgentName);
const sessionId = ctx.manager.run(targetAgent, taskMessage, { 
  source: "cron",
  parentSessionId: ownerSession  // ← the cron owner
});
```

This way:
- Bob's `analyze-failures` cron spawns Optimizer → Optimizer finishes → Bob's persistent session gets notified
- May's `drain-todo` spawns Bob → Bob finishes → May's persistent session gets notified

The existing notification logic in `handleCompletion` handles it from there — no changes needed in manager.ts.

## Edge Cases

### 1. Delegate already blocks
`subagents.delegate` waits for completion and returns the result inline. The caller already knows. The notification still fires (harmless — it's just a followUp that arrives after the delegate result), but it's redundant. 
**Action:** Consider skipping notification for delegate sessions. Low priority — the duplicate message is harmless.

### 2. Evaluator notifications
Evaluator sessions have no parent and shouldn't notify. Current code handles this: no `parentSessionId` → no notification. ✅

### 3. Notification storms
If many cron jobs trigger many sessions that all finish around the same time, the persistent session could get flooded with `[task-complete]` messages. 
**Mitigation:** followUp queues messages — the agent processes them one at a time. This is actually fine; the agent sees a batch of completions and can handle them all in one turn.

### 4. Circular notifications
Agent A spawns Agent B spawns Agent A? The `parentSessionId` chain prevents loops — notification goes UP to the parent, not across. And persistent sessions don't spawn children that notify back to themselves in a loop because the parent check is session-specific, not agent-specific.

### 5. Dead persistent sessions after restart
After a restart, `parentSessionId` from a previous process is stale. No session with that ID exists in `activeSessions`. The fallback (find persistent session for parent agent) kicks in — if the agent has been restarted and has a new persistent session, it gets the notification. If not, silent. ✅

### 6. Workflow final step
Workflow steps are filtered out (`!session.workflowRunId`). But the workflow-tool session itself (the one running the workflow) is NOT a workflow step — it's a normal session with a parent. When the workflow-tool session completes, its parent gets notified. ✅

## Implementation Plan

1. **Cron handlers** — update `run-agent-task.ts` and `drain-todo.ts` (run mode) to set `parentSessionId` to the cron-owning agent's persistent session (~5 lines each)
2. **No manager.ts changes** — existing logic handles everything
3. **Update this design doc** — mark as implemented

## What This Gives Us

Every task in the system, no matter who triggers it, notifies its caller on completion. The system is fully event-driven — no more relying on polling as the primary mechanism. Heartbeats become a safety net, not the main coordination path.
