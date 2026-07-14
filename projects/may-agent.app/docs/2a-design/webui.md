# Design: Web UI

**Status**: Partially shipped (2026-05-08); modular route proposal added for review (2026-06-13)
**Date**: 2026-05-06 (revised 2026-05-08, 2026-06-13)
**Aligned with**: `../architecture.md`, `../work-model.md`, `metrics.md`,
`heartbeat.md`, `default-project-ui.md`, `web-terminal.md`

## What this UI is for

The Web UI is **a window into the life of an autonomous multi-agent system.** Not a dashboard. Not a control panel. A window.

The primary thing the human is looking for when they open it is not a number, not a status — it's the **felt sense that the agents are alive**: moving, thinking, deciding, coordinating, persisting. A healthy autonomous system *looks different* from a broken one when you watch it for thirty seconds. The UI's job is to make that difference visible.

This shapes everything else.

## What "alive" means, concretely

The framing isn't a vibe. It maps to specific things the system already produces:

| What "alive" means | Concrete signal in the system |
|---|---|
| **Moving** | Heartbeat sessions firing on schedule across agents |
| **Thinking** | Heartbeat task/outcome summaries show what each agent chose to do. A future `agent.decision` event can make this sharper, but it is not required for the first useful view. |
| **Responding** | Comments, messages, breaches show up in the next heartbeat's context and get acted on |
| **Persisting** | Project journals carry forward; today's iteration references yesterday's |
| **Coordinating** | `message.created` events flow between agents, with replies that close the loop |
| **Caring** | Stalled projects get noticed at heartbeat; idle agents get flagged |

If the UI shows these signals as they happen, the system *looks alive*. If it doesn't, even a healthy system looks like a chart.

This is also what it means for the system to **fail visibly**. A dead heartbeat track tells you an agent is broken faster than any error metric. A flat decision feed tells you agents have lost the plot. A silent conversation strip tells you the multi-agent piece isn't multi-agent anymore.

## Three roles, one human

The same human visits the UI in three different mindsets. The UI is designed in this order:

- **Watcher** (10 seconds, dozens of times a day) — "Is the system alive? Is anything obviously off?" Glance at the front page. Watch for a moment. Close the tab.
- **Steerer** (1–5 minutes) — "I want to leave a note for an agent. Comment on a project. Reply to may. Drop a thought into a session." The verbs are participation, not control. **Conversation is a steering verb.**
- **Investigator** (15+ minutes) — "Why did agent X decide Y? What did the breach-to-fix chain look like? What does KE-744 say?" Drill in. Read transcripts. Read journals. Follow cross-links.

The Watcher's needs decide the front page. The Steerer's verbs decide the interactive surfaces. The Investigator's tools live one click away — and there are two of them (per-session investigation, cross-cutting memory) because investigation has two natural shapes.

## What the UI is NOT

- **Not a configuration panel.** Agents are configured by markdown files in the repo. Editing those in a web form is the wrong abstraction — I edit them in my IDE.
- **Not a terminal.** If I'm running commands, I'm debugging, not operating.
- **Not a control panel.** Steering verbs *change what an agent will see at its next heartbeat*. They do not "make the agent do X right now." See `heartbeat.md`.
- **Not a re-implementation of the bus or DB.** It's a window onto them.

### What about chat?

An earlier revision of this doc said "not a chat interface; Telegram is chat." That was a confusion between **channel** and **purpose**. Telegram and the dashboard are two channels into the same primitive: a session with input enabled, bound to an agent. When the human is at the laptop with the dashboard open, opening Telegram to talk to may is friction. The dashboard's session-with-input surface is the laptop-side Telegram.

So conversation belongs in the dashboard — but it doesn't get its own separate "chat" surface. It's the same `/sessions/:id` surface used for investigation, with input enabled when the session is open. See "The five surfaces" below.

## The system model the UI surfaces

Three first-class concepts (defined in detail in `../architecture.md`, `../work-model.md`, and `heartbeat.md`):

- **Project** — the context an agent works within: goals, history, journal, accumulated experience. Owned by an agent. Iterated on at heartbeat.
- **Heartbeat** — the recurring moment when an agent reads context, decides, and acts. Where agency lives.
- **Metric** — a system signal. Measures project progress or system health. Breaches inform the relevant work context (P0 forks immediately).

And two relationships that connect them:

- **Sessions** are execution attempts for a work context, triggered by heartbeats (most), metric breaches (urgent), messages, cron, or humans.
- **Messages** are async coordination between agents (and between humans and agents).

The UI's information architecture mirrors this. Projects are the primary navigable object. Metrics belong to projects (or to the system). Heartbeats animate everything. Sessions are how iterations look from the outside; messages are how coordination looks.

## Proposal: Modular Route-Based UI

**Status**: Draft for review (2026-06-13)

The current UI demonstrates useful runtime data, but it is still shaped like one
large tabbed dashboard. The next design should make May-agent understandable as
a modular product UI over one simple system model:

```text
event -> handler -> session/workflow -> emitted event -> project/task/state
```

The UI should not put every concept on one page. The front page should answer
"is the system alive?" and route the human to the right module. Each deeper page
should own one object and one investigation shape.

### Source of Truth

The runnable May-agent UI belongs to the May-agent domain workspace:

```text
projects/may-agent/packages/webui/static/
```

`projects/may-agent.app/` owns project-app design, tasks, and May-agent project
operation. It should not become the source of the platform UI implementation.
If copied static UI exists under an app folder, treat it as generated or legacy
serving material, not the design source.

### Routes

Use real browser paths with `history.pushState`, not hash routes. The HTTP
server should serve `index.html` for non-API routes and keep `/api/*`,
`/ws`, static assets, and project static routes explicit.

```text
/
/events
/events/:eventId
/projects
/projects/:projectId
/projects/:projectId/tasks
/projects/:projectId/functions
/agents
/agents/:agentName
/sessions/:sessionId
/metrics
/knowledge/*
/terminal
```

Hash routes are not the right long-term boundary. They hide the route from
server logs, make links less canonical, put too much state in client boot logic,
and make it harder to audit which page a human used to inspect a specific
event, task, or session.

### Pages

