# Event Graph And Trace

**Design status:** Accepted.
**Implementation status:** Implemented for new runtime events. Live pair closure
is transactional, queued human turns and delegation preserve trace context,
terminal events close their semantic intents, channel delivery is projected,
and integrity checks cover structural and semantic failures. Retained history
may still require the explicit backfill command.

## Purpose

May-agent should make event flow easy to program and easy to inspect.

Use mature tracing language:

```text
trace = one related chain of work
event = node in the trace
parentEventId = direct parent event
links = related events that are not the direct parent
attributes = event data
graph node = event or supporting detail represented in the read model
parentKey = display hierarchy inside the graph
provenance = whether an edge was persisted or projected from lifecycle, correlation, or transcript data
```

Events remain the source of truth for cross-boundary work. The event graph does
not introduce a separate escalation, approval, or task lifecycle object. It
records trace relationships so humans, agents, and UI can answer:

- what started this work?
- what handled it?
- what did it emit next?
- what closed it?
- where did the chain stop?
- which LLM turn or tool call made the decision?

## Event Data Rule

The graph does not classify payloads into special Goal, Result, Review, or
Effect models. It renders the event contract directly:

```text
event id and type
source -> owner/target
trace parent and links
data key/value pairs
```

Every event uses the same extraction rule. The graph response contains a
bounded top-level `dataPreview` for every node and the complete stored envelope
and `data` for the focused event. Clicking another persisted event refocuses the
same view on that event's complete payload.

Do not query workflow, task, evaluation, or session side tables to manufacture
event meaning that the event chain did not carry. Side tables and transcripts
may add supporting detail, but they must not create a missing causal parent or
pretend that context was passed when it was not.

Async boundaries must preserve trace explicitly. A queued event handler derives
one child trace from the persisted triggering event and passes that trace through
handler, workflow, and session events. If this propagation is absent, the graph
must show the session as disconnected; the UI must not repair it heuristically.

## Human-Rooted Trace Contract

`human.input.received` is the transport-neutral boundary fact for free-form
human input. It is the trace root for a new human turn, not a separate request
entity or work queue record. The input router emits exactly one semantic child
intent from it:

```text
human.input.received
  -> chat.start.requested       no chat session is bound
  -> session.steer.requested    an existing session is targeted
  -> project.comment.created    project context is targeted
  -> project.approval.submitted structured approval context is present
  -> runtime.*.requested        explicit runtime control
```

A persistent chat session is a conversation container, not a trace. Each new
standalone human turn starts a new trace even when it reuses the same chat
session. A reply to a prior notification or result stays in the prior trace:
the new `human.input.received` event uses the referenced notification/result as
its parent or reference and then emits a new semantic intent beneath it.

New-chat and existing-chat turns have these canonical shapes:

```text
human.input.received
  -> chat.start.requested
    -> session.start
      -> session.idle

human.input.received
  -> session.steer.requested
    -> session.idle
```

The terminal `session.idle` or `session.end` event belongs to the triggering
turn trace and closes the semantic intent, not the lifetime of the persistent
chat session. Session input queues therefore carry trace context per input.
`manager.send()`, cold resume, forks, workflows, CLI delegation, and outbound
notification paths must propagate that turn context explicitly; long-lived
sessions must not rely only on ambient async context or one session-wide trace.

## Closure And Human Outcome

A closure link means that one opening event reached a terminal disposition. It
does not by itself mean the project goal is complete or that the human is
satisfied. The graph derives progressively stronger answers from existing
events and projections:

| Question | Evidence |
|---|---|
| Was it handled? | A responsible domain consumer or queryable owner route accepted the intent. |
| Was work started? | A child session, workflow, task transition, or explicit rejection/no-op exists. |
| Was the intent completed? | A terminal event has a closure link to the opening intent. |
| Did the human receive the result? | The channel delivery projection links to the terminal result. |
| Did the human confirm it? | A later human reply explicitly accepts, approves, corrects, or continues the result. |

Most conversational turns finish at delivered. Approval gates and explicit
human decisions require confirmed. Human silence is not confirmation.

Closure is immutable. A later correction or follow-up does not reopen or
rewrite the old event. It creates a new human input and semantic intent linked
to the prior result, so the graph shows rework or continuation as another
branch of evidence.

## Review Interaction

The event review UI is graph-first.

1. The user starts from an event id.
2. The server resolves the complete graph bounded by that event's trace,
   lifecycle pairs, and explicit correlation keys.
