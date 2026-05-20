# Events & Inbox

## Core Principle

```
Event = something that happened at a point in time (immutable, append-only)
```

Events are the primary communication mechanism. State is derived from events where practical. Some tables (metrics, sessions) use mutable status columns for query efficiency — this is a pragmatic trade-off, not a violation. The events table remains append-only and is the audit trail.

## Schema

Every event has the same two-layer shape:

```typescript
type EventEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> = {
  type: string;        // canonical event name, e.g. "metric.breach"
  source?: string;     // emitter identity, e.g. "agent:may" or "web-ui"
  owner: string;       // responsible owner: "agent:<name>" or "human:<role>"
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  timestamp?: number;  // assigned by infra when omitted
  data: TData;         // event-specific facts for handlers/agents
};
```

The envelope is for infra: persistence, routing, TTL, urgency, and correlation.
`data` is for the event-specific context the handler or owner needs. Do not put
domain fields such as `sessionId`, `projectId`, `metricId`, `escalationId`,
`reason`, or long evidence in the envelope.

`owner` always means the responsible owner. It is never duplicated as
`data.owner`. Human owners use the same field: `owner: "human:<role>"`. Runtime
may deliver human-owned events to May because May is the human's deputy, but the
stored event keeps the original human owner.

Persistent row mapping:

| Event envelope field | `events` row |
|----------------------|--------------|
| `type` | `event_type` |
| `source` | `source` |
| `owner` | `owner` |
| `urgency` | `urgency` |
| `ttl_ms` | `ttl_ms` |
| `timestamp` | `timestamp` |
| `data` | `data` JSON |

Effective query schema. Some columns may be added by migrations after the base
`CREATE TABLE`; agents should rely on the event/query surfaces instead of
assuming the original DDL is complete.

```sql
CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,    -- dot-separated: "handler.completed"
  source     TEXT,             -- who emitted it
  owner      TEXT,             -- responsible owner / inbox route
  data       TEXT,             -- event-specific JSON payload
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

The snippets below show complete canonical envelopes. New emitters must produce
this shape before events reach the bus, socket, or event store.

Key categories agents encounter:

### Timers and triggers
```typescript
{
  type: "timer.tick",
  source: "timer",
  owner: "agent:may",
  data: { entry: "may-heartbeat" }
}
```

Timers are event sources. Cron/timer code should emit timer events; handlers then
bridge them to workflows. `trigger.<entry-name>` remains an operator/control
shortcut for manually firing a trigger entry; it is not the heartbeat lifecycle
event name.

### Handler lifecycle (paired)
```typescript
{
  type: "handler.completed",
  source: "cron",
  owner: "agent:may",
  data: { handler: "metric-alert-reactor", agent: "may", durationMs: 42 }
}
```

### Session lifecycle
```typescript
{
  type: "session.completed",
  source: "runtime",
  owner: "agent:tech-lead",
  data: {
    sessionId: "s_123",
    agent: "tech-lead",
    outcome: "done",
    status: "done",
    summary: "Implemented and verified."
  }
}
```

`session.end` is the low-level runtime lifecycle event. `session.completed` is
the canonical subscriber-facing terminal event for `outcome: "done" | "error" |
"interrupted"`. Runtime does not emit live `session.failed`.

### Metrics
```typescript
{
  type: "metric.breach",
  source: "metrics-snapshot",
  owner: "agent:may",
  urgency: "high",
  data: {
    metricId: "handler.success-rate",
    metricName: "Handler success rate",
    current: 0.5,
    threshold: 0.8,
    target: 0.95,
    message: "Handler success rate is below threshold.",
    priority: "P1"
  }
}

{
  type: "metric.alert_judged",
  source: "metric-alert-triage",
  owner: "agent:may",
  data: { alertId: "ma_123", metricId: "handler.success-rate", verdict: "fix_root_cause", reason: "Handler throws on missing session id.", evidence: {} }
}
```

Metrics are signals, not judgments. `metric.breach` wakes or informs the owner;
the owner agent judges whether to fix, calibrate, downgrade, escalate, or record
an accepted exception.

### Agent communication
```typescript
{
  type: "message.created",
  source: "agent:may",
  owner: "agent:dev",
  data: { from: "may", to: "dev", content: "Review the failing handler.", intent: "request", priority: "P2" }
}

