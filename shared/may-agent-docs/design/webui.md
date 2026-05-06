# Design: Web UI

**Status**: review
**Date**: 2026-05-06
**Aligned with**: `proposals/v2-architecture.md`

## What v2 says about UI

From `v2-architecture.md`:

> **"UI backends are just event bus subscribers."**
>
> ```ts
> bus.onAny((e) => socketServer.broadcast(e));   // WebSocket → web UI
> bus.onAny((e) => telegramNotifier.handle(e));  // Telegram alerts
> bus.onAny((e) => consoleRenderer.render(e));   // Console output
> ```

And on storage:

> **"SQLite (single queryable store): metrics │ metric_snapshots │ sessions │ events │ messages."**

The proposal gives one rule for live updates (subscribe to bus) and one rule for state (read SQLite). It does not address historical views or agent-authored artifacts (project files, daily digests, session transcripts), which are also part of what the dashboard shows in practice.

This doc fills that gap.

## Two data planes

The Web UI has exactly two data planes. Every endpoint must belong to one of them.

### Plane A — Live updates: bus subscriber

The browser opens a single WebSocket to `/ws`. The server proxies it to the running may-agent's Unix socket. Every event emitted on the bus is forwarded to every connected browser as a JSON line.

This is the v2 path. The browser receives `session.start`, `session.end`, `message.created`, `metric.breach`, `handler.started`, `handler.completed`, etc. — the full event firehose.

There is no other live channel. Server-Sent Events, polling, "refresh" buttons — none of it. If the UI needs to react to a state change, it watches the bus.

### Plane B — Historical state: SQL reads

REST endpoints exist *only* for queries that the live event stream cannot answer:

- "What were the last 7 days of metric values?" — bus only carries the last hour.
- "Show me agent activity timeline since yesterday." — same.
- "Open a session detail view from a permalink." — the live stream missed it.

These endpoints read directly from the SQLite tables v2 names (`metrics`, `metric_snapshots`, `sessions`, `events`, `messages`) and return JSON. They are **read-only**. They do not mutate state. State changes go through the agents (via the bus, via the message tool, via tool calls) — never through the Web UI's REST surface.

## The exception: filesystem reads

Some artifacts agents produce are markdown files, not SQL rows. Specifically:

- **Projects** — `agents/<name>/workspace/projects/<project>/{project.md,journal.md,discussion.md}`
- **Daily digests** — `agents/shared/daily-digests/YYYY-MM-DD.md`
- **Session transcripts** — `.state/sessions/<id>/session.jsonl`

Agents author these with the same coding tools they use for everything else (`read`, `edit`, `write`). Putting them in SQL would mean either:

1. A new tool surface (`createProject`, `appendJournal`, ...) that duplicates what `edit` already does, OR
2. A filesystem-backed virtual table.

Both are worse than the status quo. Agents already write markdown fluently; the file *is* the source of truth.

The Web UI exposes these via dedicated endpoints (`/api/projects/*`, `/api/digest`, `/api/sessions/:id/transcript`) that read the filesystem and return JSON. **These endpoints are read-only and append-only at most.** No general-purpose write API.

This is not in the v2 doc. It should be — it's the actual shape of the system.

## Endpoint inventory (after cleanup)

### Plane A — Live (1 endpoint)

| Path | Mechanism | Purpose |
|---|---|---|
| `/ws` | WebSocket → Unix socket proxy | Bus event firehose |

### Plane B — Historical SQL (10 endpoints)

| Path | Tables | Purpose |
|---|---|---|
| `/api/stats` | `sessions` | Aggregate counts for header |
| `/api/agents/activity` | `sessions` | Per-agent run counts |
| `/api/agents/timeline` | `sessions` | Time-windowed agent activity |
| `/api/agents/health` | `sessions`, `events` | Handler success rates |
| `/api/agents/:name/detail` | `sessions` | Per-agent drilldown |
| `/api/sessions/:id` | `sessions` (recursive children) | Session tree view |
| `/api/metrics` | `metrics` | Current metric values + status |
| `/api/metrics/:id/history` | `metric_snapshots` | Metric chart data |
| `/api/events` | `events` | Audit log query |
| `/api/projects/comment` (POST) | `events` | Agent-targeted comment as event |

### Plane C — Filesystem (4 endpoints)

| Path | Reads | Purpose |
|---|---|---|
| `/api/projects` | `agents/*/workspace/projects/` | Project list |
| `/api/projects/content` | one project file | Project detail |
| `/api/projects/journal` | journal.md | Project journal |
| `/api/projects/discussion` | discussion.md | Project discussion |
| `/api/projects/sessions` | sessions table + project metadata | Sessions for a project |
| `/api/digest` | `daily-digests/*.md` | Daily summary |
| `/api/browse` | filesystem walk | Knowledge tree |
| `/api/sessions/:id/transcript` | `.state/sessions/<id>/session.jsonl` | Raw transcript |

### Static (1 endpoint)

| Path | Purpose |
|---|---|
| `/`, `/index.html`, `/static/*` | The dashboard SPA |

