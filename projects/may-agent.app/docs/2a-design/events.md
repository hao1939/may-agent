# Events & Inbox

## Core Principle

```
Event = something that happened at a point in time
```

Events are the primary communication mechanism. State is derived from events where practical. Some tables (metrics, sessions) use mutable status columns for query efficiency — this is a pragmatic trade-off, not a violation. The events table serves as the audit trail for the **retention window** (currently 7 days — see Data Retention below), though its current mutable columns (`status`, `handled_by`, `result`, `reason`, `retry_count`) predate the delivery-acceptance model and should not be treated as reliable acceptance state.

> **Not append-only.** The `db-retention` handler (daily cron) deletes events
> older than 7 days. As of 2026-06-10, ~1M historical events have been pruned;
> only the most recent ~7 days survive in the table. Do not assume events
> persist indefinitely. See "Data Retention" section below.

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

## Targeting And Fallback

Event firing follows one rule:

```text
event target exists -> fire the target
no target consumer  -> follow the ownership chain
```

The target is the specific thing the event is about. It can be a subscribed
handler entry, a session id, a project id, a metric id, an escalation id, or a
human/agent inbox target. The target lives in the canonical envelope and `data`;
dispatch code must not invent a second event shape.

Examples:

- `project.task.assigned` targets the project and task in `data`; the matching
  project workflow handler should run.
- `project.owner.requested` targets the project in `data.project`,
  `data.projectId`, or `data.project_id`; only handlers for that project should
  run. `project.planning.requested` is the legacy compatibility alias.
- `session.steer.requested` targets `data.sessionId`; if that session is gone,
  the owner handles the failed intent.
- `metric.breach` targets `data.metricId`; the metric/project owner is the
  accountability fallback.
- `message.created` targets the inbox represented by `owner`.

`owner` is not the first routing guess for every event. It is the backstop:
when no targeted handler/session/project path consumes the event, the owner is
responsible for judging, repairing, escalating, or explicitly recording a no-op.

Persistent row mapping:

| Event envelope field | `events` row | Notes |
|----------------------|--------------|-------|
| `type` | `event_type` | |
| `source` | `source` | |
| `owner` | `owner` | |
| `urgency` | `urgency` | |
| `ttl_ms` | `ttl_ms` | |
| `timestamp` | `timestamp` | |
| `data` | `data` JSON | |
| *(infra only)* | `delivery_status` | `pending`, `accepted`, or `unhandled`; delivery bookkeeping |
| *(infra only)* | `accepted_by` | Responsible consumer that accepted delivery |
| *(infra only)* | `accepted_at` | Acceptance timestamp |
| *(infra only)* | `delivery_route` | `direct`, `owner_inbox`, or `noop` |
| *(infra only)* | `delivery_note` | Optional delivery detail |
| *(legacy infra)* | `status` | Legacy inbox/expiry column; do not use for delivery acceptance |
| *(legacy infra)* | `handled_by` | Legacy inbox/manual consumer marker; not equivalent to delivery acceptance |
| *(legacy infra)* | `result` | Legacy inbox/manual result marker; not equivalent to work completion |
| *(legacy infra)* | `reason` | Legacy expiry/manual reason |
| *(legacy infra)* | `retry_count` | Default 0; legacy retry placeholder |

Target query schema after delivery convergence. Runtime migrations add these
columns for existing databases; legacy reads remain during the transition.

```sql
CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL,       -- dot-separated: "handler.completed"
  source       TEXT,                -- who emitted it
  owner        TEXT,                -- responsible owner / inbox route
  data         TEXT,                -- event-specific JSON payload
  timestamp    INTEGER NOT NULL,
  -- delivery metadata:
  delivery_status    TEXT DEFAULT 'pending', -- pending | accepted | unhandled
  accepted_by        TEXT,
  accepted_at        INTEGER,
  delivery_route     TEXT,                   -- direct | owner_inbox | noop
  delivery_note      TEXT,
  -- legacy columns retained during migration:
  status       TEXT DEFAULT 'pending',
  handled_by   TEXT,
  result       TEXT,
  reason       TEXT,
  retry_count  INTEGER DEFAULT 0,
  ttl_ms       INTEGER,
  urgency      TEXT DEFAULT 'normal'
);
```

> **Note on mutable columns:** `status`, `handled_by`, `result`, `reason`, and
> `retry_count` are legacy operational columns. They may be read during
> migration, but new runtime behavior should write `delivery_*` fields and
> follow-up events instead. Do not assume today's `handled` rows mean delivery
> happened or work is done.

## Event Types

This doc is the canonical event taxonomy. `projects/may-agent/src/app/event-bus.ts` should converge
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

### Human control intents

Human-facing channels do not send free-floating input. CLI, Telegram, Web, and
May Console either target a known session or explicitly request a chat session.
These are intent events: they request work from the daemon. The daemon then
emits normal session/domain events such as `session.start`, `session.end`, and
`project.comment.created`.

