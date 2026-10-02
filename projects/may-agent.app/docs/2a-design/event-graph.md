# Event Graph And Trace

**Supports:** [Events And Task Admission](events.md). Lets people and agents follow causality and locate missing progress without inventing work state.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** Core trace storage, links, APIs, UI projection, and
transactional execution closure are implemented for new Runtime Events. App
requests and Tasks retain their own durable authority. Retained history may
still require explicit backfill. Conversation response identity and current
Task observations are now resolved by the shared projections rather than by
adapter-local inference.

## Purpose

The Host should make event flow easy to program and easy to inspect.

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

Events are the root identity for input or change crossing the Host boundary.
Addressed work and durable desired work remain authoritative in App request and
task records linked from that event. The
event graph introduces no parallel request, approval, escalation, or task
lifecycle; it records causal relationships so humans, agents, and UI can answer:

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

`get(eventId)` is the compact entry point. It returns the stored event, its
`recorded`/`accepted` admission state, and bounded links to authoritative
request, task, session, delivery, or operation records. Those links expose
current state without copying mutable work truth into the event row. The graph
may expand them as supporting nodes but cannot treat them as event children
unless a causal edge was actually persisted.

Async boundaries must preserve trace explicitly. A queued event handler derives
one child trace from the persisted triggering event and passes that trace through
handler, workflow, and session events. If this propagation is absent, the graph
must show the session as disconnected; the UI must not repair it heuristically.

## Human-Rooted Trace Contract

Ordinary human input has one semantic root,
`conversation.message.created`, addressed to May with trusted human provenance.
It admits one bounded request. The request can finish directly or admit a
responsible Task linked through a Topic. Later Task attempts may have their own
traces; exact resource links preserve their relationship to the human turn.
[Message Lifecycle](message-lifecycle.md) owns the interaction policy, and
[Events](events.md) owns admission.

Historical `human.input.received -> app.input.requested` and direct
`app.input.requested` human roots remain valid compatibility evidence, but new
Console and Telegram ingress does not create two events for one human turn.

Agent, tool, and command-authored Conversation messages add context without a
request link. Transient messages add neither durable context nor work. The
Conversation read reconstructs only durable messages; Task state is read from
the Task resource interface. Conversation is not another causal or mutable
work graph.

Deterministic controls instead emit one exact `session.steer.requested`,
`session.cancel.requested`, `project.approval.submitted`, or
`runtime.*.requested` child. An explicit project-comment API or UI may persist
`project.comment.created` directly as its receipt and trace root; its declared
App subscription then admits correlated input and a linked task.

A persistent direct-agent chat session is an execution container, not a trace
or May request. Each direct-agent turn starts a new trace even when it reuses
the session. A reply to a prior notification or result references that durable
fact; it does not recover ownership from the chat session.

Direct-agent new-chat and explicit-steer turns use one required root event:

```text
chat.start.requested
  -> session.start
    -> session.idle

session.steer.requested
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

| Question                         | Evidence                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Was it handled?                  | A responsible domain consumer or queryable owner route accepted the intent.                  |
| Was work started?                | A child session, workflow, task transition, or explicit rejection/no-op exists.              |
| Was the intent completed?        | A terminal event has a closure link to the opening intent.                                   |
| Did a surface render the result? | Adapter/provider evidence, when available; this is operational and does not gate the result. |
| Did the human confirm it?        | A later human reply explicitly accepts, approves, corrects, or continues the result.         |

Most conversational turns finish when the App result is persisted. Approval
gates and explicit human decisions require a later correlated human message.
Human silence is not confirmation.

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
- ownership change: request-to-task admission, cross-App task dependency, or
  bounded execution delegated to an agent/workflow;
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
- direct emitted causal events;
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

| Field                        | Meaning                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `traceId`                    | Groups events that belong to the same chain. Use `event:<rootEventId>` when the root event id is known. |
| `parentEventId`              | Direct parent event. This is the main event-to-event line.                                              |
| `links`                      | Related events that are not the direct parent.                                                          |
| `links[].type = "reference"` | The event uses another event as context or evidence.                                                    |
| `links[].type = "closure"`   | The event closes another event.                                                                         |

This follows the common tracing shape: one trace id, parent relationship for the
main chain, and links for non-parent relationships.

## Graph Read Model

Trace storage records durable event relationships. The read model adds bounded
supporting records—Tasks, requests, sessions, workflow runs, transcript turns,
tools, metrics, and adapter diagnostics—without turning them into Events or
copying their mutable truth.

It owns:

- which persisted or projected records appear as nodes;
- display hierarchy through an explicit `parentKey`;
- flow, reference, closure, detail, sequence, tool-call, and tool-result edges;
- `persisted`, `lifecycle`, `correlation`, `projection`, or `transcript`
  provenance for every edge; and
- visibility of skipped, malformed, unhandled, orphaned, and diagnostic facts.

Persisted `parentEventId` and trace links are authoritative. Lifecycle and
correlation edges keep retained history inspectable, but are labeled
compatibility evidence and never repair missing causal propagation silently.

Display hierarchy and time are independent. `parentKey` sets horizontal
nesting; timestamp plus stable sequence sets vertical chronology. Missing
transcript timestamps may be interpolated within their known session bounds,
but hierarchy traversal must never reorder time.

The UI owns layout, selection, colors, spacing, and raw inspectors. It does not
infer parents from event names, search payload text for relationships, hide
backend-returned diagnostics, or build a second graph model.

## Storage, Writing, And Retention

Events remain append-only nodes. Trace metadata is additive:

```text
event_traces(event_id, trace_id, parent_event_id, visibility)
event_trace_links(from_event_id, to_event_id, type, label)
```

A parent edge points parent to child. A stored reference or closure link points
from the declaring event to the related event. Renderers may draw a closure in
the readable opener-to-closer direction while preserving its stored
provenance.

A new producer emits one normal Event envelope. While handling a persisted
Event, emitted Events inherit its trace and use it as their direct parent unless
the producer explicitly starts a new trace or adds a non-parent link. Event
insertion and trace/link insertion commit together. App requests, Tasks, and
dependencies keep their own identities and link to Events; the Host never emits
decorative Events solely to improve graph shape.

An Event without a provable parent starts a local `event:<eventId>` trace.
History may be projected from exact lifecycle and correlation records, but
backfill never invents an App result, closes work, or becomes current Task
authority.

Retention protects Events referenced by unfinished requests, Tasks,
Conditions, sessions, lifecycle pairs, or retained trace links. After closure,
high-volume detail may expire before boundary and closure evidence. If detail
leaves the operational database, retain a compact manifest rather than leaving
a dangling causal parent.

Historical inspection and additive backfill procedure belong to
[Event Runtime Audit](../2b-manual/event-runtime-audit.md), not this contract.

## Branches, Conditions, Loops, And Merges

The graph uses ordinary relationships:

| Shape     | Representation                                                     |
| --------- | ------------------------------------------------------------------ |
| Branch    | several child Events share one direct parent                       |
| Condition | a Task wait and the exact Event that satisfies or challenges it    |
| Loop      | repeated immutable wake/attempt/result Events                       |
| Merge     | one Event has a direct parent plus explicit non-parent references   |

A loop never mutates an old Event. An aggregate view may summarize repeated
iterations, but the audit graph retains every bounded Event in scope.

Cross-App work is owned by App request, dependency, and Task records. The graph
only explains their causal Events. Human attention follows the same model:
May publishes shared Conversation context, the human replies with a new root or
explicit reference, and the exact owning Task receives typed input. Console,
Telegram, and Web remain independent best-effort adapters.

## Sessions, Turns, And Tools

One new session has one terminal fact: `session.end`. Its payload carries the
runtime outcome, summary, duration, structured finish data, and correlation
fields. The Runtime does not manufacture normal `session.completed` and
`session.receipt` copies. Historical derivative records remain visible as
compatibility detail and cannot drive current routing.

Available transcript turns, tool calls, and tool results are projected beneath
their session. Store compact attributes and references, not full prompts,
tokens, or large tool output in Event payloads. A projected transcript node
keeps its session, turn/tool identity, order, and provenance; it is not a
persisted Event unless the Runtime actually emitted one.

## Review Contract

A trace review should answer:

| Question                                | Evidence                                                        |
| --------------------------------------- | --------------------------------------------------------------- |
| What started this chain?                | persisted trace root or explicitly labeled compatibility root   |
| What accepted responsibility?           | exact App request/Task admission or explicit rejection/no-op     |
| What execution happened?                | workflow/session/turn/tool nodes with their provenance           |
| What durable work changed?              | authoritative Task/request links and accepted result Events      |
| Did May answer?                         | correlated result in Conversation                                |
| Did an adapter render it?               | optional adapter/provider diagnostic; never semantic completion  |
| Where did it stop?                      | missing edge, open Condition, failed attempt, or absent result    |

Integrity checks report at least:

- a lifecycle closer without its persisted closure link;
- opener and closer split across traces;
- a new non-root lifecycle Event isolated in a singleton trace;
- admitted human intent with no execution, rejection, no-op, or result;
- a May result absent from its correlated Conversation;
- a child result not observed by its exact dependency; and
- bookkeeping-only acceptance where a declared semantic route was required.

One syntactically valid trace row per Event is necessary but insufficient.
Transport delivery or human silence never turns a valid result into unfinished
App work.

## API And Presentation

The graph endpoint returns one complete bounded server-resolved graph:

```text
GET /api/events/:eventId/graph
```

Its stable contract includes the focused Event, revision, nodes, edges, resolved
scope, raw persisted Events/relations, and diagnostics. Nodes carry stable keys,
kind, role, optional display parent, identity references, time, label, summary,
and a bounded data preview. Edges carry stable keys, endpoints, kind, label,
and provenance. The focused persisted Event additionally exposes its complete
stored envelope and data.

The endpoint prefers persisted trace relationships and may add visibly marked
compatibility projections for retained history. The browser renders every
returned node and edge, distinguishes detail and diagnostics, and exposes raw
evidence without applying another semantic filter.

## Current Implementation Boundary

Implemented behavior includes additive trace/link storage, transactional Event
and trace writes, inherited async trace context, closure links, bounded graph
reads, transcript projection, diagnostic provenance, and backend-authored UI
hierarchy. App requests and Tasks remain the mutable work authorities.

Retained history can still lack exact trace propagation. Its bounded audit and
optional additive backfill are operational procedures; they are not another
runtime path or a prerequisite for new Events.

## Non-Goals

- Do not add a second request/commitment lifecycle. The canonical Task owns App
  work; its linked request correlates the caller and result, and the root Event,
  trace, and graph only explain cause and evidence.
- Do not replace Task views, metrics, sessions, or workflow run records.
- Do not make the event trace a workflow engine.
- Do not store every token or large tool output in event rows.
- Do not create escalation-specific relation fields when trace metadata
  expresses the relationship.
