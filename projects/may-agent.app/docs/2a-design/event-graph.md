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
detail events = expandable LLM/tool/session evidence
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
  visibility TEXT DEFAULT 'default' -- default | detail
)
```

Store non-parent links separately:

```sql
event_trace_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_event_id INTEGER NOT NULL,
  to_event_id INTEGER NOT NULL,
  type TEXT,                  -- reference | closure
  label TEXT,
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

Response shape:

```typescript
type EventGraphResponse = {
  focusEventId: number;
  traceId?: string;
  nodes: Array<{
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
  edges: Array<{
    id: string;
    source: number;
    target: number;
    type: "parent" | "reference" | "closure";
    label?: string;
  }>;
  diagnostics: string[];
};
```

UI defaults:

- render `default` events
- hide `detail` events until toggled
- label `closure` links distinctly
- collapse repeated loop slices
- show raw event envelope and transcript/tool references in the side panel

React Flow is a good renderer for the interactive UI, with ELK.js or a similar
layout engine for left-to-right DAG layout. Mermaid export is useful for static
reports.

## Implementation Plan

1. Add `event_traces` and `event_trace_links` storage and helpers.
2. Teach event emitters to accept `trace`.
3. Link direct chains first: message replies, escalation closure, workflow
   dispatch, task completion/review.
4. Add detail-level session/tool/LLM events as references rather than full
   transcript duplication.
5. Build `/api/events/:eventId/graph`.
6. Replace ad hoc trace UI with graph rendering and detail toggle.
7. Update evaluation checks to look for broken trace chains rather than
   matching strings or escalation-specific fields.

## Non-Goals

- Do not replace task trees, metrics, sessions, or workflow run records.
- Do not make the event trace a workflow engine.
- Do not store every token or large tool output in event rows.
- Do not create escalation-specific relation fields when trace metadata
  expresses the relationship.