```typescript
{
  type: "chat.start.requested",
  source: "may-console",
  owner: "agent:may",
  data: {
    agent: "may",
    message: "hello",
    channel: "may-console",
    channelThreadId: "local-terminal"
  }
}

{
  type: "session.steer.requested",
  source: "web-ui",
  owner: "agent:may",
  data: {
    sessionId: "s_123",
    message: "continue from the failing test"
  }
}

{
  type: "session.cancel.requested",
  source: "telegram",
  owner: "agent:may",
  data: {
    sessionId: "s_123"
  }
}

{
  type: "session.cancel_all.requested",
  source: "may-console",
  owner: "agent:may",
  urgency: "high",
  data: {
    reason: "human requested cancel all"
  }
}

{
  type: "runtime.reload.requested",
  source: "telegram",
  owner: "agent:may",
  data: {
    reason: "human requested reload"
  }
}

{
  type: "runtime.restart.requested",
  source: "may-console",
  owner: "agent:may",
  urgency: "high",
  data: {
    reason: "human requested restart"
  }
}

{
  type: "runtime.shutdown.requested",
  source: "web-ui",
  owner: "agent:may",
  urgency: "high",
  data: {
    reason: "human requested shutdown"
  }
}
```

Read-only transport controls such as socket `subscribe` and `status` are not
durable events. Existing shortcut frames such as `input`, `steer`, `fork`,
`cancel_all`, `reload`, and `shutdown` are compatibility ingress frames and
should normalize to canonical intent events at the socket boundary before
events reach the bus. `session.cancel.requested` is currently treated as a
socket command type for flat-frame compatibility; after normalization, durable
uses of that name should use the canonical envelope shown above.

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
    projectPath: "/app/projects/may-agent",
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
  type: "project.action.requested",
  source: "web-ui",
  owner: "agent:aks-explorer",
  data: { projectPath: "projects/aks-rp-e2e", action: "replan", params: { selectedPathIds: ["path.managedsystem.rest-add-existing.minimal-rest"] } }
}

{
  type: "guard.triggered",
  source: "workflow",
  owner: "agent:may",
  data: { guard: "verify-after-write", action: "warned", reason: "No verification evidence.", sessionId: "s_123", workflowRunId: "wr_123", projectId: "platform" }
}
```

`project.comment.created`, `project.action.requested`, `project.iteration`,
`project.task.dispatched`, `project.task.finished`, `project.status_changed`,
`telegram.reply`, and `guard.triggered` follow the same
envelope rule. `guard.triggered` is an unreviewed detector signal. It is useful
evidence for triage, metrics, and evaluator review, but it is not proof of agent
fault. A reviewed guard outcome may later produce `learning.feedback`; raw guard
events should not be routed as blame by themselves.

Some of these are currently dynamic event-store names rather than variants in
`SystemEvent`. The design direction is to type the stable core names while still
allowing adapter-local evidence events when needed.

For task-driven projects, the **live** task lifecycle events are
`project.task.assigned` (planner assigns task to worker) and
`project.task.completed` (task engine records completion). These have
1,293 and 2,822 rows respectively as of 2026-06-15 and are the events to
teach in handler and SDK examples. The older `project.task.dispatched` and
`project.task.finished` pair (legacy project handler) has only 2 rows each
and is effectively dead — do not use them as the canonical example.
`project.iteration` remains a project-owner loop signal used by current
health metrics and historical rows; do not use it as the general task
lifecycle example.

## Inbox (Owner Pull Route)

Inbox is not a separate event lifecycle. It is one delivery route in the unified
event model.

Use inbox when an event is addressed to an owner and should be picked up by that
owner's heartbeat/review loop instead of a direct runtime handler. The inbox
route is useful for human feedback, project feedback, async agent messages, and
owner-review items.

```text
event emitted
→ direct handler accepts it
  OR owner_inbox accepts it as fallback
→ owner heartbeat/review later reacts by emitting a normal follow-up event
```

The states are intentionally separate:

```text
delivery_status = did a responsible route accept the event?
delivery_route  = how was it accepted? direct | owner_inbox | noop
pair/work state = did the expected follow-up event arrive?
```

Example:

```text
message.created owner=agent:dev
→ no direct handler needed
→ owner_inbox accepts it
→ delivery_status=accepted
→ accepted_by=owner-inbox
→ delivery_route=owner_inbox

dev heartbeat reads it
→ emits message.consumed or message.reviewed
```

Project feedback uses the same path:

```json
{
  "type": "project.feedback.created",
  "source": "human:operator",
  "owner": "agent:aks-explorer",
  "data": {
    "projectId": "aks-rp-e2e.app",
    "projectPath": "/app/projects/aks-rp-e2e.app",
    "target": { "kind": "task", "id": "vm-pipeline-coverage" },
    "message": "Prioritize extracting every scenario before running live tests."
  }
}
```

If the project app has a direct handler, it accepts the event directly. If not,
the owner inbox accepts it and the project owner/planner reacts from the next
review packet by emitting a follow-up event such as
`project.feedback.reviewed`.

Agents see recent inbox-routed events in their heartbeat as context. Reading an
event for passive context is not delivery acceptance. Acting on an inbox item is
a normal event, not a special column update.

```sql
SELECT id, event_type, data, urgency, timestamp
FROM events
WHERE owner = ?
  AND delivery_route = 'owner_inbox'
  AND timestamp > ?              -- now - 2h
  AND (ttl_ms IS NULL OR timestamp + ttl_ms > ?)
  AND NOT EXISTS (
    SELECT 1 FROM event_pair_runs p
    WHERE p.open_event_id = events.id
      AND p.status IN ('closed', 'orphan')
  )
ORDER BY CASE WHEN urgency = 'immediate' THEN 0 ELSE 1 END,
         timestamp DESC