{
  type: "agent.decision",
  source: "agent:dev",
  owner: "agent:dev",
  data: { agent: "dev", sessionId: "s_123", decision: "Fix handler input validation.", evidence: {} }
}
```

### Escalation lifecycle

Escalation events use the same event envelope as other events. Envelope fields
are for common event transport: type, source, owner, urgency/TTL, and timestamp.
`data` contains escalation-specific correlation, lifecycle state, and the
agent-facing brief. Do not hide routing decisions inside agent prose, and do not
put long investigation context into the envelope.

When a handler subscribes to an escalation event, it receives that canonical
event envelope directly. Handlers use envelope fields for common routing and
read escalation-specific fields from the envelope's `data` object.

```
{
  type: "escalation.created",
  source: "agent:tech-lead",
  owner: "agent:may",
  urgency: "high",
  data: {
    escalationId: "esc_123",
    parentEscalationId: "esc_parent",
    sourceAgent: "tech-lead",
    sourceSessionId: "s_123",
    projectId: "platform",
    projectPath: "/app/projects/platform",
    reason: "Blocked on missing session id.",
    requestedAction: "Find and fix the event producer.",
    severity: "P1",
    blockedOn: "event payload incomplete",
    evidence: {},
    resume: {},
    dedupKey: "tech-lead:may:missing-session-id"
  }
}

{
  type: "escalation.routed",
  source: "escalation-router",
  owner: "agent:may",
  data: { escalationId: "esc_123", route: "agent:may", reason: "owner wake queued" }
}

{
  type: "escalation.resolved",
  source: "agent:may",
  owner: "agent:tech-lead",
  data: {
    escalationId: "esc_123",
    resolverAgent: "may",
    outcome: "fixed",
    summary: "The event now includes session id.",
    evidence: {},
    resumeInstruction: "Retry the blocked review.",
    childEscalationId: "esc_child"
  }
}

{
  type: "escalation.dismissed",
  source: "agent:may",
  owner: "agent:tech-lead",
  data: { escalationId: "esc_123", dismissedBy: "may", reason: "Duplicate escalation." }
}

{
  type: "escalation.resume_attempted",
  source: "escalation-lifecycle",
  owner: "agent:tech-lead",
  data: { escalationId: "esc_123", sourceKind: "session", sourceRef: "s_123", resumeInstruction: "Continue." }
}

{
  type: "escalation.resume_started",
  source: "escalation-lifecycle",
  owner: "agent:tech-lead",
  data: { escalationId: "esc_123", sourceKind: "session", sourceRef: "s_123", resumedSessionId: "s_123", summary: "Resume started." }
}

{
  type: "escalation.resume_failed",
  source: "escalation-lifecycle",
  owner: "agent:tech-lead",
  data: { escalationId: "esc_123", sourceKind: "session", sourceRef: "s_123", category: "resume_failed", recoverable: true, reason: "Checkpoint expired." }
}
```

Escalation routing follows the same payload rule as every other reactive
handler: the event type and envelope route work; `data` carries the agent-facing
facts. The cron framework must deliver the original event envelope unchanged; it
must not add subscriber-specific shortcut fields.

For escalation events, `owner` is the responsibility label:

| `owner` | Runtime route |
|---------|---------------|
| `agent:<name>` | owner inbox / handler queue for `<name>` |
| `human:<role>` | deliver to May because May is the human's deputy; preserve the human owner |

Infra may deliver `human:<role>` escalations to May, but it must preserve the
original `owner` field on the event.

`escalation.resolved.outcome = "needs_human"` means the resolving owner created
or linked a child escalation whose `owner` is `human:<role>`. It is not a
terminal unblock for the original source work by itself.

Allowed `escalation.resolved.outcome` values are `fixed`, `answered`,
`rejected`, `needs_human`, and `superseded`. All are terminal for resume
purposes except `needs_human`, which keeps the parent escalation waiting on the
child human escalation.

On terminal `escalation.resolved`, infra resumes the original source session
when one is linked. For an active source session it sends the resolution context
into that session; otherwise it cold-resumes the source session. `workflowRunId`
and project fields are context for the resumed task, not separate resume
targets.

### Learning feedback
```typescript
{
  type: "learning.feedback",
  source: "evaluator-aftermath",
  owner: "human:requester",
  data: {
    kind: "owner_finding",
    summary: "[high] request_quality: clarify missing request context",
    sessionId: "s_123",
    agent: "dev",
    projectId: "platform",
    workflowRunId: "wr_123",
    evalTrailPath: ".state/sessions/history/s_123/session.eval.jsonl",
    finding: {
      id: "request-quality",
      scope: "request_quality",
      severity: "high",
      finding: "The request missed blocker evidence.",
      suggestedActions: ["Ask the requester for blocker evidence."]
    }
  }
}
```

`learning.feedback` is emitted by the evaluator for actionable session findings. It is owner-targeted inbox input, not the canonical evaluation record. The canonical record remains the sibling `session.eval.jsonl` trail beside the raw `session.jsonl`.

Routing rule: set event `owner` to the responsible owner, either
`agent:<name>` or `human:<role>`. For human-owned findings, runtime delivers the
event to May because May is the human's deputy, while preserving the original
human owner on the event. The human owner is enough routing context; do not add
a separate boolean for the same decision.

### Project, adapter, and guard events
```typescript
{
  type: "project.task.dispatched",
  source: "agent:may",
  owner: "agent:may",
  data: { projectId: "may/task-demo", projectPath: "projects/task-demo", taskId: "score-a", assignee: "evaluator" }
}

