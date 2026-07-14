# Event Graph And Trace

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
more node = expandable boundary hiding non-default graph context
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

## Review Interaction

The event review UI is graph-first.

1. The user starts from an event id.
2. The page renders a bounded graph around that event: lifecycle pair, direct
   parent/reference/closure edges, and closely related session/workflow/task
   nodes.
3. The user clicks nodes in the graph to expand them inline.

Expansion is scoped to the clicked node:

- `session.start` or `session.end` expands that session into session events,
  LLM turns, tool calls, tool results, and the closing session event.
- workflow nodes expand workflow-level structure only when the workflow is
  selected; a session click must not automatically explode the whole workflow.
- task, escalation, and metric nodes expand their own lifecycle/context when a
  projection exists.

Multiple nodes may stay expanded at the same time. Clicking another session does
not collapse the first one; this lets humans compare two sessions in one graph.
Clicking an expanded node again collapses that node.

Rows and raw payloads are fallback views. They are useful for exact audit, but
the primary investigation surface is the graph with inline expansion.

## Default Graph Scope

The default graph should not dump every correlated event. It should answer four
questions:

```text
Where did this chain start?
Which structural parent path explains this selected event?
What directly happened around the selected event?
Where does hidden or later context continue?
```

For a selected event, render this shape:

```text
start point
  -> key parent
  -> ...
  -> selected event
       -> direct child/detail/result
       -> ... later/context/details
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

Linear noise should collapse behind a `more` node:

- receipts;
- handler skipped;
- evaluation skipped;
- context read;
- guard details;
- low-level tool events;
- same-workflow/session/task correlation that is not on the causal path.

### Selected Event Direct Scope

Around the selected event, show direct evidence:

- direct parent and direct children;
- lifecycle open/close pair;
- closure/reference links directly attached to the selected event;
- direct emitted follow-up events;
- detail children when the selected node is expanded.

The default API/UI radius is one direct graph hop around the selected event.
The structural parent path and start point are included regardless of radius, so
a deep selected event still shows where the chain began. Wider exploration
should happen by expanding graph frontiers or requesting a larger depth
explicitly.

Do not auto-expand broader context such as same workflow, same task, same
metric, or same owner inbox. Show those as expandable boundaries.

### Frontiers

The data model is the truth. The API returns real event nodes and real graph
edges. It also returns `frontiers`, which are explicit boundaries where the
backend knows connected data exists but did not include it in the current
bounded response. A frontier is not a persisted event and is not an event-to-
event edge. It is a UI affordance backed by the read model.

```typescript
type EventGraphFrontier = {
  id: string;
  anchorEventId: number;
  direction: "before" | "after" | "context" | "details";
  scope: "trace" | "workflow" | "task" | "session" | "metric" | "owner";
  hiddenCount: number;
  label: string; // "... 4 later events", "... 2 same-workflow sessions"
  nodes: EventGraphNode[]; // optional preloaded fragment for this frontier
  edges: EventGraphEdge[];
};
```

Clicking a frontier expands that boundary:

- `before`: hidden earlier parents;
- `after`: hidden children or later follow-up events;
- `details`: detail evidence such as receipts, guards, LLM turns, tool calls;
- `context`: same workflow/task/session/metric/owner context.

If the graph reaches a visible node with hidden continuation, the API must
return a frontier instead of pretending that visible node is the end. The UI
renders that frontier as a `... expand` node at the anchor where expansion is
available.

The browser maintains view state separately from loaded data:

```text
visible graph = base graph + loaded frontier/session data - hidden branches
```

Expanding may fetch more data, but rendering does not care whether data came
from the first response or a later request. Collapsing only hides visible child
branches in the current view; it must not delete fetched data.

Controls are data-driven:

- show `... expand` where a returned frontier is not currently visible;
- show `- collapse` on any visible node with visible child/detail branches;
- re-expanding a collapsed branch should reveal already fetched data when
  available.

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
- which nodes are default evidence and which are expanded detail evidence;
- which abnormal/skipped/unhandled records must remain visible for inspection.

The UI owns only presentation:

- layout direction, spacing, colors, and selection;
- which expandable node keys are currently open;
- scroll position, anchors, and fallback raw rows;
- rendering different node/edge kinds consistently.

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
    | "tool_call"
    | "tool_result"
    | "return";
  label?: string;
};
```

Important distinction:

- `trace.parentEventId` is the durable event-to-event parent.
- `parentKey` is the display hierarchy used to draw detail nodes under a
  selected event/session/workflow.

For example, `session.receipt`, `handler.skipped`, and `evaluation.skipped`
may be detail children of a session start node even when their durable trace
parent is different or missing. That is acceptable as long as the graph node
also keeps its original `eventId`, `type`, and trace metadata available in the
inspector.