| Route | Purpose |
|---|---|
| `/` | Live overview. Show liveness, heartbeat/activity timeline, core vitals, recent decisions, open alerts, recent messages, and project metric health. |
| `/events` | Event stream. Show filters, event type/owner distribution, recent events, and trace entry points. |
| `/events/:eventId` | Event trace. Show the concrete chain from input event to handler, session/workflow, emitted events, and resulting state. |
| `/projects` | Project list. Show durable work contexts and their status. |
| `/projects/:projectId` | Project overview. Show goal, current state, owner, latest discussion, metrics, sessions, and key links. |
| `/projects/:projectId/tasks` | Project task tree/Kanban. Show how agents currently understand and plan the project, with human feedback close to the relevant task. |
| `/projects/:projectId/functions` | Project-app functions. Show registered actions, domain UI links, and action history when the project is backed by an app. |
| `/agents` | Agent list. Show ownership, liveness, metrics, and chat entry points. |
| `/agents/:agentName` | Agent overview. Show identity, prompt/context files, owned projects, owned metrics, recent sessions, and default conversation. |
| `/sessions/:sessionId` | Session trace. Show trigger, context read, decisions, tool/work actions, outputs, emitted events, and transcript. |
| `/metrics` | Metrics and alerts. Show health signals and ownership. |
| `/knowledge/*` | Knowledge browser. Show durable knowledge, design docs, proposals, and references. |
| `/terminal` | Terminal surface for daemon/client operation, not the primary demo path. |

The terminal route follows the separate Web Terminal contract in
`web-terminal.md`: xterm.js owns rendering, the browser owns visible size, tmux
keeps profile processes alive, and the transport must preserve terminal output
losslessly for every profile.

### Module Layout

Keep the UI simple and modular before introducing a framework:

```text
packages/webui/static/
  index.html
  app.js
  router.js
  api.js
  components/
    badges.js
    cards.js
    timeline.js
    trace-viewer.js
    task-tree.js
  pages/
    live.js
    events.js
    event-detail.js
    projects.js
    project-detail.js
    project-tasks.js
    project-functions.js
    agents.js
    agent-detail.js
    sessions.js
    metrics.js
    knowledge.js
    terminal.js
  styles/
    base.css
    layout.css
    components.css
    pages.css
```

`app.js` should be the shell/bootstrap only. Each page module owns its route
params, data loading, rendering, and page-local interactions. Shared rendering
belongs in small component helpers, not in one large global script.

### Framework Decision

Do not introduce a large UI framework yet.

The hard part of this UI is runtime-model clarity, not complex component state.
Most current behavior is fetch JSON, render cards/tables/timelines, navigate,
and submit small steering actions. A framework would add build and runtime
complexity before the product shape is stable.

Use modular vanilla JavaScript first. Reconsider a small framework only after
the modular version hits concrete pain such as:

- complex nested local state across pages
- drag/drop task tree editing
- optimistic updates
- large reusable interactive components
- extensive form validation
- multiple independent live subscriptions per page
- component-state testing that becomes painful without a framework

If that point arrives, prefer Svelte or Preact over React for this UI because
the daemon should still serve a small static frontend.

### Demo Experience

The UI should demonstrate May-agent by letting a reviewer follow one loop:

1. Open `/` and see whether the system is alive.
2. Click an event, alert, project, agent, or session.
3. Land on the object-specific page, not a generic dashboard section.
4. Follow the trace: event -> handler -> session/workflow -> emitted event -> state.
5. Add human feedback close to the context being reviewed.
6. See the follow-up event and state change later through the same UI.

This keeps the system transparent without turning the first screen into a
control room containing every object at once.

### Task Tree Surface

The task tree is a first-class project surface:

```text
/projects/:projectId/tasks
```

This page is the primary way a human reviews and steers a project-app's current
understanding. It should not be hidden behind a generic project discussion tab.

It has two views:

- **Thinking view**: the task tree as project understanding. Show top-level
  intent, decomposition, accepted facts, blocked reasoning, parent/child
  rollups, and current focus.
- **Workflow view**: Kanban lanes derived from the same task tree. This is a
  scheduling/progress projection, not a separate source of truth.

Human feedback should attach directly to task nodes. The UI can expose this as
`tree.attachFeedback()` at the product level: the user comments on a concrete
task, and the project owner receives feedback with task id, parent chain,
current state, and surrounding context. Project-wide discussion remains useful, but it
is not the primary steering mechanism once a task tree exists.

For the refined default project control readout, including bottlenecks,
coverage/blind-spot rows, durable loop readouts, issue rows, and structured
steering, see [default-project-ui.md](default-project-ui.md).

Deep links should support:

```text
/projects/:projectId/tasks?task=:taskId
```

The target task should be expanded, selected, and scrolled into view.

### Project-App Functions

Project-app actions need a visible home:

```text
/projects/:projectId/functions
```

This surface appears when a project has registered app actions, app-provided UI,
or domain-specific operation links. It should show:

- registered actions from the project app declaration
- a link to domain UI when the project provides one
- action purpose, expected effect, and async latency expectation
- latest request/action history where available
- links back to related tasks, sessions, and events

Examples:

- `aks-rp-e2e.app` can expose actions such as request focus plan, review focus
  progress, trigger/review domain test flows, or ask the owner to replan.
- A project with a domain UI can link to `/projects/:projectId/ui/` or its
  app-declared equivalent without making that UI part of the global shell.

The product rule is: project-specific capabilities are visible, but they remain
owned by the project app. The global Web UI provides the frame and consistent
history/trace links.

### Project Surfaces and Domain UI

Some projects have their own domain UI. For example, `aks-rp-e2e` needs a
feature/test-spec/evidence explorer that is meaningful to AKS work, not to
May-agent infrastructure. That UI should remain project-owned and decoupled from
the global May-agent UI.

The May-agent UI should provide one discoverable place to find those surfaces,
but it should not import domain UI components or depend on domain UI internals.

Project apps may declare surfaces:

```ts
surfaces: [
  {
    id: "feature-explorer",
    kind: "domain-ui",
    title: "AKS Feature Explorer",
    route: "/projects/aks-rp-e2e/ui/",
    description: "Review AKS features, specs, replay runs, and evidence.",
    owner: "aks-explorer",
  },
]
```

The global UI renders declared surfaces as cards or links from:

```text
/projects/:projectId
/projects/:projectId/functions
```

Conventional domain UI entrypoint:

```text
/projects/:projectId/ui/
```

Supported integration modes:

- **Link out**: default. The global UI links to the project-owned domain UI.
- **Embed**: optional later. The global UI may iframe a domain UI only when the
  boundary is explicit and sandboxed.
- **Action bridge**: domain UI may call project-app actions through stable
  May-agent APIs, but it must not reach into May-agent runtime internals.

The action bridge is the important boundary. Domain UI can invoke durable,
registered project actions by emitting canonical events through the stable
event ingress:

```text
POST /api/events
```

with `type: "project.action.invoked"` or another project-owned event, plus the
action id and payload under `data`. The project app owns the action contract,
validation, resulting events, and any domain-specific side effects. The domain
UI does not write May-agent runtime tables directly, call handler internals,
mutate task files directly, or assume workflow implementation details.

Action results should be traceable through normal May-agent mechanisms:

- action request event
- handler/workflow/session execution
- emitted events
- task/project/evidence state changes
- event trace links

This lets a domain UI feel native to its project while preserving the global
system rule: everything important still flows through events, handlers, actions,
and traceable state transitions.

### Event Graph Trace

The event graph trace is the most important debugging surface. It should be
specified as a product/API contract, not just a button on an event table.
Events are nodes; parent relationships and trace links are edges. The default
view should show a bounded graph of default events. LLM turns and tool calls
stay hidden until the user expands a node inline in the graph.

This should become a dedicated Event Review page, not only an events table.
The same page supports four common review starts:

| Review start | Start id | First question |
|--------------|----------|----------------|
| Session review | `sessionId` | What triggered this session and what did it emit? |
| Escalation review | `escalation.created` event id | Was the owner/human path closed and did source work resume? |
| Metric breach review | `metric.breach` event id or metric alert id | Did the owner judge the breach and act? |
| Orphan review | orphan opening event id | Where did the expected closure chain stop? |

Route:

```text
/events/:eventId
/events/review?sessionId=:sessionId
/events/review?metricId=:metricId&alertId=:alertId
/events/review?orphan=1
```

API:

```text
GET /api/events/:eventId/trace
GET /api/events/:eventId/graph?depth=3&detail=false
```

The response should describe a graph:

```text
event nodes
  + parent edges
  + reference links
  + closure links
  + optional detail nodes for session, workflow, LLM, tool, metric,
    notification, and diagnostic details
```

The graph API is responsible for graph semantics. It should return display
nodes and edges with stable keys, node kind, visibility, parent key, optional
level, object ids, labels, summaries, and data previews. The browser should not
guess that a node is a child because its event type starts with `session.` or
because a payload string happens to contain a session id. The browser renders
the hierarchy it is given and keeps page-local expanded/collapsed state.

This lets the same page support multiple hierarchy depths without changing the
UI model:

```text
event
  session event
  transcript turn
    tool call
      tool result
  workflow step
    child session
```

The graph must not hide abnormal evidence by default. Skipped handlers,
skipped evaluations, receipts, unhandled events, orphan diagnostics, and failed
tool calls are inspection evidence. The API can mark them as `detail` or
`diagnostic`, but they should remain available when the related node is
expanded.

The page should render the selected event in a bounded structural graph by
default:

```text
start point
  -> key parent
  -> ...
  -> selected event
       -> direct child/detail/result
       -> ... later/context/details
```

The start point is the trace root, lifecycle opener, external boundary event,
or selected-event fallback when no earlier evidence is known.

Key parents are structural changes, not every parent event. Show them when they
represent boundary entry, ownership change, work-scope change, branch/merge, or
lifecycle close. Collapse linear noise behind an expandable `...` node.

The selected event's direct scope should show direct parents, direct children,
direct closure/reference links, lifecycle pair, direct emitted follow-ups, and
expanded detail children. Broader same-workflow, same-task, same-session,
same-metric, and same-owner context should appear as `...` boundary nodes until
the user expands them.

Every step should link to the strongest available object:

- event id -> `/events/:eventId`
- workflow run -> workflow trace if available
- session id -> `/sessions/:sessionId`
- detail LLM/tool node -> transcript/tool-call side panel
- project id -> `/projects/:projectId`
- task id -> `/projects/:projectId/tasks?task=:taskId`
- metric id -> `/metrics?metric=:metricId`

If a graph is incomplete, the UI should say where evidence stops. A trace that
shows "event persisted but no accepted route" is valuable: it exposes routing
failure. A trace that shows "event accepted but no child follow-up event" is
also valuable: it exposes a dead end. A trace that shows "human reply received
but no closure link" exposes an owner/reply-handling failure.

#### Event Review Page Layout

The page should be dense and investigation-focused:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Event Review                                                               │
│ [Session] [Escalation] [Metric breach] [Orphans]  search/filter            │
├───────────────┬──────────────────────────────────────────────┬─────────────┤
│ Start points  │ Trace graph / timeline                       │ Inspector   │
│               │                                              │             │
│ recent        │ selected trace, collapsed by default         │ selected    │
│ escalations   │ detail toggle for LLM/tool/session evidence  │ event       │
│ metric alerts │ closure/reference links                      │ raw data    │
│ orphan events │ broken-chain diagnostics                     │ transcript  │
└───────────────┴──────────────────────────────────────────────┴─────────────┘
```

Left rail:

- start-point selector: session, escalation, metric breach, orphan
- recent items for that selector
- filters: project, owner, event type, status, time window
- orphan groupings: no route, no child follow-up, no closure, no project
  reaction

Center:

- default bounded graph rendering for quick reading
- graph rendering for branch/merge/loop inspection
- click a node to expand its API-provided detail children inline in the same
  graph
- click a `...` node to expand that hidden boundary inline in the same graph
- click a session node to enrich the current graph with that session's events,
  LLM/user turns, tool calls, tool results, receipts, skipped handlers,
  evaluations, diagnostics, and closing session event
- show why a `...` node exists: hidden earlier parents, later events, detail
  evidence, same-workflow sessions, same-task review, metric context, or owner
  inbox context
- do not open a separate graph or panel for expansion; the existing graph grows
  in place
- keep already expanded nodes open so two sessions can be compared side by side
- collapse an expanded node when it is clicked again
- expand/collapse repeated loop slices
- show closure links distinctly
- rows/raw payloads are fallback audit views, not the primary detail surface

Right inspector:

- selected event envelope
- trace metadata: `traceId`, `parentEventId`, `links`
- delivery status: accepted/unhandled and accepted-by
- strongest object links: session, workflow, task, metric, project
- diagnostics and suggested next review question
- raw JSON behind a collapsed panel

The page should avoid a decorative dashboard layout. It is an operational
investigation tool: compact rows, clear status chips, predictable navigation,
and strong links to the underlying object.

#### Scenario Defaults

Session review starts from `/sessions/:sessionId` or
`/events/review?sessionId=:sessionId`.

Default graph:

```text
trigger event -> session.started -> session.completed -> emitted events
```

Default questions:

- what event/task/message triggered the session?
- what did the agent decide?
- what follow-up events did it emit?
- did the follow-up close or advance the source work?

Escalation review starts from the `escalation.created` event id.

Default graph:

```text
escalation.created
  -> message.created or owner session
  -> human.input.received or owner result
  -> escalation.resolved / escalation.dismissed
  -> resume or project reaction
```

Default diagnostics:

- no human/owner notification
- human reply received but no terminal escalation event
- terminal escalation event missing `closure` link
- terminal escalation event exists but no resume/project reaction

Metric breach review starts from `metric.breach` or a metric alert row.

Default graph:

```text
metric.breach
  -> owner route
  -> owner judgment / planner / watchdog
  -> task, accepted exception, escalation, or metric.recovered