LIMIT 20
```

After heartbeat/review acts on an inbox item, it emits a follow-up event:

```text
message.created            → message.consumed or message.reviewed
project.feedback.created   → project.feedback.reviewed
project.owner.requested    → project.owner.reviewed
```

Pair tracking then closes the original inbox-routed item. If no follow-up event
arrives within the expected window, infra surfaces it as stale/orphan owner
work. Do not add inbox-specific state columns for this; inbox follows the same
event flow as every other delivery route.

Events are retained for 7 days, then bulk-deleted by the `db-retention` handler
(daily cron). Agents act within the retention window or they don't. `ttl_ms`
can shorten a specific delivery or inbox reaction window; long-term storage
expiry is still enforced by retention.

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
sdk.message("dev", "Review the PR");
// Emits canonical message.created with source: "agent:<sender>",
// owner: "agent:dev", and data: { from, to, content, priority }.
```

The recipient sees it in their inbox on next heartbeat.

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

- **Typed core events:** `projects/may-agent/src/app/event-bus.ts`
- **Persistence:** `projects/may-agent/src/lib/db-writer.ts` subscribes to bus, writes all events
- **Inbox query:** `projects/may-agent/src/lib/runtime-ctx.ts` -> `getInbox()`
- **Heartbeat helper:** `projects/may-agent/packages/sdk/src/heartbeat-data.ts` -> `loadInbox()`

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

## Operational Status (appendix, refreshed 2026-06-13)

This section reflects what the runtime actually emits and consumes, so readers do
not mistake the taxonomy above for a live wiring diagram. Keep this table in sync
when the wiring changes; the taxonomy is aspirational when it disagrees with this
table.

### Emitter Reality

Query `SELECT event_type, COUNT(*) FROM events GROUP BY event_type` for current numbers.
Row counts below are **surviving rows** (7-day retention applies to `events` table — see Data Retention section). Snapshot refreshed 2026-06-18.

**Handler lifecycle**

| Event type | Emitted by | Status |
|---|---|---|
| `handler.started` | cron runner on every handler invocation | ✅ live (32.5k rows) |
| `handler.completed` | cron runner at handler success | ✅ live (32.4k rows) |
| `handler.failed` | cron runner at handler throw | ✅ live (236 rows); `aks-rp-e2e-task-execution-worker` accounts for 189 of 236; remaining failures spread across `scout-explore-xhs` (17), `metrics-snapshot` (5), `metric-alert-reactor` (5), `aks-rp-e2e-project-planner` (4), `aks-rp-e2e-ready-task-picker` (3), `aks-rp-e2e-project-watchdog` (3), and others |
| `handler.skipped` | cron runner when handler is skipped (debounce, no-op) | ✅ live (9.2k rows) |
| `handler.workflow_dispatched` | cron runner when handler dispatches a workflow session | ✅ live (15.9k rows) |
| `handler.routed` | handler routing infrastructure | ✅ live (46 rows) |

**Session lifecycle**

| Event type | Emitted by | Status |
|---|---|---|
| `session.start` | runtime session lifecycle | ✅ live (8.3k rows) |
| `session.end` | runtime session lifecycle | ✅ live (8.2k rows) |
| `session.completed` | session lifecycle translator after `session.end`; carries `outcome ∈ {done,error,interrupted}` | ✅ canonical subscriber-facing terminal event (4.3k rows) |
| `session.receipt` | runtime on session completion receipt | ✅ live (6.7k rows) |
| `session.cancel.requested` | cancel intent from CLI/UI; currently also accepted as a flat socket command | ✅ live (248 rows) |
| `session.resume_failed` | session-recovery when a resume target session is not found or cannot be resumed | ⚠️ dormant (2,333 rows aging out; last event 2026-06-15 04:53Z, rate 0/hr for 3+ days). Originally rebounded after Spec-3 collapse (14–48/hr Jun 14–15) then stopped permanently. Fix: dedup_key (KE-1837, ORDER-010 src/ change required); KE-1962: no handler subscriber |
| `session.watchdog.cancelled` | watchdog cancellation of stale sessions | ⚠️ rare (10 rows) |

**Human control intents**

| Event type | Emitted by | Status |
|---|---|---|
| `chat.start.requested` | canonical human-surface chat create-or-bind intent | ✅ live (14 rows) |
| `session.steer.requested` | canonical human-surface session steering intent | ✅ live (10 rows) |
| `session.cancel.requested` | canonical human-surface session cancel intent | ✅ live (248 rows); see session lifecycle above |
| `session.cancel_all.requested` | canonical broad cancel intent | ❌ intended; 0 rows in DB |
| `runtime.reload.requested` | canonical runtime reload intent | ✅ live (21 rows) |
| `runtime.restart.requested` | canonical runtime restart intent | ✅ live (1 row) |
| `runtime.shutdown.requested` | canonical runtime shutdown intent | ❌ intended; 0 rows in DB |

**Project lifecycle — owner loop**

