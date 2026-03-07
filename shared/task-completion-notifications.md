# Task Completion Notifications

## Principle

**The manager owns delivery.** When a task finishes, the manager notifies the caller. Agents don't track pending tasks or register callbacks — they just dispatch work and eventually receive a `[task-complete]` followUp.

## Who Gets Notified

| Trigger | Result delivery | Why |
|---|---|---|
| Agent session dispatches (`subagents.run`) | followUp to parent session | Caller is actively waiting |
| Cron dispatches (`ctx.manager.run`) | Append to cron owner's todo.md | Not urgent, drained on next heartbeat |
| System auto-trigger (evaluator, startup) | Result sits where it's designed | Consumer already knows where to look |

## The Manager's Responsibilities

The manager handles the **entire notification lifecycle**:

### 1. On session completion → try to deliver

```
handleCompletion(session) fires
  → build notification message (includes ✅/❌, runtime, task preview, error if any)
  → try followUp to parentSessionId (if session alive)
  → else try followUp to parent agent's persistent session
  → else write to .state/undelivered-notifications.jsonl
```

### 2. On startup → reconcile from registry

Scan the registry for child sessions of each resumed persistent session:

```
completedChildren (status=done/error) → queue followUp (may duplicate, harmless)
staleRunning (status=running but no ActiveSession) → mark interrupted, report
interrupted → already handled by existing resume logic
```

### 3. On startup → watch fallback file

```typescript
fs.watch('.state/undelivered-notifications.jsonl', () => {
  drainUndeliveredNotifications();
});
```

When a detached sub-agent (different process) finishes, its manager can't find the parent → writes to the fallback file → parent's manager picks it up via fs.watch → routes to the right session.

### 4. On heartbeat → drain fallback file (safety net)

If `fs.watch` missed an event, the heartbeat drains the file as a backup.

## The Agent's View

Agents know nothing about this. They see:

```
// Dispatch work
subagents.run("bob", "Design feature X")

// ... continue other work or go idle ...

// Eventually receive (via followUp):
// [task-complete] ✅ bob finished (1m21s): "Design feature X..." Session: s_123
```

No callbacks. No polling. No tracking pending tasks. The manager delivers.

## Fallback File

```
.state/undelivered-notifications.jsonl
```

One JSON line per undelivered notification:
```json
{"ts": 1772822427, "sessionId": "s_123", "agent": "bob", "status": "done", "task": "Design feature X...", "parentSessionId": "s_100", "parentAgent": "may", "error": null}
```

- **Append-only** — safe for concurrent writes across processes
- **JSONL** — machine-readable, easy to drain
- **Survives restarts** — on disk
- **Shared across processes** — cross-process notification bridge

## Session Recovery After Restart

### The problem

`handleCompletion()` is an in-memory `.then()` on the agent's prompt promise. When the process restarts, all callbacks are gone. No `handleCompletion` will ever fire for sessions from the previous process.

### All scenarios

| # | Sub-agent state after restart | How parent learns |
|---|---|---|
| 1 | **Interrupted** (same process, died together) | Manager's `resumeAgent()` scans registry → reports to parent |
| 2 | **Finished before restart**, notification delivered | Already in parent's JSONL history |
| 3 | **Finished before restart**, notification NOT delivered | Manager reconciles on resume → finds `done` children in registry → queues followUp |
| 4 | **Still running** (detached, other process) | When it finishes → its manager writes to fallback file → parent's manager picks up via fs.watch |
| 5 | **Stale running** (same process, registry says running but actually dead) | Manager reconciles → no ActiveSession exists → marks interrupted |

### How it works without callbacks

**Same process:** All sessions die together. Manager reconciles from registry on resume. No callback needed.

**Cross-process (detached):** Sub-agent finishes → its manager's `handleCompletion` fires → can't find parent in its `activeSessions` → writes to `.state/undelivered-notifications.jsonl` → parent's manager watches the file → drains and routes via followUp.

The fallback file is the **cross-process bridge**. Both processes share the filesystem. `fs.watch` makes it near-instant. Heartbeat drain is the safety net.

**No callback re-binding.** The prompt promise is gone — there's nothing to `.then()` on. The manager uses durable state (registry + fallback file) instead of in-memory callbacks.

## Error Handling

### Error types

| Error | Retry? | Who handles? |
|---|---|---|
| Transient (auth, rate limit, network) | Yes, with backoff | Manager retries automatically |
| Turn limit | No | Caller — task too big, needs rethinking |
| Context overflow | No | Caller — needs fresh session |
| User cancellation | Never | Nobody — user decided |
| Watchdog timeout | No | Caller — task needs review |

**Transient = infra's problem (manager retries). Semantic = caller's problem (notification includes error).**

### Notification includes error context

```
[task-complete] ❌ coder finished (31m12s): "Implement feature X..."
Session: s_123. Error: Turn limit reached (51/50 turns).
```

Caller sees the error type and decides: retry, break down, or escalate.

### Notification delivery failure

If followUp fails AND fallback file write fails → `console.warn`. This is an infra problem visible in docker logs. The result is still in `.state/sessions/` — it's discoverable, just not notified.

### Escalation chain

**agent → agent's todo → May's todo → human**

No silent failures.

## Implementation Summary

| Where | What | Lines |
|---|---|---|
| `manager.ts handleCompletion` | Try notify parent, fallback to file | ~10 lines (mostly exists) |
| `manager.ts resumeAgent` | Reconcile children from registry | ~15 lines |
| `manager.ts` constructor/startup | `fs.watch` on fallback file + drain | ~10 lines |
| Heartbeat handler | Drain fallback file (safety net) | ~5 lines |

~40 lines total. No new data structures. Manager owns everything.
