# Design: Web UI

**Status**: Partially shipped (2026-05-08)
**Date**: 2026-05-06 (revised 2026-05-08)
**Aligned with**: `../architecture.md`, `../work-model.md`, `metrics.md`, `heartbeat.md`

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
│  optimizer    ▌    ▌      ▌      ▌    ▌      ▌      ▌       ▍        │
│  evaluator    ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▍     │
│  arc          ▌      ▌            ▌                       ▌  ▍       │
│  scout        ▌                                            ▍         │
│  dev          ▌            ▌            ▌                  ▍         │
│  tech-lead    ▌                  ▌                         ▍         │
│  …                                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  RECENT DECISIONS                                                     │
│  14:24  may         "Project context-injection-review is stale 4d.   │
│                      Iterating to unstick before it goes blocked."   │
│  14:22  optimizer   "handler.success-rate breached. Investigating    │
│                      whether evaluator retries are the cause."       │
│  14:18  arc         "Reviewing scout's proposal on stigmergy. Will   │
│                      respond with feedback this heartbeat."          │
│  …                                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  PROJECTS  (sorted by recent activity)                               │
│                                                                       │
│  ● context-injection-review     may       4d ago   metrics: 2 ✓     │
│  ● handler-health               optimizer 2h ago   metrics: 3, 1⚠   │
│  ● agent-system-literacy        arc       1h ago   metrics: 2 ✓     │
│  ◐ skill-workflow-audit         scout     3d ago   metrics: 1 ✓     │
│  …                                                                    │
│                                                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  CONVERSATION  (last hour)                                           │
│  14:24  may → optimizer    P1  "handler.success-rate review"        │
│  14:22  optimizer → may    P2  "ack, picking up next heartbeat"     │
│  14:18  scout → arc        P2  "stigmergy proposal ready for review"│
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

Five panels. Each is **alive** — it updates over `/ws` as events flow. The page never reloads. Watching it for thirty seconds tells you whether the system is breathing.

- **Heartbeat timeline (40% of viewport).** Per-agent track, last 4 hours, every heartbeat session as a bar. Phase 1 identifies heartbeat sessions from existing `sessions.source` values such as `workflow:heartbeat-*` and `[heartbeat]` task prefixes. The pattern of bars *is the operator's primary signal*. Even rhythm across agents = healthy. Bursts and silences = something happening. Empty tracks = an agent is dead in its seat.

- **Recent heartbeat outcomes (live ticker).** Phase 1 renders the existing heartbeat session task/outcome summaries, newest first. If this is too weak after using it, add `agent.decision` later as a sharper signal. The first useful view should not depend on a new event.

- **Projects (sorted by recent activity).** Each project tile shows: pulse indicator (green = active in last hour, yellow = 24h, gray = dormant), name, owner, last-touched, metric summary. Click → screen 2.

- **Conversation strip.** Recent `message.created` events between agents (and human comments). Shown as a flow: from → to, priority, intent. Live. Click a message → opens its source session.

- **Top bar.** Health summary, breach count. Click breach count → screen 4 (system health), the old metric-grid view.

What the front page does **not** show: a metric grid, a session list, an event log, agent activity counts. Those are second-class. They live one click in. The front page is for *seeing the system live*.

### 2. `/projects/:id` — Project detail (Steerer)

A project is a goal + history + ongoing iterations. The UI shows it that way. Crucially: **the human sees what the agent sees.** When an agent works on a project at heartbeat, it reads `project.md`, `journal.md`, `discussion.md`, and the project's metrics. The UI surfaces the same things, in the same place, organized for human reading.

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

The discussion box is **inline and conversational**, not a buried form. The latency is honest: the UI says "for the next heartbeat," the comment is delivered as a `project.comment` event, the agent picks it up next heartbeat. Watch the pulse to see when.

**Steering verbs available here:**
- **Comment** (inline textarea) — adds to discussion, agent sees next heartbeat.
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
│              · 3 unread messages (from optimizer, arc, human)        │
│              · 14 active metrics, 1 in breach (handler.success-rate) │
│              · last 5 own decisions                                  │
│                                                                       │
│  DECIDE      "Project context-injection-review is stale 4 days and  │
│               there's a fresh comment from human asking to pick up.  │
│               Iterating now before it blocks."                        │
│                                                                       │
│  ACT         8 tool calls:                                           │
│              · read project.md, journal.md, discussion.md            │
│              · edit journal.md (added iteration entry)               │
│              · message → optimizer (P2, request review)              │
│              · finish                                                 │
│                                                                       │
│  RECORD      · journal entry added to context-injection-review      │
│              · message.created → optimizer                           │
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
│  handler.success-rate         0.78 / 0.80   ⚠  optimizer  ▁▂▃▅█▇▅   │
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
6. 🟡 **Optional refinements** — `agent.decision` is now firing in production (28 lifetime, all in last 24h — see v2-spec.md S7). The dashboard renders heartbeat session task/outcome summaries today; switching to `agent.decision` as the primary source can happen once emission coverage is consistently high. KE/H/EXP cross-links shipped (`linkifyRefs()` in `renderAssistantMsg` and `renderFileContent`).

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