**Total: 22 endpoints across 4 categories.** Each category has a clear rule for whether it belongs there.

## What gets removed

The current implementation has endpoints that fit none of the planes. They are removed:

| Path | Why removed |
|---|---|
| `/api/requests` | Returns hardcoded `{rows:[], total:0}`. The `requests` table was deleted in v0.2. |
| `/api/benchmarks` | Reads `gym_runs` table — empty (0 rows). Benchmark subsystem is not part of v2. |
| `/api/benchmarks/prompts` | Reads `prompt_logs` table — does not exist. |
| `/api/benchmarks/compare` | Same as above. |

The `<div id="benchmarks">` tab in `index.html` and its associated JS is removed alongside.

## What does NOT get removed (but feels v1-shaped)

A few endpoints look ad-hoc but earn their keep:

- **`/api/projects/comment`** writes a row to the `events` table (`type: "project.comment"`). This is the only POST endpoint outside of `/ws`. It is justified because it lets a human post a comment from the dashboard without typing in chat — the comment becomes a regular event the targeted agent receives in its next heartbeat. Same pattern as a reply on Telegram.

- **`/api/browse`** reads the knowledge tree. This is unambiguously a filesystem view tool, parallel to `/api/projects/*`. Keep.

## Constraints on the WebSocket channel

The `/ws` channel proxies the *Unix socket*, not the bus directly. This indirection exists because:

1. The webui process and the may-agent process are separate (different ports, different lifetimes).
2. Multiple webui processes can connect to one may-agent.
3. The Unix socket already implements the subscribe/filter protocol (firehose, chat-mode, per-session filter).

The proxy adds nothing; it forwards JSONL lines verbatim. If the webui were merged into may-agent's process, the proxy could be replaced with a direct `bus.subscribe()`. Right now, the indirection is the cost of being able to run them apart.

## Constraints on the REST plane

Three rules:

1. **Read-only.** No `POST`, `PUT`, `DELETE` except `/api/projects/comment` (which writes to `events`, not to mutable state).
2. **Source-of-truth queries.** Each endpoint queries one table or one filesystem path. No business logic. If the UI wants a derived view, it derives it client-side from base queries.
3. **No replacement for the bus.** If the UI needs to know *when something changed*, it watches `/ws`. It does not poll the REST plane on a timer.

## Failure modes

- **may-agent is down.** `/ws` fails to upgrade or returns an error event. The dashboard displays "agent disconnected" and continues serving historical SQL views (the SQLite file is independent of the may-agent process). This is correct: the user can investigate the recent past even when the system is down.

- **SQLite is locked.** Read endpoints return 500. We do not retry server-side. The dashboard treats this as a transient error and re-tries on user action.

- **Filesystem path missing.** Filesystem endpoints return `{}` or `[]` with 200 status. The dashboard shows an empty-state UI ("no projects yet") rather than an error.

## Why this shape

- **One rule per plane.** A new endpoint is either bus subscriber, SQL read, or filesystem read. If it doesn't fit, it doesn't ship.
- **No polling.** The browser does not loop on a timer. Live changes come over `/ws`. Historical fetches happen on navigation only.
- **No state mutation API.** The UI is a window onto agent-driven state. Mutations happen via `/ws` (commands proxied to the agent) or via the agent's own tool calls — never via REST.
- **Honest about the filesystem.** v2's "single queryable store" is aspirational; agent-authored markdown is filesystem-native and that's fine. The doc says so explicitly so future contributors don't try to "fix" it by inventing a project-table.

## Open questions

1. **Should `/api/events` paginate or stream?** Currently it limits to N rows. For long audit queries we may want a server-side cursor or merge it into `/ws` with a replay command.

2. **Should historical metric snapshots be downsampled at query time?** `/api/metrics/:id/history` for 14 days returns every snapshot. Eventually we'll want server-side downsampling.

3. **Do we want the `/api/browse` knowledge tree at all?** Agents read knowledge files via `read` tool. The dashboard view is for humans browsing what agents have written. If humans never use it, delete.

4. **Should the websocket carry historical state on connect?** Right now the Unix socket sends a `connected` welcome with active agent list. We could extend this to "last N events" for late-joining clients. Probably not worth it — the dashboard already does this via SQL on load.

## Migration steps (if approved)

1. Delete `handleRequests`, `handleBenchmarks`, `handleBenchmarkPrompts`, `handleBenchmarkCompare` from `src/app/ui/web.ts` (~200 LOC).
2. Remove `<div id="benchmarks">` and associated JS from `index.html`.
3. Remove the `Benchmarks` tab from the navigation.
4. Add the data-plane comment block at the top of `web.ts` that codifies the three rules.
5. No other functional changes. The current architecture is otherwise correct.

## Out of scope

- Replacing `web.ts` with a different framework. Bun's built-in `serve` is fine.
- A separate authentication layer. The dashboard is local-only by deployment.
- Real-time collaborative editing. The dashboard is read-mostly; mutations are agent-driven.
