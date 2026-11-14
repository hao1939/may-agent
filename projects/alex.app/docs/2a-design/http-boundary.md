# HTTP API And Web UI Boundary

**Supports:** [Host And App Boundary](system-boundary.md). Connects browser reads and controls to their existing owners without duplicating policy.

**Choice basis:** [Core Principles](../1-principles/core-principles.md#one-authority-for-each-resource).

**Design status:** Accepted.
**Implementation status:** Controls use shared event publication. Conversation,
human Task and App-ID Task reads forward through the daemon's shared read
capabilities. The default Task board uses paged human Task reads. Source entry:
`src/app/http/task-read-routes.ts` and the HTTP source guide.
Session review notes are read-only; HTTP generation and comment-write routes
are retired. The legacy `/api/learning` aggregate and its UI are retired in
[Host PR 457](https://github.com/hao1939/may-agent/pull/457), merged as
`a84c6918ed40`. Installed adoption is unverified. Exact session detail and retained
note reads (`/api/sessions/:id/eval`) remain available; the adapter does not reconstruct the old finding and
notification summaries. See the [retirement record](../archive/reviews/learning-dashboard-retirement-20261112.md).

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

Retiring the folded Overview "Legacy panels" is recorded in
[its review](../archive/reviews/legacy-dashboard-retirement-20261112.md).
The unused legacy dashboard backend endpoints (`/api/stats`,
`/api/agents/activity`, `/api/agents/timeline`, `/api/agents/health` and
`/api/agents/:name/detail`) are also retired in
[Host PR 474](https://github.com/hao1939/may-agent/pull/474), merged as
`cd29dc70d9`, returning 404. Shared WebSocket events, `/api/liveness`,
`/api/agents`, exact session reads and metric history remain available.

The project Lineage aggregate `/api/projects/lineage` is retired in
[Host PR 458](https://github.com/hao1939/may-agent/pull/458), merged as
`2a762206dd52`, and the legacy project Journal and Discussion endpoints
(`/api/projects/journal`, `/api/projects/discussion`) are retired in
[Host PR 503](https://github.com/hao1939/may-agent/pull/503), merged as
`9ec454ea49`. Installed adoption is unverified. The retired endpoints return
404. `/api/projects/sessions` and exact
`/api/sessions/:id` reads remain, including recorded session parent/child links.
The adapter no longer combines workflow mentions, historical file reads and
child associations into a project-wide timeline or loads its inline checkpoint
summaries. No stored evidence is deleted or converted. See the
[retirement record](../archive/reviews/project-lineage-retirement-20261112.md)
for source status and checks; installed adoption is unverified.

Saved project list/detail, session lookup and agent project counts share one
HTTP metadata reader and discovery path in
[Host PR 460](https://github.com/hao1939/may-agent/pull/460), merged as
`bdaba7d0ee26`. Installed adoption is unverified. JSON display posture uses the
existing saved project read model;
identity comes from source metadata. A runtime posture projection cannot change
the HTTP project ID or owner. These project counts describe saved context, not
loaded Apps or Task execution.

Historical Markdown and its existing file precedence remain readable. Explicit
per-agent paths resolve their own context before a shared basename fallback.
Session reads include exact tags recognized by the former parser alongside the
current identity; no stored tags are rewritten. Ingress retains its previous
single target. Missing metadata still permits an exact retained session-tag
read; malformed JSON fails detail and is omitted from saved-project listings.
Collection discovery captures timestamps inside each guarded metadata read;
a file disappearing before that read completes removes only its own record.
Controls use an identity-only reader sharing the source parser, without loading
display posture. JSON syntax errors retain the previous path/frontmatter
identity fallback for project comments and event ingress. Existing file-access
checks remain; the daemon owns validation and admission of the addressed target.
See the [reader consolidation record](../archive/reviews/shared-project-metadata-20261112.md)
for compatibility and verification limits.

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

SDK and human reads share one Task lifecycle. An open converged Task without
newly runnable work is `idle`; explicit ending is `closed` or `cancelled`.
`done` remains a historical terminal receipt label. Idle alone establishes
neither fulfillment nor a monitoring obligation. These status changes are
implemented in the paired candidate source; installed adoption is tracked in
[the lifecycle record](../archive/reviews/task-lifecycle-responsibilities-20261107.md).
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
| Comment on project              | Publish `app.input.requested` (`publish` on the control socket; or `project.comment.created` for legacy markdown projects) |
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

Trace reads (`/api/events/:id/trace` and `/api/loop-trace`) show causal
evidence and links to authoritative App requests, Tasks, sessions, workflows,
and optional adapter diagnostics. The inferred `/api/events/:id/graph` read
model and SVG graph renderer were retired in
[Host PR 476](https://github.com/hao1939/may-agent/pull/476), merged as
`339ed72430`. They do not reconstruct an event-pair work lifecycle in the browser.

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
