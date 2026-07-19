# Events, Delivery, And Inbox

**Design status:** Accepted.
**Implementation status:** Implemented for canonical envelopes, delivery
acceptance, owner inbox routing, typed follow-up review, pair tracking, trace
closure, and bounded retention.

## Purpose

An event is a durable signal that another component, owner, session, workflow,
or human can react to.

```text
emit -> persist -> target delivery -> owner fallback -> typed response/state
```

Pure history or facts with no possible reaction belong in state, logs, metrics,
or knowledge. Events are not decorative audit rows.

Read [system-model.md](system-model.md) for the relationship among events,
delivery, pairs, traces, and domain entities. Read
[event-graph.md](event-graph.md) for causal graph details.
Read [storage.md](storage.md) for event-body storage and retention invariants.

## Canonical Envelope

Every persisted event uses one two-layer shape:

```ts
type EventEnvelope<TData extends Record<string, unknown>> = {
  id?: number;
  type: string;
  source: string;
  owner: string;
  target?: Record<string, unknown>;
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

Envelope fields belong to infra routing, ownership, urgency, retention, and
causality. Event-specific facts belong in `data`.

Authoring adapters may accept flat compatibility fields or infer source/owner,
but they normalize before persistence. Handlers read domain fields from
`event.data`. New external/HTTP producers send the complete envelope.

## Owner And Target

`target` identifies the intended consumer or domain object. `owner` identifies
who is accountable if targeted delivery fails.

```text
matching target consumer -> accepts responsibility
no matching consumer      -> queryable owner inbox accepts
no owner route            -> unhandled and surfaced to ops health
```

An owner is a backstop, not necessarily the first responder. Human ownership
uses `human:<role>`. Agent ownership uses `agent:<name>`. Project events should
target the project and resolve its configured owner.

Identifiers used by both routing and domain handling may appear in typed
`target` and `data`. They have different roles: `target` routes; `data` gives
the consumer the domain context. Compatibility extraction of `projectId`,
`project_id`, or flat fields belongs at ingress only.

## Durability And Reliability

“Durable” means the event and trace are persisted for audit, reconciliation,
and owner review. The in-process bus is not a general durable queue and does not
promise automatic exactly-once replay.

The runtime guarantees:

- durable recording at boundaries that require it;
- explicit delivery acceptance;
- queryable owner fallback for unclaimed owned work;
- overdue delivery and missing-response detection;
- idempotent reconciliation paths where a continuation can repeat;
- referential retention for events linked to open work.

Persistence is not proof of execution. Delivery acceptance is not proof of
completion.

### Body storage

The event row always keeps bounded routing, delivery, causality, and common
correlation fields. A small bounded body may remain inline. A larger body is
atomically written to `.state/event-bodies/<sha256>.json` before the row is
committed; `data` then contains a bounded compatibility projection and artifact
reference. Content-addressed bodies are immutable and may be shared.

Consumers that only route, correlate, or measure an event must not load the
full body. Detail/audit readers resolve the reference when full content is
actually required.

## Delivery Acceptance

Delivery metadata lives on the original event:

```text
delivery_status = pending | accepted | unhandled
accepted_by
accepted_at
delivery_route = direct | owner_inbox | noop
delivery_note
```

Only a component taking responsibility reports acceptance:

- matching event consumer or workflow-dispatch binding;
- targeted session/runtime controller;
- receiving human/channel adapter;
- queryable owner inbox.

Observation and outcome events such as daemon heartbeats, workflow dispatch
facts, evaluator results, routed metric feedback, and review records are
accepted directly by the evidence projection. An `owner` on those facts is
attribution, not a request to create owner work.

DbWriter, logging, passive metrics, UI tailing, graph projection, and unrelated
broad subscribers do not count as delivery.

For asynchronous work, acceptance means “queued or started responsibly,” not
“finished.” The normal accepted path updates the event row; it does not emit an
`event.accepted` event.

## Owner Inbox

The owner inbox is the durable pull route for owned events without a specialized
consumer when the event represents actionable work. Explicit work candidates
include messages, escalations, metric alerts, owner requests, feedback, and
comments. An otherwise unknown owner-addressed request also remains visible
rather than being silently discarded. Inbox acceptance means the item is
visible to the owner. Owner review later emits a typed follow-up event and
closes the inbox pair.

Typical follow-ups include:

- `message.reviewed` or `message.consumed`;
- `project.owner.reviewed`;
- a project/task/problem event;
- `escalation.resolved` or `escalation.dismissed`;
- an explicit evidence-backed no-op event.

Stale inbox work becomes an orphaned owner-inbox pair. Event rows have no
generic mutable review status; use delivery metadata and typed pair state.

## Typed Response And Pair Tracking

Some events open a commitment with an expected typed response:

```text
opening event -> accepted work -> closing event
              -> deadline passes -> orphan surfaced
