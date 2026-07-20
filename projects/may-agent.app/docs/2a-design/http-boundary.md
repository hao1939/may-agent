# HTTP API and WebUI Boundary

**Design status:** Accepted.
**Implementation status:** Implemented; compatibility endpoints remain thin
adapters over the same daemon/event and read-model boundaries.

## Purpose

The HTTP adapter is the browser-facing read and control boundary for May-agent.
It serves the default WebUI, exposes bounded read models, streams live events,
and translates human controls into the same daemon/event paths used by CLI,
Telegram, and May Console.

It is infrastructure, not a project controller:

```text
browser
  -> HTTP read model or canonical control event
  -> daemon/runtime authority
  -> project, task, session, metric, or event state
```

The adapter must not own project strategy, task acceptance, workflow policy, or
another copy of runtime state.

## Source and process ownership

There is one runtime binary: `may-agent`. Web mode runs with
`may-agent --web`; deployment may use a separate process group, but it executes
the same binary.

Current source ownership:

```text
projects/may-agent/src/app/http/       # HTTP, websocket, and read-model adapter
projects/may-agent/packages/webui/static/  # editable default browser UI
projects/platform/ui/                 # generated served UI target
projects/<id>.app/ui/                 # optional independent domain UI
```

Edit the default UI only under `projects/may-agent/packages/webui/static`, then run
`bun run ui:sync`. Do not hand-edit the generated platform target. A
project-specific UI remains owned by its app and uses the shared HTTP/control
contracts rather than private runtime storage.

## Read boundary

GET endpoints may aggregate bounded SQLite projections, task read models, and
owned artifacts. They return an explicit API model rather than exposing table
rows or filesystem layout as the public contract.

A read model should:

- identify its source and measurement/freshness time;
- distinguish missing, unknown, stale, and structurally invalid data;
- use stable project, task, session, workflow, event, metric, and alert IDs;
- bound timelines, transcripts, completion summaries, and large collections;
- preserve canonical task phase, generation, Conditions, readiness, and
  integrity findings; and
- surface trace/read failures without changing the underlying domain meaning.

The server may read canonical task state to build a projection. The browser
does not infer controller eligibility or write a repaired interpretation back.

The executable route table in `projects/may-agent/src/app/http/server.ts` is the current endpoint
catalog. Stable API families include:

| Family | Responsibility |
| --- | --- |
| Health and overview | Liveness, stats, digest, and bounded dashboard readouts |
| Events and traces | Event queries, delivery health, graph detail, ingress, and live websocket updates |
| Agents and sessions | Agent identity, activity, transcript/result detail, evaluation, and steering |
| Projects and tasks | Project readout, canonical task collection/detail, bounded completions, artifacts, and comments |
| Metrics and alerts | Current metric/alert state, history, calibration, and explicit resolution |
| Terminal | Shared browser terminal profiles and websocket transport |

Do not duplicate the full route list here; it changes more often than the
boundary.

## Write and control boundary

State-changing HTTP actions enter one of two paths:

1. a canonical event/control intent sent through the daemon; or
2. a dedicated infrastructure service that owns the mutation and emits its
   evidence.

Examples:

| Human intent | Canonical path |
| --- | --- |
| Start or steer chat/session | `chat.start.requested` or `session.steer.requested` |
| Cancel a session | `session.cancel.requested` |
| Comment on a project | `project.comment.created` |
| Invoke an app action | Declared action endpoint emits its semantic event directly |
| Reload/restart runtime | `runtime.*.requested` |
| Resolve an alert | Metric service/command with alert and owner evidence |

`POST /api/events` is the generic canonical event ingress. It validates the
envelope and hands it to the daemon path; it is not permission to invent domain
events or bypass an app's declared actions.

Project comment ingress returns the persisted `project.comment.created` event
ID. Exactly one correlated `project.owner.reviewed` summarizes the owner's
decision and references any durable tasks. The HTTP event receipt never means
those tasks or downstream work completed.

The adapter must not:

- write task files or task phases directly;
- execute project workflows from hard-coded project routes;
- mutate SQLite with ad hoc SQL when a service/command owns the change;
- turn a successful POST into a domain-completion claim; or
- create a second owner, retry, or scheduling policy.

## Project and task boundary

Generic project pages consume the shared read model described by
[Default Project UI](default-project-ui.md). Completed achieve tasks remain out
of the live graph; bounded completion evidence supports old task links and
recent activity. `state.json` remains canonical and `tree.json` remains a
disposable projection.

Domain-specific browser panels may present deeper AKS, Evaluation, Scout, or
other facts. They call stable artifact/event/action APIs and do not query
private SQLite tables or derive task meaning independently.

Project actions are declared by the app. The browser discovers their schemas
from the loaded runtime and invokes a selected action through its dedicated
project endpoint. The runtime validates the input, emits the action's semantic
event, and returns that event ID. It does not parse source code or create an
action wrapper event.

## Event and websocket boundary

Historical event queries use bounded HTTP reads. Live observation uses the
websocket event stream. Both expose the same canonical envelopes and trace IDs.

Websocket delivery is observation, not event acceptance. A browser subscriber
does not satisfy owner delivery or a typed event pair merely by receiving a
frame.

## Files and path safety

Browser requests use stable project and artifact identifiers. Server path
resolution must remain inside declared project/app roots. Absolute filesystem
paths in evidence remain text unless a dedicated safe artifact endpoint admits
them.

API routes are matched before static and project UI routes. One-project
deployment uses the same `PROJECTS_ROOT/*` shape as multi-project deployment;
there is no special `/project` filesystem contract.

## Compatibility

Compatibility endpoints are acceptable when they provide a useful ergonomic
alias and still enter the canonical event/service boundary. New code uses
canonical events and current read models. Compatibility aliases do not define a
second payload, lifecycle, mutation authority, or project execution path.

The HTTP adapter and read models use the shared database/schema modules.
`projects/may-agent/src/lib/db/schema.ts` remains the sole schema/migration
owner.

## Integrity checklist

- Default UI source and generated served assets have distinct ownership.
- Reads are bounded projections with freshness and explicit unknown/error state.
- Writes use canonical daemon events or a dedicated infrastructure service.
- An HTTP event receipt is never presented as delivery or completion.
- Project/task meaning remains in app-owned canonical state.
- Browser logic does not implement readiness, reconciliation, or repair policy.
- Event streaming does not count as owner delivery.
- Paths remain within admitted roots.
- Route compatibility adds no second semantics.
- The HTTP layer contains no project-specific controller logic.