{
  type: "project.task.finished",
  source: "agent:may",
  owner: "agent:may",
  data: { projectId: "may/task-demo", projectPath: "projects/task-demo", taskId: "score-a", assignee: "evaluator", sessionId: "s_123", status: "done", finishStatus: "success" }
}

{
  type: "guard.triggered",
  source: "workflow",
  owner: "agent:may",
  data: { guard: "verify-after-write", action: "warned", reason: "No verification evidence.", sessionId: "s_123", workflowRunId: "wr_123", projectId: "platform" }
}
```

`project.comment.created`, `project.iteration`, `project.task.dispatched`,
`project.task.finished`, `project.status_changed`, `telegram.reply`,
`guard.triggered`, and `tool.executed` follow the same
envelope rule. `guard.triggered` is an unreviewed detector signal. It is useful
evidence for triage, metrics, and evaluator review, but it is not proof of agent
fault. A reviewed guard outcome may later produce `learning.feedback`; raw guard
events should not be routed as blame by themselves.

Some of these are currently dynamic event-store names rather than variants in
`SystemEvent`. The design direction is to type the stable core names while still
allowing adapter-local evidence events when needed.

For task-driven projects, `project.task.dispatched` and
`project.task.finished` are the task lifecycle events to teach in handler and
SDK examples. `project.iteration` remains a project-owner loop signal used by
current health metrics and historical rows; do not use it as the general task
lifecycle example.

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

## Handler Event Payloads

Reactive handlers receive the canonical event envelope directly:

```typescript
type EventEnvelope = {
  type: string;
  source: string;
  owner: string;
  timestamp?: number;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  data: Record<string, unknown>;
};
```

The framework does not promote domain fields such as `sessionId`, `projectId`,
or `metricId` onto the event envelope. The subscribed handler reads
event-specific fields from `event.data`.

Example:

```typescript
sdk.emit("session.completed",
  { sessionId: "s_123", outcome: "done" },
  { owner: "agent:may", source: "runtime" },
);

