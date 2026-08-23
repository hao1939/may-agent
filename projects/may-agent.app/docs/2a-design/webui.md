# Web UI

**Design status:** Accepted.
**Implementation status:** Implemented as a static route-based operator UI;
individual readouts continue to evolve.

## Purpose

The Web UI is a window into the same App request, task, event, project,
session, metric, and owner model used by agents. It is not a second control
plane and does not invent browser-only lifecycle state.

The UI serves three human roles:

| Role         | Primary question                                               |
| ------------ | -------------------------------------------------------------- |
| Watcher      | Is the system alive, moving, and failing visibly?              |
| Steerer      | Which owner/session/project should receive this intent?        |
| Investigator | What event, evidence, decision, or state explains the outcome? |

## Product Model

The UI renders the objects defined in [system-model.md](system-model.md):

- projects and tasks are durable work context; a tree is only an optional task
  layout;
- requests show caller correlation, linked tasks, and delivery state;
- events and traces show signals and causality;
- sessions and workflow runs show execution attempts;
- metrics and alerts show measured signals needing judgment;
- agents show accountable identities and their current execution context.

App schedules, observers, task reconciliation, and owner workflows are project
liveness. Standalone agent heartbeats are agent liveness. The UI must not treat
heartbeat sessions as the only form of agency.

## Source Ownership

The only editable default UI source is:

```text
projects/may-agent/packages/webui/static/
```

`bun run ui:sync` generates the sole served deployment copy at:

```text
projects/platform/ui/
```

Project-specific `.app/ui/` directories are independent domain surfaces, not
copies of the default platform UI. See
[default-project-ui.md](default-project-ui.md).

## Routes

The platform uses real browser paths and `history.pushState`:

| Route                            | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `/`                              | Live owner/project/agent/metric overview                        |
| `/agents` and `/agents/:name`    | Agent identity, context, projects, sessions, chat               |
| `/projects` and `/projects/:id`  | Project readout and steering                                    |
| `/projects/:id/tasks`            | Task list, optional relationship tree, and selected-task detail |
| `/projects/:id/functions`        | Declared App commands that create requests                      |
| `/metrics` and `/metrics/:id`    | Metric/alert detail and evidence                                |
| `/sessions/:id`                  | Transcript, result, lineage, tools, and steering                |
| `/events` and `/events/:eventId` | Event list, delivery health, and trace graph                    |
| `/learning`                      | Evaluation and learning readouts                                |
| `/knowledge`                     | Searchable durable knowledge                                    |
| `/terminal`                      | Browser terminal profiles                                       |

Legacy hash routes are ingress aliases only. New links and docs use real paths.
The HTTP adapter serves `index.html` for platform client routes while keeping
`/api/*`, `/ws`, static assets, and project domain UI routes explicit.

## Route Ownership and Bounded Reads

Each route initializes only the data and realtime connections needed by its
visible surface. In particular, direct `/terminal` navigation must not load the
hidden Live dashboard or open its event websocket. Live initializes on entry;
chat/session routes open realtime transport when they need it and release it
when the active route no longer does.

Operator read models are bounded summaries. Timeline and liveness APIs return
the newest fixed-size row set in display order and report when it was
truncated. Bulk audit remains a dedicated query/export concern rather than an
accidental dashboard response. Static assets use conditional cache validators
so unchanged files return `304 Not Modified`; optional presentation libraries
must not block terminal startup.

## Live Surface

The front page should answer, in order:

1. Is the daemon and channel path healthy?
2. Which project owners or standalone agents moved recently?
3. Which projects, alerts, delivery failures, or sessions need attention?
4. Where should the operator click for evidence?

Liveness uses existing facts:

- recent project agent/workflow/session activity;
- active and recently changed projects;
- open metric alerts;
- event delivery, request, task, and human-delivery health;
- recent messages and human-result delivery;
- standalone heartbeat activity where heartbeats are enabled.

Empty standalone heartbeat tracks are not an App failure. An App
is alive when its schedules/events reach owner workflows and produce current
project/task evidence.

## Project Surface

The default project page owns the generic control readout:

- identity, owner, goal, posture, and last movement;
- one primary bottleneck or next fact to inspect;
- task list, optional relationship tree, and selected-task detail;
- metrics, sessions, events, declared App commands, and domain UI link;
- structured steering with an honest async receipt.