| Event type | Emitted by | Status |
|---|---|---|
| `project.iteration` | `agents/may/handlers/project.ts` when launching a project owner loop | ⚠️ live owner-loop signal; not the task lifecycle event (301 rows) |
| `project.owner.dispatched` | project handler when dispatching an owner session | ✅ live (301 rows) |
| `project.owner.finished` | project handler when owner session finishes | ✅ live (298 rows) |
| `project.owner.incomplete` | project handler when owner session finishes without completing | ✅ live (12 rows) |
| `project.execution.requested` | project handler or explicit UI workflow wake requesting iteration/execution | ✅ live (1.2k rows) |
| `project.nudge` | project handler nudging stale/idle projects | ✅ live (39 rows) |
| `project.audit.suggested` | project health check suggesting an audit | ✅ live (37 rows) |
| `project.comment.created` | project comment system | ✅ live (2 rows) |
| `project.action.requested` | HTTP/UI event ingress for project UI requests that the project app should interpret | ✅ accepted |
| `project.status_changed` | no emitter exists | ❌ aspirational |
| `project.execution.watchdog` | manual/operator recovery for stale zero-op sessions | ⚠️ rare (1 row); not wired to a handler |

**Project lifecycle — owner & watchdog**

| Event type | Emitted by | Status |
|---|---|---|
| `project.owner.requested` | project-apps and agent sessions when requesting owner review (e.g. after task completion, human steering, metric signal) | ✅ canonical V3 event |
| `project.planning.requested` | legacy compatibility alias for owner review | ⚠️ legacy; accepted during migration |
| `project.watchdog.tick` | project execution watchdog schedule (cron-fired, checks for stale sessions) | ✅ live (~690 rows, ~276/24h, ~12/hour); single project `aks-rp-e2e`, 5-min interval cron |
| `project.tick` | project-app scheduled tick (e.g. `lane: "learning"`, `lane: "replan-review"`); emitted by `app.ts` in project apps such as `aks-rp-e2e.app` and `may-agent.app` | ✅ live (19 rows); from `project-app:aks-rp-e2e:schedule:regular-learning` |
| `project.problem.requested` | project-app problem-solver trigger when tasks fail with a common root cause | ✅ live (~195 rows); owner `agent:may` routes to problem-solver workflow |
| `project.problem.escalated` | project-app problem-solver when a fix is found and applied | ✅ live (~170 rows) |

**Project lifecycle — task-driven**

| Event type | Emitted by | Status |
|---|---|---|
| `project.task.dispatched` | project handler when dispatching a task item to its assignee | ✅ live (20 rows) |
| `project.task.finished` | project handler when the task session resolves or throws | ✅ live (20 rows) |
| `project.task.execution.requested` | project task engine requesting task execution | ✅ live (2.5k rows) |
| `project.tasks.ready` | project task engine when tasks become ready | ✅ live (1.4k rows) |
| `project.task.completed` | project task engine when a task completes | ✅ live (2.2k rows) |
| `project.task.assigned` | project-planner when assigning a task to a worker agent | ✅ live (268 rows); from `agent:aks-explorer` project-planner sessions |

**Project health**

| Event type | Emitted by | Status |
|---|---|---|
| `project.health.checked` | project health checker on every check cycle | ⛔ emission removed (commit 73d989fdb, 2026-06-10); all rows purged by 7-day retention (0 rows as of 2026-06-18) |
| `project.health.finding` | project health checker on detected issues | ✅ live (178 rows) |

**Task lifecycle (generic)**

| Event type | Emitted by | Status |
|---|---|---|
| `task.started` | task execution engine | ✅ live (3.4k rows) |
| `task.claimed` | task execution engine when agent claims a task | ✅ live (1.3k rows) |
| `task.verified` | task execution engine when task passes verification | ✅ live (333 rows) |
| `task.promoted` | task execution engine when task is promoted | ✅ live (82 rows) |
| `task.rejected` | task execution engine when task is rejected | ✅ live (979 rows) |
| `task.requeued` | task execution engine when task is requeued for retry | ✅ live (276 rows) |
| `task.blocked` | task execution engine when task is blocked | ✅ live (16 rows) |
| `task.deferred` | task execution engine when a task is deferred (e.g. waiting for dependency gate) | ⚠️ rare (1 row); from `agent:aks-explorer` |

**Evaluation lifecycle**

| Event type | Emitted by | Status |
|---|---|---|
| `evaluation.routed` | evaluator aftermath when routing a session for review | ✅ live (3.7k rows) |
| `evaluation.reviewed` | evaluator aftermath after reviewing a session | ✅ live (3.1k rows) |
| `evaluation.triage_closed` | evaluator aftermath when triage is closed | ✅ live (2.1k rows) |
| `evaluation.learning_created` | evaluator aftermath when a learning is extracted | ✅ live (1.4k rows) |
| `evaluation.success_candidate` | evaluator aftermath marking a session as good | ✅ live (1.1k rows) |
| `evaluation.deep_dispatched` | evaluator dispatching an LLM-based deep eval | ✅ live (177 rows) |
| `evaluation.deep_recorded` | evaluator recording a deep eval result | ✅ live (190 rows) |
| `evaluation.false_good` | evaluator overturning a previously-good session | ✅ live (109 rows) |
| `evaluation.skipped` | evaluator skipping a session (not worth evaluating) | ✅ live (41 rows) |

**Metrics**

| Event type | Emitted by | Status |
|---|---|---|
| `metric.breach` | `metrics-snapshot.ts` when `breached && !openAlert` | ✅ live (307 rows) |
| `metric.recovered` | `metrics-snapshot.ts` when metric recovers from breach | ✅ live (308 rows) |
| `metric.alert_judged` | metric-alert-triage workflow after agent judges an alert | ✅ live (152 rows) |
| `metric.stalled` | `metrics-snapshot.ts` on `stall_after_ms` window | ❌ 0 rows in events table; emitter may have been removed or is dormant |

