# Event System, Socket Protocol & Web UI

## Architecture

```
Agent sessions ──AgentEvent──→ Manager
                                 │
                                 ▼
                              EventBus (in-process, source of truth)
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼             ▼
                 Console      Telegram      Socket server
                 (stdout)     (HTTP API)    (Unix socket)
                                              │
                                    ┌─────────┼─────────┐
                                    ▼         ▼         ▼
                                  socat    Web UI    socket_watch
                                 (debug)  (browser)  (agent tool)
```

The EventBus is the in-process pub/sub. The socket is one consumer of the
EventBus that re-broadcasts to external clients. Console and Telegram are
other consumers. Each filters events according to its needs.

The Web UI is a socket client. It connects to the Unix socket for chat
(events + commands) and reads SQLite directly for the dashboard. It runs
as a standalone process — no coupling to the agent.

## Event System

### Session-scoped events

Every session produces the same events. No special treatment for the
"interface agent." The event emitter doesn't know who's watching.

Every session event carries `sessionId`:

```typescript
type SessionEvent =
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; outcome?: string }
```

System events (not session-scoped):

```typescript
type SystemEvent =
  | { type: "notification"; agent: string; text: string }   // heartbeat briefs, escalations
  | { type: "log"; level: "info" | "warn" | "error"; message: string }  // startup, cron, errors
```

The `channel` field is removed. The `info` dumping ground is split:
current `info` events that are system diagnostics become `log`, and
push-to-human events (heartbeat briefs, alerts) become `notification`.

### attachAgentEvents becomes uniform

Currently: `if (isChat) { full streaming } else { one-line turn summary }`.
After: same handler for every session. All sessions emit text, tool_call,
tool_result, turn_end. The UI decides what to render.

```typescript
function attachAgentEvents(agentName: string, sessionId: string): void {
  manager.subscribe(sessionId, (event) => {
    switch (event.type) {
      case "message_update":
        if (event.assistantMessageEvent.type === "text_delta")
          bus.emit({ type: "text", sessionId, agent: agentName, text: event.assistantMessageEvent.delta });
        break;
      case "tool_execution_start":
        bus.emit({ type: "tool_call", sessionId, agent: agentName, tool: event.toolName, args: event.args });
        break;
      case "tool_execution_end":
        bus.emit({ type: "tool_result", sessionId, agent: agentName, tool: event.toolName, preview: extractPreview(event), isError: !!event.isError });
        break;
      case "turn_end":
        bus.emit({ type: "turn_end", sessionId, agent: agentName, toolCalls, durationMs });
        break;
    }
  });
}
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

Existing (unchanged):
- `input` — send user input
- `steer` — interrupt mid-turn (requires sessionId)
- `cancel` — cancel a session (requires sessionId)
- `cancel_all` — cancel all running sessions
- `cancel_task` — cancel the interface agent's session
- `status` — get active sessions
- `run` — start a new agent session
- `reload_agents` — hot-reload agent configs
- `close` — shutdown
- `restart` — exit 100 (hot-reload)

New:
- `subscribe` — set session filter for this client

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
