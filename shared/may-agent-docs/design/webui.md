# Design: Web UI

**Status**: review
**Date**: 2026-05-06
**Aligned with**: `proposals/v2-architecture.md`, `design/agent-metrics.md`, `design/heartbeat-as-agency.md`

## What this UI is for

The Web UI is **a window into the life of an autonomous multi-agent system.** Not a dashboard. Not a control panel. A window.

The primary thing the human is looking for when they open it is not a number, not a status — it's the **felt sense that the agents are alive**: moving, thinking, deciding, coordinating, persisting. A healthy autonomous system *looks different* from a broken one when you watch it for thirty seconds. The UI's job is to make that difference visible.

This shapes everything else.

## What "alive" means, concretely

The framing isn't a vibe. It maps to specific things the system already produces:

| What "alive" means | Concrete signal in the system |
|---|---|
| **Moving** | Heartbeat sessions firing on schedule across agents |
| **Thinking** | Each heartbeat session produces an explicit decision ("doing X because Y") |
| **Responding** | Comments, messages, breaches show up in the next heartbeat's context and get acted on |
| **Persisting** | Project journals carry forward; today's iteration references yesterday's |
| **Coordinating** | `message.created` events flow between agents, with replies that close the loop |
| **Caring** | Stalled projects get noticed at heartbeat; idle agents get flagged |

If the UI shows these signals as they happen, the system *looks alive*. If it doesn't, even a healthy system looks like a chart.

This is also what it means for the system to **fail visibly**. A dead heartbeat track tells you an agent is broken faster than any error metric. A flat decision feed tells you agents have lost the plot. A silent conversation strip tells you the multi-agent piece isn't multi-agent anymore.

## Three roles, one human

The same human visits the UI in three different mindsets. The UI is designed in this order:

- **Watcher** (10 seconds, dozens of times a day) — "Is the system alive? Is anything obviously off?" Glance at the front page. Watch for a moment. Close the tab.
- **Steerer** (1–5 minutes) — "I want to leave a note for an agent. Comment on a project. Adjust a threshold. Reply to a breach." The verbs are participation, not control.
- **Investigator** (15+ minutes) — "Why did agent X decide Y? What was the chain from breach to fix?" Drill in. Read transcripts. Follow links.

The Watcher's needs decide the front page. The Steerer's verbs decide the interactive surface. The Investigator's tools live one click away.

## What the UI is NOT

- **Not a chat interface.** Telegram is chat. Agents talk to each other; they don't talk to me through the dashboard. The UI's "send" verbs are *steering*, not *conversation*.
- **Not a configuration panel.** Agents are configured by markdown files in the repo. Editing those in a web form is the wrong abstraction — I edit them in my IDE.
- **Not a terminal.** If I'm running commands, I'm debugging, not operating.
- **Not a control panel.** Steering verbs *change what an agent will see at its next heartbeat*. They do not "make the agent do X right now." See `design/heartbeat-as-agency.md`.
- **Not a re-implementation of the bus or DB.** It's a window onto them.

## The system model the UI surfaces

Three first-class concepts (defined in detail in `proposals/v2-architecture.md` and `design/heartbeat-as-agency.md`):

- **Project** — the context an agent works within: goals, history, journal, accumulated experience. Owned by an agent. Iterated on at heartbeat.
- **Heartbeat** — the recurring moment when an agent reads context, decides, and acts. Where agency lives.
- **Metric** — the system's vital sign. Measures project progress or system health. Breaches inform the next heartbeat (P0 forks immediately).

And two relationships that connect them:

- **Sessions** are iterations of projects, triggered by heartbeats (most), metric breaches (urgent), or messages.
- **Messages** are async coordination between agents (and between humans and agents).

The UI's information architecture mirrors this. Projects are the primary navigable object. Metrics belong to projects (or to the system). Heartbeats animate everything. Sessions are how iterations look from the outside; messages are how coordination looks.

## The four screens

Four screens. One URL each. Deep-linkable. No tabs.

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
│  bob          ▌            ▌            ▌                  ▍         │
│  judge        ▌                  ▌                         ▍         │
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
│  ● agent-system-literacy        bob       1h ago   metrics: 2 ✓     │
│  ◐ skill-workflow-audit         coach     3d ago   metrics: 1 ✓     │
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

- **Heartbeat timeline (40% of viewport).** Per-agent track, last 4 hours, every heartbeat session as a bar. Live: new bars appear at the right edge as `session.start` events fire for `trigger=heartbeat`. The pattern of bars *is the operator's primary signal*. Even rhythm across agents = healthy. Bursts and silences = something happening. Empty tracks = an agent is dead in its seat.

- **Recent decisions (live ticker).** Each heartbeat session emits an `agent.decision` event near the start (see `design/heartbeat-as-agency.md`). This panel renders those, newest first. The agent's voice, not its actions. *This is the panel that most clearly shows agents thinking.*

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

