# Design: Web UI

**Status**: review
**Date**: 2026-05-06
**Aligned with**: `proposals/v2-architecture.md`, `design/agent-metrics.md`

## What the system is, in one paragraph

May-agent is a **metric-driven autonomous multi-agent system**. Metrics drive work: a metric breach forks the owning agent with a remediation task. Agents run continuously on heartbeats, coordinate via async persisted messages, and write deliverables to markdown files. Humans are mostly offline. The system either runs or it doesn't.

The UI exists to answer one question for the human: **is the system working?** And to give the human a small set of verbs to **steer it when it isn't**. Everything else is secondary.

## Three human roles, one person

The same human visits the UI in three different mindsets:

- **Operator** (5 seconds) — "Is anything broken right now?"
- **Steerer** (1 minute) — "I want to nudge the direction. Adjust a threshold. Comment on a project. Reply to an alert. Cancel a stuck session."
- **Investigator** (15 minutes) — "Why did agent X do Y last Tuesday?"

The UI is designed in that order: **Operator's needs decide the front page. Steerer's verbs decide the interactive surface. Investigator's tools live one click away.**

## What the UI is NOT

- **Not a chat interface.** Telegram is chat. Agents talk to each other, not to me. The UI's only "send" verbs are *steering* verbs (comment, threshold-change, cancel), not "have a conversation."
- **Not a configuration panel.** Agents are configured by markdown files (`agent.json`, `context.md`, `cron.json`). Editing those in a web form is the wrong abstraction — I edit them in my IDE.
- **Not a terminal.** If I'm running commands, I'm debugging, not operating. The UI is for operating.
- **Not a re-implementation of the bus or DB.** It's a window onto them.

## The primary object is the metric

V1 thinking: the dashboard shows *agents* and what they did. Sessions are central; metrics are a tab.

V2 thinking: **metrics are central; sessions are a side-effect.** A session exists because a metric breached or a heartbeat fired. The first thing the UI shows is metrics, in their natural state, grouped by ownership.

This is not cosmetic. It changes navigation:

- Front page = **metric grid** (current value, target, threshold, status, sparkline).
- Metric click = **breach history + sessions spawned by this metric + recent events**.
- From a session detail, "what metric caused this?" is one click back.

The UI's information architecture mirrors the system's causality: **metric → handler → session → output → metric updates**.

## Causality is the headline feature