**Agent communication**

| Event type | Emitted by | Status |
|---|---|---|
| `message.created` | message-bus emitter on agent-to-agent message create | ✅ live (1.6k rows) |
| `message.delivery_failed` | message delivery when target is unreachable | ❌ 0 rows in DB |
| `agent.decision` | agent sessions recording decisions | ✅ live (1.4k rows) |
| `agent.config_invalid` | config loader on agent config validation failure | ❌ 0 rows in DB |

**Escalation lifecycle**

| Event type | Emitted by | Status |
|---|---|---|
| `escalation.created` | `sdk.escalate`; blocked/failure session boundary promotion | ✅ live (46 rows) |
| `escalation.routed` | escalation router emits after routing to owner | ✅ live (46 rows) |
| `escalation.resolved` | owner sessions/handlers may emit it when they have a disposition | ❌ **no emitter exists** — 0 rows in events table; escalation lifecycle handler not implemented (KE-1242) |

**Heartbeat lifecycle**

| Event type | Emitted by | Status |
|---|---|---|
| `heartbeat.step_started` | heartbeat workflow on each step | ✅ live (1.4k rows) |
| `heartbeat.diagnostics_started` | heartbeat diagnostics phase start | ✅ live (149 rows) |
| `heartbeat.diagnostics_completed` | heartbeat diagnostics phase end | ✅ live (149 rows) |
| `heartbeat.skipped` | heartbeat skipped (agent busy, debounce) | ✅ live (21 rows) |

**Session recovery**

| Event type | Emitted by | Status |
|---|---|---|
| `session.recovery_failed` | session-recovery handler (`agent:may`) when a task's original session or task record is missing | ⚠️ rare (7 rows); distinct from `session.resume_failed` (which fires when a resume target sessionId is not found) |

**Learning and feedback**

| Event type | Emitted by | Status |
|---|---|---|
| `learning.feedback` | `evaluator-aftermath` when an owner finding should notify now | ✅ wired for actionable evaluator findings (208 rows) |

**Context and infrastructure**

| Event type | Emitted by | Status |
|---|---|---|
| `context.read` | context system when reading agent context | ✅ live (3.6k rows); ⛔ evaluator-aftermath emission removed (commit 73d989fdb, 2026-06-10) |
| `steer` | session steering from CLI/UI | ✅ live (4 rows) |
| `trigger.project` | manual project trigger from operator | ✅ live (2 rows) |
| `restart` | daemon restart signal | ✅ live (5 rows) |
| `reload` | daemon reload signal | ✅ live (1 row) |
| `codex.probe` | codex integration probe (external tooling handshake) | ⚠️ rare (1 row); ephemeral diagnostic |
| `cancel` | legacy cancel signal from session watchdog / operator | ⚠️ legacy (10 rows, no `source`); superseded by `session.cancel.requested` |

### Data Quality: Malformed event_type rows

As of 2026-06-15, 11 events have an entire JSON blob stored in `event_type`
instead of a plain dot-separated string (e.g.
`{"type":"project.execution.requested","project":"aks-rp-e2e",...}`). These
were injected via codex/operator and bypass the normal emit path. They are not
harmful but will not match any handler's `on:` filter. Two temporal clusters:
7 events from ~5.3 days ago, 4 events from ~0.3 days ago (KE-1991). Query:
`SELECT * FROM events WHERE LENGTH(event_type) > 100`.

Note: `session.completed` is translated from `session.end` in daemon event
subscribers. `session.failed` is not a live runtime event. `project.status_changed`
still has no emitter. `session.resume_failed` is dormant — last event 2026-06-15 04:53Z, rate 0/hr for 3+ days (2,333 rows aging out via retention).
Split shifted: ~50% task, ~41% planner, ~8% problem (was planner-dominated until Jun 14).

### Consumer Reality

Query for live numbers:
```sql
SELECT handler_name, COUNT(*) FROM handler_runs WHERE started_at > unixepoch() * 1000 - 86400000 * 7 GROUP BY handler_name;
```

| Handler | Subscribes to | Status notes |
|---|---|---|
| `session-recovery` | target: `session.completed` where `outcome` is `error` or `interrupted` | Converge on `session.completed` for real-time recovery, with the 5-min timer fallback scanning missed terminal errors. |
| `evaluator-aftermath` | `session.completed` | ✅ wired; `session-aftermath-scan` remains the 7-minute fallback |
| `escalation` | `escalation.created` | ✅ routes to owner via message; emits `escalation.routed` |
| `escalation-lifecycle` | `escalation.resolved`, `escalation.dismissed` | ❌ **no handler exists** — no `.ts` file implements this; `escalation.resolved` has 0 rows in events table (KE-1242) |
| `metric-alert-reactor` | `metric.breach` | ✅ wired; timer fallback also scans unresolved alerts |
| (no handler) | `metric.stalled` | ❌ **no handler exists** — KE-781 |
| `context-learn` | `context-learn` | ❌ replaced by timer-driven `context-learn-poller` |

### When Extending This Design

Before adding a new `on:`-only handler:
1. Confirm the source event is emitted (query `events` table for ≥1 row in the last 7 days).
2. Add a timer-driven fallback only when the workflow needs delayed/backfill behavior.

