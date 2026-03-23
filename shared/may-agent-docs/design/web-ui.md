# may-agent Web UI Design

## What this is for

A lightweight web interface for may-agent. Not a replacement for the terminal — a companion for situations where you want to check on the system from a phone, share a link with someone, or review request history without SSH.

## What it should do

### 1. Request & Session Dashboard (read-only)

The primary use case. Query the `requests` and `sessions` tables we just built.

**Requests view:**
- List requests, most recent first
- Filter by `fromEntity` (human, cron, agent name), `status`, `source`, date range
- Each request shows: task (truncated), status badge, agent, source, duration, summary/outcome
- Click to expand: full task text, linked session tree, evaluation scores if available

**Session tree view:**
- Given a sessionId (from clicking a request), show the full delegation tree
- Each node: agent, status, duration, outcome snippet
- Expandable to show the session transcript (tool calls, agent reasoning)

This is pure read — queries SQLite, renders HTML. No websocket needed.

### 2. Talk to the system (interactive)

Send messages to may-agent, see responses in real-time.

**What this means technically:**
- WebSocket connection to a bridge that proxies the Unix socket protocol
- Send `input` commands (same as typing in terminal or Telegram)
- Receive streamed `text`, `tool_call`, `tool_result` events
- `@agent` prefix for direct agent invocation works (same as terminal)