A metric breached. An agent was forked. It ran a session. The session produced output (or failed). The metric recovered (or didn't).

That chain is what the UI should make trivial to follow. Today's UI doesn't, because it shows each link as an isolated table row. The new UI shows the chain.

Concretely, on a metric detail view:

```
metric: handler.success-rate  (gauge, owner=optimizer)
current: 0.78  target: 0.95  threshold: 0.80  ⚠️ breach (since 14:22)

[ sparkline showing last 7d ]

Breach history (last 30d):
  2026-05-06 14:22 → fork(optimizer)  → s_177… → status=running
  2026-05-04 09:11 → fork(optimizer)  → s_177… → status=done    (recovered 09:48)
  2026-05-01 22:00 → fork(optimizer)  → s_177… → status=done    (no recovery → dedup'd)

Recent events targeting this metric:
  14:22  metric.breach   value=0.78
  14:22  session.start   optimizer  s_177…  task="metric-alert: handler.success-rate"
  14:22  message.created may → optimizer  P1
```

Each row is clickable. Each click stays on the same page (panel updates), so the investigator never loses context.

## The four screens

That's all there are. Four screens, one URL each, deep-linkable.

### 1. `/` — Operator view (the front page)

Answers "is it working?" in one screen, no clicks.

```
─────────────────────────────────────────────────────────────────────
  may-agent              [● healthy]    13 agents · 4 active now
─────────────────────────────────────────────────────────────────────

  METRICS                                              [breaches: 1]

  ⚠️ handler.success-rate     0.78 / 0.95 ▼  optimizer  ▁▂▃▅█▇▅
  ✓ session.error-rate-6h     0.07 / 0.10    may        ▃▃▂▁▁▁▂
  ✓ system.real-output-24h    508  / 100     may        ▅▆▇▇▇█▇
  ✓ project.active-count      1    / 1       may        ▁▁▁▂▁▁▁
  …  (collapsed: 10 healthy metrics, click to expand)

  RIGHT NOW                                          [4 sessions]

  optimizer  s_177…  metric-alert: handler.success-rate     2m ago
  may        s_177…  heartbeat                              just now
  evaluator  s_177…  evaluate session s_177…                40s ago
  arc        s_177…  research: feedback-loop-design         6m ago

  RECENT EVENTS                                  [last 1h: 142 events]

  14:24  message.created   may → optimizer  P1
  14:22  metric.breach     handler.success-rate  value=0.78
  14:18  session.end       evaluator  done       opCount=12
  …  (live stream, scroll for more)
─────────────────────────────────────────────────────────────────────
```

This is the entire operator experience. **One screen. Three panels. No tabs.**

- **Top bar** — system health summary. Green if no metrics in breach. Red with count if any are. Number of agents loaded vs. active.
- **METRICS panel** — every metric, breaches first, then healthy collapsed. Sparkline gives trend at a glance. Click a metric → screen 3.
- **RIGHT NOW panel** — every session in `running` or `idle` state. Click a session → screen 4.
- **RECENT EVENTS panel** — live event firehose, filtered to "interesting" events (`metric.breach`, `session.start/end`, `message.created`, `project.comment`, `handler.failed`). Updated via `/ws`.

Live updates: the whole page is reactive to bus events. A `metric.breach` event flips a metric to red and bumps the breach count. A `session.start` adds to RIGHT NOW. A `session.end` removes it. The page never reloads.

### 2. `/agents` — Multi-agent shape

For the multi-agent dimension. Answers "who is doing what, and how often?"

Not a list. A **grid** organized by ownership and recent activity:

```
                last 24h    queue   running    failures (24h)
  may              42         3         1            0
  optimizer        18         1         1            0
  evaluator       155         0         1            2
  arc               6         0         1            0
  scout             3         0         0            0
  …
```

Click an agent → screen 5 (agent detail).

This screen exists for "is the multi-agent system *balanced*?" — am I leaning too hard on one agent, is one agent silent, etc. It's the *only* screen where agents are the primary object.

### 3. `/metrics/:id` — Metric detail (causality view)

The view I sketched above. Sparkline + breach history + sessions-spawned + recent events, all for one metric.

**Steering verbs available here:**
- "Adjust threshold" — opens a modal, edits the metric registry. *(See "Steering surface" below.)*
- "Resolve alert" — marks the current breach resolved without re-firing.
- "Comment to owner" — posts a `project.comment` event targeted at the metric's owning agent.

### 4. `/sessions/:id` — Session detail (investigator)

For the investigator. Shows:

- Session metadata (agent, task, status, kind, duration, opCount, parent/children).
- The metric breach that caused it (if any).
- The full transcript (collapsible, lazy-loaded).
- Sibling sessions in the same workflow.
- Outgoing messages and outgoing project edits.

**Steering verbs:**
- "Cancel" — if `status=running`.
- "Resume" — if `status=interrupted`.
- "Send message to this agent" — opens compose, posts a `message.created` event targeted at the session's agent (next-heartbeat delivery).

Plus a fifth, secondary screen:

### 5. `/agents/:name` — Agent detail

Reachable from `/agents` and from any session. Shows:

- Recent sessions (timeline view).
- Inbox (pending messages).
- Active projects.
- Knowledge directory listing (markdown browser).

This is the deep-dive screen. It collapses what today's UI calls "agent activity," "agent timeline," "agent detail," and parts of "knowledge" into one place organized by *agent* rather than by *resource type*.

That's all five screens. There is no "events" tab, no "benchmarks" tab, no "knowledge" tab as top-level navigation. Events stream live on the front page. Knowledge is reachable via agent detail. Benchmarks are deleted.

## The steering surface

The human's verbs, complete list:

| Verb | Where | Mechanism |
|---|---|---|
| **Comment on a project** | `/metrics/:id`, `/sessions/:id`, `/agents/:name`, project detail | POST → emits `project.comment` event |
| **Send a message to an agent** | `/sessions/:id`, `/agents/:name` | POST → emits `message.created` event with `from: "human"` |
| **Cancel a session** | `/sessions/:id` (when running) | WebSocket command `cancel` |
| **Resume an interrupted session** | `/sessions/:id` (when interrupted) | WebSocket command `resume` |
| **Adjust a metric threshold** | `/metrics/:id` | POST → updates `metrics.threshold`, emits `metric.config-changed` event |
| **Resolve a metric alert** | `/metrics/:id` (when in breach) | POST → updates `metric_alerts`, emits `metric.alert-resolved` |
| **Mark a project closed** | project detail | POST → emits `project.closed` event |
| **Trigger a heartbeat** | `/agents/:name` | WebSocket command `emit heartbeat` |

Five rules for the steering surface:

1. **Every verb is an event.** Steering is just emitting events the agents would emit themselves. The human is "another agent" with extra privileges. No special API.
2. **No verb mutates agent state directly.** Cancelling a session emits a cancel command; the manager processes it. The UI doesn't reach into manager internals.
3. **Verbs are async.** Click "send message" → see the event in the live feed → wait for the agent to act on it next heartbeat. The UI doesn't pretend the agent responds immediately.
4. **Confirmation only for destructive verbs.** Cancel a session: confirm. Comment on a project: just send. Trust the human.
5. **No verb requires a form with five fields.** The most complex verb is "comment on project" — that's a textarea + submit. If a verb needs more, it's not a UI verb; it's a config change for the IDE.

## Live vs. historical: the two data planes

V2's "UI = bus subscriber" rule applies to **live updates**. For **historical state** (the last 7 days of metric values, the breach history, the agent timeline), the UI reads SQLite directly. Both are correct, both are needed.

### Plane A — Live (1 endpoint)

`/ws` proxies the running may-agent's Unix socket. Browser receives `session.start`, `session.end`, `message.created`, `metric.breach`, `metric.recovered`, `handler.started`, `handler.completed`, `handler.failed`, `project.comment`, etc.

**Rule**: if a screen needs to react to a state change *while the user is looking at it*, it watches `/ws`. No polling. No 30-second refresh timers. The websocket is the source of truth for "now."

### Plane B — Historical SQL (read-only)

Endpoints exist only for queries the live event stream cannot answer:

| Path | Tables | Used by |
|---|---|---|
| `/api/metrics` | `metrics` | screen 1, 3 (initial load) |
| `/api/metrics/:id` | `metrics`, `metric_snapshots`, `metric_alerts`, `events` | screen 3 |
| `/api/sessions/:id` | `sessions` (recursive), `events` | screen 4 |
| `/api/sessions/:id/transcript` | `.state/sessions/<id>/session.jsonl` | screen 4 |
| `/api/agents` | `sessions`, `events` aggregates | screen 2 |
| `/api/agents/:name` | `sessions`, project files, message events | screen 5 |
| `/api/events` | `events` | screen 1 (initial load), investigator queries |

**Rule**: every endpoint queries one table or one filesystem path. No business logic. No derived views. If the UI wants a derived view, it derives it client-side from base queries. Read-only — no mutations through this plane.

### Plane C — Steering verbs (POST → bus)

The seven steering POST endpoints (`/api/comment`, `/api/message`, `/api/threshold`, `/api/alert/resolve`, `/api/project/close`, `/api/cancel`, `/api/heartbeat`).

**Rule**: each endpoint validates input, then emits exactly one event to the bus. The handler that picks up the event does the work — same as if an agent emitted it. No special privileges. The endpoint is just a thin authenticated event-emitter.

That's the whole back-end surface. ~10 query endpoints + 7 verb endpoints + `/ws` + static files.

## What gets removed

Endpoints that fit no plane:

| Path | Why |
|---|---|
| `/api/requests` | Returns hardcoded empty stub. Table deleted in v0.2. |
| `/api/benchmarks*` (3 endpoints) | `gym_runs` table is empty. Subsystem unused. |
| `/api/digest` | Daily-digest tab adds no operator value. Delete tab + endpoint. (Recover via `cat agents/shared/daily-digests/*.md` if anyone misses it.) |
| `/api/browse` | Knowledge tree at top level. Move under `/agents/:name`. |

Front-end equivalents (Benchmarks tab, Knowledge tab, Digest panel) deleted alongside.

## Failure modes

- **may-agent process is down** — `/ws` fails to upgrade. The UI shows "agent disconnected" in the top bar but continues to serve historical SQL views. The user can still investigate the recent past.
- **SQLite is locked** — read endpoints return 500. The UI treats this as transient, retries on user action. Live updates continue to flow over `/ws` (different file mode).
- **Filesystem path missing** — endpoints return `[]` or `{}` with 200. The UI shows empty-state ("no projects yet"), not an error.
- **Browser loses websocket** — auto-reconnect with backoff. On reconnect, the UI re-fetches the metric and sessions panels (since it missed events while disconnected). This is the *only* time the UI does a "refresh."

## Why this is v2-shaped

- **Metrics first** — the system is metric-driven; the UI is metric-driven.
- **Causality visible** — the chain `metric.breach → fork → session → output → recovery` is what the system is about, and the UI shows it as a chain.
- **One screen for the operator** — autonomous systems should be operable in 5 seconds. A 6-tab dashboard is for v1's "manage agents manually" mindset.
- **Steering = events** — verbs emit the same events agents emit. The human is a participant in the bus, not a controller standing outside it.
- **Live + historical, no polling** — Plane A for now, Plane B for the past, never confused.

## Out of scope

- **Authentication.** Local-only by deployment.
- **Mobile layout.** The dashboard is a desktop tool. Mobile is Telegram.
- **Editing markdown in the UI.** That's an IDE job. The UI shows projects; my editor edits them.
- **Multi-tenant / multi-instance.** One may-agent per dashboard.
- **Replacing Bun's built-in `serve`.** It's enough.

## Open questions

1. **Should `/agents/:name` (screen 5) be merged into `/agents` (screen 2) as a master-detail layout?** Probably yes; that drops to four screens total.
2. **Threshold adjustment via UI:** does it write back to `agents/may/handlers/metrics-snapshot.ts` (the source of truth) or only to the DB? The DB is mutable; the source file is canonical. If they drift, who wins? Suggested rule: UI writes to DB only; the registry on next snapshot reconciles. Manual edits to the file are the canonical override.
3. **Project comments are events; project files are filesystem.** Should the agent's response to a comment be visible inline on the project detail screen, or only via the agent's session that picked it up? Inline = better UX; one more cross-link to maintain.
4. **Live event filtering.** The front page's RECENT EVENTS panel filters to "interesting" events. Who decides what's interesting? Suggest: hardcoded list for v1 of this UI, expose user-configurable filter later if it matters.
5. **WebSocket replay-on-connect.** When the browser reconnects, should the server replay the last N events? Currently the UI re-fetches. Replay would be cleaner but more code. Defer.

## Migration steps (if approved)

The current `web.ts` is mostly v2-shaped. The work is structural, not architectural:

1. **Delete dead endpoints** (`/api/requests`, 3× `/api/benchmarks*`, `/api/digest`). ~200 LOC.
2. **Add the 7 steering POST endpoints**. ~150 LOC. Each is 15 lines: validate, emit event, return ok.
3. **Replace `index.html` with the four-screen layout.** This is a front-end rewrite. Same SQL endpoints; new IA. Largest piece of work.
4. **Make the front page reactive to `/ws` instead of polling.** Currently the dashboard polls `/api/agents/activity` etc. on a timer. Replace with bus subscription.
5. **Fold knowledge browser into `/agents/:name`.** Delete the top-level Knowledge tab.

Order: 1, 2, 4, 5, 3. (3 is the long one; do it last with the back-end stable.)

No rewrite of `web.ts` itself. Same Bun.serve, same SQLite reads, same Unix socket proxy. The architecture is fine; the UX is wrong.
