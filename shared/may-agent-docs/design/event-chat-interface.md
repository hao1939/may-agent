# Unified UI Architecture

## The problem

may-agent has four UIs (console, telegram, socket, web) that each solve the same problem differently: accept human input, show the agent's response, optionally show system activity. They're wired inconsistently:

| | Reads events from | Sends input via | Filters events | Runs in |
|---|---|---|---|---|
| **Console** | `bus.on()` | readline → `handleInput()` | dim activity | Agent process |
| **Telegram** | `bus.on()` | poll → `bus.command()` | drop non-chat | Agent process |
| **Socket** | `bus.on()` | client → `bus.command()` | no filter (firehose) | Agent process |
| **Web UI** | Unix socket proxy | WebSocket → Unix socket | proxy filters chat | Separate process |

The web UI is a proxy of the socket which is a listener on the bus. Two hops. Four different filtering strategies. Input routing goes through different paths.

## Observation

Every UI does three things:
1. **Show conversation** — the interface agent's chat-channel events (text, tool calls, results)
2. **Accept input** — human types something, it reaches `handleInput()`
3. **Optionally show activity** — background agent work, cron, system info

The difference between UIs is only the transport and rendering:
- Console: stdin/stdout, ANSI formatting
- Telegram: HTTP polling/push, Markdown
- Web: WebSocket, HTML
- Socket: Unix domain socket, JSON lines (raw debug, not really a "UI")

## Design

### Separate concerns: transport vs presentation vs protocol

**Protocol** (shared): What events to show for conversation, what events to show for activity, how input flows. This is the same for all UIs.

**Transport** (per-UI): How events reach the client (stdout, HTTP, WebSocket, Unix socket). How input arrives (readline, Telegram poll, WebSocket message, socket line).

**Presentation** (per-UI): How to render text (ANSI, Markdown, HTML). How to render tool calls. How to handle streaming.

### The event channel is the protocol layer

Already exists: `channel: "chat"` vs `channel: "activity"`. This is the right abstraction. The problem is each UI implements its own interpretation.

Formalize it:

```typescript
/** What a chat-focused UI should show. */
function isChatEvent(event: RunnerEvent): boolean {
  return eventChannel(event) === "chat";
}

/** What a monitoring UI should show (everything). */
function isVisibleEvent(event: RunnerEvent): boolean {
  return true;
}
```

Every UI picks one filter. Chat UIs (telegram, web chat) use `isChatEvent`. Monitor UIs (console, socket) show everything.

### Input is already unified

All input paths converge to `bus.command({ type: "input", message, source })` → `handleInput()` → `chatSession.handleInput()`. Telegram does this. Socket does this. The web UI does this through the socket proxy, but it could do it directly.

The `source` field tracks where input came from. Add it consistently:
- `source: "console"` — terminal readline
- `source: "telegram"` — Telegram bot
- `source: "web"` — Web UI
- `source: "socket"` — Raw socket client (socat, programmatic)

### The socket is NOT a UI

Stop treating the socket as a UI channel. It's a **control interface** — for programmatic access, debugging, and cross-process communication (detached agents, socket_watch). It broadcasts everything by design. It should not be the path for human interaction.

The web UI should NOT proxy through the socket. It should connect to the EventBus directly (in-process) or talk to a lightweight HTTP API (out-of-process).

### Two modes for the web UI

**In-process** (`--web` flag): `attachWebUI(bus, opts)` — same pattern as console/telegram. Listens on bus, filters chat events, serves WebSocket to browser. Best experience, zero latency.

**Standalone** (`bun web.ts --state-dir .state`): Dashboard-only (SQLite queries). No chat. If you want chat, use the in-process mode. The standalone dashboard is useful for read-only review from any machine.

This eliminates the socket proxy entirely. The web UI is either a proper bus listener (in-process) or a database reader (standalone). Clean.

## Implementation plan

### Phase 1: Extract shared event filter

Add to `event-bus.ts`:

```typescript
/** Events that belong to the human conversation (for chat UIs). */
export function isChatEvent(event: RunnerEvent): boolean {
  return eventChannel(event) === "chat";
}
```

Update telegram to use `isChatEvent()` instead of inline checks.

### Phase 2: attachWebUI (in-process)

New file `src/app/ui/web.ts` (rewrite current file):

```typescript
export function attachWebUI(opts: {
  bus: EventBus;
  manager: SubagentManager;
  persistDir: string;
  interfaceAgent: string;
  port: number;
}): { close: () => void } {
  // HTTP server for dashboard API (same endpoints as current web.ts)
  // WebSocket handler: bus.on() for events → filter isChatEvent → ws.send()
  // WebSocket handler: ws.onmessage → bus.command({ type: "input", source: "web" })
}
```

Wire in `may.ts`:
```typescript
const WEB_ENABLED = process.argv.includes("--web");
const WEB_PORT = parseInt(getArg("--web-port", "8080"));
if (WEB_ENABLED) {
  attachWebUI({ bus, manager, persistDir: PERSIST_DIR, interfaceAgent, port: WEB_PORT });
}
```

### Phase 3: Standalone dashboard (simplified)

Strip chat from standalone `web.ts`. It becomes purely a SQLite dashboard viewer:
- `GET /api/requests`, `/api/sessions/:id`, `/api/sessions/:id/transcript`, `/api/stats`
- `GET /` serves the HTML
- No WebSocket, no socket proxy
- Runs anywhere with access to `may.db`

### Phase 4: Improve console and telegram

**Console improvements:**
- Show delegation progress for the interface agent's sub-tasks (when may calls tech-lead, show `[may → tech-lead] running...` and `[may → tech-lead] done (45s)`)
- Hide background heartbeat noise by default (`--verbose` to show it)

**Telegram improvements:**
- Show tool call summaries (currently only text is sent, tool calls are invisible)
- Show delegation progress (same as console — `may → tech-lead: running`)
- "Ask about this" — reply to a heartbeat brief to drill into it (similar to web UI button)

### Event types to add

Current events are too coarse. Add:

```typescript
| { type: "delegation_start"; agent: string; targetAgent: string; task: string; sessionId: string; channel?: EventChannel }
| { type: "delegation_end"; agent: string; targetAgent: string; sessionId: string; status: string; duration: string; channel?: EventChannel }
```

When the interface agent delegates, these events carry `channel: "chat"` — so chat UIs can show delegation progress without showing all background activity. Currently this info is only visible through `info` events (which are `channel: "activity"`).

## Summary

| Component | Current | Proposed |
|---|---|---|
| Console | bus.on(), dims activity | bus.on(), isChatEvent() for bright/dim, delegation events |
| Telegram | bus.on(), hand-rolled filter | bus.on(), isChatEvent(), delegation events, tool summaries |
| Socket | bus.on(), broadcast all | Unchanged — debug/control firehose |
| Web chat | Socket proxy → filter | bus.on() in-process (--web flag), isChatEvent() |
| Web dashboard | Socket proxy + SQLite | Standalone SQLite reader, no chat |
| Event filter | Per-UI inline | Shared `isChatEvent()` in event-bus.ts |
| Input | Multiple paths | All → `bus.command({ type: "input", source })` |
