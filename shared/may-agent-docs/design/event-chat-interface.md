# Event & Chat Session Interface Redesign

## Current State

### Event flow

```
Agent sessions ──events──→ EventBus ──broadcast──→ Console UI (stdout)
                                                 → Socket server (all clients)
                                                 → Telegram bot
```

The EventBus is a single broadcast channel. Every event goes to every listener.

### Channel tag

Events have an optional `channel` field: `"chat"` or `"activity"` (default).

- **`channel: "chat"`**: Events from the interface agent's session (the one that handles human messages). Set in `attachAgentEvents()` in `may.ts` — only the interface agent's session gets this tag.
- **`channel: "activity"`** (default): Everything else — background agent turns, cron fires, system info.

### How each UI uses channels

| UI | Chat events | Activity events |
|---|---|---|
| **Console** | Bright text | Dimmed text (both shown) |
| **Telegram** | Accumulate text, flush on prompt | Ignored |
| **Socket** | Broadcast to all clients | Broadcast to all clients |
| **Web UI (current)** | Show in chat | Filter out (after this fix) |

### What's wrong

1. **Socket broadcasts everything.** The socket was designed for `socat` debugging — seeing all events is useful for operators. But for a chat UI (web or otherwise), getting 200 `[coder] turn done` messages per day is noise.

2. **No server-side filtering.** The socket server has no concept of "this client only wants chat events." Every client gets the full firehose. Filtering happens client-side (telegram filters in its own listener, web UI filters in JS). This means the socket still sends all the data — wasteful for chat-focused clients.

3. **The channel tag is too coarse.** There are only two values: `chat` and `activity`. But a web UI might want:
   - Chat agent's conversation (text, tool calls, tool results) ✓
   - Status of sub-agents the chat agent spawned (delegation progress)
   - NOT background heartbeats, cron fires, other agents' turn counts

4. **No session scoping on events.** Events don't carry `sessionId` (except `session_start`). If the interface agent delegates to tech-lead, and tech-lead delegates to coder, the web UI can't tell which events belong to the user's request tree vs background activity.

## Proposed design

### Keep it simple — filter at the proxy, not the protocol

Don't change the socket protocol. Don't add subscription topics. The socket stays as a debug firehose — it works well for that.

Instead, the **web UI server** does the filtering. It already sits between WebSocket and Unix socket. Right now it's a dumb proxy. Make it a smart proxy:

```
Browser ──WebSocket──→ Web Server ──filter──→ Unix Socket
                          │
                          └── Only forwards channel:"chat" events to WebSocket clients
                              Forwards ALL commands from WebSocket to Unix socket
```

### Implementation

In `web.ts`, instead of blindly forwarding every line from the Unix socket to the WebSocket client, parse each event and only forward if:

1. `event.channel === "chat"` (interface agent's conversation), OR
2. `event.type === "connected"` (welcome message), OR
3. `event.type === "error"` (errors should always show)

Everything else (turn-done summaries, cron fires, heartbeat briefs, background info) is dropped at the proxy.

### Why not filter on the socket server?

- Socket protocol stays simple (one broadcast, no subscriptions)
- Existing `socat` debugging still works (sees everything)
- Detached agent control still works (receives all events)
- `socket_watch` tool still works (needs all events)
- The web server is the right place for UI-specific decisions

### Why not add topics/subscriptions to the socket protocol?

- Adds complexity to every socket client
- Only one consumer (web UI) needs filtering
- The proxy pattern is simpler and doesn't touch core code

### Changes

Only `src/app/ui/web.ts` changes — the `proxyWebSocket` function:

```typescript
unix.on("data", (chunk) => {
  // ... line buffering ...
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      // Only forward chat-channel events + meta events
      if (event.channel === "chat" || event.type === "connected" || event.type === "error") {
        ws.send(line);
      }
    } catch {
      ws.send(line); // Forward unparseable lines as-is
    }
  }
});
```

The client-side filter in `index.html` becomes redundant (defense in depth — keep it but it won't fire for activity events).
