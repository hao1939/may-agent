# Web UI

**Design status:** Accepted.
**Implementation status:** The static operator UI, paged human Task board,
App-ID Task reads, workflow health views and context-usage reports are implemented.
Some presentation copy still describes convergence as recurring work; the
[Task contract](task-resource-engine.md#one-lifecycle-baseline) applies to every
Task. The [documentation review](../archive/reviews/design-doc-hygiene-20260927.md)
records remaining presentation and authority gaps. Deployment is separate.

## Purpose

The Web UI is a window into the same App, request, Task, Event, project,
session, metric, and execution-profile model used by the Host. It is not a second control
plane and does not invent browser-only lifecycle state.

The UI serves three human roles:

| Role         | Primary question                                               |
| ------------ | -------------------------------------------------------------- |
| Watcher      | Is the system alive, moving, and failing visibly?              |
| Steerer      | Which App, Task, or session should receive this intent?         |
| Investigator | What event, evidence, decision, or state explains the outcome? |

## Product Model

The UI renders the objects defined in [system-model.md](system-model.md):

- projects hold durable context and Tasks own durable work; a hierarchy is
  only an optional relationship view;
- requests show caller correlation, linked Tasks, and result state;
- events and traces show signals and causality;
- sessions and workflow runs show execution attempts;
- metrics and alerts show measured signals needing judgment;
- agents show replaceable execution profiles and their current attempts.

App schedules, observers, Task reconciliation, and accepted results are App
liveness. Process/session observations describe execution liveness; optional App review
schedules have their own meaning. See [Heartbeat](heartbeat.md). The UI must not treat
heartbeat sessions as the only form of agency.

## Source Ownership

The only editable default UI source is:

```text
projects/may-agent/packages/webui/static/
```

By default, the server reads the generated deployment copy at:

```text
projects/platform/ui/
```

Build/staging and deployment are separate operations. `bun run ui:sync` and
`bun run bundle` stage UI under the Host's ignored `bundle/platform-ui` by
default. `MAY_AGENT_UI_OUTPUT_DIR` selects another staging directory; staging
replaces its contents. Explicit deployment activates the served copy.

For development, the WebUI package's `dev` command serves `static/` directly
through the same HTTP adapter: these editable assets need no compilation or
deployment copy. `MAY_AGENT_UI_DIR` selects only the served static directory;
it does not redirect App discovery, state or API requests. Without that override,
the deployment path above is unchanged. Development must use the intended
`PROJECT_ROOT`/`STATE_DIR`; `WEB_PORT` remains configurable (default 8080).
Building and serving have explicit, separate paths rather than relying on an
implicit write into the installation to refresh the browser.

Project-specific `.app/ui/` directories are independent domain surfaces, not
copies of the default platform UI. See
[default-project-ui.md](default-project-ui.md).

## Routes

The platform uses real browser paths and `history.pushState`:

| Route                            | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `/`                              | Overview of execution, current work and observations            |
| `/agents` and `/agents/:name`    | Agent identity, context, projects, sessions, chat               |
| `/projects` and `/projects/:id`  | Project readout and steering                                    |
| `/projects/:id/tasks`            | Task list, optional relationship tree, and selected-task detail |
| `/projects/:id/functions`        | Declared App commands that create requests                      |
| `/metrics` and `/metrics/:id`    | Metric/alert detail and evidence                                |
| `/sessions/:id`                  | Transcript, result, lineage, tools, and steering                |
| `/events` and `/events/:eventId` | Event list, admission health, and trace graph                   |
| `/learning`                      | Evaluation and learning readouts                                |
| `/knowledge`                     | Searchable durable knowledge                                    |
| `/terminal`                      | Full-window ttyd terminal attached to Herdr                                       |

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
2. Which Apps, Tasks, or standalone agents moved recently?
3. Which projects, alerts, admission failures, adapter failures, or sessions need attention?
4. Where should the operator click for evidence?

Liveness uses existing facts:

- recent project agent/workflow/session activity;
- active and recently changed projects;
- open metric alerts;
- Event admission, request, and Task health;
- recent Conversation messages and adapter diagnostics;
- standalone heartbeat activity where heartbeats are enabled.

Empty standalone heartbeat tracks are not an App failure. An App
is alive when its schedules or Events reach Tasks and produce current project
or Task evidence.

## Overview, Metrics and Run Inspection

Refine the existing routes, not a second monitoring UI. The
[workflow health proposal](../proposals/workflow-tracing-and-health-metrics.md#3-present-health-with-a-path-back-to-evidence)
tracks implementation; [Metrics](metrics.md#metric-semantics-and-persistence)
owns calculation and persistence semantics.

| Surface | Primary content |
| --- | --- |
| Overview (`/`, internal tab `live`) | Last-24h finished top-level runs and all four outcomes with a shared denominator; running executions and a bounded current Task list separately; recent failures, explicit attention items and collection problems; a few verified Host observations |
| Metrics (`/metrics`) | App/workflow and time filters; comparable execution counts, success share and named duration statistics; searchable measurements with value, unit, sample time and coverage |
| Metric detail (`/metrics/:id`) | Definition/source, actual time-axis history, sample size, collection errors, optional warning rule and links to matching evidence |
| Existing run/trace detail | Recorded outcome/reason, steps, exact child links, bounded diagnostics and artifacts; missing, redacted, truncated or expired evidence |

Keep failure investigation easy without hiding successes. Empty activity means
no executions; no open alerts does not mean the Host is healthy. Show observation
freshness, collection errors and threshold state separately. Priority is urgency,
not a substitute for an explicit alert/watch policy.

Read shared server calculations and retained observations, not cached values
paired with definition-update times. Summary and drill-down carry the same
fixed time bounds, scope and outcomes. If retention or later settlement changes
available records, refresh the summary with the detail and explain the change;
do not promise an immutable historical population that was never saved.

Charts use actual sample times, visible collection gaps and explicit units and
windows. Fixed-window charts, including legacy health panels, use the returned
window bounds rather than stretching sparse samples across the whole axis.
A missing or failed read is not a zero value. Load bounded summaries
on entry and detail/history on demand, not one request and graph for every
metric. Render names, errors and notes as untrusted text, never executable HTML.

The UI uses `GET /api/workflow-health` for shared summary, breakdown and
paged evidence. See [reporting bounds](metrics.md#bounded-reporting-reads) for
scope, freshness and limits. `/api/metrics` supplies observations; the existing
per-metric history endpoint is loaded only after selection. Late responses must
not replace a newer selection. A workflow-run link opens
`/events?workflowRunId=<id>#loop-trace`, with exact parent, prior-run, child and
step-session links where retained; no relationship is inferred from names.
Trace selection belongs to the current route: navigation clears the old trace
and invalidates pending loads, including late failures. Generic Events must not
show evidence from a previously selected run. An explicit workflow-run selection
takes precedence over an event trace anchor.
Internal link interception preserves the complete path, query and anchor, so a
run link both selects the evidence and scrolls it into view.

Overview reads up to eight pending/running/waiting/attention Tasks using the
existing Task list with explicit `allApps=true` and repeated `status` filters.
This is a bounded list, not global state counts or an oldest-work calculation.
An unavailable Task daemon is shown as unavailable, not no work. Exact Task
detail still requires its App ID. Collection coverage includes all returned
metric definitions, not only selected Host observations, and shows list limits.
Agent overviews and individual project cards also show incomplete metric
coverage, including when their subset is empty; counts describe shown metrics,
not complete totals. See [reporting bounds](metrics.md#bounded-reporting-reads).
Overview previews the newest four open alerts from a read capped at 20; its
badge states how many are shown when the preview is partial. The summary reads
one extra row to distinguish exactly 20 from more than 20. Metrics previews
the newest 20 alerts from a read capped at 500 and likewise distinguishes
exactly 500 from more than 500. Neither preview promises an exhaustive list.
A Host observation outside a truncated alert list has unknown alert state;
opening its exact metric detail reads that metric's alerts directly.

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
- Event admission, declared App/Task consumers, unhandled facts, and links
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
owning App request, Task, escalation, metric, or Runtime result. Adapter send
state is diagnostic only. Never show “done” merely because an HTTP POST
returned successfully.

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
- Surface unhandled facts, failed Task admission, stale request/dependency waits,
  failed sessions, adapter errors, and missing coverage.
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
