# HTTP API And Web UI Boundary

**Design status:** Accepted.
**Implementation status:** Bounded reads and controls use canonical App
admission, fact publication, and deterministic-control paths. Compatibility
endpoints cannot create alternate work authority.

## Purpose

HTTP is the browser-facing adapter for bounded reads, live observation, and
typed ingress. It is not an App, project controller, workflow dispatcher, or
second runtime.

```text
browser
  -> bounded read
     or App admission / fact publication / deterministic control
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

The server may use internal stores to build these projections. The browser
cannot write inferred state back or become a reconciler.

## Write boundary

Every state-changing request enters exactly one path:

1. **App input admission** for addressed work;
2. **fact publication** for a changed observation;
3. **declared App action** translated to App input;
4. **exact task/approval control** owned by the task runtime; or
5. **deterministic Host control** owned by the Host.

Examples:

| Human intent | Canonical path |
| --- | --- |
| Ordinary conversation | Admit one request to the `may` App |
| Explicitly steer/cancel session | Exact session control |
| Comment on project | Publish `project.comment.created`; declared App subscription may admit a correlated request |
| Invoke App action | Discover schema, validate, call `toInput`, admit App request |
| Submit approval | Update exact owning task/Condition through typed control |
| Reload/restart/shutdown | Deterministic runtime control |
| Publish provider/lifecycle fact | Validated fact ingress |

`POST /api/events` is fact ingress only. It is not permission to invent domain
commands, address an owner by fallback, or bypass App actions.

Receipts state exactly what became durable: request ID, event ID, task/control
operation ID, or admission failure. An HTTP `2xx` never proves owner handling,
task convergence, human delivery, or domain completion.

## App and project boundary

Project comments and actions are different:

```text
comment -> fact -> declared subscription -> App input
action  -> validate declared schema -> App input
```

A comment may instead feed a task subscription when its semantics are a
deterministic changed fact. This classification belongs to the loaded App and
must have one actionable authority.

Actions never emit an actionable semantic event as a shortcut. The host admits
the translated input and returns its App request identity. The App may complete,
delegate, or attach a task.

Generic project pages consume shared read models. Domain panels may present
deeper facts/artifacts but cannot query private SQL, read task files, or infer
task meaning independently.

## Event and websocket boundary

Historical event queries are bounded HTTP reads. Live websockets stream the
same canonical facts and projection changes.

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

Compatibility endpoints may preserve old client shapes only when they
normalize immediately into one canonical admission/fact/control operation.
They cannot define a second payload meaning, lifecycle, task mutation path,
owner fallback, or execution route.

Compatibility responses should include the canonical identity so clients can
move without relying on legacy event-pair or session-follow-through behavior.

## Integrity checklist

- Reads are bounded projections with source, freshness, and honest unknowns.
- Every write maps to exactly one App admission, fact, exact task control, or
  runtime control.
- An HTTP receipt never appears as semantic completion.
- App/task meaning remains in canonical runtime and App-owned state.
- Browser/websocket observation never counts as delivery acceptance.
- Actions translate to App input and do not publish command-like events.
- Paths stay within admitted roots.
- Compatibility adds no second semantics or actionable route.
- The HTTP layer contains no project-specific workflow/task controller logic.