Before adding a new event type to the `SystemEvent` union:
1. Identify the emitter site in code, not just in this spec. A type added here without an emitter is the failure mode that produced `project.status_changed` above.

## Data Retention

The `db-retention` handler (`agents/may/handlers/db-retention.ts`, daily cron)
enforces these windows:

| Table | Retention | Delete condition |
|---|---|---|
| `events` | 7 days | `timestamp < now - 7d` |
| `sessions` | 14 days | `startedAt < now - 14d` |
| `session_digests` | 14 days | `created_at < now - 14d` |
| `workflow_runs` | 14 days | `startedAt < now - 14d` |
| `metric_snapshots` | 14 days | `measured_at < now - 14d` |
| `evaluations` | 30 days | `createdAt < now - 30d` |

After deletions exceed 1,000 rows, a `VACUUM` reclaims disk space.

### Size-based retention (added 2026-06-14, KE-1986)

In addition to age-based retention, rows with oversized data blobs are deleted
regardless of age:

| Table | Column | Threshold | Rationale |
|---|---|---|---|
| `events` | `data` | > 1 MB | Normal events avg ~7 KB; 1 MB is 100x+ margin |
| `sessions` | `task` | > 1 MB | Normal sessions avg ~42 KB |
| `session_digests` | `task` | > 1 MB | Same threshold as sessions |
| `workflow_runs` | `task` | > 1 MB | Same threshold as sessions |

Always VACUUMs if any oversized rows are deleted (individual rows can be 200 MB+).
Trigger: the `platform-owner-review` context cascade (KE-1986) created events with
exponentially growing `data` blobs (up to 220 MB each), reaching 987.6 MB across
22 events. Commit `a1ff9b269`.

**Tables with no retention policy (low-priority — small row counts):**

| Table | Rows | Notes |
|---|---|---|
| `file_reads` | ~6k | Low growth rate |
| `notification_messages` | ~3k | Low growth rate |
| `metric_alerts` | ~2k | Low growth rate |

These tables total ~11k rows and are not high-growth. They can be addressed
later if they become significant.

**Implication for agents:** Any query window exceeding the retention limit returns
incomplete data. `COUNT(*)` over `events` reflects only the surviving window, not
lifetime totals. Session-based analytics should stay within 14 days.

Approved 2026-06-04 via `shared/work-queue.md`; proposal at
`agents/arc/workspace/proposals/2026-05-27-db-retention-policy.md`.

### See Also

- KE-454 — `handler.completed` fires on failed sessions
- KE-455 — every event-only handler has fired zero times
- KE-468 — `project.iteration` has two incompatible payload shapes

## Proposal: Event Delivery and Completion Tracking (2026-06-18)

### Event Rule

An event exists because something can react.

If the system only needs history, UI timeline, or metrics, write
state/log/metric records directly. Do not send that through the event bus.
DbWriter is persistence for events that already exist; it is not the reason to
create an event and it is not a consumer.

Every event that enters the bus must have a responsible consumer. The consumer
does not have to be a project owner; it can be an infra component or a default
owner route. For example, `session.end` is a valid event because completion
tracking, cleanup, evaluation, or recovery logic may react to it.

Events can also be extension interfaces. A project or runtime may emit a stable
event so optional handlers can subscribe later. That is still valid, but the
event must not disappear into the bus: if no specialized handler is installed,
the default owner/observer path must consume it and decide whether to ignore,
record, or act. If no component or extension point can ever react, it should be
a log/state update instead of an event.

```
event emitted → bus delivers to subscribers
             → one or more subscribers accept responsibility → accepted
             → no subscriber accepts responsibility → unhandled → owner
```

### Two Things Infra Tracks

**1. Was the event accepted?** (delivery accepted, not work done)

A responsible consumer is the handler/owner/runtime component that reacts to the
event. DbWriter, UI tailing, logging, and passive metrics readers do not count.

Examples:

- `project.owner.requested` → project owner/planner reacts
- `metric.breach` → metric owner or ops review reacts
- `session.end` → session completion tracking/evaluator/recovery reacts
- `escalation.resolved` → escalation tracker closes the open escalation
- `runtime.restart.requested` → runtime control handler reacts

**2. Was the work completed?** (done — for paired events only)

Some events start work that has a defined end. Infra tracks the pair:

```
opening event → work in progress → closing event → done
             → no closing event within timeout → orphan → surface
```

### Delivery Tracking

When `bus.emit(event)` runs:

1. DbWriter stores the event for recovery and audit
2. Bus delivers to all subscribers
3. Subscribers that actually consume the event report acceptance
4. If at least one responsible subscriber accepted the event → update the
   original event row with delivery metadata
5. If no responsible subscriber accepted the event before TTL → mark the
   original event row `unhandled`
6. `unhandled` events → surface to the event owner, then May if there is no
   specific owner route

Acceptance is not a new event. Do not append `event.accepted` or similar for
the normal path. Acceptance is runtime delivery bookkeeping on the original
event:

```sql
delivery_status TEXT DEFAULT 'pending', -- pending | accepted | unhandled
accepted_by     TEXT,                   -- cron:..., app:..., runtime:...
accepted_at     INTEGER,
delivery_route  TEXT,                   -- direct | owner_inbox | noop
delivery_note   TEXT
```

