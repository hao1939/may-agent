# Design: Context-Enriched Reply

**Status**: draft
**Date**: 2026-04-29

## Problem

When you reply to a Telegram notification, May gets raw text with no context. "focus on output not cost" — about what? which project? what was the current state? May has to guess or ask.

## Core Idea

Every notification carries context. When you reply, your text is enriched with that context before reaching the agent. The agent receives a complete picture: what happened, why you were notified, and what you said about it.

## How It Works

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

## Context Structure

Every notification stores a context blob when sent:

```typescript
interface NotificationContext {
  // What triggered the notification
  source: {
    type: "project" | "metric" | "agent" | "digest";
    id: string;           // project name, metric id, agent name
  };
  
  // Snapshot of state when notification was sent
  state: Record<string, unknown>;
  // e.g., { status: "waiting", metrics: {...}, lastIteration: "..." }
  
  // What the system already tried or knows
  background: string;
  // e.g., "orchestrator completed all plan items, said WAITING"
  
  // Timestamp
  sentAt: number;
}
```

## Enrichment

When you reply, the bot builds an enriched message:

```
[Context from notification #{msgId}]
Source: project "system-efficiency" (WAITING since 2h)
State: metrics at target (may-session-ratio 0.12), all plan items checked
Background: orchestrator completed 3 fixes (heartbeat dedup, circuit breaker, budget checkpoint), waiting for human direction

[Your reply]
focus on output metrics not cost reduction

[Instructions to agent]
The user is responding to the above context. Act on their reply in the context of the source.
```

The agent sees everything in one message. No back-and-forth to establish context.

## Examples

### Project notification → reply

Notification sent:
```
🔔 system-efficiency is WAITING
Metrics at target. Orchestrator needs direction.
```

Context stored:
```json
{
  "source": { "type": "project", "id": "system-efficiency" },
  "state": { "status": "waiting", "metrics": { "may-session-ratio": 0.12 } },
  "background": "3 fixes implemented, metrics met, orchestrator out of ideas"
}
```

You reply: "focus on output metrics not cost reduction"

Agent receives:
```
User replied to notification about project "system-efficiency" (WAITING).
State: metrics at target, 3 fixes implemented.
Background: orchestrator completed all plan items.

User says: focus on output metrics not cost reduction

Act on this: add user's feedback as comment to the project discussion,
then trigger the project to resume with this new direction.
```

### Metric alert → reply

Notification sent:
```
🔴 handler.p95-duration at 274s (threshold 240s) for 2h
```

You reply: "increase timeout to 10min for heartbeats"

Agent receives:
```
User replied to metric alert for handler.p95-duration.
State: 274s, threshold 240s, breaching 2h.
Background: handlers run LLM sessions that take 3-5min.

User says: increase timeout to 10min for heartbeats

Act on this: update handlerConfig.timeoutMs for heartbeat entries in cron.json.
```

### Progress update → reply

Notification sent:
```
📊 Progress: skill-workflow-audit deployed 3 skills, coach ran 8 sessions
```

You reply: "coach is spending too many sessions, investigate"

Agent receives:
```
User replied to progress update.
State: coach 8 sessions in last 4h, skill-workflow-audit active.
Background: routine progress, no alerts.

User says: coach is spending too many sessions, investigate

Act on this: investigate coach's session count and efficiency.
```

### Unprompted message (no reply context)

You just type: "what's the status of all projects?"

Agent receives:
```
User message (no reply context — treat as a direct question to May).

User says: what's the status of all projects?
```

No enrichment needed. May handles it like any chat message.

## Implementation

### Bot side (telegram.ts)

1. **On send**: store `{ telegramMsgId → NotificationContext }` mapping (in-memory or DB)
2. **On reply**: look up context by `reply_to_message_id`, build enriched message
3. **On non-reply**: pass through as regular message (no enrichment)

### Storage

Simple: `Map<number, NotificationContext>` in memory. Notifications expire after 48h. If bot restarts, context is lost — replies become regular messages (graceful degradation).

Or: store in events table with the notification event, keyed by telegram message id.

### Agent side

No changes. The agent receives a text message with context prepended. It reads the context and acts. Same as any task.

## What This Design Does NOT Cover

- **When to notify**: projects, metrics, agents decide this. Not this design's concern.
- **Notification format**: each notifier formats its own message. This design only adds the context blob for reply enrichment.
- **Slash commands**: not needed. Natural language replies with context are better.
- **Buttons/keyboards**: not needed. Text replies are universal.
