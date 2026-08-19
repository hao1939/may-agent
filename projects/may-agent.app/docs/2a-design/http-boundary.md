# HTTP API And Web UI Boundary

**Design status:** Accepted.
**Implementation status:** Controls use the shared event publication path.
Canonical App-ID Task list/get routes are implemented as daemon-read adapters.
The default project UI still uses older path-based project endpoints and a
generated projection while it migrates.

## Purpose

HTTP is the browser-facing adapter for bounded reads, live observation, and
typed ingress. It is not an App, project controller, workflow dispatcher, or
second runtime.

```text
browser
  -> bounded read
     or publish(EventInput)
  -> canonical daemon authority
  -> App request, task, session, metric, event, or delivery projection
```

## Source and process ownership

```text
projects/may-agent/src/app/http/           # HTTP/websocket adapter
projects/may-agent/packages/webui/static/  # editable default UI
projects/platform/ui/                      # generated served target
projects/<id>.app/ui/                      # optional domain UI
```

The same `may-agent` binary owns the runtime. Web mode may run in a separate
process group, but it uses the same control/read contracts and cannot claim App
work independently.

Edit the default UI only in `packages/webui/static`, then generate the served
copy with `bun run ui:sync`. Domain UIs use stable HTTP/control contracts rather
than private runtime storage.

## Read boundary

GET endpoints return bounded explicit API models, never database rows or
filesystem layout as a public contract. A read model:

- names its source and freshness/measurement time;
- distinguishes missing, unknown, stale, and invalid state;
- uses stable App request, project, task, execution, event, metric, alert, and
  delivery identities;
- bounds timelines, transcripts, summaries, and collections;
- preserves canonical task generation, Conditions, readiness, and integrity
  findings; and
- surfaces read/projection failure without inventing domain meaning.

Stable families include health/overview, App inbox/request health, events and
traces, agents and executions, projects/tasks, metrics/alerts, delivery, and
terminal transport. The executable server route table remains the endpoint
catalog.

Canonical App task reads use stable identities rather than filesystem-like
project paths:

```text
GET /api/apps/:appId/tasks
GET /api/apps/:appId/tasks/:taskId
```

The collection is bounded and filtered; the detail is exact and includes a
bounded reconciliation timeline. Their responses use the shared resource
shape (`kind`, `metadata`, `spec`, and `status`) returned by in-process and
agent-tool reads. HTTP is only scope and transport binding, not a separate read
model. Existing path-based project task reads are compatibility adapters over
the same service. Neither form permits task mutation.

Resource APIs share `get`/`list`, identity, pagination, and error conventions,
but they remain typed by resource kind. The out-of-process HTTP adapter asks
the daemon's resource reader through the control socket; it does not reopen
task files and rebuild another model. There is no generic HTTP CRUD endpoint
that accepts arbitrary kinds or mutations.

Other Host-owned read models may use their canonical stores directly. The
browser cannot write inferred state back or become a reconciler.

## Write boundary

Every state-changing request enters one operation:

```text
POST /api/events -> publish(event) -> EventReceipt
```

The admitted event type retains the existing meaning: App input, reported fact,
declared App action translated to input, exact control, or Host lifecycle
control. The transport does not implement separate queues or receipts for
those meanings.

Examples:

| Human intent                    | Canonical path                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| May conversation adapter        | Publish human `conversation.message.created` for `Conversation may:primary`                 |
| Explicitly steer/cancel session | Publish an exact required session event                                                     |
| Comment on project              | Publish `project.comment.created`; declared App subscription may admit input and a task     |
| Invoke App action               | Discover schema, validate, call `toInput`, admit input and its linked request/task           |
| Submit approval                 | Update exact owning task/Condition through typed control                                    |
| Reload/restart/shutdown         | Publish a required Host-control event                                                       |
| Publish provider/lifecycle fact | Publish a record-only event                                                                 |

`POST /api/events` accepts an explicit allowlist of request, fact, and control
types with type-specific schemas. Callers supply `type`, `target`, `data`, and
an optional idempotency key. HTTP assigns trusted provenance; callers cannot
assert `source`, `owner`, or trace ancestry. The endpoint is not permission to
invent a domain type, address an owner by fallback, or bypass App actions.

The receipt always includes the event ID, `recorded` or `accepted`, and linked
request/task/session/operation identities when present. HTTP returns `202` for
durable required events still awaiting acceptance. No HTTP `2xx` proves task
convergence, human delivery, or domain completion.

## App and project boundary

Project comments and actions are different:

```text
comment -> fact -> declared subscription -> App input
action  -> validate declared schema -> App input
```

A deterministic changed fact may instead wake an exact task or Condition. This
classification belongs to the loaded App and must have one actionable path.

Actions never emit an actionable semantic event as a shortcut. The Host admits
the translated input, resolves its task, and returns the linked request and
task identities.

Generic project pages consume shared read models. Domain panels may present
deeper facts/artifacts but cannot query private SQL, read task files, or infer
task meaning independently.

## Event and websocket boundary

`GET /api/events/:id` returns the bounded event, delivery state, and linked
outcomes. Historical queries remain bounded. Live websockets stream the same
canonical events and projection changes.

Browser receipt of a websocket frame is observation only. It does not satisfy
semantic event delivery, App request handling, task work, or human delivery.

Trace graphs show causal evidence and links to authoritative App/task/delivery
objects. They do not reconstruct an event-pair work lifecycle in the browser.

## Files and path safety

Requests use stable project, App, task, execution, and artifact identifiers.
Server resolution remains inside declared App/workspace/artifact roots.
Absolute paths in evidence are inert text unless a dedicated safe artifact
endpoint admits them.

API routes match before static and domain UI routes. The browser never supplies
an arbitrary server filesystem root.

## Compatibility

Compatibility endpoints may preserve old client shapes only when they become a
small `EventInput` constructor and call the same `publish` function.
They cannot define a second payload meaning, lifecycle, task mutation path,
owner fallback, or execution route.

Compatibility responses should include the canonical identity so clients can
move without relying on legacy event-pair or session-follow-through behavior.

## Integrity checklist

- Reads are bounded projections with source, freshness, and honest unknowns.
- Every write uses one allowlisted `publish(EventInput)` operation.
- An HTTP receipt never appears as semantic completion.
- App/task meaning remains in canonical runtime and App-owned state.
- Browser/websocket observation never counts as delivery acceptance.
- Actions translate to App input and do not publish command-like events.
- Paths stay within admitted roots.
- Compatibility adds no second semantics or actionable route.
- The HTTP layer contains no project-specific workflow/task controller logic.
