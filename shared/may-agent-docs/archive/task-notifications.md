# Task Completion Notifications

## Current State

### What's Implemented

**In-process notification** works via the `onSessionComplete` callback:

```
handleCompletion(session) fires
  → build SessionInfo (status, error, runtime, agent, task, parentSessionId)
  → call onSessionComplete(info)
  → may.ts surfaces errors via EventBus, runs auto-evaluation
```

**`callAgent` (sync cooperation)** works via in-process promise resolution:

```
Parent calls callAgent("bob", "do X")
  → manager.run() creates kind: "call" session
  → parent awaits promise
  → child completes → handleCompletion → promise resolves with TaskResult
  → parent continues with result
```

No file-based notification needed for either path.

### What's NOT Implemented

The following were designed but **never built**:

1. **`undelivered-notifications.jsonl`** — Cross-process fallback file for when detached sub-agents can't find their parent in `activeSessions`. Does not exist in the codebase.
2. **`fs.watch` on fallback file** — Parent process watching for cross-process notifications. Not implemented.
3. **Startup reconciliation** — Scanning registry for completed children on resume and queuing followUp. Not implemented.
4. **Heartbeat drain as safety net** — Draining fallback file during heartbeats. Not implemented.

### How Cross-Process Notification Actually Works

For detached sub-agents (spawned by `run-agent-task` handler):
- The detached process writes `identity.json` with `status: "done"/"error"` when complete.
- The parent process does **not** watch for this. Results sit on disk.
- If the parent cares about the result, it must check manually (e.g., read the session history during next heartbeat).
- In practice, detached jobs (analyze-failures, optimize, lesson-consolidation) are fire-and-forget — nobody waits for their result.

---

## Original Design (Reference)

The design below describes the intended notification system. It was approved but
sections 2-4 were never implemented. Kept for reference if cross-process
notification becomes necessary.

### Principle

**The manager owns delivery.** When a task finishes, the manager notifies the caller. Agents don't track pending tasks or register callbacks — they just dispatch work and eventually receive a result.

### Who Gets Notified

| Trigger | Result delivery | Status |
|---|---|---|
| `callAgent` (sync) | Promise resolves with TaskResult | ✅ Implemented |
| `manager.run()` (in-process) | `onSessionComplete` callback | ✅ Implemented |
| `spawnDetachedAgent()` (cross-process) | `identity.json` status field (passive) | ⚠️ Passive only |
| Cron dispatches | Result sits where designed | ✅ Sufficient |

### 🔮 Proposed: Cross-Process Bridge (NOT IMPLEMENTED)

When a detached sub-agent finishes:

```
Detached process: handleCompletion fires
  → can't find parent in activeSessions
  → writes to .state/undelivered-notifications.jsonl

Parent process: fs.watch picks up the file change
  → drainUndeliveredNotifications()
  → routes notification to the right session
```

Fallback file format:
```json
{"ts": 1772822427, "sessionId": "s_123", "agent": "bob", "status": "done", "task": "...", "parentSessionId": "s_100", "parentAgent": "may"}
```

Safety nets:
- Heartbeat drain (if fs.watch misses an event)
- Startup reconciliation (scan registry for completed children)

### 🔮 Proposed: Session Recovery After Restart (NOT IMPLEMENTED)

| # | Sub-agent state after restart | Proposed mechanism |
|---|---|---|
| 1 | Interrupted (same process, died together) | `resumeStaleSessions()` handles ✅ |
| 2 | Finished before restart, notification delivered | Already in JSONL history ✅ |
| 3 | Finished before restart, notification NOT delivered | Startup reconciliation 🔮 |
| 4 | Still running (detached, other process) | `identity.json` polling or fs.watch 🔮 |
| 5 | Stale running (same process, actually dead) | `resumeStaleSessions()` handles ✅ |

---

## Error Handling

### What's Implemented

`handleCompletion` detects:
- **Turn limit**: `turnCount >= maxTurns` → structured error message
- **Context overflow**: `isOverflowError()` → dumps progress to workspace
- **Silent stream errors**: No assistant reply after user message → synthetic error
- **Empty model response**: 0 output tokens → synthetic error
- **Abort**: Error contains "aborted" → `interrupted` status

`onSessionComplete` receives the full `SessionInfo` including error details.

### Error types

| Error | Retry? | Who handles? |
|---|---|---|
| Transient (auth, rate limit, network) | Auto (agent-core) | Agent-core retry logic |
| Turn limit | No | Caller — task too big |
| Context overflow | No | Caller — needs fresh session |
| User cancellation | Never | Nobody — user decided |
| Watchdog timeout | No | Caller — task needs review |

### Escalation chain
**Agent error → `onSessionComplete` callback → EventBus info message → console/Telegram**

No silent failures.
