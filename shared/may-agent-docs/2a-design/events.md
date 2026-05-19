# Events & Inbox

## Core Principle

```
Event = something that happened at a point in time (immutable, append-only)
```

Events are the primary communication mechanism. State is derived from events where practical. Some tables (metrics, sessions) use mutable status columns for query efficiency — this is a pragmatic trade-off, not a violation. The events table remains append-only and is the audit trail.

## Schema

Effective query schema. Some columns may be added by migrations after the base
`CREATE TABLE`; agents should rely on the event/query surfaces instead of
assuming the original DDL is complete.

```sql
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,    -- dot-separated: "handler.completed"
  source     TEXT,             -- who emitted it
  owner      TEXT,             -- who should see it (for inbox)
  data       TEXT,             -- JSON payload
  timestamp  INTEGER NOT NULL,
  ttl_ms     INTEGER,          -- auto-expire after this duration
  urgency    TEXT DEFAULT 'normal'
);
```

## Event Types

This doc is the canonical event taxonomy. `src/app/event-bus.ts` should converge
on these core events, but the implementation can temporarily persist dynamic
event names from adapters, workflows, and handlers. When the code and this doc
differ, treat it as an implementation gap to resolve or a design issue to
revisit explicitly; do not silently invent a third naming scheme.

Key categories agents encounter:

### Timers and triggers
```
timer.heartbeat_due { owner, entry }
```

Timers are event sources. Cron/timer code should emit timer events; handlers
then bridge them to workflows.

### Handler lifecycle (paired)
```
handler.started    { handler, agent }
handler.completed  { handler, agent, durationMs }
handler.failed     { handler, agent, error, durationMs }
```

### Session lifecycle
```
session.start      { sessionId, agent, task, kind, parentSessionId }
session.end        { sessionId, agent, status, summary }
```

### Metrics
```
metric.breach       { owner, metricId, metricName, current, threshold, target?, message, priority? }
metric.recovered    { metricId, metricName }
metric.stalled      { owner, metricId, metricName, message }
metric.alert_judged { alertId?, metricId, owner, verdict, reason, evidence? }
```

Metrics are signals, not judgments. `metric.breach` wakes or informs the owner;
the owner agent judges whether to fix, calibrate, downgrade, escalate, or record
an accepted exception.

### Agent communication
```
message.created    { from, to, content, intent?, priority? }
agent.decision     { agent, sessionId, decision, evidence? }
```

### Escalation lifecycle
```
escalation.created {
  escalationId,
  sourceAgent,
  sourceSessionId?,
  targetOwner,
  projectId?,
  projectPath?,
  reason,
  requestedAction,
  severity?,
  blockedOn?,
  evidence?,
  resume?,
  dedupKey?,
  createdAt
}

escalation.resolved {
  escalationId,
  resolverAgent,
  outcome,
  summary,
  evidence?,
  resumeInstruction?,
  resolvedAt
}
```

Escalation routing follows the same payload rule as every other reactive
handler: the event type routes work and the payload carries facts. A subscriber
must read fields from `TriggerEvent.data`; the cron framework should not promote
domain fields onto the trigger object.

`targetOwner` should resolve to a concrete owner:

| `targetOwner` | Runtime route |
|---------------|---------------|
| `agent:<name>` | owner inbox / handler queue for `<name>` |
| `human:<role>` | May-owned human routing |

On `escalation.resolved`, infra should try to resume the original paused
session/checkpoint first. Starting a continuation session is a fallback only
when true resume is unavailable.

### Learning feedback
```
learning.feedback {
  kind: "owner_finding",
  owner,
  summary,
  needsHuman,
  sessionId,
  agent,
  projectId?,
  workflowRunId?,
  evalTrailPath,
  finding
}
```

`learning.feedback` is emitted by the evaluator for actionable session findings. It is owner-targeted inbox input, not the canonical evaluation record. The canonical record remains the sibling `session.eval.jsonl` trail beside the raw `session.jsonl`.

Routing rule:

| `finding.owner` | event `owner` |
|-------------------|---------------|
| `agent:<name>` | `<name>` |
| `human:<role>` | `may` |

For human-owned findings, payload keeps `finding.owner` and sets `needsHuman: true`; May decides whether to contact the human, update context, defer, or dismiss.