3. The server projects available session transcripts into the same graph.
4. The page lays out and renders every returned node and edge.

Clicking a persisted event may refocus the page on that event. It does not hide,
expand, collapse, or fetch a graph fragment. There are no placeholder nodes or
browser-maintained graph visibility state.

Rows and raw payloads are fallback views. They are useful for exact audit, but
the primary investigation surface is the graph with inline expansion.

## Graph Scope

The graph should answer four questions:

```text
Where did this chain start?
Which structural parent path explains this selected event?
What directly happened around the selected event?
What related work and evidence belong to the chain?
```

For a selected event, render the complete resolved shape:

```text
start point
  -> key parent
  -> selected event
       -> direct child/detail/result
       -> related workflow/session/task context
       -> transcript turns/tool calls/results
```

### Start Point

Use the strongest provable start:

1. Trace root: walk `trace.parentEventId` backward until there is no parent.
2. Lifecycle opener: `*.started`, `*.requested`, `*.created`, or `*.assigned`.
3. External boundary: timer/cron, human input, API/web request, Telegram reply,
   metric breach, external callback, or manual operator action.
4. Selected event fallback: use the selected event and mark `start unknown`.

Do not treat correlation-only events as start points. A second session with the
same `workflowRunId` is context, not the start of the selected event chain.

### Key Parent Path

The key parent path is the structural path, not every parent event. Show parent
nodes when they explain a hierarchy, branch, ownership, or work-scope change:

- boundary entry: human input, timer, metric breach, API request, callback;
- ownership change: routed to owner, owner inbox, delegated to agent/workflow;
- work-scope change: project task assigned, workflow started, session started,
  CLI task started, escalation created;
- branch or merge: one event emits multiple follow-ups, closes another chain,
  resumes prior work, or triggers redo/replan;
- lifecycle close: task/session/workflow/escalation completed, failed,
  blocked, resolved, or dismissed.

Operational detail remains in the graph because it may explain a failure:

- receipts;
- handler skipped;
- evaluation skipped;
- context read;
- guard details;
- low-level tool events;
- same-workflow/session/task correlation that is not on the causal path.

### Complete Resolved Scope

Around the selected event, show direct evidence:

- direct parent and direct children;
- lifecycle open/close pair;
- closure/reference links directly attached to the selected event;
- direct emitted follow-up events;
- all detail events associated with the resolved trace or correlation keys;
- all sessions in a resolved workflow;
- available transcript turns, tool calls, and tool results for those sessions.

The bound is a server concern. The read model limits correlation queries and
uses explicit trace, lifecycle, and domain identifiers; it never loads the
entire event store. Within that bound, it returns one complete graph. The UI
must not apply a second semantic filter.

## Core Model

Every persisted event already has an event-store id. That id is the node id.

Each event can carry trace metadata:

```typescript
type EventTrace = {
  traceId: string;
  parentEventId?: number;
  links?: EventTraceLink[];
};

type EventTraceLink = {
  eventId: number;
  type?: "reference" | "closure";
  label?: string;
};
```

Meaning:

| Field | Meaning |
|-------|---------|
| `traceId` | Groups events that belong to the same chain. Use `event:<rootEventId>` when the root event id is known. |
| `parentEventId` | Direct parent event. This is the main event-to-event line. |
| `links` | Related events that are not the direct parent. |
| `links[].type = "reference"` | The event uses another event as context or evidence. |
| `links[].type = "closure"` | The event closes another event. |

This follows the common tracing shape: one trace id, parent relationship for the
main chain, and links for non-parent relationships.

## Graph Read Model

Trace storage records durable event relationships. The graph read model turns
those relationships plus projections such as sessions, workflow runs,
transcripts, notifications, metrics, and pair runs into display-ready graph
nodes and edges.

The read model owns graph semantics:

- which records are graph nodes;
- which node is the parent of another node in the displayed hierarchy;
- which edges mean main flow, reference, closure, detail, tool call, or return;
- which nodes are primary evidence and which are supporting detail evidence;
- which abnormal/skipped/unhandled records must remain visible for inspection.
- the provenance of every edge: `persisted`, `lifecycle`, `correlation`,
  `projection`, or `transcript`.

Persisted `parentEventId` and links are authoritative. Lifecycle and correlation
edges are visibly marked compatibility evidence; they are not substitutes for
propagating trace when new work is emitted.