### 3. `/sessions/:id` — Session detail (Investigator)

A session is **a thought**. The UI renders it as one, in four phases (matching the heartbeat structure in `design/heartbeat-as-agency.md`):

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
- **Cancel** (if `status=running`).
- **Message this agent** — opens compose, posts `message.created`.

### 4. `/system` — System health (Watcher → Investigator)

The metric grid lives here, not on the front page. This is where you go when the front page's breach badge is non-zero.

```
┌──────────────────────────────────────────────────────────────────────┐
│  System health      breaches: 1                                       │
├──────────────────────────────────────────────────────────────────────┤
│  AGENCY  (are agents being agents?)                                  │
│                                                                       │
│  agent.heartbeat-coverage     13 / 8        ✓                        │
│  agent.idle-rate              0.18 / 0.30   ✓                        │
│  agent.self-initiated-rate    0.62 / 0.50   ✓                        │
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

That's all four screens. There is no Events tab, no Knowledge tab, no Benchmarks tab, no Digest tab as top-level navigation. Events stream live on the front page. Knowledge is reachable per-agent via the agent name in any session/project view. Benchmarks are deleted. Digest is reachable as a markdown file in the repo.

## The agency view (callout)

The new front-page panel that didn't exist before is the **HEARTBEAT TIMELINE + RECENT DECISIONS** pair. Together they answer "are agents being agents?"

This is the UI element that most directly delivers the "see agents alive" experience. The timeline shows *that* agents are running. The decisions feed shows *what they're thinking*. Watching both for 30 seconds gives the visceral sense of a system at work — or, when something is wrong, of silence where there should be activity.

This pair depends on a system-level addition: the `agent.decision` event emitted by the heartbeat workflow (see `design/heartbeat-as-agency.md`). Without it, the decisions panel falls back to "first 200 chars of session output," which is much weaker. The decision event is a small change with large UI payoff.

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
| **Trigger heartbeat now** | agent context | emits `heartbeat` event | immediate |
| **Adjust metric threshold** | metric detail | updates `metrics.threshold`, emits config-change event | next measure cycle |
| **Resolve metric alert** | metric detail | updates `metric_alerts` | immediate |

Five rules for the steering surface:

1. **Every verb is an event.** Steering is just emitting events agents would emit themselves. The human is "another agent" with extra privileges. No special API.
2. **Verbs shape the agent's next look, not its current action.** Per `design/heartbeat-as-agency.md`, the framing is: change what the agent sees when it next heartbeats. The UI's copy reflects this ("delivered at next heartbeat") rather than implying immediate response.
3. **Verbs are async, and the UI is honest about it.** After commenting, see the comment in discussion immediately, then watch the project's pulse for when the agent picks it up. Don't fake instant response.
4. **No verb mutates agent state directly.** Cancelling a session emits a cancel command; the manager processes it. The UI doesn't reach into manager internals.
5. **Confirmation only for destructive verbs.** Cancel a session: confirm. Comment on a project: just send. Trust the human.

## Live vs. historical: the two data planes

The "UI = bus subscriber" rule from `proposals/v2-architecture.md` applies to **live updates**. For **historical state** (last 7 days of metric values, breach history, agent timeline, project journals), the UI reads SQLite and the filesystem directly. Both are correct, both are needed.

### Plane A — Live (1 endpoint)

`/ws` proxies the running may-agent's Unix socket. Browser receives the firehose: `session.start`, `session.end`, `message.created`, `metric.breach`, `metric.recovered`, `agent.decision`, `project.comment`, `handler.failed`, etc.

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
| `/api/decisions` | `events` filtered to `agent.decision` | screen 1 (initial load) |
| `/api/heartbeats` | `sessions` filtered to `trigger=heartbeat` | screen 1 (initial load of timeline) |

**Rule**: each endpoint queries one table or one filesystem path. No business logic. Read-only — mutations happen via Plane C.

### Plane C — Steering verbs (POST → bus)

One endpoint per verb in the steering surface. Each validates input, emits exactly one event to the bus, returns ok. The handler that picks up the event does the work — same as if an agent emitted it.

That's the entire back-end surface: 1 WebSocket + ~9 query endpoints + ~9 verb endpoints + static files.

## What gets removed

Endpoints and UI surfaces that fit no plane or no role:

| Removed | Why |
|---|---|
| `/api/requests` and Requests tab | Empty stub; table deleted in v0.2 |
| `/api/benchmarks*` (3 endpoints) and Benchmarks tab | `gym_runs` empty, `prompt_logs` missing, subsystem dead |
| `/api/digest` and Digest panel | Daily digest is a markdown file in the repo; not needed in UI |
| Top-level Knowledge tab | Reachable per-agent in agent context views |
| `/api/agents/activity`, `/api/agents/timeline` (current shape) | Replaced by heartbeat timeline + decisions feed |

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
- **No `agent.decision` events flowing.** The decisions feed shows an empty state with a hint: "agents aren't emitting decisions — heartbeat workflow may need updating." This is itself a useful diagnostic.

## Data model gaps to close

Two structured fields the system doesn't currently capture cleanly. Both are pre-requisites for the UI as designed:

1. **`agent.decision` event** — emitted partway through every heartbeat session, before the action phase. Carries: `agent`, `sessionId`, `decision` (the agent's "I will do X because Y" statement). Without this, the decisions feed is much weaker. Small change to the heartbeat workflow; large UI payoff. (See `design/heartbeat-as-agency.md`.)

2. **Session `trigger` field consistently populated** — `heartbeat | metric.breach | message | order | manual`. The schema has the field; population is inconsistent. Tighten this so the heartbeat timeline can filter cleanly to `trigger=heartbeat`, and so screen 3 can show the trigger context at the top.

A third change is desirable but not blocking:

3. **First-class metric ↔ project link in the DB.** Today metrics have an `owner` (agent) but no `project`. Without it, "metrics for this project" requires parsing markdown. Add a nullable `project_id` column on `metrics` and have the registry populate it.

## Migration steps

The current `web.ts` is mostly v2-shaped on the back end. The front-end is the rewrite.

1. **Delete dead endpoints** (`/api/requests`, 3× `/api/benchmarks*`, `/api/digest`). ~200 LOC.
2. **Add the 9 steering POST endpoints.** ~150 LOC. Each is ~15 lines: validate, emit event, return ok.
3. **Add `/api/decisions` and `/api/heartbeats` query endpoints.** Read from `events` and `sessions`. ~50 LOC.
4. **Land the `agent.decision` event in the heartbeat workflow.** Schema + workflow change. (Coordinate with `design/heartbeat-as-agency.md` author.)
5. **Tighten session `trigger` field population.** Audit all `runAgent` callers; ensure trigger is set.
6. **Front-end rewrite to the four-screen layout.** Reactive to `/ws`, no polling. Largest piece.
7. **Fold knowledge browser and digest viewer into per-agent context.** Delete top-level tabs.

Order: 1, 2, 3, 5, 4, 7, 6. Front-end last with a stable back end.

## Out of scope

- **Authentication.** Local-only by deployment.
- **Mobile layout.** The dashboard is a desktop tool. Telegram is the mobile interface.
- **Editing markdown in the UI.** That's an IDE job. The UI shows projects; my editor edits them.
- **Multi-tenant / multi-instance.** One may-agent per dashboard.
- **Replacing Bun's built-in `serve`.** It's enough.

## Open questions

1. **Should `/system` (screen 4) collapse into the front page as a "vitals" expandable panel?** Probably yes once metrics are agent-owned and project-scoped — the system-only metrics shrink to a small set that fits on the front page.

2. **Threshold adjustment via UI:** does it write back to `agents/may/handlers/metrics-snapshot.ts` (registry source) or only to the DB? The DB is mutable; the source file is canonical. If they drift, who wins? Suggested rule: UI writes DB only; the registry on next snapshot reconciles. Manual edits to the registry file remain canonical override.

3. **Conversation strip on the front page: should it show all messages or only those needing attention?** All-messages may flood; needing-attention requires a definition. Probably: all-messages, but high-priority (P0/P1) visually emphasized.

4. **Live event filtering on the front page.** Recent decisions, conversation, breaches — what about `tool.executed` (firehose volume), `session.end` (one per minute), etc.? Currently scoped to the most-meaningful types. Make this user-configurable later if it matters.

5. **Heartbeat trigger as a steering verb:** when the human comments and wants the agent to pick it up *now*, "trigger heartbeat now" is the right verb. Should this be on every page, only on agent context, or only on the comment confirmation? Suggested: appears on the project detail's discussion area as a small "or trigger heartbeat now" link below the send button.

6. **Should the UI show the same context the agent will see at next heartbeat?** I.e., a "what will this agent see when it next runs?" view, exposing the prompt assembly. This is a powerful debug tool but blurs the line between window and control panel. Defer.

## Why this is v2-shaped

- **Projects are the primary navigable object** — because projects are the context (per `proposals/v2-architecture.md` §7).
- **Heartbeats are visible** — because heartbeats are agency (per `design/heartbeat-as-agency.md`), and agency is the thing the operator most needs to see.
- **Metrics are vitals, not pagers** — breach badge is in the top bar; the metric grid is one click in. (Per `design/agent-metrics.md`.)
- **Steering is participation, not control** — verbs shape what agents see at their next look. Async by design.
- **Live + historical, no polling** — Plane A for now, Plane B for the past, never confused.
- **The window principle** — the UI shows the system; it does not stand outside it. The human's verbs flow through the same bus the agents use.
