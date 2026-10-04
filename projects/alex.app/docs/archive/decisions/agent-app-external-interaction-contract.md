# Agent App External Interaction

**Historical context:** [System Model](../../2a-design/system-model.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Superseded by `canonical-agent-app-migration.md` (2026-08-15)
**Scope:** How a human, agent, automation, or UI gives intent to an Agent App

> Historical decision only. The event-pair ownership model below must not be
> implemented. Current addressed input is admitted to App Inbox; a task is an
> optional explicit dependency; `app.dependency.completed` wakes the request;
> and no `project.owner.reviewed` work lifecycle is created.

## Superseded decision

Use one default mental model:

```text
send intent to the app -> event receipt
  -> the app owner reviews it with current app context
  -> one correlated owner result
  -> optional durable task
  -> follow the existing event and, when created, the task
```

The external actor does not need to discover the app's internal task taxonomy,
choose an agent, select a workflow, create a task, or choose a runtime session.
The app owner has the context needed to make those decisions.

The existing `project.comment.created` event is the default external input,
receipt, and trace root. Every accepted intent closes with one correlated
`project.owner.reviewed` result. Do not add a request, command, or job entity
around that event pair.

> External actors give intent to an app. The owner decides how to handle it.
> Workflows preserve reusable experience. Tasks preserve durable desired work.
> Events connect and record the loop.

## Why this boundary

An external actor usually knows what outcome it wants, but not:

- which current task already covers it;
- whether the project is waiting on an external fact;
- which agent owns the domain decision;
- whether a learned workflow should be reused;
- whether a new task is justified; or
- whether the correct result is an answer, no-op, wait, task revision, or new
  finite task.

The app owner can read current project intent, task state, waits, evidence,
workflows, and policy before deciding. Moving those choices into an external
action catalogue exposes app internals and asks the least-informed actor to
choose the execution path.

The standalone migration incident demonstrated the risk. Missing
`standaloneBuildId` input was interpreted through a free-form task-creation
path, producing unintended work. The correction is not to require every human
to choose a more precise internal action. The owner should refuse to invent
required facts, request the missing information, or select a learned workflow
whose contract validates it.

## Default public contract

Every external surface supports the same two operations:

```ts
projects.comment(projectId, message, context?, { idempotencyKey? }) -> { eventId }
events.get(eventId)
```

If the event produces a durable task, the caller follows that task through the
existing task read model. There is no app-specific job or status API.

### Send intent

```http
POST /api/projects/comment
Content-Type: application/json

{
  "projectId": "aks-rp-e2e",
  "comment": "Validate standalone build 172999999 with the dual-target pilot.",
  "idempotencyKey": "validate-standalone-172999999"
}
```

The transport:

1. authenticates the actor;
2. authorizes access to the project;
3. validates the bounded transport shape;
4. persists `project.comment.created`; and
5. returns its event ID.

```json
{
  "eventId": 3644962,
  "eventType": "project.comment.created"
}
```

The event target identifies the project. Infrastructure resolves the app and
its accountable owner. Identity comes from the authenticated transport; the
event body cannot claim a different actor, owner, or agent.

A comment is intent, not a task specification. It may include bounded
attachments or references, but it does not contain task-state mutations,
workflow bindings, or session instructions.

The optional idempotency key is scoped to the ingress source, project, and
semantic event type. Reusing it with the same input returns the original event
ID; reusing it with different input is rejected. This is retry-safe event
ingress, not a command lifecycle or a second durable entity. A transport with
authenticated actors may include that actor in its source identity.

### Owner handling

The app/owner path builds current project context and performs one bounded
review. The owner may:

- answer or record an evidence-backed no-op;
- update or create durable work through reconciler task actions;
- bind an owner-owned workflow when reusable experience applies;
- ask the human for missing required information; or
- reject an unsafe or out-of-scope request with a clear reason.

An answer, rejection, or no-op may complete directly in the owner result. Work
or waiting that must survive the owner turn is durable task state. The owner
creates or revises a task; exact Conditions belong to that task rather than to
an ephemeral response event.

The owner never edits task storage directly. The generic reconciler remains the
sole task-state writer and the autonomous host remains responsible for event
delivery, queues, attempts, persistence, concurrency, and recovery.

The reconciler remains level-based: several intents may wake the same stable
owner-review task and one review may cover their combined current state. Event
coalescing must not lose response correlation. The pending task trigger carries
the unresolved input event references, and the completed review emits one
bounded owner result for each reference. This preserves one stable task without
turning the work queue into a per-request scheduler.

When owner review is complete, exactly one `project.owner.reviewed` event closes
the original input trace. Its bounded payload contains:

```ts
{
  openEventId: number;
  projectId: string;
  disposition: "answered" | "rejected" | "no-op" | "task-created" | "task-updated";
  summary: string;
  taskRefs: Array<{ projectId: string; taskId: string }>;
}
```

`taskRefs` is empty for a direct answer, rejection, or no-op. When durable work
was created or revised, the owner result and task reconciliation events link
the same trace. The result event is the explicit semantic response that lets
`events.get(eventId)` answer what happened without interpreting an arbitrary
transcript.

### Follow

The caller follows existing state:

```text
project.comment.created #3644962
  -> owner review
  -> project.owner.reviewed · task-created
  -> task domain/validate-standalone
       pending / running / waiting / attention / converged
```

The event graph shows delivery, owner handling, child events, and any task
reference. The task read model shows durable desired and observed state. A UI
may present a compact combined view, but it must derive it from these existing
sources rather than maintaining an invocation record.

## Optional typed shortcuts

Typed app actions are optional shortcuts for repeated external automation. They
are not the default human interaction model and external users do not need to
choose one before contacting the app. Their names, descriptions, and schemas
remain discoverable for generated WebUI forms, CLI help, and external agents
that deliberately use the automation surface.

Promote an interaction to a typed action only when:

- the same external operation repeats;
- its required input is stable and mechanically validatable;
- the app can deterministically translate its input to one semantic event; and
- automation benefits from a stable schema.

Only the input-to-event translation is deterministic. The semantic event may
still resolve to a workflow, an owner judgment task, or other agent-driven
work.

An action is only a described, typed event constructor:

```ts
type ProjectAppAction<TSchema> = {
  type: "async";
  description: string;
  inputSchema: TSchema;
  event(input: Static<TSchema>): ProjectAppEvent;
};
```

Invocation performs one short path:

```text
discover the optional action schema
  ->
validate input
  -> build one app-defined semantic event
  -> persist and emit that event
  -> return its event ID
```

For example:

```ts
actions: {
  "validate-standalone-dual-target": {
    type: "async",
    description: "Validate an existing standalone build using the dual-target pilot.",
    inputSchema: Type.Object({
      standaloneBuildId: Type.String({ minLength: 1 }),
    }),
    event(input) {
      return {
        type: "aks.standalone-dual-target.requested",
        target: { project: "aks-rp-e2e" },
        data: {
          project: "aks-rp-e2e",
          standaloneBuildId: input.standaloneBuildId,
        },
      };
    },
  },
}
```

The returned semantic event is itself the receipt and trace root. Do not wrap
it in `project.action.invoked`, `project.action.accepted`, an action-status
record, or a second lifecycle.

Invalid typed input returns a validation error before the event factory runs.
It creates no semantic event and no task. Ordinary authentication and audit
logging may record the transport rejection without turning it into project
work.

The event then follows normal app routing:

```text
typed semantic event
  -> deterministic tasks.resolve when the mapping is known
  -> app owner when judgment is needed
  -> existing task or bounded effect
```

Stable task identity and ordinary event-handler rules provide the same replay
behavior as other project events. The optional ingress idempotency key provides
retry safety and returns the original semantic event ID. Do not create a
special exactly-once command subsystem for actions.

## Convention over configuration

The default is always available:

```text
project comment -> app owner
```

Apps declare only the typed shortcuts they have actually learned to support.
They do not need:

- a generic `submit-work` action;
- a public `preferredOwner` field;
- an action output schema;
- an action-specific status machine; or
- a second action registry database.

The app owner resolves ownership and chooses direct handling or an owner-owned
workflow. A typed shortcut bypasses owner interpretation only when the app has
already encoded that repeated mapping in its event constructor and task
resolver.

## One contract on every surface

- **WebUI:** provide the project comment box as the primary entry point; show
  discoverable typed shortcuts as optional convenience forms.
- **CLI:** send a project comment, or invoke a known typed shortcut for
  automation.
- **agent tool:** send project intent with structured project identity and
  content; use a typed shortcut only when its schema is already known.
- **Telegram:** translate a project-directed message into the same project
  comment event.
- **HTTP:** expose the same operations without app-specific routes.

`POST /api/events` remains trusted low-level event ingress. It is not the
normal human interface and must not bypass transport authorization.

Direct session steering remains a conversation control surface:

```text
chat.start.requested
session.steer.requested
session.cancel.requested
```

Use project intent when the outcome should be understood and organized in app
context. Use session steering only when the human deliberately wants to control
one existing conversation.

## Reliability and security rules

- The project input event is persisted before owner handling starts.
- The transport returns the persisted event ID.
- Every accepted intent produces one correlated `project.owner.reviewed`
  response with a summary and zero or more task references.
- Repeated ingress with the same idempotency scope and input returns the first
  event ID without repeating owner review or event-only effects.
- Actor identity is transport-authenticated and cannot be supplied by input.
- Secrets are referenced, not embedded in comments or typed-action events.
- Sensitive typed-action fields are redacted in logs and UI.
- Owner handling and resulting task events remain in the same trace.
- Missing information is requested directly or represented by an exact
  Condition on a durable task; it is not invented to satisfy a task schema.
- An adapter does not create tasks, select owners, or wait synchronously for
  long work.
- A typed action emits one semantic event and has no private lifecycle.

## Implemented shape

The implementation provides retry-safe project-comment ingress, persisted event
receipts, app-owner routing, correlated owner results, discoverable action
schemas, validation before emission, and direct semantic-event receipts. The
event and task read models expose the resulting trace and durable work without
an action-specific lifecycle.

## Required proof

- a project comment returns its persisted event ID;
- the event is delivered to the intended app-owner path with current context;
- the owner or workflow returns one structured decision, and infrastructure
  emits one correlated result with its summary and task references;
- the owner can answer, reject, no-op, or return valid reconciler task actions;
- durable work and exact waits are represented by tasks rather than ephemeral
  owner-response state;
- missing required facts do not become invented task input;
- any resulting task is visible through the same event trace and task read
  model;
- an optional typed action rejects invalid input before emitting an event;
- a valid typed action returns the ID of its one semantic event;
- action descriptions and schemas remain discoverable on every automation
  surface;
- repeated ingress with the same key and input returns the original event ID
  without repeating effects;
- stable task resolution does not create duplicate durable work on replay;
- external callers cannot spoof actor, owner, workflow, or agent identity; and
- no UI requires action discovery before a user can contact an app.

## Non-goals

- No public raw task creation or task-state mutation.
- No direct durable assignment to an agent or session.
- No requirement that a human discover an action before contacting an app.
- No action request, command, or job database.
- No action-specific received/accepted/completed lifecycle.
- No generic hold/resume/cancel design in this proposal.
- No app-specific scheduler in HTTP or UI.
- No requirement that every app expose typed shortcuts.
- No synchronous HTTP wait for task completion.
