# Output Channel Redesign — Engineering Analysis

## 1. Telegram Event Filtering

### Current Behavior (telegram.ts)
The `bus.subscribe()` callback in `attachTelegramBot` (line ~196) does:
1. Maintains a `watchedSessions` set — starts with the chat session, auto-expands on `session_start` with matching `parentSessionId`
2. Filters out events from sessions not in the set ✓
3. Accumulates **all** `text` events (line ~218) — this includes child session assistant text
4. Flushes on **every** `turn_end` event (line ~222) — every child turn triggers a send

**Problem**: A `tech-lead → coder` delegation produces ~20 child turns. Each turn's text chunks are accumulated and flushed individually, creating 20+ Telegram messages for one delegated task.

### Minimal Fix (estimated: ~25 LOC, risk: low)
Add a `rootSessionId` tracker alongside the existing `watchedSessions`. Only accumulate/flush text for the root chat session:

```
// In the bus.subscribe callback:
if (event.type === "text" && event.sessionId === chatSid) {
  pendingText += event.text;   // Only May's direct text
}
if (event.type === "turn_end" && event.sessionId === chatSid) {
  flushPendingText();          // Only flush on May's turns
}
```

For child session completion, add a `session_end` handler:

```
if (event.type === "session_end" && watchedSessions.has(event.sessionId) && event.sessionId !== chatSid) {
  // Child session finished — send ONE summary
  const fp = event.finishParams as any;
  const summary = fp?.summary ?? event.outcome?.slice(0, 200) ?? "completed";
  const status = fp?.status ?? event.status;
  const agent = event.agent;
  const msg = `🔧 ${agent} ${status}: ${summary}`;
  sendMessage(pendingChatId!, msg).catch(() => {});
}
```

**Files**: `src/app/ui/telegram.ts` (lines ~218-232)
**Risk**: Low — backward compatible. Worst case: user misses a child message (they can check web UI).

### Ideal Change
Same as above plus: suppress `session_end` messages for intermediate workflow steps (e.g., lens-analysis inner sessions). Only surface the top-level fork/call completion. Check `event.parentSessionId === chatSid` (direct child only, not grandchildren).

---

## 2. Web Console Socket Bug

### The Bug (socket.ts line 114)
```typescript
function shouldForward(client: ClientState, event: AgentEvent): boolean {
  if (!client.filter) return true;
  if ("sessionId" in event && typeof event.sessionId === "string") {
    return client.filter.has(event.sessionId);
  }
  // BUG: notification events always forwarded to filtered clients
  if (event.type === "notification") return true;   // ← LINE 114
  return false;
}
```

When a client subscribes with a session filter (e.g., `subscribe({ sessions: ["chat"] })`), `notification` events from **all agents** bypass the filter. These events lack a `sessionId` field, so they skip the session check and hit the `return true` on line 114.

The web console renders these notifications in the chat panel alongside conversation messages, making it look like Bob, coach, and optimizer are talking in May's chat.

### Fix (2 LOC change, risk: none)
```typescript
// notification events: only forward from the interface agent, not all agents
if (event.type === "notification") {
  return !client.chatMode;  // Only firehose clients get notifications
}
```

Or more precisely — notifications should route to a **separate activity feed channel**, not the chat panel. The web UI WebSocket proxy (`web.ts` line ~340) doesn't distinguish event types; it forwards everything. The fix has two parts:

**Part A — socket.ts** (line 114): Change `return true` to `return false` for chat-mode clients. Notifications are not session-scoped, so they don't belong in a session-filtered stream.

**Part B — web UI frontend**: The frontend should subscribe to TWO channels: (1) a session-filtered channel for the chat panel, and (2) a firehose/notification-only channel for the sidebar activity feed. This is a frontend change (the web-static HTML/JS).

**Files**: `src/app/ui/socket.ts` (line 114), web frontend
**Risk**: Zero for Part A. Part B requires frontend work.

---

## 3. Child Session Summary Mechanism