### Project, adapter, and guard events
```
project.comment.created { projectId, author, text }
project.iteration       { project, iteration }
project.status_changed  { project, from, to }
telegram.reply          { chatId?, messageId?, target?, text }
guard.triggered         { owner, source, guard, action, reason, sessionId?, workflowRunId?, projectId? }
tool.executed           { agent, sessionId, tool, args? }
```

`guard.triggered` is an unreviewed detector signal. It is useful evidence for
triage, metrics, and evaluator review, but it is not proof of agent fault. A
reviewed guard outcome may later produce `learning.feedback`; raw guard events
should not be routed as blame by themselves.

Some of these are currently dynamic event-store names rather than variants in
`SystemEvent`. The design direction is to type the stable core names while still
allowing adapter-local evidence events when needed.

## Inbox (time-window based)

Agents see recent events in their heartbeat. No ack/done needed:

```sql
SELECT id, event_type, data, urgency, timestamp
FROM events
WHERE owner = ?
  AND timestamp > ?              -- now - 2h
  AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
         timestamp DESC
LIMIT 20
```

Events naturally expire via TTL or time window. Agents act or they don't.

## Trigger Payloads

Reactive cron handlers receive the original event payload as trigger data:

```typescript
type TriggerEvent = {
  type: string;
  source: "timer" | "event" | "manual";
  entry: string;
  data?: Record<string, unknown>;
  timestamp: number;
};
```

The framework does not promote domain fields such as `sessionId`, `projectId`,
or `metricId` onto `TriggerEvent`. The event producer owns the payload shape;
the handler or workflow that subscribes to the event owns interpretation.

Example:

```typescript
// Emits event row data: { sessionId: "s_123", outcome: "done" }
sdk.emit("session.completed", { sessionId: "s_123", outcome: "done" });

// Subscriber reads the domain field from trigger data.
const sessionId = event?.data?.sessionId;
```

This keeps the event model simple: event type routes work, event data carries
the facts, and handlers decide what fields matter.

## Deriving State

Events support queryable state alongside mutable tables:

| Question | Query |
|----------|-------|
| Handler last fire? | `MAX(timestamp) WHERE event_type = 'handler.started' AND handler = ?` |
| Handler healthy? | `COUNT completed > COUNT failed` in window |
| Agent work stats? | `sessions GROUP BY agent, status` |
| Message dedup? | `EXISTS WHERE event_type = 'message.created' AND data LIKE ?` |

Note: some state is maintained directly (metrics.current, sessions.status) for query efficiency. The events table serves as the audit trail and supports time-window queries that mutable tables cannot.

## Agent-to-Agent Messaging

Uses `message.created` — the single async communication primitive:

```typescript
sdk.message("bob", "Review the PR");
// Emits: { type: "message.created", from: agent, to: "bob", content: "Review the PR" }
```

Bob sees it in his inbox on next heartbeat.

## Socket Boundary

The Unix socket is an event transport, not a second command system.

- Inbound JSON lines with a string `type` are accepted as bus events.
- `subscribe` and `status` are the only socket-local protocol frames.
- Legacy aliases are normalized at the socket boundary:
  `emit` unwraps to its named event, `close` becomes `shutdown`,
  `reload_agents` becomes `reload`, and `cancel_task` becomes `cancel_all`.
- Socket `ok` means the frame was accepted into the event transport. It does
  not mean every handler finished.

This keeps socket, Telegram, web, and runtime code on the same event-first
path: normalize at the edge, persist via the bus, and let subscribers react.

## Implementation

- **Typed core events:** `src/app/event-bus.ts`
- **Persistence:** `src/lib/db-writer.ts` subscribes to bus, writes all events
- **Inbox query:** `src/lib/runtime-ctx.ts` -> `getInbox()`
- **Heartbeat injection:** `shared/workflows/heartbeat-data.ts` -> `loadInbox()`

## Current Gaps To Close

- The typed `SystemEvent` union does not yet include every documented taxonomy
  event.
- Heartbeat dispatch still has legacy event naming in places; converge on
  `timer.heartbeat_due` at the boundary and keep workflow names conventional
  (`<owner>-heartbeat`).
- Some historical names remain in docs, tests, or old event rows. Normalize at
  the boundary rather than teaching agents multiple names.