```

Default diagnostics:

- breach persisted but no accepted route
- accepted route but no owner judgment
- owner judgment but no action/exception/recovery
- action started but no completion

Orphan review starts from `/events/review?orphan=1`.

Default list groups:

- opening event has no accepted route
- opening event accepted but no child event
- expected closing event missing
- closing event exists but lacks `closure` link
- event type should be unpaired
- timeout looks wrong

The orphan workflow is:

```text
pick orphan -> open trace -> find stop point -> classify -> fix trace, handler,
timeout, event pairing, or source work
```

The UI should not guess the fix automatically. It should make the stopped chain
obvious enough that a human or owner agent can choose the next action.

### Knowledge Search

`/knowledge` should be search-first. The primary human question is:

```text
what do we know about X?
```

The file tree is secondary navigation.

Search should span durable knowledge and project understanding:

- knowledge entries
- design docs and proposals
- project summaries
- task tree accepted facts and completed task summaries
- session summaries
- feature/model packets where a project provides them

Results should show source type, owning project or agent, freshness, and why the
result matched. When a result comes from a task tree, link to the task node.
When it comes from a session, link to the session. When it comes from a design
doc, link to the document path.

### Project-App Health on Live

The `/` live page should show project-app health, not just last-touched pulse.
For project-apps, the project strip should prefer task/app health:

```text
aks-rp-e2e.app
2 active · 3 review · 0 blocked · 83% model coverage
```

Fallback for ordinary projects:

```text
owner · status · last update · metric summary
```

The front page should answer whether important project apps are advancing. A
recent timestamp is not enough if the task tree is empty, all leaves are
blocked, or the domain model is not improving.

### Runtime Self-Drive on Live

The `/` live page must also answer whether the platform can keep project apps
moving without manual refreshes. Core vitals should pin the small active runtime
metric set before broader output metrics:

- `runtime.daemon-heartbeat-stale`
- `runtime.project-app-schedule-orphan-count-1h`
- `session.planner-timeout-rate-6h`
- `escalation.pending-count`

These are not a separate dashboard concept. They are the first health strip
because they tell the operator whether scheduled project-app events are turning
into owner/workflow progress and whether human-facing escalations are
accumulating.

The `/metrics` page should show the same signals as a trend group named
`Runtime Self-Drive`. Runtime and escalation metrics belong to the
Infrastructure axis. Graph colors must respect metric direction:
`alert_op: above` means lower/equal is healthy, while `alert_op: below` means
higher/equal is healthy.

### Session Task Context

`/sessions/:sessionId` should show task context when a session was spawned for a
project task.

If the session source, event payload, workflow run, or task body includes a task
id, the session page should show:

- project id
- task id
- task goal
- task status at session start and latest known status
- parent chain
- current output/evidence targets
- link to `/projects/:projectId/tasks?task=:taskId`

This prevents sessions from becoming isolated transcripts. The human should be
able to see where the session fits in the project tree before reading tool
calls.

### Responsive Baseline

The Web UI remains desktop-first. Telegram is still the mobile-first channel.
But the browser UI should support narrow laptop windows with basic responsive
rules:

- stack multi-column panels vertically on narrow screens
- convert dense tables to card lists where practical
- keep task tree and Kanban horizontally scrollable when needed
- keep action buttons and feedback boxes reachable without overlapping content
- preserve route deep links and selected object state across resize

This is not a full mobile product. It is basic layout resilience for the same
desktop tool.

## The five surfaces

Five surfaces. Deep-linkable URLs. The implementation may use tabs *if and only if* tabs are real URLs (paths or hashbangs that the browser back button respects).

Mapping to roles:

| Surface | Primary role | Notes |
|---|---|---|
| `/` | Watcher | liveness; heartbeat timeline; decision feed; breach summary |
| `/projects/:id` | Steerer | comment lands → next heartbeat picks it up |
| `/sessions/:id` | Steerer + Investigator | one surface; read-only when session is closed, input-enabled when open |
| `/knowledge` (and sub-paths) | Investigator | KE entries, journals, hypotheses, experiments — the system's memory |
| `/system` | Watcher → Investigator | metrics + events; the dashboard for spec conformance once that's computed |

The Watcher has one front door. The Steerer has two scopes (per-project comments, per-session conversation). The Investigator has two shapes (per-trace deep-dive, cross-cutting memory). Five surfaces, three roles, one human.

### 1. `/` — The liveness view (Watcher)

Answers "is the system alive?" in one screen, no clicks. Built around **movement**, not numbers.

```
┌──────────────────────────────────────────────────────────────────────┐
│  may-agent     ●●● 13 agents · 4 active now      breaches: 1   ▼     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  HEARTBEAT TIMELINE   (last 4h)                          ← live →    │
│                                                                       │
│  may          ▌  ▌    ▌   ▌  ▌    ▌   ▌  ▌   ▌  ▌    ▌  ▌  ▌  ▍     │
│  evaluator    ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▍     │
│  arc          ▌      ▌            ▌                       ▌  ▍       │
│  scout        ▌                                            ▍         │
│  dev          ▌            ▌            ▌                  ▍         │
│  aks-explorer ▌    ▌      ▌      ▌    ▌      ▌      ▌       ▍        │
│  tech-lead    ▌                  ▌                         ▍         │
│  …                                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  RECENT DECISIONS                                                     │
│  14:24  may         "Project context-injection-review is stale 4d.   │
│                      Iterating to unstick before it goes blocked."   │
│  14:22  dev         "handler.success-rate breached. Investigating    │
│                      whether evaluator retries are the cause."       │
│  14:18  arc         "Reviewing scout's proposal on stigmergy. Will   │
│                      respond with feedback this heartbeat."          │
│  …                                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PROJECT METRIC HEALTH  (alerting first, then recent activity)        │
│                                                                       │
│  ● aks-rp-e2e.app            aks-explorer active  2 alerts           │
│     task.blocked-count 20  live-started-24h 0  stale-active 0       │
│  ● evaluation.app            evaluator    active  metrics ok         │
│     aftermath-coverage 0.82  active-task-count 3                    │
│  ◐ scout-knowledge-lib.app   scout        active  no project metrics │
│  …                                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  CONVERSATION  (last hour)                                           │
│  14:24  may → dev           P1  "handler.success-rate review"        │
│  14:22  dev → may          P2  "ack, picking up next heartbeat"     │
│  14:18  scout → arc        P2  "stigmergy proposal ready for review"│
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

Five panels. Each is **alive** — it updates over `/ws` as events flow. The page never reloads. Watching it for thirty seconds tells you whether the system is breathing.