The UI owns only presentation:

- layout direction, spacing, colors, and selection;
- scroll position, anchors, and fallback raw rows;
- rendering different node/edge kinds consistently.

Layout has two independent axes:

- horizontal position is hierarchy depth derived from `parentKey`; siblings at
  the same depth align in the same column;
- vertical position is chronological across the complete graph; earlier nodes
  are always above later nodes, with stable sequence order breaking timestamp
  ties.

Transcript records do not always carry a timestamp on every turn. The read
model interpolates a missing timestamp between the nearest known transcript or
session timestamps, then enforces monotonic session order. The UI must not use
hierarchy traversal to reorder nodes vertically.

Do not make the browser infer semantic hierarchy from event names or payload
string matching. If the graph needs a session event, an LLM turn, a tool call,
or a diagnostic to appear as a child of a session node, the API response should
carry that relationship explicitly.

Display hierarchy is intentionally generic and can have multiple levels:

```text
event
  session detail event
  transcript turn
    tool call
      tool result
  workflow step
    child session
      transcript turn
```

The current UI may render only two or three visible levels, but the data model
must not bake in that limit.

Recommended display node shape:

```typescript
type EventGraphDisplayNode = {
  key: string; // stable within response: event:3128372, session:s_123:turn:4
  kind:
    | "event"
    | "session"
    | "workflow"
    | "turn"
    | "tool_call"
    | "tool_result"
    | "metric"
    | "notification"
    | "diagnostic";
  role?: "primary" | "detail" | "diagnostic";
  parentKey?: string; // display parent, not necessarily trace parent
  level?: number; // convenience for simple renderers; derivable from parentKey
  visibility: "default" | "detail";
  eventId?: number;
  sessionId?: string;
  workflowRunId?: string;
  turnIndex?: number;
  toolCallId?: string;
  timestamp?: number;
  type?: string;
  label: string;
  summary?: string;
  dataPreview?: Record<string, unknown>;
  refs?: Record<string, string | number | boolean | null>;
};
```

Recommended display edge shape:

```typescript
type EventGraphDisplayEdge = {
  key: string;
  sourceKey: string;
  targetKey: string;
  kind:
    | "flow"
    | "reference"
    | "closure"
    | "detail"
    | "sequence"
    | "tool_call"
    | "tool_result";
  label?: string;
  provenance:
    | "persisted"
    | "lifecycle"
    | "correlation"
    | "projection"
    | "transcript";
};
```

Important distinction:

- `trace.parentEventId` is the durable event-to-event parent.
- `parentKey` is the display hierarchy used to draw detail nodes under a
  selected event/session/workflow.

Historical `session.completed`, `session.receipt`, routine `handler.skipped`,
and `evaluation.skipped` records may be detail children of a session start node
even when their durable trace parent is different or missing. The graph keeps
their original `eventId`, `type`, and trace metadata; the runtime no longer
creates these derivative records for normal session completion.

The read model must not drop records because they look secondary. Skipped,
unhandled, malformed, orphan, and diagnostic records are often the evidence the
human is looking for.

### One terminal session fact

New sessions have one terminal event: `session.end`. Its `data` contains the
runtime outcome, summary, duration, structured `finishParams`, and correlation
fields. Recovery, evaluation, and project workflows subscribe to that event
directly.

The runtime does not copy it into `session.completed` or `session.receipt`.
Expected filtering returns without an event; `handler.skipped` is reserved for
an explicit request that was malformed or deliberately declined. Evaluation
preflight stores an intentional skip in the evaluation read model instead of
emitting a dead-end `evaluation.skipped` event.

This rule keeps the graph faithful: one fact has one event ID, one payload, and
one place in the timeline. Historical derivative events remain inspectable but
must not influence current routing.

## Event Envelope

The canonical envelope stays small. `trace` is event-system metadata, not domain
data, so it belongs beside `type`, `source`, `target`, and `owner`.

Target shape:

```typescript
type EventEnvelope<TData extends Record<string, unknown> = Record<string, unknown>> = {
  id?: number;          // assigned by the event store
  type: string;
  source?: string;
  target?: Record<string, unknown>;
  owner: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
  timestamp?: number;
  visibility?: "default" | "detail";
  trace?: {
    traceId: string;
    parentEventId?: number;
    links?: Array<{
      eventId: number;
      type?: "reference" | "closure";
      label?: string;
    }>;
  };
  data: TData;
};
```

