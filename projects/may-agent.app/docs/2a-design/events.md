# Events & Inbox

## Core Principle

```
Event = something that happened at a point in time
```

Events are the primary communication mechanism. State is derived from events where practical. Some tables (metrics, sessions) use mutable status columns for query efficiency — this is a pragmatic trade-off, not a violation. The events table serves as the audit trail for the **retention window** (currently 7 days — see Data Retention below), though it carries reserved mutable columns (`status`, `handled_by`, `result`, `reason`, `retry_count`) for future inbox-ack and retry patterns — see DDL and row mapping below.

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
| *(infra only)* | `status` | Default `'pending'`; reserved for future ack |
| *(infra only)* | `handled_by` | Reserved; no writer yet |
| *(infra only)* | `result` | Reserved; no writer yet |
| *(infra only)* | `reason` | Reserved; no writer yet |
| *(infra only)* | `retry_count` | Default 0; reserved |

Effective query schema (verified 2026-06-06 against live DDL). The base
`CREATE TABLE` defined the first 6 columns; the remainder were added by
migrations. Agents should rely on this effective schema, not hand-copy base DDL.

```sql
CREATE TABLE events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL,       -- dot-separated: "handler.completed"
  source       TEXT,                -- who emitted it
  owner        TEXT,                -- responsible owner / inbox route
  data         TEXT,                -- event-specific JSON payload
  timestamp    INTEGER NOT NULL,
  -- migration-added columns below this line:
  status       TEXT DEFAULT 'pending',  -- event processing status
  handled_by   TEXT,                -- reserved; no writer yet
  result       TEXT,                -- reserved; no writer yet
  reason       TEXT,                -- reserved; no writer yet
  retry_count  INTEGER DEFAULT 0,  -- reserved; retry logic not yet implemented
  ttl_ms       INTEGER,            -- auto-expire after this duration
  urgency      TEXT DEFAULT 'normal'
);
```

> **Note on mutable columns:** `status`, `handled_by`, `result`, `reason`, and
> `retry_count` were added for future inbox-ack and retry patterns. As of
> 2026-06-06, no production code path writes to these columns — all 183k+ rows
> have `status='pending'` and the other four are NULL/0. The columns are
> reserved infrastructure; do not invent a parallel ack mechanism (see KE-568).

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

Events are retained for 7 days, then bulk-deleted by the `db-retention` handler (daily cron). Agents act within the retention window or they don't. The `ttl_ms` column exists on the envelope/schema but no current producer populates it; expiry is enforced solely by the retention handler's `DELETE FROM events WHERE timestamp < ?`.

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
Row counts below are **surviving rows** (7-day retention applies to `events` table — see Data Retention section). Snapshot refreshed 2026-06-13.

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
| `session.resume_failed` | session-recovery when a resume target session is not found or cannot be resumed | ✅ live (~2,800 rows as of 2026-06-15 post-retention); rate rebounded after initial Spec-3 collapse: 14–48/hr Jun 14 13:00–Jun 15 05:00Z across task/planner/problem sessions, then dropped to 0/hr by ~05:00Z Jun 15 (last event 04:53Z). The initial "collapse" (KE-2005) was transient — resume attempts resumed within hours and persisted for ~16h before truly stopping. Fix: dedup_key (KE-1837, ORDER-010 src/ change required); KE-1962: no handler subscriber |
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
| `project.health.checked` | project health checker on every check cycle | ⛔ emission removed (commit 73d989fdb, 2026-06-10); 22.8k rows remain in DB, aging out via 7-day retention |
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
still has no emitter. `session.resume_failed` fires actively from session-recovery
when the target session cannot be found (~2,800 rows as of 2026-06-15 post-retention; rate rebounded post-Spec-3: 14–48/hr for ~16h before stopping at 04:53Z Jun 15; KE-2005's "collapse" claim was premature).
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

## Proposal: Unified Event Lifecycle (2026-06-18)

### Problem

255K events sit at `pending` forever. The DB has `status`, `handled_by`,
`result` columns reserved for lifecycle tracking, but nothing writes to them.
The system records events but doesn't know whether they were processed.

For observability events (`handler.started`, `session.start`) this is fine —
they're log entries. For actionable events (`metric.breach`, `escalation.created`,
`project.owner.requested`) this is a gap — a pending actionable event means
nobody can tell whether it was consumed, ignored, or lost.

### Mental Model

Every event has a lifecycle:

```
created → acked → done
```

Three states, one direction:

| State | Meaning |
|-------|---------|
| `created` | Event recorded. No consumer has claimed it yet. |
| `acked` | A consumer has claimed responsibility. Processing in progress. |
| `done` | Terminal. Processing complete with a result. |

Terminal results (stored in `result` column):

| Result | Meaning |
|--------|---------|
| `handled` | Consumer processed it successfully. |
| `expired` | TTL passed before any consumer claimed it. |
| `dropped` | Consumer examined it and decided no action needed (with reason). |
| `failed` | Consumer tried and failed (may retry). |

