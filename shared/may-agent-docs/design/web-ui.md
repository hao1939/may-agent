# may-agent Web UI Design

## What this is for

A lightweight web interface for may-agent. Not a replacement for the terminal — a companion for reviewing request history, browsing session trees, and optionally chatting with the agent from a browser.

## Architecture

**Standalone process.** The web UI is a separate process that reads the agent's state directory. No coupling to the agent process — it reads files the agent writes. That's the interface.

```
Browser ──HTTP/WS──→ Web Server
                        │
                        ├── SQLite (read) ──→ .state/may.db
                        ├── Files (read) ──→ .state/sessions/*/session.jsonl
                        └── Unix Socket (proxy) ──→ .state/instances/*/may.sock
```

Run it wherever:
- On the k3s pod as a sidecar (same PVC, dashboard + chat)
- On your laptop pointing at a local `.state/` (dashboard + chat if socket exists)
- On any machine with a copy of `may.db` (dashboard only, no chat)

**No build step.** Single TypeScript entry point + single HTML file. No React, no bundler, no npm dependencies beyond what may-agent already has (Bun built-in HTTP server).

## Usage

```bash
# Local — dashboard + chat (if agent is running locally)
bun src/app/ui/web.ts --state-dir .state --port 8080

# Sidecar — dashboard + chat (same PVC)
bun src/app/ui/web.ts --state-dir /app/.state --port 8080

# Remote — dashboard only (copy may.db, no socket access)
bun src/app/ui/web.ts --state-dir /path/to/state --port 8080
```

## What it does

### Dashboard (read-only)

- **Request list** — most recent first, filterable by source/status/agent
- **Session tree** — click a request to see the delegation chain
- **Transcript viewer** — click a session to see tool calls, reasoning, outcome
- **Stats** — agent workload, completion rates

### Chat (optional, requires Unix socket)

- Text input → `input` command via Unix socket proxy
- Streamed response (text, tool calls, tool results)
- Same as typing in terminal or Telegram

## API

### `GET /api/requests?from=&status=&limit=20&offset=0`

Query requests table. Returns JSON array with pagination.

### `GET /api/sessions/:id`

Session metadata + recursive child tree from sessions table.

### `GET /api/sessions/:id/transcript`

Parsed session.jsonl — messages, tool calls, tool results.

### `GET /api/stats`

Aggregate stats from sessions + requests tables.

### `WebSocket /ws`

Proxies to the agent's Unix socket. Same JSON-line protocol.
Only available when the socket file exists and the agent is running.

## What it does NOT do

- No agent config editing
- No cancel/steer buttons (v1)
- No auth (private network assumed)
- No real-time activity feed (show outcomes, not process)
