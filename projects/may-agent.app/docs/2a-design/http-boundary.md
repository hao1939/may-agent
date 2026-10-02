# HTTP API And Web UI Boundary

**Supports:** [Host And App Boundary](system-boundary.md). Connects browser reads and controls to their existing owners without duplicating policy.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** Controls use shared event publication. Conversation,
human Task and App-ID Task reads forward through the daemon's shared read
capabilities. The default Task board uses paged human Task reads. Source entry:
`src/app/http/task-read-routes.ts` and the HTTP source guide.
Session evaluation generation still embeds evaluator instructions in HTTP, and
evaluation comments still append feedback files directly. These are known gaps
in the thin-adapter boundary, not exceptions to the contract below; their paired
Host/Evaluation change is tracked in the convergence tracker.

## Purpose

HTTP is the browser-facing adapter for bounded reads, live observation, and
typed ingress. It is not an App, project controller, workflow dispatcher, or
second runtime.

```text
browser
  -> bounded read
     or publish(EventInput)
  -> canonical daemon authority
  -> App request, Task, session, metric, Event, or adapter projection
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

### Installation access responsibility

Host-control events, cancellation, and browser-terminal input are trusted
operator surfaces. The installation operator must authorize their users and
constrain network access before publishing them. Event ingress allowlists,
provenance assignment, and resource-level authority checks restrict what an
accepted request can name; they are not user authentication or a firewall.
Current container configuration publishes HTTP on 8080 and noVNC/websockify on
6080. Nginx serves `/terminal/` by proxying ttyd over
`/tmp/may-agent-ttyd.sock`; port 6080 is the separate noVNC surface. The
inspected repository configuration does not establish an external identity
proxy, firewall, or other deployment boundary, so operators must verify those
controls for their installation rather than infer them from reachability or
this design.

Edit the default UI only in `packages/webui/static`. Build into staging, then
update the served copy through explicit deployment; see the
[UI source/build boundary](webui.md#source-ownership) for the repository-local
staging and deployment behavior. Domain UIs use stable HTTP/control
contracts rather than private runtime storage.

## Read boundary

The [SDK read types](../../../may-agent/packages/sdk/src/workflow.ts) define
public Task responses. The internal stored resource's `metadata/spec/status`
shape is not that response contract.

GET endpoints return bounded explicit API models, never database rows or
filesystem layout as a public contract. A read model:

- names its source and freshness/measurement time;
- distinguishes missing, unknown, stale, and invalid state;
- uses stable App request, project, Task, execution, Event, metric, alert, and
  adapter-attempt identities;
- bounds timelines, transcripts, summaries, and collections;
- preserves canonical task generation, Conditions, readiness, and integrity
  findings; and
- surfaces read/projection failure without inventing domain meaning.

Stable families include health/overview, App request health, Events and traces,
agents and executions, projects/Tasks, metrics/alerts, adapter diagnostics, and
terminal transport. The executable server route table remains the endpoint
catalog.

Canonical App task reads use stable identities rather than filesystem-like
project paths:

```text
GET /api/apps/:appId/tasks
GET /api/apps/:appId/tasks/:taskId
```

These are the App SDK's bounded `TaskView`/`TaskDetail` contracts, forwarded
through `app.tasks.list` and `app.task.get`; they are not persisted resource
rows (`kind`, `metadata`, `spec`, `status`). They do not include a timeline.

Human Task reads use the same `tasks.list` and `task.get` service as Console
and Telegram:

```text
GET /api/tasks?appId=<app>&limit=30&cursor=<opaque-cursor>
GET /api/task?appId=<app>&taskId=<exact-task-id>
```

The board shows one page at a time, newest changes first, with a server-side
state filter and an option to include retained finished/cancelled Tasks.
Counts and text filtering explicitly apply only to the displayed page. The
board does not rebuild a whole-App tree or claim global integrity/capacity
from a partial page. Exact detail keeps the full goal, acceptance, current
attempt/progress, parent identity, outputs, Conditions, dependencies, and
retained evidence. It shows at most 100 direct Conditions/dependencies and
20 reconciliation events, with visible truncation notices. History includes
older generations/attempts and cannot establish current completion.

An open converged Task is `up-to-date`. Explicit closure is separate; `done`
remains a historical receipt label in human reads.
Completion/cancellation comes from canonical retained records, not inferred
events. Read failures remain failures, never empty boards or fabricated
completion. Browser selection is local; late responses cannot replace a
newer Task selection, closed drawer, or changed project.

The new board retires `/api/projects/tasks` and `/api/projects/task`; audited
current callers are confined to the shipped board. Upgrade the Host and its
generated UI together. App SDK routes remain unchanged. No read route permits
Task mutation; steering still publishes an exact `project.owner.requested`
event through `/api/events`.

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
durable required Events still awaiting acceptance. No HTTP `2xx` proves Task
convergence, adapter display, or domain completion.

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

`GET /api/events/:id` returns the bounded Event, admission state, and linked
outcomes. Historical queries remain bounded. Live websockets stream the same
canonical events and projection changes.

Browser receipt of a websocket frame is observation only. It does not satisfy
semantic Event admission, App request handling, Task work, or Conversation
completion.

Trace graphs show causal evidence and links to authoritative App requests,
Tasks, and optional adapter diagnostics. They do not reconstruct an event-pair
work lifecycle in the browser.

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
- Browser/websocket observation never counts as semantic Event admission.
- Actions translate to App input and do not publish command-like events.
- Paths stay within admitted roots.
- Compatibility adds no second semantics or actionable route.
- The HTTP layer contains no project-specific workflow/task controller logic.