```

`event_pair_runs` tracks whether that response arrived in time. Pair matching
uses the opening event id when available and a stable domain correlation key
only where an exact event relation cannot yet be carried.

Examples:

| Opening | Closing |
| --- | --- |
| `project.owner.requested` | `project.owner.reviewed` |
| `escalation.created` | `escalation.resolved` or `escalation.dismissed` |
| `cli.task.requested` | `cli.task.completed`, `failed`, or `orphaned` |
| `runtime.restart.requested` | runtime restart result event |

Not every event is paired. `metric.breach` uses the metric-alert entity for its
open/resolved lifecycle. An observation/result event with no promised later
response is normally unpaired.

Pair closure records a trace closure link atomically. Pair status answers
whether the expected response arrived; the trace link answers which event
fulfilled the earlier commitment.

## Lifecycle Separation

| Record | Question |
| --- | --- |
| Event delivery | Did a responsible consumer accept the signal? |
| Event pair | Did an expected typed response arrive before its deadline? |
| Trace | What caused the work and which event fulfilled it? |
| Domain entity | What is true now for the project/task/alert/escalation? |
| Session/workflow run | How did this bounded execution attempt end? |

Never infer project success from pair closure or task acceptance from workflow
completion.

## Core Event Vocabulary

The runtime type definitions are the exhaustive executable reference. The
design keeps the core cross-boundary vocabulary small.

### Human And Session

- `human.input.received` — transport-neutral human input root;
- `chat.start.requested` — bind/create a conversation container;
- `session.steer.requested` — deliver one turn to an existing session;
- `session.cancel.requested` — targeted cancellation;
- `session.start`, `session.idle`, `session.end` — execution/conversation facts;
- channel delivery events — prove a result reached the human surface.

Exactly one semantic child intent follows each free-form human input root.

### Project

- `project.owner.requested` / `project.owner.reviewed`;
- `project.task.reconcile.started`, `project.task.reconcile.skipped`, and
  `project.task.reconciled` are controller observations, not scheduling commands;
- domain and provider observations wake tasks through an app resolver or an
  exact `target.taskId`;
- `project.problem.investigation.requested` / `project.problem.resolved` /
  `project.problem.escalated`;
- `project.comment.created` and project-specific typed actions.

Historical assignment, completion, review, planning, execution, dispatch, and
finish task events are not live ingress aliases.

### Metrics And Escalation

- `metric.breach`, `metric.stalled`, `metric.recovered`;
- `metric.alert_judged` for owner judgment;
- `escalation.created`, `escalation.resolved`, `escalation.dismissed`.

Metrics wake judgment; they do not choose the fix. Escalation is reserved for
cross-owner blockers.

### Runtime And Execution

- timer/handler/workflow/session lifecycle facts;
- `workflow.owner.requested` for blocked non-project top-level workflows;
- `cli.task.requested`, `started`, `completed`, `failed`, `orphaned`;
- `runtime.*.requested` plus typed result/failure events;
- `guard.triggered` and `skill.loaded` as diagnostic evidence, not owner work by
  default.

## Human-Rooted Traces

```text
human.input.received
  -> exactly one semantic intent
  -> session/workflow/project/runtime work
  -> terminal evidence
  -> channel delivery
```

A persistent chat session is a container, not a trace. Each human turn gets a
new trace unless it is explicitly replying within a referenced notification or
result trace.

## Workflow Blocking

A workflow ends with local `done` or `blocked`. Nested blockers return to the
parent synchronously. At a top-level project boundary:

- task workflows return blocked evidence to the app controller, which records
  attention and invokes owner fallback through the same task key;
- project workflows without task context wake `project.owner.requested`;
- non-project workflows wake `workflow.owner.requested`.

The workflow itself does not emit an external escalation merely because it is
blocked. The caller/owner decides whether the next action crosses an ownership
boundary.

## Retention

Events are operational evidence, not permanent event sourcing. The base event
window is short. Retention protects:

- events referenced by open pairs or owner inbox work;
- retained trace parents and closure links;
- human roots/results whose delivery evidence is still required;
- other explicit open-work references.

After referential protection, old detail may be pruned before roots, delivery,
and closure evidence. Long-term domain truth belongs in projects, tasks,
metrics, knowledge, reports, or domain artifacts.

## Schema Boundary

The live schema has one event model. Delivery uses `delivery_status`,
`accepted_by`, `accepted_at`, `delivery_route`, and `delivery_note`. Domain
state uses typed events and `event_pair_runs`; there are no generic mutable
`status`, `handled_by`, `result`, `reason`, or `retry_count` event columns.

Authoring conveniences normalize at ingress into this canonical envelope.
Runtime readers and examples use only the canonical schema and do not maintain
a second legacy lifecycle.

## Operational Audit

Use `query.eventDeliveryHealth()` and the event graph to check:

- overdue `pending` or `unhandled` events;
- owner-inbox fallback and orphaned inbox pairs;
- overdue lifecycle pairs;
- missing trace parents or closure links;
- opener/closer trace splits;
- human intents without terminal disposition or channel delivery;
- bookkeeping-only acceptance hiding a missing domain consumer.

Detailed procedures live in
[event-runtime-audit.md](../2b-manual/event-runtime-audit.md).

## Integrity Checklist

- Event has a real possible consumer and accountable owner.
- Persisted event has canonical envelope and `data` payload.
- Target-first routing and owner fallback are distinguishable.
- Passive observers never satisfy delivery.
- Typed responses close pairs and write trace closure links atomically.
- Domain completion remains in the owning entity.
- Continuation/reconciliation handlers are idempotent.
- Retention protects open work and causal evidence.
- Compatibility is isolated and read-only.