Browser inference stays light. Stable project/task classifications belong in a
server read model or project-owned state. Domain-specific feature/test/run
meaning belongs in the project's own UI.

## Session Surface

A session page shows one execution or conversation container:

- task and source context;
- transcript and compact result;
- tool calls and verification evidence;
- parent session/workflow/project links;
- event trace and terminal closure;
- steering only when the session still accepts input.

A persistent chat is not one permanent trace. The session view groups turns for
conversation, while event detail preserves per-turn causality.

## Event Surface

The event page renders backend graph nodes and edges directly. It distinguishes:

- persisted causal parent edges;
- closure links;
- projected compatibility evidence;
- supporting session/tool/transcript detail;
- delivery acceptance, declared App/task consumers, unhandled facts, and links
  to correlated App requests or tasks.

The browser may own selection and layout. It must not invent missing causal
edges or infer completion from delivery.

## Steering Contract

Every mutation/control affordance constructs an allowlisted `EventInput` and
uses the shared `publish` operation. Examples:

| Human intent                | Canonical path                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Future May chat             | Human `conversation.message.created` on `Conversation may:primary` -> fenced May App request             |
| Steer an active session     | Required exact session event linked to its May request when applicable                                   |
| Comment/steer project       | Publish `project.comment.created`; the declared App subscription admits one correlated App request |
| Invoke declared App command | Discover its action schema, validate input, translate and admit one App request                          |
| Cancel session              | `session.cancel.requested`                                                                               |
| Submit approval             | `project.approval.submitted` or owning typed approval event                                              |
| Runtime restart/reload      | `runtime.*.requested`                                                                                    |

The UI confirms “accepted/queued” only after the request, task trigger, or
control operation is durably correlated. Completion appears later in the
owning App request, task, delivery operation, escalation, metric, or runtime
result. Never show “done” merely because an HTTP POST returned successfully.

Project/task commands include the selected project id, task id, visible raw
fact, expected owner response, and relevant evidence. They create an App
request and do not mutate task meaning directly.

## Data Planes

| Plane                  | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| Live socket/read model | Current activity and incremental updates                                    |
| Historical read APIs   | Bounded queries over persisted events, sessions, metrics, and project state |
| Steering POST/control  | `publish(EventInput)` with an honest durable receipt                        |

The UI should prefer event-driven updates. Polling is an explicit fallback for
a surface that lacks a live feed, not a hidden second source of state.

## Latency And Failure Honesty

- Show when data was measured or last moved.
- Distinguish known, inferred, missing, and stale facts.
- Preserve raw facts beside system hints.
- Surface unhandled facts, failed task admission, stale request/dependency waits,
  failed sessions, delivery uncertainty, and missing coverage.
- Keep the operator's submitted intent visible until an accepted task result
  arrives or the system reports a failure.
- Do not turn an empty metric panel into a healthy verdict.

## Source And API Boundaries

- UI code calls documented `/api/*` read/steering endpoints.
- Domain UIs do not query private SQLite tables directly.
- The HTTP adapter remains in `projects/may-agent/src/app/http`;
  `projects/may-agent/packages/webui` is static-only.
- API routes run before static/project routes.
- Project paths exposed to the browser use stable project ids, not arbitrary
  server filesystem paths.
- The platform UI never edits source Markdown/code as an implicit control path.

## Responsive And Accessibility Baseline

Desktop is the primary dense investigation surface, but essential navigation,
project steering, chat, and alert acknowledgment must remain usable at narrow
widths. Use semantic buttons/links, keyboard-reachable controls, visible focus,
text labels for status, and color as a secondary signal.

Telegram remains the preferred mobile notification/conversation surface.

## Integrity Checklist

- Every visible state names its source and freshness.
- Every control maps to an allowlisted event type and exact target and shows an
  honest `recorded`/`accepted` receipt.
- Project and task meaning comes from project-owned state/read models.
- Event graphs render server-provided causality without browser repair.
- App activity and standalone heartbeat activity are not conflated.
- Default UI source has one editable location and one generated served target.
- Legacy hash routes and compatibility APIs are not used in new examples.
- Missing evidence fails visibly instead of appearing healthy.
