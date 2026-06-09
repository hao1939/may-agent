# Design: Context-Enriched Reply

**Status**: partial — envelope shipped, enrichment payload not implemented
**Date**: 2026-04-29 (drift re-verified 2026-05-12)

## What Shipped

The `notification_messages` table and basic reply routing are live:

```sql
CREATE TABLE notification_messages (
  telegram_msg_id  INTEGER PRIMARY KEY,
  event_type       TEXT,
  agent            TEXT,
  session_id       TEXT,
  project_id       TEXT,
  data             TEXT,    -- JSON blob: {text} or {summary, text}
  sent_at          INTEGER
);
```

- On send: stores `telegram_msg_id → event` mapping
- On reply: looks up `reply_to_message_id` to find the original event context
- Reply routing works: replies reach the correct agent with the stored `data`

### Known limitations of current state

- `data` payload is `{text}` or `{summary, text}` only — no `subject`, `state`, `background` fields
- `project_id` is set on ~2% of rows — project disambiguation on reply is not exercisable
- No enrichment formatter exists — replies pass through without context prepending
- No `telegram.reply-actionable-rate` metric is registered

Source: KE-576 (2026-05-03), re-verified 2026-05-12.

---

## Proposed Design (not implemented)

Everything below describes the intended enrichment system. None of this is live.

### Problem

When you reply to a Telegram notification, May gets raw text with no context. "focus on output not cost" — about what? which project? what was the current state? May has to guess or ask.

### Core Idea

Every notification carries context. When you reply, your text is enriched with that context before reaching the agent. The agent receives a complete picture: what happened, why you were notified, and what you said about it.

### How It Works

```
System sends notification (project/agent/metric — they decide when)
    ↓
Notification carries structured context
    ↓
You reply with natural text
    ↓
Bot enriches: your text + notification context
    ↓
Agent receives full picture, acts on it
```

### Context Structure

Every outbound Telegram message would store a context blob:

```typescript
interface NotificationContext {
  agent: string;              // "may", "scout", "dev", etc.
  subject: string;            // human-readable: "project system-efficiency", "metric handler.p95-duration"
  state: Record<string, unknown>;
  background: string;
  sentAt: number;
}
```

This covers ALL notifications:
- Project waiting → `{ agent: "may", subject: "project system-efficiency", state: { status: "waiting", metrics: {...} }, background: "orchestrator needs direction" }`
- Metric breach → `{ agent: "may", subject: "metric handler.p95-duration", state: { value: 274, threshold: 240 }, background: "breaching for 2h" }`
- Agent finding → `{ agent: "scout", subject: "paper on agent memory architectures", state: {}, background: "found on arXiv, relevant to our context-learning project" }`
- Agent alert → `{ agent: "may", subject: "dev stuck in retry loop", state: { sessionCount: 15, task: "Ship EXP-188" }, background: "same task retried 15x over 3 days" }`
- Simple message → `{ agent: "scout", subject: "XHS content update", state: {}, background: "found 3 posts about multi-agent systems" }`

### Enrichment Format

When you reply, the bot builds an enriched message:

```
[User replying to notification from may about "project system-efficiency"]
State: WAITING, metrics at target (may-session-ratio 0.12), all plan items checked
Background: orchestrator completed 3 fixes, waiting for human direction

User says: focus on output metrics not cost reduction
```

No action instructions. The agent reads the context and decides what to do.

### Examples

**Project notification → reply:**
```
Notification: 🔔 system-efficiency is WAITING. Metrics at target. Orchestrator needs direction.
User replies: "focus on output metrics not cost reduction"

Agent receives:
  User replied to notification about project "system-efficiency" (WAITING).
  State: metrics at target, 3 fixes implemented.
  Background: orchestrator completed all plan items.
  User says: focus on output metrics not cost reduction
```

**Metric alert → reply:**
```
Notification: 🔴 handler.p95-duration at 274s (threshold 240s) for 2h
User replies: "increase timeout to 10min for heartbeats"

Agent receives:
  [User replying to notification from may about "metric handler.p95-duration"]
  State: 274s, threshold 240s, breaching 2h.
  Background: handlers run LLM sessions that take 3-5min.
  User says: increase timeout to 10min for heartbeats
```

**Agent alert → reply:**
```
Notification: ⚠️ dev stuck in retry loop — "Ship EXP-188" retried 15x over 3 days
User replies: "cancel it and move on to the next experiment"

Agent receives:
  [User replying to notification from may about "dev stuck in retry loop"]
  State: 15 retries of same task over 3 days.
  User says: cancel it and move on to the next experiment
```

**Unprompted message (no reply context):**
```
User types: "what's the status of all projects?"
Agent receives as-is — no enrichment needed.
```

### Bot-Side Implementation

1. **On send**: send clean message to user. Store mapping: `telegram_message_id → event` in `notification_messages` table.
2. **On reply**: look up `reply_to_message_id` → get original event. From the event, reconstruct context: which agent, session, project, workflow, state at that time.
3. **On non-reply**: pass through as regular message (no enrichment)

### Context Reconstruction from Event

The original event carries all metadata:
```typescript
{
  type: "notification",
  source: "agent:may",
  owner: "human:operator",
  data: {
    agent: "may",
    text: "...",
    sessionId: "s_123",
    // From session, derive: projectId, workflowRunId, task, parent session
  }
}
```

From `sessionId`, reconstruct:
- `sessions.projectId` → which project
- `sessions.task` → what was being worked on
- `sessions.agent` → who was doing it
- `sessions.workflowRunId` → which workflow run
- Recent events for that project → current metrics, status

### Session Context Enrichment

When enriching a reply that has a `sessionId`, the bot also reads the session's transcript from disk and includes a summary:

1. Reply received → look up stored context → has `sessionId`
2. Read `.state/sessions/{sessionId}/session-compact.jsonl`
3. Extract: original task, key findings, last action before interruption
4. Include in enriched message

**Fallback:** If session JSONL not found (cleaned up), enrichment still includes notification context. Graceful degradation.

### Validation (from earlier experiment)

Tested with claude-opus-4.6, same message with and without context enrichment:

| Reply | Without context | With context |
|-------|----------------|--------------|
| "focus on output not cost" | Wrong scope — applied globally to system | Correct — targets system-efficiency project specifically |
| "cancel it and move on" | "Could you clarify what to cancel?" | "Cancelling Ship EXP-188 for dev, unblocking the task" |

### Proposed Metric

`telegram.reply-actionable-rate` — % of replies that didn't need clarification (no follow-up within 5min). Target: 0.90, threshold: 0.70.

### What This Design Does NOT Cover

- **When to notify**: projects, metrics, agents decide this
- **Notification format**: each notifier formats its own message
- **Slash commands**: not needed — natural language replies with context are better
- **Buttons/keyboards**: not needed — text replies are universal
