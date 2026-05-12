# Design: Context-Enriched Reply

**Status**: partial — envelope shipped, payload + enrichment did not (see drift note below)
**Date**: 2026-04-29 (drift re-verified 2026-05-12)

> **Drift note (2026-05-12, arc):** The `notification_messages` envelope
> columns (`telegram_msg_id, event_type, agent, session_id, project_id,
> data, sent_at`) match this doc. The `data` payload, the enrichment
> formatter, and the regression metric do **not**:
> - `data` shape on 1538/1538 messages (last 30d) is `{text}` or
>   `{summary,text}`. Zero rows carry `subject`, `state`, `background`,
>   or `sentAt`.
> - `project_id` set on 36/1538 rows (2.3%); the doc's first promise
>   (project disambiguation on reply) is not exercisable.
> - No metric `telegram.reply-actionable-rate` is registered.
> - Enriched task format observed in live chat sessions omits
>   `subject`, `State:`, `Background:` lines.
>
> Source: KE-576 (2026-05-03) + re-verification 2026-05-12. Proposal
> with Option A/B/C decision points lives at
> `agents/arc/workspace/proposals/2026-05-03-telegram-notifications-md-runtime-reality-appendix.md`.
> The doc body below is preserved as the *intended* design.

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

Every outbound Telegram message stores a context blob:

```typescript
interface NotificationContext {
  // Who sent it
  agent: string;              // "may", "scout", "coach", etc.
  
  // What it's about (flexible — works for any notification)
  subject: string;            // human-readable: "project system-efficiency", "metric handler.p95-duration", "XHS finding about agent memory"
  
  // Snapshot: relevant state at the time
  state: Record<string, unknown>;
  // Could be: { projectStatus, metrics, lastIteration }
  // Or: { metricValue, threshold, duration }
  // Or: { finding, source, relevance }
  // Or: just {} for simple messages
  
  // What happened / why you're being told
  background: string;
  
  // Timestamp
  sentAt: number;
}
```

This covers ALL notifications:
- Project waiting → `{ agent: "may", subject: "project system-efficiency", state: { status: "waiting", metrics: {...} }, background: "orchestrator needs direction" }`
- Metric breach → `{ agent: "may", subject: "metric handler.p95-duration", state: { value: 274, threshold: 240 }, background: "breaching for 2h" }`  
- Agent finding → `{ agent: "scout", subject: "paper on agent memory architectures", state: {}, background: "found on arXiv, relevant to our context-learning project" }`
- Agent alert → `{ agent: "coach", subject: "bob stuck in retry loop", state: { sessionCount: 15, task: "Ship EXP-188" }, background: "same task retried 15x over 3 days" }`
- Simple message → `{ agent: "amy", subject: "XHS content update", state: {}, background: "found 3 posts about multi-agent systems" }`
```

## Enrichment

When you reply, the bot builds an enriched message:

```
[User replying to notification from may about "project system-efficiency"]
State: WAITING, metrics at target (may-session-ratio 0.12), all plan items checked
Background: orchestrator completed 3 fixes, waiting for human direction

User says: focus on output metrics not cost reduction
```

No action instructions. The agent reads the context and decides what to do.

The agent sees everything in one message. No back-and-forth to establish context.

## Examples

### Project notification → reply

Notification sent:
```
🔔 system-efficiency is WAITING
Metrics at target. Orchestrator needs direction.
```

You reply: "focus on output metrics not cost reduction"

Agent receives:
```
User replied to notification about project "system-efficiency" (WAITING).
State: metrics at target, 3 fixes implemented.
Background: orchestrator completed all plan items.

User says: focus on output metrics not cost reduction

```

### Metric alert → reply

Notification sent:
```
🔴 handler.p95-duration at 274s (threshold 240s) for 2h
```

You reply: "increase timeout to 10min for heartbeats"

Agent receives:
```
[User replying to notification from may about "metric handler.p95-duration"]
State: 274s, threshold 240s, breaching 2h.
Background: handlers run LLM sessions that take 3-5min.

User says: increase timeout to 10min for heartbeats
```

### Progress update → reply

Notification sent:
```
📊 Progress: skill-workflow-audit deployed 3 skills, coach ran 8 sessions
```

You reply: "coach is spending too many sessions, investigate"

Agent receives:
```
[User replying to progress update]
State: coach 8 sessions in last 4h, skill-workflow-audit active.
Background: routine progress, no alerts.

