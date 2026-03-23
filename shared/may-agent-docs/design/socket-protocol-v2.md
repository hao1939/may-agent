# Socket Protocol v2

## Context

The event system is moving to session-scoped events (every event carries `sessionId`). The socket protocol needs to support this so consumers can subscribe to the events they care about instead of receiving everything.

## Current protocol

```
Client connects
  ← welcome { type: "connected", pid, agent, instance, activeAgents }
  ← ALL events broadcast (no filtering)

Client sends command
  ← { type: "ok" } or { type: "error" }
```

Every client gets every event. Works for `socat` debugging. Wrong for everything else.

## Proposed protocol

### Subscribe command

After connecting, a client can send a `subscribe` command to filter events:

```json
{ "type": "subscribe", "sessions": ["s_123"] }
```

- `sessions`: array of session IDs to watch. Events with `sessionId` matching any of these are forwarded. Events without `sessionId` (system events, notifications) are always forwarded.
- If `sessions` includes `"*"`, all events are forwarded (firehose mode, same as current behavior).
- If no `subscribe` is sent, default is `"*"` (backward compatible — existing clients see no change).

The server maintains a per-client filter. The client can send `subscribe` multiple times to update its filter.

### Auto-expand session tree

When a `session_start` event arrives with `parentSessionId` matching a subscribed session, the server automatically adds the new session to the client's filter. This way a client subscribing to the chat session automatically sees delegations without needing to know child session IDs in advance.

```
Client: { "type": "subscribe", "sessions": ["s_123"] }

// s_123 (may) delegates to s_456 (tech-lead)
Server sees: session_start { sessionId: "s_456", parentSessionId: "s_123" }
Server auto-adds s_456 to this client's filter
Client receives: session_start + all subsequent s_456 events
```

### Subscribe with notifications flag

```json
{ "type": "subscribe", "sessions": ["s_123"], "notifications": true }
```

`notifications: true` (default) means the client also receives `notification` events (heartbeat briefs, escalations). Set to `false` to suppress.

### Full protocol

```
Client connects
  ← welcome { type: "connected", pid, agent, instance, sessionId, activeAgents }
  (default: firehose mode — all events forwarded, backward compatible)

Client: { "type": "subscribe", "sessions": ["s_123"], "notifications": true }
  ← { type: "ok", command: "subscribe" }
  (now only receives events for s_123 + descendants + notifications)

Client: { "type": "subscribe", "sessions": ["*"] }
  ← { type: "ok", command: "subscribe" }
  (back to firehose)

All other commands unchanged: input, steer, cancel, status, run, etc.
```

### Implementation

Per-client state on the socket server:

```typescript
interface ClientState {
  socket: Socket;
  /** Session IDs this client is watching. null = firehose (all events). */
  sessionFilter: Set<string> | null;
  /** Whether to forward notification events. */
  notifications: boolean;
}
```

Broadcast function changes from:

```typescript
function broadcast(event: RunnerEvent): void {
  const line = JSON.stringify(event) + "\n";
  for (const client of clients) {
    client.write(line);
  }
}
```

To:

```typescript
function broadcast(event: RunnerEvent): void {
  const line = JSON.stringify(event) + "\n";
  for (const client of clients.values()) {
    if (shouldForward(client, event)) {
      client.socket.write(line);
    }
  }
}

function shouldForward(client: ClientState, event: RunnerEvent): boolean {
  // Firehose mode — no filter
  if (!client.sessionFilter) return true;

  // Session-scoped events: check if sessionId is in the watch set
  if ("sessionId" in event && event.sessionId) {
    return client.sessionFilter.has(event.sessionId);
  }

  // Notification events: forward if client wants them
  if (event.type === "notification") return client.notifications;

  // System events (log, cron_fire): only in firehose mode
  return false;
}
```

When `session_start` arrives with `parentSessionId` in the filter, auto-expand:

```typescript
if (event.type === "session_start" && event.parentSessionId) {
  for (const client of clients.values()) {
    if (client.sessionFilter?.has(event.parentSessionId)) {
      client.sessionFilter.add(event.sessionId);
    }
  }
}
```

### Web UI usage

```javascript
// Connect
ws = new WebSocket("ws://localhost:8080/ws");

// On connected, subscribe to the chat session
ws.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.type === "connected" && event.sessionId) {
    ws.send(JSON.stringify({ type: "subscribe", sessions: [event.sessionId] }));
  }
  // ... render events
};
```

The web UI proxy in `web.ts` forwards the `subscribe` command to the Unix socket. No proxy-level filtering needed — the socket server does it.

### Telegram usage

Telegram already connects to the bus directly (in-process). It doesn't use the socket. No change needed — it filters by checking `sessionId` against the chat session ID.

### socat / debug usage

No `subscribe` sent → firehose mode → same as today. Zero breaking changes.

### socket_watch usage

socket_watch connects and sends `subscribe` for the session it's observing. Currently it receives everything and filters client-side. With subscribe, the server does the filtering.

## Migration

1. Add `subscribe` command to socket server
2. Add `sessionId` to session events (the event system redesign)
3. Update web UI to send `subscribe` after connect
4. Update socket_watch to send `subscribe`
5. Existing clients (socat) work unchanged (default firehose)

Steps 1-3 are the meaningful change. Steps 4-5 are optimization.