Only emit another event when the delivery state itself needs a reaction. For
example, a sweep may emit `event.unhandled.detected` after marking an old event
`unhandled`. The normal accepted path should stay a row update to avoid creating
event loops.

Subscriber consumption should be explicit but lightweight. A subscriber can
observe an event and return nothing, or accept responsibility and return a
delivery result:

```typescript
bus.subscribe((event) => {
  if (!shouldHandle(event)) return;   // observer/irrelevant — no claim
  // ... accept and dispatch work ...
  return { accepted: true, by: "cron:project-owner" };
});
```

For async work, acceptance means "I accepted responsibility and started or
queued the work", not "the work is finished":

```typescript
bus.subscribe((event) => {
  if (!shouldHandle(event)) return;
  queueWorkflow(event);
  return { accepted: true, by: "workflow:task-worker" };
});
```

Completion is tracked separately by the work's own state or by paired events.

The return value is preferred over a callback because it keeps the subscriber
contract simple: the subscriber either ignored the event or accepted
responsibility for it. Subscribers are distributed, and the runtime records that
at least one responsible consumer accepted the event.

Only a subscriber that is taking responsibility for the event should report
acceptance:
the matching project-app handler, the targeted runtime/session handler, the
event-pair tracker for lifecycle-shaped events, the owner inbox/default-owner
handler for addressed owner work, or an explicit no-op handler. Broad
subscribers such as DbWriter, UI tailing, logging, and passive metrics readers
must not report acceptance, because that would hide routing gaps.

Some events are optional hooks: they are emitted so a handler can react, but
the absence of a handler is not itself a failure. Examples include daemon
heartbeats, routing/skip facts such as `metric.feedback.routed`, guard facts,
session receipts, and evaluation audit facts such as
`evaluation.deep_recorded`. If no targeted consumer claims one of these, the
runtime optional hook consumer accepts it with
`delivery_route='noop'`. This is different from a passive logger accepting
everything: the noop set is explicit and should stay small. If an event
represents required work, do not put it in the optional hook set.

Owner inbox acceptance is a real delivery acceptance, but it is not the same as
owner reaction. It means "this event has been routed to the owner's pull queue."
The owner heartbeat/review later emits a normal follow-up event after it has
read and acted on the item.

Infra does not decide the domain outcome. It only verifies that events reached a
responsible consumer. Dead letters go to the owner path.

### What Should Be An Event

Use an event when crossing a boundary, waking a reaction, or exposing an
extension point:

- human or UI asks the runtime to do something
- project app asks its owner to review/replan/act
- metric detector asks the metric owner to investigate a breach
- worker completion should wake planner/owner/problem handling
- opening or closing work should update completion/orphan tracking, cleanup,
  or evaluation
- runtime command should wake a runtime component
- stable lifecycle hooks let optional project/runtime handlers react

Do not use an event just to remember that code reached a line. Use state,
logs, traces, metrics, or entity records for that.

So the rule is:

```text
no reaction needed          → write state/log/metric, do not emit an event
reaction possible/needed    → emit event; responsible consumer must accept it
event opens work with an end → consumer accepts it; pair tracker waits for close
event closes existing work   → pair tracker/cleanup/evaluator consumes it
```

### Done: Convention-Based Pair Tracking

Some events open lifecycle work that should later close. The runtime should
track these by convention first, not by requiring every project to configure
event pairs.

Default opening/closing conventions:

| Opening suffix | Closing suffixes |
|----------------|------------------|
| `.started` | `.completed`, `.failed` |
| `.requested` | `.accepted`, `.rejected`, `.failed` |
| `.created` | `.resolved`, `.dismissed`, `.closed` |
| `.assigned` | `.completed`, `.blocked`, `.failed` |

Default correlation-key conventions:

| Event family | Correlation key |
|--------------|-----------------|
| `session.*` | `data.sessionId` |
| `workflow.*` | `data.workflowRunId` |
| `handler.*` | `data.handlerRunId` |
| `escalation.*` | `data.escalationId` |
| `project.task.*` | `data.taskId` + optional `data.attemptId` |
| `*.requested` | `data.requestId` |

If an opening event matches the naming convention and has a correlation key,
the pair tracker creates an open pair record. If a matching closing event
arrives with the same key, the pair closes. If the closing event does not arrive
within the expected window, infra marks the pair `orphan` and surfaces it for
investigation.

This is an audit signal, not proof of domain failure. An orphan can mean stuck
work, a missing close event, a wrong key, a bad timeout, or an event naming
design issue.

```
opening event → record pair run (opened_at, expected_close_at)
closing event → match by correlation key → mark complete
sweep         → opened too long without close → orphan → surface
```

Suggested pair table:

```sql
event_pair_runs (
  id                 INTEGER PRIMARY KEY,
  pair_name          TEXT NOT NULL,
  correlation_key    TEXT NOT NULL,
  open_event_id      INTEGER NOT NULL,
  close_event_id     INTEGER,
  owner              TEXT,
  status             TEXT DEFAULT 'open', -- open | closed | orphan
  opened_at          INTEGER NOT NULL,
  expected_close_at  INTEGER NOT NULL,
  closed_at          INTEGER,
  note               TEXT
)
```

Most event families should need no pair configuration. Add a code-local
exception only when the convention cannot work, for example:

- the closing event names are unusual
- the correlation key is not one of the standard fields
- the timeout is materially different from the default
- the event looks like an opening event but should explicitly not be paired

