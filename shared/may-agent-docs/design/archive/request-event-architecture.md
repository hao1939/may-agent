# Design: Request & Event Architecture

**Status:** ✅ Implemented  
**Date:** 2026-04-17  
**References:** [convention-defaults.md](convention-defaults.md), [core-principles.md](core-principles.md) (P1, P3)

## Two Tables, Two Purposes

The system has two persistence tables with distinct roles:

| Table | Purpose | Who sees it | Lifecycle |
|-------|---------|-------------|-----------|
| **events** | Signals & notifications — things agents need to see and act on | Agents (heartbeat inbox) | pending → acked/done/dismissed/failed |
| **requests** | Work tracking — links a task request to the session that fulfills it | Infra (web UI, request-status tool) | CREATED → IN_PROGRESS → COMPLETED/FAILED |

### Events table = agent inbox

Every notification, finding, metric breach, and domain signal goes here. The heartbeat `loadInbox()` function queries this table to show agents their pending items.

**What goes in events:**
- `agent.notification` — one agent notifies another (via Notify tool)
- `agent.finding` — findings tracker creates follow-up for target agent
- `metric.breach` — metric threshold exceeded
- `project.completed`, `project.blocked` — project lifecycle signals
- `escalation.created` — blocked session escalated
- Any `emit` from handlers/workflows

**Lifecycle:** Events have `status` (pending/done/acked/dismissed/failed/expired), `handled_by`, `retry_count`, `urgency`, `ttl_ms`. Handlers subscribe via cron.json `on` field. Unhandled events surface in heartbeat inbox.

### Requests table = work ledger

Tracks "who asked whom to do what" with session linkage. The `requestId` threads from request creation through `manager.run()` to session completion.

**What goes in requests:**
- `fork` — agent forks work to another agent (requestId links to child session)
- `call` — agent calls another agent synchronously
- `heartbeat` — cron fires agent heartbeat (tracks cron execution)
- `handler` — cron fires event handler
- `chat` — human starts chat session
- `task`/`oneshot` — human submits task via CLI/socket

**Lifecycle:** CREATED → IN_PROGRESS (session started) → COMPLETED/FAILED (session ended). Status updated by session-subscribers when linked session completes.

## What changed (2026-04-17 migration)

Previously, notifications also went to the requests table. This caused:
- 532 stale CREATED requests that agents never saw (requests weren't shown in heartbeat)
- Duplicate tracking — some items in both tables
- Two inboxes that didn't talk to each other

**Migration:** Agent-facing notifications moved from `trackRequest()` to events:

| Caller | Before | After |
|--------|--------|-------|
| Notify tool (`send-tool.ts`) | `trackRequest({ method: "notify" })` | `emit("agent.notification")` |
| Session new_items (`session-subscribers.ts`) | `trackRequest({ method: "notify" })` | INSERT into events table |
| Findings tracker (`session-subscribers.ts`) | `trackRequest({ method: "notify" })` | INSERT into events table |
| Message created (`db-writer.ts`) | `trackRequest({ method: "notify" })` | INSERT into events table |
| Socket message (`may.ts`) | `trackRequest()` + `bus.emit(message_created)` | `bus.emit(message_created)` only (db-writer persists as event) |

## How it flows

```
Agent A notifies Agent B:
  Notify tool → emit("agent.notification", { owner: B }) 
    → DbWriter persists to events table (status: pending)
    → heartbeat triggers for B
    → B's heartbeat loads inbox → sees notification → acts on it

Human forks Agent B:
  Socket/CLI → trackRequest({ method: "fork", toAgent: B }) → requestId
    → manager.run(B, task, { requestId })
    → session completes → session-subscribers updates request status
    → Web UI shows request lifecycle
```

## Rules

1. **If an agent needs to see it → events table.** Notifications, findings, metric breaches, domain signals.
2. **If it tracks a session → requests table.** Forks, calls, heartbeats, human tasks. Anything with `requestId` linkage.
3. **Never put the same item in both tables.** One source of truth per item.
4. **Events have lifecycle.** Agents mark them done/dismissed. Stale events with TTL expire automatically.