- **Heartbeat timeline (40% of viewport).** Per-agent track, last 4 hours, every heartbeat session as a bar. Phase 1 identifies heartbeat sessions from existing `sessions.source` values such as `workflow:heartbeat-*` and `[heartbeat]` task prefixes. The pattern of bars *is the operator's primary signal*. Even rhythm across agents = healthy. Bursts and silences = something happening. Empty tracks = an agent is dead in its seat.

- **Recent heartbeat outcomes (live ticker).** Phase 1 renders the existing heartbeat session task/outcome summaries, newest first. If this is too weak after using it, add `agent.decision` later as a sharper signal. The first useful view should not depend on a new event.

- **Project metric health.** Each project tile shows: pulse indicator (green = active in last hour, yellow = 24h, gray = dormant), name, owner, status, last-touched, and project-owned metric chips. Alerting metrics sort first, then priority, then recent activity. Click the project row → screen 2. Click a metric chip → metric history.

- **Conversation strip.** Recent `message.created` events between agents (and human comments). Shown as a flow: from → to, priority, intent. Live. Click a message → opens its source session.

- **Top bar.** Health summary, breach count. Click breach count → screen 4 (system health), the old metric-grid view.

What the front page does **not** show: a metric grid, a session list, an event log, agent activity counts. Those are second-class. They live one click in. The front page is for *seeing the system live*.

### 2. `/projects/:id` — Project detail (Steerer)

A project is a goal + history + ongoing iterations. The UI shows it that way.
Crucially: **the human sees what the agent sees.** For current `.app` projects,
the owner reads the project manifest, task tree, journal/discussion audit when
present, recent events, and project metrics. The UI surfaces the same material,
organized for human reading and steering.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Project: context-injection-review              owner: may  ● active │
├──────────────────────────────────────────────────────────────────────┤
│  GOAL                                                  [edit]         │
│  Define how project context gets injected into agent prompts so       │
│  iterations build on prior work instead of restarting.                │
│                                                                       │
│  PULSE      last iteration: 4d ago    last comment: 1h ago           │
│             metrics: 2/2 healthy  ▁▂▃▃▂▁▂                            │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  JOURNAL  (newest first)                                              │
│  2026-05-02  may     "Tried approach A; tests show context           │
│                       overflow at 3rd iteration. Reverting."          │
│  2026-04-30  may     "Initial design: inject project.md as part      │
│                       of system prompt at heartbeat..."              │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  DISCUSSION                                                           │
│  2026-05-06 14:00  human   "Project is stale — please pick up"      │
│  2026-05-02 22:00  may     "Will revisit after current iteration"   │
│                                                                       │
│  [ leave a comment for the next heartbeat... ]              [send]   │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  METRICS                                                              │
│  context.injection-overflow      gauge   0.05 / 0.10  ✓  ▁▂▁▁▂▁     │
│  context.iteration-continuity    gauge   0.78 / 0.80  ⚠   ▁▂▃▃▂▂    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  RECENT SESSIONS  (iterations of this project)                       │
│  s_177…  2026-05-02  may       heartbeat   done       6 ops          │
│  s_177…  2026-04-30  may       heartbeat   done      18 ops          │
│  …                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

The discussion box is **inline and conversational**, not a buried form. The
latency is honest: the comment is delivered as a `project.comment.created`
event, and the project app or owner fallback wakes the owner path. Watch the
pulse and event trace to see whether it was accepted and acted on.

**Steering verbs available here:**
- **Comment** (inline textarea) — emits `project.comment.created`; the owner
  sees it through the project event path. The app may also keep an audit copy in
  discussion/journal state.
- **Edit goal** — updates `project.md` `## Goal` section. Mutable by humans only.
- **Pause / Resume** — sets project status; agent skips paused projects.
- **Mark closed** — humans close projects, not agents.

### 3. `/sessions/:id` — Session view (Steerer + Investigator)

This is the unified surface that earlier drafts split into "chat" and "sessions." They were always the same surface viewed from different starting points. The transcript is the transcript; whether you can type into it depends on whether the session is open.

**Three ways to land here:**

- **Click a session** in the liveness feed, project detail, or knowledge cross-reference → `/sessions/<id>`. Read-only investigation.
- **"Talk to may"** (or any agent) — button on `/` that resolves to the agent's *default session* (most recent open session bound to inputs). Lands you on `/sessions/<that-id>` with input enabled. Mirrors Telegram's single-thread-per-agent model.
- **"New conversation"** — explicit button. POST creates a new session bound to the chosen agent; you land on `/sessions/<new-id>` with input enabled.

A session is **a thought**. The UI renders it as one, in four phases (matching the heartbeat structure in `heartbeat.md`):

```
┌──────────────────────────────────────────────────────────────────────┐
│  Session s_177…   may   heartbeat   done   2026-05-06 14:24-14:31    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  TRIGGER     heartbeat (cron, every 20m)                             │
│                                                                       │
│  READ        Context the agent took in:                              │
│              · projects/context-injection-review/{project,journal,   │
│                  discussion}.md                                       │
│              · 3 unread messages (from dev, arc, human)              │
│              · 14 active metrics, 1 in breach (handler.success-rate) │
│              · last 5 own decisions                                  │
│                                                                       │
│  DECIDE      "Project context-injection-review is stale 4 days and  │
│               there's a fresh comment from human asking to pick up.  │
│               Iterating now before it blocks."                        │
│                                                                       │
│  ACT         8 tool calls:                                           │
│              · read project/task state, journal/discussion, metrics  │
│              · edit journal.md (added iteration entry)               │
│              · message → dev (P2, request review)                    │
│              · finish                                                 │
│                                                                       │
│  RECORD      · journal entry added to context-injection-review      │
│              · message.created → dev                                 │
│              · session.end (outcome: progress)                       │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  [ view raw transcript ]  [ cancel ]  [ message this agent ]         │
└──────────────────────────────────────────────────────────────────────┘
```

The transcript is one click away (collapsed by default) — the structured view is the primary rendering. Investigators who need the raw tool calls can expand. Most of the time, the four-phase view is enough to understand what happened and why.

**Steering verbs:**
- **Type into the input row** (if the session is open and bound to inputs) — your message becomes part of the session's context on the next agent step. Same primitive that Telegram uses.
- **Cancel** (if `status=running`).
- **Message this agent** — opens compose for a *new* message to the agent (distinct from typing into this session); posts `message.created`.

**Default-session resolution.** The "talk to may" entry point needs to resolve to a specific session ID. The rule: pick the most recent session for that agent that is (a) open / accepting input, (b) not a heartbeat session, (c) not a workflow-spawned worker. If none exists, the button creates one. This matches Telegram's behavior where a single thread persists across messages until explicitly closed.

### 4. `/knowledge` — System memory (Investigator)