Static hygiene should flag convention-shaped opening events that have no
correlation key and no explicit exception. That keeps conventions useful without
forcing projects to maintain pair config files.

### What Doesn't Need Done Tracking

Some events are **unpaired** — they have a consumer but no completion clock:

- `metric.breach` → metric owner reacts. The `metric_alerts` entity tracks
  open/resolved separately, so pair tracking is not needed.
- `project.owner.requested` → acceptance is enough. What the owner does is
  the owner's judgment, tracked in the task tree.
- `evaluation.reviewed` → acceptance is enough. The evaluation entity stores
  the verdict.

Don't add done tracking to these. The responsible consumer and entity tables
already own that state.

### Observability

Delivery health is a normal runtime read model:

- `delivery_status='unhandled'` means no responsible consumer accepted a new
  event within its TTL.
- `delivery_status='pending'` with an expired TTL means the row is overdue but
  has not yet been swept.
- `delivery_route='noop'` means a runtime component explicitly accepted that no
  further reaction is required. This is also used once during migration to
  baseline events that predate delivery tracking, so old audit rows do not turn
  into fake delivery failures.
- `event_pair_runs.status='orphan'` means an expected closing event did not
  arrive before the timeout.
- `event_pair_runs.status='open'` with `expected_close_at < now` means the pair
  is overdue but has not yet been swept.

The query API exposes this as `query.eventDeliveryHealth()`. Ops health uses
that read model as the default signal for routing gaps, stuck inbox work, and
missing close events. The observer records the packet every run and wakes the
project owner only when there is an actual delivery or pair failure.

### What This Gives Us

- **Unhandled event detection**: new event type with no subscriber →
  infra knows within one TTL window.
- **Routing gap detection**: app filter too narrow → event unhandled →
  visible.
- **Orphan detection**: opening event without closing event → stuck work
  → visible. Generalizes what `session-recovery` already does.
- **No per-event-type delivery logic**: infra treats all acceptance reports the
  same.
- **Convention-based orphan detection**: common lifecycle events are tracked
  automatically from naming and key conventions. Exceptions stay rare and local.

### Implementation

1. Let bus subscribers optionally return a delivery result such as
   `{ accepted: true, by: string }`
2. DbWriter stores every event for recovery/audit and never reports acceptance
3. Define the responsible consumer for each event type or route pattern
4. Cron handler dispatcher accepts events it dispatches to a matching handler
5. App event router accepts events it routes to a matching project app
6. Owner/default-owner inbox accepts owner-addressed events that no target
   handler owns by setting `delivery_route='owner_inbox'`
7. Delivery acceptance updates the original event row; it does not append an
   accepted event
8. Heartbeat/review emits follow-up events such as `message.consumed`,
   `message.reviewed`, `project.feedback.reviewed`, or `project.owner.reviewed`
9. Write-time sweep marks unaccepted events past TTL as `unhandled`; health
   queries also report overdue pending events that have not been swept yet
10. Pair tracker accepts lifecycle-shaped events and opens/closes
    `event_pair_runs` from naming/key conventions
11. Runtime optional-hook consumer accepts known optional/audit hooks as
    `delivery_route='noop'` if no required consumer claimed them
12. Write-time sweep marks orphan openings; health queries also report overdue
    open pairs that have not been swept yet
13. Ops health packet includes unhandled count + owner-inbox orphan count +
   lifecycle orphan count

### Legacy State Cleanup

Current runtime code uses `events.status`, `handled_by`, and `result` for manual
inbox draining. That should converge to delivery fields plus follow-up events:

| Current behavior | Target behavior |
|------------------|-----------------|
| `status='pending'` for unread inbox rows | `delivery_status='accepted'`, `delivery_route='owner_inbox'` |
| `markInboxHandled()` | `reviewInboxEvents()` emits a follow-up event and lets pair tracking close the original item; `markInboxHandled()` remains a compatibility alias during migration |
| `status='handled'`, `handled_by=<agent>` | closing event such as `message.consumed` or `project.feedback.reviewed` |
| `status='expired'`, `reason='stale'` for old inbox rows | pair run marked `orphan`; optional `event_pair.orphan.detected` reaction event |
| schedule/orphan metrics infer from legacy pending rows | metrics read `delivery_status`, `delivery_route`, and `event_pair_runs` |

Migration can be compatibility-first:

1. Add the new columns and write them for new rows.
2. Mark pre-delivery-tracking rows as `delivery_status='accepted'`,
   `delivery_route='noop'`, `accepted_by='legacy:event-store'` using a one-time
   migration marker.
3. Keep reading legacy `status` as a fallback while backfilling.
4. Replace `markInboxHandled()` call sites with `reviewInboxEvents()`.
5. Update heartbeat/review queries to prefer `delivery_route='owner_inbox'` and
   open `event_pair_runs`.
6. Remove metrics and code paths that infer delivery or completion from legacy
   `status`.

### What This Is Not

- Not event sourcing — events are still a log, not a state store
- Not a message queue — bus is still in-memory pub/sub
- Not per-event-type delivery logic — acceptance is universal
- Not a project pair-config system — pairs are convention-driven with rare
  runtime exceptions
- Not blocking — acceptance and pair tracking are fire-and-forget DB updates
- Not replacing entity state — sessions, alerts, tasks still own their
  state machines. Pair tracking just detects orphans.