`data` remains domain attributes. Do not put general trace relations into
`data`. Until trace storage exists, producers may keep legacy context fields
such as `conversationId`, `originalIssue`, or correlation keys. New code should
prefer `trace` whenever the related event id is known.

## Storage

Keep events as nodes:

```sql
events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  source TEXT,
  owner TEXT,
  data TEXT,
  timestamp INTEGER NOT NULL,
  ...
)
```

Store trace metadata separately so graph reads are simple:

```sql
event_traces (
  event_id INTEGER PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_event_id INTEGER,
  visibility TEXT NOT NULL DEFAULT 'default' -- default | detail
)
```

Store non-parent links separately:

```sql
event_trace_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_event_id INTEGER NOT NULL,
  to_event_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'reference', -- reference | closure
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE(from_event_id, to_event_id, type, label)
)
```

Direction:

```text
parentEventId: parent -> child
trace link:    from_event -> linked event
closure link:  closing event -> opened event
```

For visualization, closure edges can be drawn from opened event to closing
event, but storage should keep the event's declared links as written:

```text
escalation.resolved links to escalation.created with type=closure
```

## Existing DB Records

The current SQLite DB already contains valuable operational history. The trace
model must reuse it rather than replacing it.

| Table | Role in the graph | How to use it |
|-------|-------------------|---------------|
| `events` | Canonical event nodes | Keep append-only. Add trace metadata in side tables, not by rewriting event payloads. |
| `event_pair_runs` | Existing lifecycle projection | Backfill parent/closure edges for request/completion pairs such as session, handler, project task, CLI task, owner inbox, and escalation. |
| `sessions` | Execution span projection | Link session events and detail nodes by `sessionId`; do not duplicate full transcripts into event payloads. |
| `workflow_runs` | Workflow span projection | Link handler/workflow/session events by `workflowRunId`, `parentWorkflowRunId`, and `projectId`. |
| `notification_messages` | Transport projection | Link Telegram/Web delivery records to the event that caused the notification and to the human reply that followed. |
| `metrics`, `metric_alerts`, `metric_snapshots` | Metric signal projection | Link `metric.breach`, `metric.recovered`, alert rows, owner reviews, and follow-up work. |
| `session_digests`, `evaluations`, `guard.triggered` events | Detail evidence | Expose as detail nodes or side-panel evidence without dropping them from the graph. |

The migration rule is additive:

- keep existing tables and fields;
- keep legacy context fields such as `sessionId`, `workflowRunId`,
  `taskId`, `attemptId`, `metricId`, `alertId`, `conversationId`,
  `originalIssue`, and `escalationId`;
- prefer new `trace` metadata for exact event-to-event relations when the
  related event id is known;
- use compatibility projections to make older records graphable.

### Referential Retention

An event id cannot serve as a lifecycle identity if retention removes the
opening event while work is still open. Retention must preserve events that are
referenced by an open lifecycle pair, active escalation, active task/session,
or a retained trace link. After closure, prune high-volume detail before root,
boundary, delivery, and closure evidence. If full detail cannot remain in the
operational database, archive a compact trace manifest before deleting it.

The normal age window applies only after these referential protections. Trace
cleanup must not silently null a still-live causal parent or delete the only
closure edge for retained work.

## Backfill Strategy

Backfill should populate `event_traces` and `event_trace_links` from existing
records. It should be deterministic and safe to rerun.

Baseline rule:

```text
event without known parent -> trace_id = event:<event_id>
```

Then apply stronger relations:

| Existing evidence | Backfill action |
|-------------------|-----------------|
| `event_pair_runs.open_event_id` and `close_event_id` | Put both events in `trace_id = event:<open_event_id>`. Set close event `parent_event_id` to the open event when no better parent exists. Add `closure` link from close event to open event. |
| Payload has `openEventId` / `open_event_id` | Add `closure` or `reference` link from current event to that event. Use `closure` for review/terminal events, `reference` otherwise. |
| Same `sessionId` | Link `session.start`, `session.end`, `guard.triggered`, evaluation events, detail records, and historical derivative records into the session trace. |
| Same `workflowRunId` | Link `handler.workflow_dispatched`, workflow run, session, guard, and result events into the workflow trace. |
| Same `taskId` plus `attemptId` | Link `project.task.assigned`, worker session, `project.task.completed`, `project.task.reviewed`, and planner follow-up. |
| Same `metricId` / `alertId` | Link metric alert, `metric.breach`, owner workflow/session, `metric.recovered`, and review events. |
| `notification_messages.telegram_msg_id` and reply context | Link notification delivery to `message.created`; link `human.input.received` to the message it replied to. |
| Legacy `escalationId` | Resolve to the opening `escalation.created` event when possible. Use the event id as the canonical identity after that. |