The system accumulates memory in markdown: knowledge entries (KE-*), hypotheses (H-*), experiments (EXP-*), project journals, design docs, proposals. These are the substrate of agent continuity — every heartbeat reads from them. The Investigator needs the same view.

```
┌──────────────────────────────────────────────────────────────────────┐
│  📁 shared / knowledge / entries                                      │
├──────────────────────────────────────────────────────────────────────┤
│  📁 entries                          │  KE-744: Git assume-unchanged │
│  📁 hypotheses                       │  on workspace files           │
│  📁 experiments                      │  ────────────────────────────  │
│  📄 KE-001.md   1.5KB                │  Status: open                  │
│  📄 KE-002.md   5.9KB                │  Cited in: project.active...   │
│  📄 KE-003.md   1.0KB                │  ...                           │
│  ...                                  │                                │
└──────────────────────────────────────────────────────────────────────┘
```

**What it surfaces:**
- Tree view on the left, content on the right.
- Markdown rendered with cross-links: any `KE-NNN`, `H-NNN`, `EXP-NNN` reference becomes a clickable navigation.
- File metadata: size, last modified, owner.
- Sub-paths are real URLs: `/knowledge/entries/KE-744` deep-links to that file.

**Why this earns its surface.** The design's own "alive" table includes **Persisting** — "journals carry forward; today's iteration references yesterday." If the human can't read what carried forward, they can't tell whether the system is persisting or just storing. `/knowledge` is the surface where that signal becomes visible. It's also where C10 (honesty) becomes legible: stale entries, orphan references, unresolved hypotheses are visible in the file tree's metadata. A future iteration can surface staleness signals ("this KE hasn't been referenced in 60 days") directly.

**Steering from `/knowledge`?** No. Reading the system's memory is investigation, not steering. To act on something you read, navigate to its associated project or session and steer there.

### 5. `/system` — System health (Watcher → Investigator)

The metric grid lives here, not on the front page. This is where you go when the front page's breach badge is non-zero.

```
┌──────────────────────────────────────────────────────────────────────┐
│  System health      breaches: 1                                       │
├──────────────────────────────────────────────────────────────────────┤
│  AGENCY  (are agents being agents?)                                  │
│                                                                       │
│  agent.heartbeat-coverage     13 / 8        ✓                        │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                                       │
│  handler.success-rate         0.78 / 0.80   ⚠  dev        ▁▂▃▅█▇▅   │
│  handler.heartbeat-coverage   13 / 8        ✓                        │
│  session.error-rate-6h        0.07 / 0.10   ✓                        │
│  …                                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│  OUTPUT                                                               │
│  system.real-output-24h       508 / 30      ✓                        │
│  project.iterations-24h       7 / 0         (watch-only)             │
│  project.blocked-over-6h      1 / 1         ⚠                        │
│  …                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

Click a metric → metric detail with breach history, sparkline, sessions spawned by this metric, threshold-adjust verb, alert-resolve verb.

This screen is **secondary**. It exists for when the front page's heartbeat-and-decisions view raises a question that needs a numerical answer. It is not how the operator starts.

That's all five surfaces. The shipped UI's `#chat` tab collapses into `/sessions/:id`. The `#benchmarks` tab is unhooked pending a future rebuild. `#metrics` and `#events` fold into `/system`. `#knowledge` stays as a first-class Investigator surface. The dashboard tab becomes `/`.

## The agency view (callout)

The new front-page panel that didn't exist before is the **HEARTBEAT TIMELINE + RECENT HEARTBEAT OUTCOMES** pair. Together they answer "are agents being agents?"

This is the UI element that most directly delivers the "see agents alive" experience. The timeline shows *that* agents are running. The outcome feed shows *what they did or intended*. Watching both for 30 seconds gives the visceral sense of a system at work — or, when something is wrong, of silence where there should be activity.

This pair uses existing data first: `sessions.source`, `sessions.task`, `sessions.outcome`, `session.start`, and `session.end`. A future `agent.decision` event is allowed only if the existing feed proves too weak in practice.

## The steering surface

The human's verbs, complete list:

| Verb | Where | Mechanism | Latency |
|---|---|---|---|
| **Comment on project** | project detail | `project.comment` event → agent sees next heartbeat | next heartbeat |
| **Edit project goal** | project detail | edits `project.md` `## Goal` | next heartbeat |
| **Pause / resume project** | project detail | sets project status | next heartbeat |
| **Close project** | project detail | sets project status to `closed` | immediate (system) |
| **Send message to agent** | session detail, agent context | `message.created` event | next heartbeat |
| **Cancel session** | session detail | WebSocket command to manager | immediate |
| **Trigger heartbeat now** | agent context | emits `timer.tick` or the control shortcut for that heartbeat entry | immediate |
| **Adjust metric threshold** | metric detail | updates `metrics.threshold`, emits config-change event | next measure cycle |
| **Resolve metric alert** | metric detail | updates `metric_alerts` | immediate |

Five rules for the steering surface:

1. **Every verb has one durable effect.** Prefer the simplest durable path. Emit an event when live visibility or agent wakeup needs it; do not add event indirection just to satisfy architecture.
2. **Verbs shape the agent's next look, not its current action.** Per `heartbeat.md`, the framing is: change what the agent sees when it next heartbeats. The UI's copy reflects this ("delivered at next heartbeat") rather than implying immediate response.
3. **Verbs are async, and the UI is honest about it.** After commenting, see the comment in discussion immediately, then watch the project's pulse for when the agent picks it up. Don't fake instant response.
4. **No verb mutates agent state directly.** Cancelling a session emits a cancel command; the manager processes it. The UI doesn't reach into manager internals.
5. **Confirmation only for destructive verbs.** Cancel a session: confirm. Comment on a project: just send. Trust the human.

## Live vs. historical: the two data planes

The "UI = bus subscriber" rule from `../architecture.md` applies to **live updates**. For **historical state** (last 7 days of metric values, breach history, agent timeline, project journals), the UI reads SQLite and the filesystem directly. Both are correct, both are needed.

### Plane A — Live (1 endpoint)

`/ws` proxies the running may-agent's Unix socket. Browser receives the firehose: `session.start`, `session.end`, `message.created`, `metric.breach`, `metric.recovered`, `handler.failed`, and optional future events such as `agent.decision`.

**Rule**: if a screen reacts to state change *while the user is looking at it*, it watches `/ws`. No polling. No 30-second refresh timers. The websocket is the source of truth for "now."

### Plane B — Historical SQL (read-only)

Endpoints exist only for queries the live event stream cannot answer:

| Path | Reads | Used by |
|---|---|---|
| `/api/projects` | filesystem walk + project_index | screen 1 |
| `/api/projects/:id` | project files + metrics + sessions | screen 2 |
| `/api/sessions/:id` | `sessions`, `events` | screen 3 |
| `/api/sessions/:id/transcript` | `.state/sessions/<id>/session.jsonl` | screen 3 |
| `/api/agents/:name` | `sessions`, `events`, project files | session detail header, agent context |
| `/api/metrics` | `metrics` | screen 4 (initial load) |
| `/api/metrics/:id` | `metrics`, `metric_snapshots`, `metric_alerts`, `events` | metric detail |
| `/api/liveness` | `sessions`, `events`, `metrics`, `metric_alerts` | screen 1 initial load: heartbeat timeline, recent outcomes, messages, open alerts |
| `/api/decisions` | optional future endpoint if `agent.decision` exists | screen 1 refinement |

**Rule**: each endpoint queries one table or one filesystem path. No business logic. Read-only — mutations happen via Plane C.

### Plane C — Steering verbs (POST → bus)

One endpoint per verb in the steering surface. Each validates input, emits exactly one event to the bus, returns ok. The handler that picks up the event does the work — same as if an agent emitted it.

That's the eventual back-end surface: 1 WebSocket + a small set of query endpoints + a few steering endpoints + static files. Phase 1 deliberately starts with one aggregate read-only endpoint, `/api/liveness`, so the operator can see whether the system works before expanding the API.

## What gets removed

From today's UI and API surface, this revision removes or defers:

| Removed / deferred | Why |
|---|---|
| `/api/requests` and Requests tab | Empty stub; table deleted in v0.2 |
| `/api/benchmarks*` (3 endpoints) and Benchmarks tab | Currently broken; rebuild deferred. Backend routes stay for data preservation; tab is unhooked. Returns later as `/admin/benchmarks` or `/system/benchmarks` if rebuilt. |
| `/api/digest` and Digest panel | Daily digest is a markdown file in the repo; not needed in UI |
| `/api/agents/activity`, `/api/agents/timeline` (current shape) | Replaced by heartbeat timeline + decisions feed |

**Reversal from earlier draft.** A previous version of this section also listed "Top-level Knowledge tab" as removed ("reachable per-agent in agent context views"). That was wrong: the system's memory needs a top-level Investigator surface. `/knowledge` is now first-class — see surface 4 above.

## Constraints on the UI

These are not aesthetic preferences — they're consequences of "the UI is a window onto living agents."

### The UI moves

Things slide, fade, pulse, appear. Not as decoration — as the rendering of liveness. Static tables are wrong for the front page. CSS animations driven by websocket events are right. Pacing matters: don't strobe, don't overwhelm, don't lag.

### Density is the enemy

The heartbeat timeline takes 40% of the front page. Each project tile gets real space. A session is shown as four phases, not a JSON dump. Breathing room is functional, not decorative — it's what makes liveness visible. A dense table of numbers, even if up-to-the-millisecond fresh, *looks dead*.

### Latency honesty

Agents are async. Comments take until next heartbeat to be processed. The UI says so explicitly. After commenting, see it appear in the discussion immediately, then watch the project pulse for when the agent picks it up. Asynchrony is part of the experience, not a bug to hide.

### No polling

The browser does not loop on a timer. Live changes come over `/ws`. Historical fetches happen on navigation only. The single exception: on websocket reconnect after a drop, the UI re-fetches the initial state of the screen the user is viewing (because it missed events while disconnected). This is the *only* refresh.

## Failure modes

- **may-agent process is down.** `/ws` fails to upgrade. The UI shows "agent disconnected" in the top bar but continues to serve historical Plane B views (SQLite is independent of the may-agent process). The user can still investigate the recent past.
- **SQLite is locked.** Read endpoints return 500. The UI treats this as transient, retries on user action. Live updates continue over `/ws`.
- **Filesystem path missing.** Endpoints return `[]` or `{}` with 200. The UI shows empty state ("no projects yet"), not an error.
- **Browser loses websocket.** Auto-reconnect with backoff. On reconnect, re-fetch the current screen's initial state, then resume listening.
- **No heartbeat sessions in the last 4h.** The liveness view shows empty heartbeat tracks. This is enough to diagnose a scheduler/runtime visibility problem before adding any sharper decision event.

## Data model gaps to close

Potential structured fields to add later. None are prerequisites for the first useful UI:

1. **`agent.decision` event** — optional. If heartbeat task/outcome summaries are not enough, emit this partway through every heartbeat session. Carries: `agent`, `sessionId`, `decision`.

2. **Session trigger typing** — optional. The current schema has `kind` and `source`, not a `trigger` column. Phase 1 infers heartbeat sessions from `source='workflow:heartbeat-*'` and `[heartbeat]` task prefixes. Add a formal trigger only if inference becomes unreliable.

3. **Metric ↔ project population** — optional. The DB already has `metrics.project`; use and standardize that before adding any new `project_id` column.

## Migration steps

The current `web.ts` is mostly v2-shaped on the back end. The front-end is the rewrite. The shipped UI overlaps with the design more than the earlier revision admitted: `#chat` already implements session-view-with-input, `#knowledge` already implements the file browser. The migration is mostly *renaming and rewiring*, not building from scratch.

**Status as of 2026-05-08 (revised, post commit `0db40723`)**:

1. ✅ **`/api/liveness` shipped and rendered.** Heartbeat detection fixed (was missing ~80% of heartbeats due to per-agent workflow path bypassing the `[heartbeat]` task prefix). Verified: 6/3 → 31/5 heartbeats/agents detected in 4h after the fix.
2. ✅ **Dead surfaces unhooked.** `/api/requests` deleted; `Benchmarks` tab unhooked from header. `/api/digest`, `/api/agents/activity`, `/api/agents/timeline` are still wired to the current dashboard panels because removing them now would break visible features before their replacement panels (heartbeat timeline + decision ticker + conversation strip) are built. Defer their deletion until the panel rebuild proceeds.
3. ✅ **Five steering POST endpoints shipped and wired to UI.** `POST /api/sessions/:id/cancel`, `POST /api/sessions/:id/message`, `POST /api/agents/:name/heartbeat-now`, `POST /api/metrics/:id/threshold`, `POST /api/alerts/:id/resolve`. Each emits one typed event with `source: "web-ui"` (or `"human"` for heartbeat-now). UI affordances: ♥ button on each agent heartbeat row, ✕ button on each session pill, `resolve` button on each open alert, ✎ pencil on each metric Target cell. One `steer()` helper + toast feedback ("queued at <time>") owns latency honesty. Canonical alert judgment events use `metric.alert_judged`; recovery still depends on later metric evidence, usually `metric.recovered`.
4. ✅ **Front-end — plumbing and core panels done.**
   - ✅ Hash router shipped: `#/`, `#/projects`, `#/projects/:id`, `#/sessions`, `#/sessions/:id`, `#/knowledge`, `#/knowledge/<sub-path>`, `#/system`. Legacy hashes (`#dashboard`, `#chat`, `#metrics`, `#events`) still resolve via aliases for one release.
   - ✅ Tabs renamed `Dashboard`/`Chat`/`Metrics`/`Events` → `Live`/`Sessions`/`System`. `Benchmarks` removed from nav.
   - ✅ WebSocket pub-sub layer shipped: panels can `busSubscribe(eventType, fn)` to live events. Existing dashboard panels already auto-refresh via `scheduleLivenessRefresh()` on the relevant event types.
   - ✅ **All five front-page design panels render**: heartbeat timeline (already), recent decisions / outcomes (already), open alerts (already), recent messages (already), and projects-by-activity (new in `0db40723`).
   - ⏳ The pixel-perfect 40%-viewport heartbeat timeline + ASCII-mock layout from screen-1 is not the literal CSS used; the panels render the same data in a similar three-section grid. If a future operator finds the layout proportionally wrong, that's pure CSS work — the data wiring is done.