const sessionId = event?.data?.sessionId;
```

This keeps the event model simple: event type routes work, event data carries
the facts, and handlers decide what fields matter.

## Deriving State

Events support queryable state alongside mutable tables:

| Question | Query |
|----------|-------|
| Handler last fire? | `MAX(timestamp) WHERE event_type = 'handler.started' AND json_extract(data, '$.handler') = ?` |
| Handler healthy? | `COUNT completed > COUNT failed` in window |
| Agent work stats? | `sessions GROUP BY agent, status` |
| Message dedup? | `EXISTS WHERE event_type = 'message.created' AND data LIKE ?` |

Note: some state is maintained directly (metrics.current, sessions.status) for query efficiency. The events table serves as the audit trail and supports time-window queries that mutable tables cannot.

## Agent-to-Agent Messaging

Uses `message.created` — the single async communication primitive:

```typescript
sdk.message("bob", "Review the PR");
// Emits canonical message.created with source: "agent:<sender>",
// owner: "agent:bob", and data: { from, to, content, priority }.
```

Bob sees it in his inbox on next heartbeat.

## Socket Boundary

The Unix socket is an event transport, not a second command system.

- Inbound JSON lines with a string `type` are accepted as bus events when they
  already use the event schema. Dot-named events must use the canonical
  envelope (`type`, `source`, `owner`, `data`).
- `subscribe` and `status` are the only socket-local protocol frames.
- Non-dot daemon/operator frames such as `input`, `steer`, `cancel`, `resume`,
  `reload`, `shutdown`, and the legacy `fork` shortcut are accepted into the
  event path and handled by runtime subscribers. When a shortcut creates domain
  work, runtime should emit canonical trace events such as `message.created`.
- Deprecated wrapper aliases such as `emit`, `message`, `close`,
  `cancel_task`, and `reload_agents` are rejected instead of normalized.
- Socket `ok` means the frame was accepted into the event transport. It does
  not mean every handler finished.

This keeps socket, Telegram, web, and runtime code on the same event-first
path: validate at the edge, persist via the bus, and let subscribers react.

## Implementation

- **Typed core events:** `src/app/event-bus.ts`
- **Persistence:** `src/lib/db-writer.ts` subscribes to bus, writes all events
- **Inbox query:** `src/lib/runtime-ctx.ts` -> `getInbox()`
- **Heartbeat helper:** `packages/sdk/src/heartbeat-data.ts` -> `loadInbox()`

## Current Gaps To Close

- The typed `SystemEvent` union does not yet include every documented taxonomy
  event.
- Keep heartbeat bus events under the `heartbeat.*` namespace; workflow
  lifecycle callback names are local to the workflow tool.
- Some historical names remain in docs, tests, or old event rows. Do not teach
  agents multiple names; update active producers/consumers to canonical names
  and leave old rows as historical data.
- Event payload examples should use the envelope shape above, not flattened
  domain fields.

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
| `project.iteration` | `agents/may/handlers/project.ts` when launching a project action; legacy `master-worker.ts` can emit historical/compatibility shape | ⚠️ live owner-loop signal; not the task lifecycle event |
| `project.task.dispatched` | `agents/may/handlers/project.ts` when dispatching a ready `## Tasks` item to its assignee | ✅ live for task-driven projects |
| `project.task.finished` | `agents/may/handlers/project.ts` when the task session resolves or throws | ✅ live for task-driven projects |
| `session.completed` | session lifecycle translator after `session.end`; carries `outcome ∈ {done,error,interrupted}` | ✅ canonical subscriber-facing terminal event, including errored/interrupted sessions |
| `project.status_changed` | no emitter exists | ❌ aspirational |
| `metric.breach` | `metrics-snapshot.ts` when `breached && !openAlert` | ⚠️ live; see consumer status below |
| `metric.stalled` | `metrics-snapshot.ts` on `stall_after_ms` window | ⚠️ live but no dedicated subscriber |
| `metric.recovered` | `metrics-snapshot.ts` when metric recovers from breach | ✅ live |
| `message.created` | message-bus emitter on agent-to-agent message create | ✅ live, low volume |
| `escalation.created` | `sdk.escalate`; blocked/failure session boundary promotion; boundary promotion of a workflow `ctx.escalate` result is the intended path when routing is needed | ✅ canonical event; workflow `ctx.escalate` itself is local and should not emit this event |
| `escalation.resolved` | owner sessions/handlers may emit it when they have a disposition | ✅ persisted as a canonical event and handled by escalation lifecycle for session resume |
| `learning.feedback` | `evaluator-aftermath` when an owner finding should notify now | ✅ wired for actionable evaluator findings |

Note: `session.completed` is translated from `session.end` in daemon event
subscribers. `session.failed` is not a live runtime event. `project.status_changed`
still has no emitter.

### Consumer Reality

Query for live numbers:
```sql
SELECT handler_name, COUNT(*) FROM handler_runs WHERE started_at > unixepoch() * 1000 - 86400000 * 7 GROUP BY handler_name;
```

| Handler | Subscribes to | Status notes |
|---|---|---|
| `session-recovery` | target: `session.completed` where `outcome` is `error` or `interrupted` | Converge on `session.completed` for real-time recovery, with the 5-min timer fallback scanning missed terminal errors. |
| `evaluator-aftermath` | `session.completed` | ✅ wired; `session-aftermath-scan` remains the 7-minute fallback |
| `escalation` | `escalation.created` | ⚠️ owner routing still depends on subscribed handlers/workflows |
| `escalation-lifecycle` | `escalation.resolved`, `escalation.dismissed` | ✅ resumes the source session for terminal outcomes; `needs_human` waits for the human child escalation |
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