**What we should NOT replicate from pi's TUI:**
- No local file system access (we're not a coding agent IDE)
- No terminal emulation (no cursor positioning, no ink rendering)
- No multi-panel layout (sessions panel, chat panel, tools panel)
- No keybinding system
- No extension/theme system

**What we should take from pi's approach:**
- Streaming text rendering (markdown)
- Tool call/result collapsible blocks
- Clean separation of agent output vs system messages
- Simple, fast, minimal

### 3. What it should NOT do

- **No agent configuration UI.** Agent configs are files (`agent.json`, `cron.json`, `heartbeat.md`). Editing them via web is fragile and unnecessary — use git.
- **No session management UI.** No cancel/steer buttons in v1. Those are power-user operations that are easy to misuse. Use terminal or Telegram.
- **No real-time activity dashboard.** The cron system, heartbeats, and agent activity are high-volume noise. The request/session query is the right abstraction — show outcomes, not process.
- **No authentication in v1.** It runs on a private cluster, accessed via port-forward or internal ingress. Authentication adds complexity for zero users. Add it when there's a need.

## Architecture

```
Browser ──HTTP──→ Web Server ──SQLite──→ may.db (read-only queries)
                      │
                      └──WebSocket──→ Unix Socket ──→ may-agent process
                                      (proxy for interactive chat)
```

### Server

A single HTTP server (Bun.serve or Node http) running inside the may-agent container, started alongside the agent process. Serves:

- `GET /` — Static HTML/CSS/JS (single page app, no build step)
- `GET /api/requests` — Query requests table (JSON)
- `GET /api/sessions/:id` — Session metadata + child tree (JSON)
- `GET /api/sessions/:id/transcript` — Session transcript from JSONL (JSON)
- `GET /api/stats` — Agent workload summary (JSON)
- `WebSocket /ws` — Proxied connection to the Unix socket

### Frontend

Single HTML file with inline CSS and minimal JS. No React, no build step, no npm dependencies. Renders with the browser's native APIs. Think: the `scripts/log-viewer.html` that already exists but for requests/sessions.

Two tabs:
1. **Dashboard** — request list, click to drill into session trees
2. **Chat** — text input, streaming output, like a basic chat interface

### Deployment

- New `--web` flag on the binary (like `--socket`, `--telegram`, `--console`)
- Listens on a configurable port (default 8080)
- Helm chart exposes the port via Service, optional Ingress
- Container already has Xvfb/Chrome on 6080 — web UI would be a separate port

## API Design

### `GET /api/requests?from=human&status=COMPLETED&limit=20&offset=0`

```json
{
  "requests": [
    {
      "requestId": "abc123",
      "fromEntity": "human",
      "toAgent": "may",
      "method": "chat",
      "source": "telegram",
      "task": "ask someone to investigate our tool system...",
      "status": "COMPLETED",
      "summary": "Dispatched to bob and tech-lead. Dynamic tool loading designed.",
      "sessionId": "s_1773945938972_38",
      "createdAt": 1773945938000,
      "completedAt": 1773948003000,
      "durationMs": 2065000
    }
  ],
  "total": 23,
  "limit": 20,
  "offset": 0
}
```

### `GET /api/sessions/s_1773945938972_38`

Returns the session metadata + child tree:

```json
{
  "session": {
    "sessionId": "s_1773945938972_38",
    "agent": "may",
    "task": "ask someone to investigate our tool system...",
    "status": "done",
    "kind": "chat",
    "outcome": "Dispatched to bob and tech-lead.",
    "startedAt": 1773945938972,
    "endedAt": 1773948003719,
    "opCount": 17
  },
  "children": [
    {
      "sessionId": "s_1773945990107_40",
      "agent": "bob",
      "task": "Research Task: Dynamic Agent Tools...",
      "status": "done",
      "outcome": "Design brief written to workspace/dynamic-tools-design.md",
      "startedAt": 1773945990108,
      "endedAt": 1773946061117,
      "children": []
    }
  ]
}
```

### `GET /api/sessions/s_1773945938972_38/transcript`

Returns parsed session.jsonl as structured messages:

```json
{
  "messages": [
    { "role": "user", "text": "ask someone to investigate..." },
    { "role": "assistant", "text": "I'll delegate this to bob..." },
    { "role": "tool_call", "tool": "agents", "args": {"action": "call", "agent": "bob"} },
    { "role": "tool_result", "tool": "agents", "content": "Bob completed: ..." },
    { "role": "assistant", "text": "Bob has written a design brief..." }
  ]
}
```

### `GET /api/stats`

```json
{
  "last24h": {
    "totalSessions": 279,
    "byAgent": { "coder": 107, "coach": 40, "optimizer": 38, ... },
    "humanRequests": 2,
    "completionRate": 0.97
  },
  "last7d": {
    "totalSessions": 1200,
    "humanRequests": 23,
    "avgDurationMs": 45000
  }
}
```

### `WebSocket /ws`

Bidirectional JSON-line protocol, same as the Unix socket but over WebSocket:

```
→ {"type": "input", "message": "what are agents working on?"}
← {"type": "text", "agent": "may", "text": "Let me check..."}
← {"type": "tool_call", "agent": "may", "tool": "agents", "args": {...}}
← {"type": "tool_result", "agent": "may", "tool": "agents", "preview": "..."}
← {"type": "text", "agent": "may", "text": "Here's what's happening..."}
← {"type": "prompt", "message": "may"}
```

The server proxies between WebSocket and Unix socket. No translation — same events, same commands.

## What I'm NOT sure about

**Should we show live running sessions?** The dashboard could show currently-running sessions with real-time progress. But this is noisy (agents run 200+ sessions/day) and the use case is unclear. The request view already shows outcomes. Live monitoring feels like an operator tool, not a user tool. Defer to v2 if needed.

**Should transcripts be searchable?** Full-text search across session transcripts would be powerful for "when did I ask about X?" queries. But session.jsonl files are large (30-300KB each) and FTS requires indexing. Defer — `grep` on the server works for now.

**Should the chat UI have session history?** Pi's TUI shows previous messages in the current session. The may-agent chat session is persistent (autoClose: "never"), so there IS history. But loading 50+ turns of a persistent session into a web UI is heavy. Maybe show last N messages on connect, with a "load more" button.

## Implementation plan

1. **API server** (`src/app/ui/web.ts`) — Bun.serve HTTP + WebSocket, SQLite queries, Unix socket proxy. ~300 lines.
2. **Frontend** (`src/app/ui/web-static/index.html`) — Single HTML file, inline CSS/JS. Dashboard tab + Chat tab. ~500 lines.
3. **Wire into may.ts** — `--web` flag, `attachWebUI(opts)` called alongside socket/telegram/console.
4. **Helm chart** — Add web port to Service, optional Ingress in values.
