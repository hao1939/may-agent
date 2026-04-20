# Event System, Socket Protocol & Web UI

## Architecture

```
Manager (sole producer)
  │  emits session_start, session_end, text, tool_call,
  │  tool_result, turn_end directly on bus
  ▼
EventBus (in-process, source of truth)
  │
  ├── Console     (stdout, filters by primary sessionId)
  ├── Telegram    (HTTP API, accumulates text, flushes on turn_end)
  ├── DbWriter    (persists to SQLite)
  ├── ActivityWriter, MemoryWriter, ContextUpdater,
  │   RequestTracker, ProgressWriter  (session lifecycle side effects)
  ├── StuckDetector  (cancels stuck sessions)
  ├── AutoResume     (resumes interrupted sessions with opCount > 0)
  ├── Recovery       (re-queues infra-failed sessions)
  ├── AutoEval       (evaluates completed task trees)
  ├── Escalation     (blocked/failure → Telegram + request tracking)
  └── Socket server  (Unix socket → external clients)
        │
        ├── socat (debug)
        ├── Web UI (browser, WebSocket proxy)
        └── socket_watch (agent tool)
```

The Manager is the sole producer of session lifecycle events. It takes an
optional `bus` reference and emits directly — no callback bridge. All side
effects (persistence, recovery, evaluation, notifications) are bus subscribers.

The Web UI reads SQLite directly for the dashboard and proxies through
the Unix socket for chat. It runs as a standalone process under supervisord.

## Event Flow

### Manager → Bus (direct emission)

The Manager emits events at three points:

1. **`run()` / `resumeSession()`**: emits `session_start`, sets up `bridgeAgentEvents`
2. **`bridgeAgentEvents()`**: subscribes to pi-agent-core events, re-emits as `text`, `tool_call`, `tool_result`, `turn_end`
3. **`handleCompletion()`**: emits `session_end` (task sessions) or `info` with error (chat sessions going idle)
4. **`close()`**: emits `session_end` for explicitly closed sessions

No callbacks. No indirection. The Manager's `ManagerEventBus` interface requires only `emit()`:

```typescript
interface ManagerEventBus {
  emit(event: Record<string, unknown>): void;
}
```

### Completion Pipeline

Session completion (`handleCompletion`) uses a pipeline of pure functions
extracted to `completion.ts`:

```
detectErrors → clearPostFinishErrors → handleOverflow →
detectShallowHeartbeat → determineOutcome → buildSessionInfo
```

Key: `clearPostFinishErrors` and `isRetryableInfraError` use
`lastTurnCalledFinish()` which only checks the current turn (since last
user message). The old `hasFinishToolCall()` scanned all messages — for
persistent chat sessions this always returned true after the first
heartbeat, silently swallowing all future empty responses.

## Session Events

### Session-scoped events

Every session produces the same events. No special treatment for the
"interface agent." The Manager's `bridgeAgentEvents()` handles translation
from pi-agent-core events to bus events uniformly.

Every session event carries `sessionId`:

```typescript
type SessionEvent =
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; outcome?: string; parentSessionId?: string }
```

System events (not session-scoped):

```typescript
type SystemEvent =
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string }
```

Agent commands:

```typescript
type AgentCommand =
  | { type: "fork"; agent: string; task: string; opts?: { kind?: string } }
  | { type: "input"; message?: string; source?: string }
  | { type: "steer"; sessionId?: string; message?: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }
  | { type: "resume"; sessionId: string }
  | { type: "reload" }
  | { type: "restart" }
  | { type: "shutdown" }
```

### How UIs filter

Each UI decides what to show based on `sessionId`:

**Console**: All events rendered. Primary session bright, other sessions dim.
Determines "primary" from chatSession.getSessionId().

**Telegram**: Filters to primary session tree + notifications. Accumulates
text, flushes on turn_end.

**Socket → Web UI**: Uses `subscribe` command (see below) to filter at the
socket server. Only receives events for subscribed sessions.

**Socket → socat**: No subscribe = firehose. Same as today.

## Socket Protocol

### Subscribe command

New command. Tells the server to filter events for this client:

```json
{ "type": "subscribe", "sessions": ["s_123"] }
```

Behavior:
- Only events with `sessionId` matching a subscribed session are forwarded.
- `notification` events are always forwarded (briefs, alerts).
- `log` events are NOT forwarded (system noise).
- If `sessions` includes `"*"`, all events forwarded (firehose). This is the default when no `subscribe` is sent.
- `subscribe` can be sent multiple times to update the filter.

### Auto-expand session tree

When the server sees `session_start` with `parentSessionId` matching a
subscribed session, it automatically adds the new sessionId to that
client's filter. The client subscribes to the chat session and
automatically sees delegations (may → tech-lead → coder).

### Per-client state

```typescript
interface ClientState {
  socket: Socket;
  filter: Set<string> | null; // null = firehose
}
```

### Backward compatibility

No `subscribe` sent = firehose. Existing socat usage, socket_watch,
detached agent control — all unchanged.

### All commands

- `input` — send user input (routed through ChatSession)
- `steer` — interrupt mid-turn (requires sessionId)
- `cancel` — cancel a session (requires sessionId)
- `cancel_all` — cancel all running sessions
- `cancel_task` — cancel the interface agent's session
- `status` — get active sessions (handled locally by socket server)
- `subscribe` — set session filter for this client
- `fork` / `run` — start a new agent session
- `resume` — resume an interrupted/errored session by sessionId
- `reload_agents` — hot-reload agent configs
- `restart` — process exits, supervisord restarts
- `close` — shutdown

## Web UI

### Standalone process

```bash
bun src/app/ui/web.ts --state-dir .state --port 8080
```

Two features:

**Dashboard** (HTTP, reads SQLite):
- `GET /api/requests` — query requests table
- `GET /api/sessions/:id` — session metadata + child tree
- `GET /api/sessions/:id/transcript` — parsed session.jsonl
- `GET /api/stats` — agent workload summary
- `GET /` — single HTML page

**Chat** (WebSocket → Unix socket):
- Browser connects via WebSocket to web server
- Web server connects to agent's Unix socket
- On connect: sends `subscribe` with the chat sessionId from the welcome message
- Proxies filtered events from socket → WebSocket (only subscribed sessions)
- Proxies commands from WebSocket → socket (input, cancel)
- "Ask about this" button composes context from dashboard data and sends to chat

### The proxy becomes dumb

With `subscribe` doing server-side filtering at the socket, the web UI
proxy doesn't need to parse events. It just forwards bytes:

```
Browser WebSocket ←→ Web Server ←→ Unix Socket (with subscribe filter active)
```

The only smart thing the proxy does:
1. On connect, read the welcome message to get sessionId
2. Send `{ "type": "subscribe", "sessions": [sessionId] }` if sessionId is non-empty
3. Forward everything else transparently

## Implementation Order

1. **Add `sessionId` to session events** in `attachAgentEvents` + event-bus types.
   Make all sessions emit the same events (remove the `if (isChat)` branch).

2. **Add `subscribe` to socket server.** Per-client filter, auto-expand.

3. **Update web UI proxy** to send `subscribe` on connect.

4. **Update console UI** to filter by sessionId (bright/dim) instead of channel.

5. **Update telegram** to filter by sessionId instead of channel.

6. **Split `info` into `notification` + `log`.** Move heartbeat briefs
   from channel:chat text events to `notification` type. Move system
   diagnostics to `log` type.

7. **Remove `channel` field.**

Steps 1-3 are the critical path. Steps 4-7 are cleanup.
