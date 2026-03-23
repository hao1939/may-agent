# Unified UI Architecture

## Current state

Four UI backends, each wired differently:

```
                    ┌─ Console UI ── bus.on() ── filters by channel, renders to stdout
                    │
EventBus ───────────┼─ Telegram ──── bus.on() ── filters chat channel, accumulates text, flushes to Telegram API
                    │                bus.command() ← Telegram poll
                    │
                    ├─ Socket ────── bus.on() ── broadcasts ALL events to all Unix socket clients
                    │                bus.command() ← Unix socket clients
                    │
                    └─ Web UI ────── (not connected to bus)
                                     WebSocket ↔ Unix socket proxy ↔ Socket server ↔ EventBus
                                     Client-side JS filters chat channel
```

The web UI is the odd one out — it's a proxy of the socket, which is a proxy of the bus. Two hops. And it does its own filtering that the socket server should have done.

## What's wrong

1. **The web UI proxies through the socket instead of connecting to the bus directly.** This was the "separate process" choice — correct for the dashboard (reads SQLite), but wrong for chat. Chat needs the EventBus.

2. **Each UI reimplements event filtering.** Console dims activity. Telegram ignores non-chat. Web UI proxy filters. Socket broadcasts everything. There's no shared "what does a chat UI need?" logic.

3. **The socket serves two purposes that conflict.** It's both a debug firehose (socat, socket_watch) AND a control interface (send commands). The web UI only needs the control interface + chat events, but gets the firehose.

## Proposed design

### Split the web UI into two parts

**Dashboard** (standalone, no bus): Reads SQLite, serves HTML, no WebSocket. This stays as a separate process. `bun src/app/ui/web.ts --state-dir .state --port 8080 --no-chat`.

**Chat** (in-process, on the bus): An `attachWebUI(bus, opts)` function in may.ts, same pattern as console/telegram/socket. Listens on the bus directly, filters chat-channel events, serves WebSocket to browsers.

```
                    ┌─ Console UI ── bus.on() ── all events, dim activity
                    │
EventBus ───────────┼─ Telegram ──── bus.on() ── chat events only → Telegram API
                    │                bus.command() ← Telegram poll
                    │
                    ├─ Socket ────── bus.on() ── ALL events → Unix socket (debug/control)
                    │                bus.command() ← Unix socket
                    │
                    └─ Web UI ────── bus.on() ── chat events only → WebSocket → browser
                                     bus.command() ← WebSocket ← browser
```

All four UIs follow the same pattern:
1. Subscribe to EventBus
2. Filter events appropriate for their medium
3. Accept input → route through `bus.command()`

### But wait — the "separate process" benefit

The whole point of making the web UI standalone was: dashboard doesn't need the agent process. And that's still true. The dashboard queries SQLite — it can run anywhere.

So the answer is: **both modes**.

When run standalone (`bun src/app/ui/web.ts --state-dir .state`):
- Dashboard works (SQLite queries)
- Chat proxies through Unix socket (current behavior, with server-side filtering)

When run in-process (`--web` flag on the agent):
- Dashboard works (same SQLite)
- Chat connects to EventBus directly (no proxy, no socket hop)

The standalone mode is the "good enough" default. The in-process mode is for when you want clean chat without the proxy indirection. Both serve the same HTML/API.

### Implementation

**Phase 1** (now): Fix the standalone proxy filtering. This is what we just did — server-side filter in web.ts. Ship it, it works.

**Phase 2** (later, if needed): Add `attachWebUI(bus, opts)` in-process mode. Extracts the HTTP server from web.ts into a shared module. The `attachWebUI` function serves the same routes but uses `bus.on()` instead of Unix socket proxy for the WebSocket.

Phase 2 is only worth doing if the proxy approach has real problems (latency, missed events, etc.). For now the proxy works fine.

### The socket stays as-is

The Unix socket continues to broadcast everything. It's the debug/control interface. The web UI proxy filters at the server layer. No protocol changes.

### Event filtering becomes a shared concern

For phase 2, extract a helper:

```typescript
function isChatEvent(event: RunnerEvent): boolean {
  const channel = (event as any).channel ?? "activity";
  return channel === "chat" || event.type === "connected" || event.type === "error";
}
```

Telegram already does this check. Web UI proxy does it. Console uses it for dimming. One function, used by all.