The read model must not drop records because they look secondary. Skipped,
unhandled, malformed, orphan, and diagnostic records are often the evidence the
human is looking for.

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
| `session_digests`, `evaluations`, `guard.triggered` events | Detail evidence | Expose as detail nodes or side-panel evidence, hidden by default. |

The migration rule is additive:

- keep existing tables and fields;
- keep legacy context fields such as `sessionId`, `workflowRunId`,
  `taskId`, `attemptId`, `metricId`, `alertId`, `conversationId`,
  `originalIssue`, and `escalationId`;
- prefer new `trace` metadata for exact event-to-event relations when the
  related event id is known;
- use compatibility projections to make older records graphable.

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
| Same `sessionId` | Link `session.start`, `session.end`, `session.completed`, `session.receipt`, `guard.triggered`, evaluation events, and detail records into the session trace. |
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
  -> project.planning.requested
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

The UI can collapse repeated loop slices into one group such as:

```text
spec-loop x37 iterations
```

Merges are multiple incoming parent/reference relationships:

```text
project.planning.requested
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

LLM turns and tool calls should also be traceable, but hidden by default.

Use `visibility`:

| Visibility | Default behavior | Examples |
|------------|------------------|----------|
| `default` | show in normal graph | `escalation.created`, `project.task.completed`, `message.created`, `workflow.completed` |
| `detail` | hide until toggled | `llm.turn.completed`, `tool.call.completed`, `context.read` |

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

Expanded trace:

```text
human.input.received
  -> session.started
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

## API And UI

The graph API should return nodes and edges directly:

```text
GET /api/events/:eventId/graph?depth=3&detail=false
```

The API should prefer persisted trace rows and fall back to `event_pair_runs`
when traces have not been backfilled yet. This keeps existing DB history useful
immediately after deployment.

Response shape:

```typescript
type EventGraphResponse = {
  focusEventId: number;
  traceId?: string;
  nodes: EventGraphDisplayNode[];
  edges: EventGraphDisplayEdge[];
  frontiers?: EventGraphFrontier[];
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
  eventListScope?: string;
  diagnostics: string[];
};
```

UI defaults:

- render graph nodes with `visibility = "default"`
- hide `detail` events until toggled
- label `closure` links distinctly
- collapse repeated loop slices
- show raw event envelope and transcript/tool references in the inspector
- preserve all nodes returned by the API, including skipped/unhandled
  diagnostics; filtering is a user choice, not a default data loss

React Flow is a good renderer for the interactive UI, with ELK.js or a similar
layout engine for left-to-right DAG layout. Mermaid export is useful for static
reports.

## Implementation Plan

1. Add `event_traces` and `event_trace_links` storage and helpers.
2. Teach the DB writer and direct SQL insertion paths to persist `trace`.
3. Backfill existing traces from `event_pair_runs` and common payload fields.
4. Teach event emitters to accept `trace`.
5. Link direct chains first: message replies, escalation closure, workflow
   dispatch, task completion/review.
6. Add detail-level session/tool/LLM events as references rather than full
   transcript duplication.
7. Build `/api/events/:eventId/graph`.
8. Move display hierarchy into the graph read model: return node keys,
   `parentKey`, `level`, node kind, edge kind, and detail visibility from the
   API instead of reconstructing session/tool hierarchy in the browser.
9. Replace ad hoc trace UI with graph rendering and detail toggle.
10. Update evaluation checks to look for broken trace chains rather than
   matching strings or escalation-specific fields.

Implemented foundation:

- `event_traces` and `event_trace_links` are additive side tables.
- New event rows get a default `trace_id = event:<event_id>`.
- Explicit envelope `trace` writes parent and link metadata.
- Owner-inbox review follow-up events write closure links.
- `backfillEventPairTraces(...)` can project existing `event_pair_runs` into
  trace rows and closure links.
- `GET /api/events/:eventId/graph?depth=3&detail=false` returns graph nodes,
  edges, and diagnostics.
- The current UI can expand sessions inline, but the long-term contract is for
  the graph API to provide semantic hierarchy so the UI only renders it.
- `bun run check:event-graph -- --state-dir /app/.state` checks trace storage
  integrity. Add `--backfill` to create baseline trace rows for existing events
  and project lifecycle pair records into closure links.

## Non-Goals

- Do not replace task trees, metrics, sessions, or workflow run records.
- Do not make the event trace a workflow engine.
- Do not store every token or large tool output in event rows.
- Do not create escalation-specific relation fields when trace metadata
  expresses the relationship.