### Event Classes

Not every event needs full lifecycle tracking. Classify by intent:

| Class | Lifecycle | Examples |
|-------|-----------|---------|
| **Signal** | `created → acked → done` | `metric.breach`, `escalation.created`, `project.owner.requested`, `message.created` |
| **Trace** | `created → done(handled)` immediately | `handler.started`, `handler.completed`, `session.start`, `session.end`, `guard.triggered` |

**Signals** are events that require a consumer to act, judge, or acknowledge.
They move through the full lifecycle. If no consumer acks within the TTL,
they expire. If they expire, the system knows something was missed.

**Traces** are events that record what happened. They're born terminal — written
as `done(handled)` immediately because their purpose is the record itself,
not triggering action. They never sit at `created` waiting for a consumer.

### Lifecycle Rules

```
created
  │
  ├── consumer claims it ──→ acked (handled_by = consumer, acked_at = now)
  │                            │
  │                            ├── success ──→ done(handled) with result
  │                            ├── failure ──→ done(failed) with reason
  │                            │                 └── retry? → created (retry_count++)
  │                            └── drop ────→ done(dropped) with reason
  │
  └── TTL expires ───────────→ done(expired)
                                 └── owner notified if signal class
```

### Ack Contract

When a bus subscriber processes a signal event, it must ack:

```typescript
// In the handler/workflow that processes the event:
ctx.ackEvent(eventId);           // created → acked
// ... do work ...
ctx.resolveEvent(eventId, {      // acked → done
  result: "handled",
  reason: "evaluated session s_123, verdict=acceptable",
});
```

When a handler examines an event and decides no action is needed:

```typescript
ctx.resolveEvent(eventId, {
  result: "dropped",
  reason: "metric recovered before handler ran",
});
```

### Retry

If a consumer fails:

```typescript
ctx.resolveEvent(eventId, {
  result: "failed",
  reason: "evaluator session timed out",
  retry: true,  // → infra resets to created, increments retry_count
});
```

Retry policy (infra-owned):
- Max retries per event: configurable, default 3
- Backoff: exponential with jitter
- After max retries: `done(failed)` + escalation to owner

### TTL and Expiry

Signal events should declare `ttl_ms`. If not set, infra applies a default
based on urgency:

| Urgency | Default TTL |
|---------|-------------|
| `immediate` | 5 min |
| `high` | 30 min |
| `normal` | 2 hours |
| `low` | 24 hours |

When TTL expires on a `created` event (never acked), infra:
1. Marks `done(expired)`
2. Emits `event.expired` trace with the original event type and owner
3. The ops health packet surfaces expired signal events as unhandled

### What Changes in the DB

No schema change needed. The existing columns support this:

| Column | Current | New meaning |
|--------|---------|-------------|
| `status` | Always `pending` | `created` → `acked` → `done` |
| `handled_by` | Always NULL | Consumer identity on ack |
| `result` | Always NULL | Terminal result: `handled`, `expired`, `dropped`, `failed` |
| `reason` | Always NULL | Human-readable closure reason |
| `retry_count` | Always 0 | Incremented on retry |

### What Changes in the Code

1. **DbWriter**: write trace events as `status='done', result='handled'`
   immediately. Write signal events as `status='created'`.

2. **Bus subscribers**: when a cron handler or app workflow handler dispatches
   work for a signal event, call `ackEvent(eventId)`. When the work completes,
   call `resolveEvent(eventId, result)`.

3. **TTL expiry**: the existing `expireStaleMessages` and
   `expireStaleSignalEvents` already do this. Generalize to cover all signal
   event types.

4. **Ops health packet**: count `created` signal events older than expected
   processing time → surfaces "unhandled signal" as an observation.

### What This Enables

- **"Is anyone handling this?"** — `acked` means yes, `created` past TTL means no.
- **"What happened to that breach?"** — `done(handled)` with reason shows the
  outcome. Not "I hope someone saw it."
- **Retry for failed processing** — instead of silent drops, the event re-enters
  the queue with exponential backoff.
- **Expiry detection** — unacked signal events surface automatically in the ops
  health packet. The owner investigates why nobody consumed it.
- **Clean DB** — trace events are born `done`; signal events reach `done` within
  their TTL. No more 255K perpetual pending rows.

### What This Is Not

- Not a full event-sourcing system — trace events are still just logs.
- Not a message queue — the bus is still in-memory pub/sub. The DB lifecycle
  is an accountability record, not a delivery guarantee.
- Not blocking — ack/resolve are fire-and-forget DB updates. They don't block
  the bus or the handler.

### Implementation Order

1. Classify existing event types as signal vs trace
2. DbWriter: write traces as `done(handled)` immediately
3. Add `ackEvent` and `resolveEvent` to the SDK/handler context
4. Wire ack/resolve into the cron handler dispatch path
5. Wire ack/resolve into the app event router dispatch path
6. Generalize TTL expiry for all signal types
7. Add "unacked signal count" to ops health packet
