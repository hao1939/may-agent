# Design: Context-Enriched Reply

**Status**: partial — envelope shipped, enrichment payload not implemented

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

The sections below describe the intended enrichment design. None of this is live.

### Problem

When you reply to a Telegram notification, May gets raw text with no context. "focus on output not cost" — about what? which project? what was the current state?

### Core Idea

Every notification carries structured context. When you reply, your text is enriched with that context before reaching the agent.

### Context Structure

```typescript
interface NotificationContext {
  agent: string;
  subject: string;            // human-readable: "project system-efficiency", "metric handler.p95-duration"
  state: Record<string, unknown>;
  background: string;
  sentAt: number;
}
```

### Enrichment Format

When you reply, the bot would build:

```
[User replying to notification from may about "project system-efficiency"]
State: WAITING, metrics at target
Background: orchestrator completed 3 fixes, waiting for human direction

User says: focus on output metrics not cost reduction
```

### Validation (from earlier experiment)

Tested with claude-opus-4.6, same message with and without context enrichment:

| Reply | Without context | With context |
|-------|----------------|--------------|
| "focus on output not cost" | Wrong scope — applied globally | Correct — targets specific project |
| "cancel it and move on" | "Could you clarify what to cancel?" | "Cancelling Ship EXP-188 for bob" |

### Proposed Metric

`telegram.reply-actionable-rate` — % of replies that didn't need clarification (no follow-up within 5min). Target: 0.90, threshold: 0.70.