5. ⏳ **Default-session resolution rule documented but not yet implemented.** `#chat` (now `/sessions`) already resolves to a session-with-input surface using whichever session is selected; the rule "most-recent open non-heartbeat/worker session per agent" needs to be encoded in `initChat()`. Today's behavior: shows whatever session was last clicked.
6. 🟡 **Optional refinements** — `agent.decision` is now firing in production (28 lifetime, all in last 24h — see the archived V2 spec S7). The dashboard renders heartbeat session task/outcome summaries today; switching to `agent.decision` as the primary source can happen once emission coverage is consistently high. KE/H/EXP cross-links shipped (`linkifyRefs()` in `renderAssistantMsg` and `renderFileContent`).

What remains for a fully spec-aligned UI:

- Default-session resolution wired into the Sessions surface.
- Visual layout polish on `/` (the design's screen-1 mock expects the heartbeat timeline at ~40% viewport height as the dominant element; today the panels are roughly equal-weight). Pure CSS.
- Phase-out of the hand-pasted "Activity Timeline" + "Live Activity Feed" panels on the dashboard — the design wants the conversation strip (already rendered as "Recent messages") to replace them. Decide based on operator preference after some use.
- Deletion of `/api/digest`, `/api/agents/activity`, `/api/agents/timeline` — safe once the visual layout above settles.

Order: 1 first. Then do 2 and 3 only where they simplify the shipped UI. Do 4 and 5 together when moving from hash tabs to real URLs. Step 6 is explicitly last. The rule is: expose existing truth first, add primitives only after a concrete gap appears.

## Out of scope

- **Authentication.** Local-only by deployment.
- **Mobile layout.** The dashboard is a desktop tool. Telegram is the mobile interface.
- **Editing markdown in the UI.** That's an IDE job. The UI shows projects; my editor edits them.
- **Multi-tenant / multi-instance.** One may-agent per dashboard.
- **Replacing Bun's built-in `serve`.** It's enough.

## Shipped Nav Structure (2026-05-08)

Nav was reframed around three first-class resources: **agents**, **projects**, **metrics**. Sessions are no longer in primary nav — reached through an agent, project, or heartbeat.

| Tab | Purpose | URL | Backend |
|---|---|---|---|
| Live | live activity (heartbeats, decisions, alerts, messages, projects strip) | `#/` | `/api/liveness`, `/api/projects` |
| Agents | card grid of all configured agents | `#/agents` | `/api/agents` |
| Projects | flat table of all projects | `#/projects` | `/api/projects` |
| Metrics | metric grid (Agency / Infrastructure / Output) | `#/metrics` | `/api/metrics` |
| Knowledge | KE / H / EXP file tree | `#/knowledge` | `/api/browse` |
| System | events log + runtime health | `#/system` | `/api/events` |

Agent detail (`#/agents/<name>`) has five sub-tabs: Chat (default), About, Metrics, Projects, Sessions.

Backend additions: `GET /api/agents` (per-agent rollup), `GET /api/agents/:name/about` (identity files).

## Open Problems

1. **Project parser broken.** `handleProjects()` parses `**Owner**: x` lines but every actual `project.md` uses YAML frontmatter (`---\nowner: x\n---`). Every project shows `owner=unknown`, `status=unknown`. The Projects table is currently useless.

2. **Knowledge has 604 entries and no search.** A file tree of 604 entries is not browseable. Add a client-side filter by filename + first-line content.

3. **Stale projects visibility.** Should `status: waiting` projects appear by default? Suggest: show, but visually muted.

## Open questions

1. **Should `/system` (screen 4) collapse into the front page as a "vitals" expandable panel?** Probably yes once metrics are agent-owned and project-scoped — the system-only metrics shrink to a small set that fits on the front page.

2. **Threshold adjustment via UI:** does it write back to `agents/may/handlers/metrics-snapshot.ts` (registry source) or only to the DB? The DB is mutable; the source file is canonical. If they drift, who wins? Suggested rule: UI writes DB only; the registry on next snapshot reconciles. Manual edits to the registry file remain canonical override.

3. **Conversation strip on the front page: should it show all messages or only those needing attention?** All-messages may flood; needing-attention requires a definition. Probably: all-messages, but high-priority (P0/P1) visually emphasized.

4. **Live event filtering on the front page.** Recent decisions, conversation, breaches — what about `tool.executed` (firehose volume), `session.end` (one per minute), etc.? Currently scoped to the most-meaningful types. Make this user-configurable later if it matters.

5. **Heartbeat trigger as a steering verb:** when the human comments and wants the agent to pick it up *now*, "trigger heartbeat now" is the right verb. Should this be on every page, only on agent context, or only on the comment confirmation? Suggested: appears on the project detail's discussion area as a small "or trigger heartbeat now" link below the send button.

6. **Should the UI show the same context the agent will see at next heartbeat?** I.e., a "what will this agent see when it next runs?" view, exposing the prompt assembly. This is a powerful debug tool but blurs the line between window and control panel. Defer.

## Why this is v2-shaped

- **Projects are the primary navigable object** — because projects are the durable work context (per `../work-model.md`).
- **Heartbeats are visible** — because heartbeats are agency (per `heartbeat.md`), and agency is the thing the operator most needs to see.
- **Metrics are vitals, not pagers** — breach badge is in the top bar; the metric grid is one click in. (Per `metrics.md`.)
- **Steering is participation, not control** — verbs shape what agents see at their next look. Async by design.
- **Live + historical, no polling** — Plane A for now, Plane B for the past, never confused.
- **The window principle** — the UI shows the system; it does not stand outside it. The human's verbs flow through the same bus the agents use.