User says: coach is spending too many sessions, investigate
```

### Agent finding → reply

Notification sent (by scout):
```
🔬 Found paper on agent memory architectures (arXiv:2604.xxxxx)
Relevant to our context-learning approach. See DD#801.
```

You reply: "share with bob, see if it connects to his hypothesis"

Agent receives:
```
[User replying to notification from scout about "paper on agent memory architectures"]
Background: found on arXiv, relevant to context-learning project. DD#801 written.

User says: share with bob, see if it connects to his hypothesis
```

### Agent alert → reply

Notification sent (by coach):
```
⚠️ bob stuck in retry loop — "Ship EXP-188" retried 15x over 3 days
```

You reply: "cancel it and move on to the next experiment"

Agent receives:
```
[User replying to notification from coach about "bob stuck in retry loop"]
State: 15 retries of same task over 3 days.

User says: cancel it and move on to the next experiment
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

1. **On send**: send clean message to user. Store mapping: `telegram_message_id → event` in `notification_messages` table.
2. **On reply**: look up `reply_to_message_id` → get original event. From the event, reconstruct context: which agent, session, project, workflow, state at that time.
3. **On non-reply**: pass through as regular message (no enrichment)

### Context reconstruction from event

The original event already carries all metadata:
```typescript
// The event that triggered the notification:
{
  type: "notification",
  agent: "may",           // → who sent it
  text: "...",            // → what user saw
  sessionId: "s_123",    // → which session was running
  // From session, we can derive:
  //   - projectId (if session was for a project)
  //   - workflowRunId (if session was in a workflow)
  //   - task (what the agent was doing)
  //   - parent session (who dispatched it)
}
```

From `sessionId`, reconstruct:
- `sessions.projectId` → which project
- `sessions.task` → what was being worked on
- `sessions.agent` → who was doing it
- `sessions.workflowRunId` → which workflow run
- Recent events for that project → current metrics, status

### Storage

`notification_messages` table:
```sql
CREATE TABLE notification_messages (
  telegram_msg_id  INTEGER PRIMARY KEY,
  event_type       TEXT,
  agent            TEXT,
  session_id       TEXT,
  project_id       TEXT,
  data             TEXT,    -- JSON blob of event data
  sent_at          INTEGER
);
```

Lightweight. One row per outbound message. Expire after 7 days.

### Agent side

No changes. The agent receives a text message with context prepended. It reads the context and acts. Same as any task.

## Session Context Enrichment

When enriching a reply that has a `sessionId`, the bot also reads the session's transcript from disk and includes a summary. This enables continuation after restart.

**How it works:**
1. Reply received → look up stored context → has `sessionId`
2. Read `.state/sessions/{sessionId}/session-compact.jsonl` (or `session.jsonl`)
3. Extract: original task, key findings, last action before interruption
4. Include in enriched message:

```
[User replying to notification from may about "project system-efficiency"]
Session context (interrupted after 114 ops):
  Task: fix project failures and blocks
  Progress: read project.ts, edited handler, was investigating meta.json files
  Last action: switching from grep to faster approach for 36k files

User says: continue
```

**Proven by experiment:**
- Without session context: May starts from scratch with generic plan
- With session context: May says "let me pick up where I left off" and continues specific work

**Fallback:** If session JSONL not found (cleaned up), enrichment still includes notification context (agent, event type, summary). Graceful degradation.

## What This Design Does NOT Cover

- **When to notify**: projects, metrics, agents decide this. Not this design's concern.
- **Notification format**: each notifier formats its own message. This design only adds the context blob for reply enrichment.
- **Slash commands**: not needed. Natural language replies with context are better.
- **Buttons/keyboards**: not needed. Text replies are universal.


## Validation

### Test Results

Tested with claude-opus-4.6, same message with and without context enrichment:

| Reply | Without context | With context |
|-------|----------------|--------------|
| "focus on output not cost" | Wrong scope — applied globally to system | Correct — targets system-efficiency project specifically |
| "cancel it and move on" | "Could you clarify what to cancel?" | "Cancelling Ship EXP-188 for bob, unblocking him" |

Context enrichment converts ambiguous replies into precise actions.

### Regression Metric

`telegram.reply-actionable-rate`
- **What**: % of replies that didn't need clarification (no follow-up within 5min)
- **Target**: 0.90
- **Threshold**: 0.70
- **Measured by**: track reply → check if user sends again within 5min to same thread
