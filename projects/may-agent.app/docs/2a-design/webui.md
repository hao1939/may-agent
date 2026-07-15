# Web UI

**Design status:** Accepted.
**Implementation status:** Implemented as a static route-based operator UI;
individual readouts continue to evolve.

## Purpose

The Web UI is a window into the same event, project, session, metric, and owner
model used by agents. It is not a second control plane and does not invent
browser-only lifecycle state.

The UI serves three human roles:

| Role | Primary question |
| --- | --- |
| Watcher | Is the system alive, moving, and failing visibly? |
| Steerer | Which owner/session/project should receive this intent? |
| Investigator | What event, evidence, decision, or state explains the outcome? |

## Product Model

The UI renders the objects defined in [system-model.md](system-model.md):

- projects and task trees are durable work context;
- events and traces show signals and causality;
- sessions and workflow runs show execution attempts;
- metrics and alerts show measured signals needing judgment;
- agents show accountable identities and their current execution context.

App-owned schedules and owner workflows are project liveness. Standalone agent
heartbeats are agent liveness. The UI must not treat heartbeat sessions as the
only form of agency.

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

| Route | Purpose |
| --- | --- |
| `/` | Live owner/project/agent/metric overview |
| `/agents` and `/agents/:name` | Agent identity, context, projects, sessions, chat |
| `/projects` and `/projects/:id` | Project readout and steering |
| `/projects/:id/tasks` | Task-tree/Kanban projection |
| `/projects/:id/functions` | Declared project actions |
| `/metrics` and `/metrics/:id` | Metric/alert detail and evidence |
| `/sessions/:id` | Transcript, result, lineage, tools, and steering |
| `/events` and `/events/:eventId` | Event list, delivery health, and trace graph |
| `/learning` | Evaluation and learning readouts |
| `/knowledge` | Searchable durable knowledge |
| `/terminal` | Browser terminal profiles |

Legacy hash routes are ingress aliases only. New links and docs use real paths.
The HTTP adapter serves `index.html` for platform client routes while keeping
`/api/*`, `/ws`, static assets, and project domain UI routes explicit.

## Live Surface

The front page should answer, in order:

1. Is the daemon and channel path healthy?
2. Which project owners or standalone agents moved recently?
3. Which projects, alerts, delivery failures, or sessions need attention?
4. Where should the operator click for evidence?

Liveness uses existing facts:

- recent project owner/workflow/session activity;
- active and recently changed projects;
- open metric alerts;
- event delivery and pair health;
- recent messages and human-result delivery;
- standalone heartbeat activity where heartbeats are enabled.

Empty standalone heartbeat tracks are not a project-app failure. A project app
is alive when its schedules/events reach owner workflows and produce current
project/task evidence.

## Project Surface

The default project page owns the generic control readout:

- identity, owner, goal, posture, and last movement;
- one primary bottleneck or next fact to inspect;
- task board/tree and selected-task detail;
- metrics, sessions, events, declared actions, and domain UI link;
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
- delivery acceptance, owner-inbox fallback, unhandled events, and orphaned
  pairs.

The browser may own selection and layout. It must not invent missing causal
edges or infer completion from delivery.

## Steering Contract

Every mutation/control affordance maps to a typed event or daemon control
operation. Examples:

| Human intent | Canonical path |
| --- | --- |
| Start/bind chat | `human.input.received -> chat.start.requested` |
| Steer session | `human.input.received -> session.steer.requested` |
| Comment/steer project | `project.comment.created` or `project.owner.requested` |
| Invoke declared app action | The action's typed event |
| Cancel session | `session.cancel.requested` |
| Submit approval | `project.approval.submitted` or owning typed approval event |
| Runtime restart/reload | `runtime.*.requested` |

The UI confirms “accepted/queued” after ingress. Completion appears later as a
session, project, task, escalation, metric, or runtime result event. Never show
“done” merely because an HTTP POST returned successfully.

Project/task actions include the selected project id, task id, visible raw
fact, expected owner response, and relevant evidence. They do not mutate task
meaning directly.

## Data Planes

| Plane | Purpose |
| --- | --- |
| Live socket/read model | Current activity and incremental updates |
| Historical read APIs | Bounded queries over persisted events, sessions, metrics, and project state |
| Steering POST/control | Typed intent accepted into the same runtime/event path |

The UI should prefer event-driven updates. Polling is an explicit fallback for
a surface that lacks a live feed, not a hidden second source of state.

## Latency And Failure Honesty

- Show when data was measured or last moved.
- Distinguish known, inferred, missing, and stale facts.
- Preserve raw facts beside system hints.
- Surface unhandled events, owner-inbox fallback, orphaned pairs, failed
  sessions, and missing coverage.
- Keep the operator's submitted intent visible until a typed disposition
  arrives or the system reports a failure.
- Do not turn an empty metric panel into a healthy verdict.

## Source And API Boundaries

- UI code calls documented `/api/*` read/steering endpoints.
- Domain UIs do not query private SQLite tables directly.
- The HTTP adapter remains in `src/app/http`; `packages/webui` is static-only.
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
- Every control maps to a canonical intent/event and shows an async receipt.
- Project and task meaning comes from project-owned state/read models.
- Event graphs render server-provided causality without browser repair.
- Project-app activity and standalone heartbeat activity are not conflated.
- Default UI source has one editable location and one generated served target.
- Legacy hash routes and compatibility APIs are not used in new examples.
- Missing evidence fails visibly instead of appearing healthy.