### Current Flow
1. Child session runs, calls `finish()` with `{ status, summary, deliverables, ... }`
2. `finish()` tool writes these params into the final assistant message content block
3. Manager's `handleCompletion()` (manager.ts ~816) calls `extractFinishParams()` to pull them out
4. Manager emits `session_end` event on the bus with `finishParams` field populated (manager.ts ~852, ~1972)
5. **For `callAgent`**: The parent awaits `waitFor(sessionId)`, which resolves with a `TaskResult` containing the messages array. The `agents` tool (manager-agents-tool.ts ~265-289) extracts the result and returns it as tool output text.
6. **For `runAgent` (fork)**: The parent doesn't await — the child's `session_end` event fires on the bus, but the parent only sees it if it happens to `peek` the session.

### Where to Intercept
The `session_end` event already contains everything needed: `event.finishParams.summary`, `event.finishParams.status`, `event.finishParams.deliverables`, `event.agent`, `event.sessionId`.

For telegram: the `bus.subscribe` callback in telegram.ts already receives `session_end` events for watched sessions. We just need to handle them (see §1 above) instead of streaming the 25 individual turns.

For the web console: `session_end` events already flow through the socket. The frontend just needs to render child `session_end` as a collapsed summary card instead of showing every tool_call/tool_result.

**No new infrastructure needed.** The data is already there in the event stream. The fix is purely in the consumers (telegram.ts, socket.ts, web frontend).

---

## 4. May as Notification Router

### Current Architecture
```
Agent sessions → EventBus → [all subscribers receive everything]
                          → telegram.ts (filters by watchedSessions)
                          → socket.ts (filters by client.filter)
                          → session-subscribers.ts (DB writes, eval, memory)
```

### Proposed Change: Filter Layer (not a new router)
Adding May as a processing queue is over-engineering. The simpler approach: add a **notification classifier** as a bus subscriber that transforms events before they reach telegram/socket.

But even that is unnecessary. The real fix is much simpler:

**Telegram filtering is sufficient.** The changes in §1 (skip child turns, send one summary on completion) solve 90% of the noise. The remaining 10% (urgency classification) can be done inline:

```typescript
// In telegram.ts session_end handler:
if (event.type === "session_end" && isChildSession(event)) {
  const fp = event.finishParams as any;
  if (fp?.status === "failure" || fp?.status === "blocked") {
    // Urgent — send immediately with ❌ prefix
    sendMessage(chatId, `❌ ${event.agent} BLOCKED: ${fp.summary}`);
  } else if (fp?.status === "success") {
    // Info — send concise summary
    sendMessage(chatId, `✅ ${event.agent}: ${fp.summary?.slice(0, 100)}`);
  }
  // partial — could batch these, but not worth the complexity yet
}
```

**Why not a central router**: The two consumers (telegram, socket) have fundamentally different needs. Telegram wants minimal messages. Socket wants everything for the web UI to render. Putting a router between the bus and consumers adds a layer of indirection without reducing complexity — each consumer still needs its own rendering logic.

**If we want urgency classification later**, it belongs in the `notification` event type itself. When agents emit `bus.emit({ type: "notification", agent, text, urgency: "alert" })`, the urgency travels with the event. Consumers filter on it. No central router needed.

---

## 5. Implementation Cost Estimate

| Component | LOC | Files | Risk | Priority |
|-----------|-----|-------|------|----------|
| **Telegram: skip child turns, send summary** | ~25 | telegram.ts | Low (backward compat) | P0 |
| **Socket: fix notification bypass** | ~3 | socket.ts L114 | None | P0 |
| **Web frontend: separate notification feed** | ~40 | web-static/ | Low | P1 |
| **Web frontend: child session summary cards** | ~30 | web-static/ | Low | P2 |
| **Urgency field on notification events** | ~10 | event-bus.ts + emitters | None (additive) | P2 |

**Total minimal fix (P0 only): ~28 LOC across 2 files.**
The two P0 items are independent and can be done in parallel.

### Recommended Sequence
1. Fix socket.ts notification bug (3 LOC, instant win)
2. Add telegram child-session summarization (25 LOC, biggest noise reduction)
3. Web frontend notification separation (if web UI gets used more)