Backfill should not invent domain outcomes. If an escalation has no
`escalation.resolved` or `escalation.dismissed`, the graph should show it as an
open chain, not silently close it.

## Write Path

New event producers may include `trace` in the event envelope. The DB writer
should:

1. Insert the `events` row as it does today.
2. Resolve the inserted event id.
3. Insert or update `event_traces` for that event.
4. Insert `event_trace_links` for `trace.links`.

Event producers normally do not copy trace metadata manually. While a handler
is processing an event, events it emits inherit the triggering event's
`traceId` and use the triggering event id as `parentEventId`. The event bus
preserves this context across asynchronous handler continuations. Producers
provide explicit trace metadata only when starting a new trace, linking to
additional events, or overriding the natural parent.

Manual event insertion paths, such as inbox review follow-up events, must use
the same trace helper. Otherwise new traces will be split between writer-created
events and direct SQL-created events.

If an event has no explicit trace, the writer can still create a local trace row
with `trace_id = event:<event_id>`. Later backfill can merge it into a stronger
trace by updating the side table.

## Branches, Conditions, Loops, And Merges

Branches are natural fan-out: several events can have the same parent event.

```text
metric.breach
  -> project.owner.requested
  -> message.created
  -> project.watchdog.check.requested
```

Conditions are event attributes or link labels:

```text
human.input.received
  -> escalation.resolved  data.outcome=answered

project.task.reviewed
  -> project.task.assigned  data.decision=redo
```

Loops are repeated events, not mutation of the same node:

```text
project.task.tick -> controller.completed -> project.task.tick -> ...
```

The read model may provide a separate aggregate view for repeated loop slices,
but the event graph itself keeps every event. An aggregate can be labeled:

```text
spec-loop x37 iterations
```

Merges are multiple incoming parent/reference relationships:

```text
project.owner.requested
  <- metric.breach
  <- project.task.reviewed
  <- escalation.resolved
```

## Escalation Example

Escalation does not need a separate id when the `escalation.created` event id is
available. The created event is the escalation identity.

```text
#100 escalation.created
#101 message.created
#102 human.input.received
#103 escalation.resolved
```

Trace:

```text
#100 traceId=event:100
#101 traceId=event:100 parentEventId=100
#102 traceId=event:100 parentEventId=101
#103 traceId=event:100 parentEventId=102 links=[{ eventId: 100, type: "closure" }]
```

Telegram/Web are transport. May is the human deputy. The trace preserves the
chain without adding escalation-specific relation fields.

## LLM Turns And Tool Calls

LLM turns and tool calls should also be traceable. When a transcript is
available, the graph endpoint projects them into the complete graph.

Use `visibility`:

| Visibility | Display role | Examples |
|------------|------------------|----------|
| `default` | primary event | `escalation.created`, `project.task.completed`, `message.created`, `workflow.completed` |
| `detail` | supporting evidence, still shown | `llm.turn.completed`, `tool.call.completed`, `context.read` |

Do not store full prompts or large tool output as graph node payloads. Store
compact attributes and references:

```json
{
  "type": "llm.turn.completed",
  "visibility": "detail",
  "trace": {
    "traceId": "event:100",
    "parentEventId": 102
  },
  "data": {
    "sessionId": "s_123",
    "turnIndex": 4,
    "model": "gpt-5.5",
    "summary": "Interpreted human approval and emitted escalation.resolved.",
    "transcriptRef": ".state/sessions/history/s_123/session.jsonl#turn=4"
  }
}
```

```json
{
  "type": "tool.call.completed",
  "visibility": "detail",
  "trace": {
    "traceId": "event:100",
    "parentEventId": 104
  },
  "data": {
    "sessionId": "s_123",
    "toolName": "emit_event",
    "status": "success",
    "resultEventId": 103
  }
}
```

Projected trace:

```text
human.input.received
  -> session.start
  -> llm.turn.completed
  -> tool.call.completed
  -> escalation.resolved
```

## Review And Debugging

The trace should make review concrete:

| Question | Trace answer |
|----------|--------------|
| Did the event reach a handler? | Event has delivery acceptance and a child workflow/session/event in the same trace. |
| Did May receive the human reply? | `human.input.received` exists under the prior `message.created`. |
| Did May close the escalation? | `escalation.resolved` or `escalation.dismissed` has a `closure` link to the opening `escalation.created`. |
| Did the project consume the result? | Closure event has child project planning/task update/session resume events. |
| Did the LLM/tool fail? | Detail nodes show missing or failed `tool.call.completed`. |

Broken chains should be visible without guessing:

```text
event persisted, no accepted route
event accepted, no child follow-up
human reply received, no closure link
closure event emitted, no project/task reaction
tool call failed before emitting expected event
```

Trace integrity checks must test meaning as well as schema shape. At minimum,
report:

- a closed lifecycle pair without a persisted closure link;
- an opener and closer in different traces;
- a human semantic intent with no child execution, rejection, or no-op;
- a human result generated but not delivered to its channel;
- a non-root lifecycle event isolated in a singleton trace;
- an event accepted only by bookkeeping when a domain or owner reaction was
  required.

Having one syntactically valid `event_traces` row per event is necessary but is
not sufficient evidence that causal propagation or loop closure works.

## API And UI

The graph API should return nodes and edges directly:

```text
GET /api/events/:eventId/graph
```

The API should prefer persisted trace rows and fall back to `event_pair_runs`
when traces have not been backfilled yet. This keeps existing DB history useful
immediately after deployment.

Response shape:

```typescript
type EventGraphResponse = {
  focusEventId: number;
  traceId?: string;
  revision: string;
  nodes: EventGraphDisplayNode[];
  edges: EventGraphDisplayEdge[];
  eventNodes: EventGraphNode[];
  eventEdges: EventGraphEdge[];
  eventList?: Array<{
    id: number;
    type: string;
    visibility: "default" | "detail";
    source?: string;
    owner?: string;
    timestamp: number;
    label: string;
    summary?: string;
    dataPreview?: Record<string, unknown>;
  }>;
  eventListScope?: {
    kind: "session" | "workflow" | "task" | "graph";
    ids: string[];
    label: string;
  };
  diagnostics: string[];
};
```

UI defaults:

- render every node and edge returned by the endpoint
- visually distinguish supporting `detail` evidence without hiding it
- label `closure` links distinctly
- show raw event envelope and transcript/tool references in the inspector
- preserve all nodes returned by the API, including skipped/unhandled
  diagnostics

React Flow is a good renderer for the interactive UI, with ELK.js or a similar
layout engine for left-to-right DAG layout. Mermaid export is useful for static
reports.

## Current Implementation

- `event_traces` and `event_trace_links` are additive side tables.
- New event rows get a default `trace_id = event:<event_id>`.
- Explicit envelope `trace` writes parent and link metadata.
- Owner-inbox review follow-up events write closure links.
- `backfillEventPairTraces(...)` can project existing `event_pair_runs` into
  trace rows and closure links.
- `GET /api/events/:eventId/graph` returns the complete resolved graph and
  diagnostics.
- Graph `nodes` and `edges` are the canonical display contract. Raw event
  projections are available separately as `eventNodes`, `eventEdges`, and
  `eventList` for inspection.
- The endpoint projects available transcript turns and tools for every session
  in the resolved graph.
- The UI renders backend node keys, hierarchy, edge kinds, and provenance. It
  owns only selection and layout.
- `bun run check:event-graph -- --state-dir /app/.state` checks trace storage
  integrity. Add `--backfill` to create baseline trace rows for existing events
  and project lifecycle pair records into closure links.
- Live event insertion, pair closure, trace alignment, and closure-link writes
  commit in one database transaction.
- Persistent chat turns carry their intent trace through send/cold resume,
  agent calls/forks, workflows, CLI delegation, terminal events, and delivery.
- The integrity checker reports missing live closure links, opener/closer trace
  splits, malformed human roots, undelivered human results, and invalid
  bookkeeping-only acceptance.

## Non-Goals

- Do not add a request/commitment lifecycle object; human work is represented
  by the root event, its trace, existing entity state, and derived read models.
- Do not replace task trees, metrics, sessions, or workflow run records.
- Do not make the event trace a workflow engine.
- Do not store every token or large tool output in event rows.
- Do not create escalation-specific relation fields when trace metadata
  expresses the relationship.