- Event payload examples should use IDs and owner/context fields, not embedded
  metric/session objects, unless the payload truly needs the full object.

## Operational Status (appendix, refreshed 2026-05-07)

This section reflects what the runtime actually emits and consumes, so readers do
not mistake the taxonomy above for a live wiring diagram. Keep this table in sync
when the wiring changes; the taxonomy is aspirational when it disagrees with this
table.

### Emitter Reality

Query `SELECT event_type, COUNT(*) FROM events GROUP BY event_type` for current numbers.

| Event type | Emitted by | Status |
|---|---|---|
| `handler.started` | cron runner on every handler invocation | ✅ live |
| `handler.completed` | cron runner at handler success | ✅ live |
| `handler.failed` | cron runner at handler throw — rarely thrown because handler bodies catch internally | ⚠️ rarely emitted |
| `project.iteration` | `project.ts` on the default project path; legacy `master-worker.ts` can emit historical/compatibility shape | ⚠️ live default plus legacy compatibility shape |
| `session.failed` | session/runtime layer on session-end with error | ⚠️ degraded since 2026-05-03 — emission collapsed ~35× (70/day → 2/day); errored sessions now arrive as `session.completed{outcome:'error'}` (~33/day). KE-1248. |
| `session.completed` | session lifecycle translator after `session.end` for non-evaluator sessions; carries `outcome ∈ {done,error,interrupted}` | ✅ live and now the de-facto channel for errored/interrupted sessions |
| `project.status_changed` | no emitter exists | ❌ aspirational |
| `metric.breach` | `metrics-snapshot.ts` when `breached && !openAlert` | ⚠️ live; see consumer status below |
| `metric.stalled` | `metrics-snapshot.ts` on `stall_after_ms` window | ⚠️ live but no dedicated subscriber |
| `metric.recovered` | `metrics-snapshot.ts` when metric recovers from breach | ✅ live |
| `message.created` | message-bus emitter on agent-to-agent message create | ✅ live, low volume |
| `escalation.created` | `sdk.escalate` and workflow `ctx.escalate` | ⚠️ live, but current payloads are minimal/legacy and do not yet include full lifecycle correlation |
| `escalation.resolved` | no emitter exists | ❌ aspirational |
| `learning.feedback` | `evaluator-aftermath` when an owner finding should notify now | ✅ wired for actionable evaluator findings |

Note: `session.failed` and `session.completed` are translated from `session.end`
in `src/app/may.ts`. `project.status_changed` still has no emitter.

### Consumer Reality

Query for live numbers:
```sql
SELECT handler_name, COUNT(*) FROM handler_runs WHERE started_at > unixepoch() * 1000 - 86400000 * 7 GROUP BY handler_name;
```

| Handler | Subscribes to | Status notes |
|---|---|---|
| `session-recovery` | `session.failed` | ⚠️ emitter migrated to `session.completed{outcome:'error'}` (KE-1248) — event path fires zero times on real traffic; 5-min timer fallback does 100% of recovery work |
| `evaluator-aftermath` | `session.completed` | ✅ wired; `session-aftermath-scan` remains the 7-minute fallback |
| `escalation` | `session.escalated` | ✅ wired as event-first routing for blocked/failure finishes |
| (no lifecycle handler) | `escalation.created`, `escalation.resolved` | ❌ full escalation lifecycle routing/resume is not implemented yet |
| `metric-alert-reactor` | `metric.breach` | ✅ wired; timer fallback also scans unresolved alerts |
| (no handler) | `metric.stalled` | ❌ **no handler exists** — KE-781 |
| `context-learn` | `context-learn` | ❌ replaced by timer-driven `context-learn-poller` |

### When Extending This Design

Before adding a new `on:`-only handler:
1. Confirm the source event is emitted (query `events` table for ≥1 row in the last 7 days).
2. Add a timer-driven fallback only when the workflow needs delayed/backfill behavior.

Before adding a new event type to the `SystemEvent` union:
1. Identify the emitter site in code, not just in this spec. A type added here without an emitter is the failure mode that produced `project.status_changed` above.

### See Also

- KE-454 — `handler.completed` fires on failed sessions
- KE-455 — every event-only handler has fired zero times
- KE-468 — `project.iteration` has two incompatible payload shapes
