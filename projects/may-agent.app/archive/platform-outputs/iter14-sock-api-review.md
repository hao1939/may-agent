# Socket/Control API Review

**Date**: 2026-05-15  
**Reviewer**: platform worker  
**Source files**: `packages/control/src/protocol.ts`, `packages/control/src/server.ts`  
**Docs**: `sdk.md`, `system-boundary.md`

---

## 1. What the Socket API Provides

The control socket (`may.sock`) is a newline-delimited JSON protocol over a Unix domain socket. It provides:

### Inbound Commands (client → daemon)

| Command | Purpose | Notes |
|---------|---------|-------|
| `{"type":"status"}` | Get active agents/sessions | Returns `{type:"status", activeAgents:[...]}` |
| `{"type":"subscribe", "sessions":[...]}` | Subscribe to event stream | Supports `"*"` (all), `"chat"` (follow chat session + children), or specific session IDs |
| `{"type":"input", ...}` | Send user input | Auto-sets `source:"socket"`, aliases `content`→`message` |
| `{"type":"fork", "agent":"x", "task":"y"}` | Fork an agent session | Wraps into fork event with `source:"socket"` |
| `{"type":"message", ...}` | Send a message | Aliases `content`→`task` if no `task` field |
| `{"type":"close"}` | Shutdown daemon | Maps to `{type:"shutdown"}` event |
| `{"type":"cancel_task"}` | Cancel all tasks | Maps to `{type:"cancel_all"}` event |
| `{"type":"reload_agents"}` | Hot-reload agent definitions | Maps to `{type:"reload"}` event |
| `{"type":"emit", "event":"x", ...}` | Emit arbitrary named event | Generic escape hatch for any event type |

### Outbound (daemon → client)

- **Welcome frame** on connect: `{type:"connected", pid, agent, instance, sessionId, activeAgents}`
- **Event stream** after subscribe: newline-delimited JSON events matching the subscription filter
- **Ack frames**: `{type:"ok", command:"..."}` for accepted commands
- **Error frames**: `{type:"error", command, message}` for invalid input

### Subscription Filtering

The `shouldForward` function filters by `sessionId` membership in the client's filter set. Notable: `message.created` events to `"human"` are **suppressed** unless session-matched. The `"chat"` mode auto-tracks the current chat session ID and follows child sessions via `session.start` parentage.

---

## 2. Documentation Accuracy

### system-boundary.md
Accurately describes the socket as "Universal command/event ingress and realtime event stream" — matches implementation. The conceptual framing (infra primitive vs agent pattern) is sound.

### sdk.md
- **No mention of the socket protocol at all.** The SDK doc covers the programmatic `AgentSDK` interface (runAgent, emit, metrics, etc.) but not the socket wire protocol. There is no dedicated socket protocol doc.
- The `emit()` SDK method conceptually maps to `{"type":"emit","event":"x"}` on the socket, but this mapping is undocumented.
- The "Alignment: SDK ↔ Agent Tools" table is helpful but doesn't mention socket commands.

### Missing documentation
There is **no standalone socket protocol reference**. A consumer connecting to `may.sock` must read `protocol.ts` and `server.ts` source code to understand:
- What commands exist
- What responses to expect
- How subscription filtering works
- The welcome frame format

---

## 3. What Works Well

1. **`status` command** — tested successfully, returns clean JSON with active agents list.
2. **`subscribe` command** — tested successfully with `sessions:["*"]`, receives event stream.
3. **Protocol normalization** — `normalizeSocketFrame()` is well-structured: clean kind discrimination (`control`/`event`/`error`), good error messages for malformed input.
4. **Newline-delimited JSON** — Simple, streamable, easy to implement clients for. Good choice.
5. **Welcome frame** — Immediately useful: gives PID, instance name, current session, and active agents without requiring a separate status call.
6. **Chat mode** — Clever: `subscribe({sessions:["chat"]})` auto-follows the interactive session and its children. Good UX for terminal/web clients.
7. **Stale socket detection** — `isSocketAlive()` probe before listening prevents conflicts between instances.
8. **Core/transport separation** — `createControlSocketCore()` is cleanly separated from `attachControlSocket()`, making it testable and reusable for non-Unix transports (e.g., WebSocket).

---

## 4. What's Broken or Unclear

### 4a. Bugs / Issues

1. **`shouldForward` is too restrictive**: When a client has a filter set, events without a `sessionId` field AND not matching `message.created` to human are **silently dropped** (returns `false`). System-wide events like metrics, alerts, or lifecycle events that lack `sessionId` will never reach filtered subscribers. This seems like an oversight — a `"chat"` subscriber probably wants to see alerts too.

2. **`cancel_task` semantics are misleading**: The command name suggests canceling a specific task, but it maps to `cancel_all` — canceling everything. Should either be renamed to `cancel_all` at the protocol level, or accept a `sessionId` parameter for targeted cancellation.

3. **No authentication/authorization**: Any process with filesystem access to the socket can shut down the daemon (`close`), cancel all work (`cancel_task`), or inject arbitrary events (`emit`). This is acceptable for single-user containers but worth noting for multi-tenant or shared environments.

### 4b. Unclear / Underdefined

4. **`emit` vs named commands**: It's unclear when to use `{"type":"emit","event":"foo"}` vs `{"type":"foo"}`. Both paths exist — `emit` goes through explicit event wrapping while unknown types fall through to the default case in `normalizeSocketFrame` and get forwarded as-is. Are both intentional? The `emit` path strips `type` and `event` fields and renames; the fallthrough keeps the original frame intact. This could confuse clients.

5. **`message` command behavior**: When `type:"message"` is sent, it only aliases `content`→`task` when `task` is missing. But the resulting event still has `type:"message"` — is this handled downstream as a `message.created` event, or does it need further transformation? The protocol doesn't make this clear.

6. **Error recovery**: No reconnection protocol. If the socket drops, clients must reconnect and re-subscribe. There's no sequence numbering or replay capability for missed events.

---

## 5. Improvement Suggestions

### High Priority

1. **Write a socket protocol reference doc** (`docs/socket-protocol.md`). Include: connection setup, welcome frame, all commands with request/response examples, subscription modes, and error handling. This is the #1 gap — the socket is a primary integration surface with zero documentation.

2. **Fix `shouldForward` filtering** to have a sensible default for events without `sessionId`. Options: (a) forward all non-session events to all subscribers, (b) add an explicit `system` subscription channel, (c) tag system events so they bypass the filter.

3. **Rename `cancel_task` to `cancel_all`** or add a `sessionId` parameter for targeted cancellation.

### Medium Priority

4. **Clarify `emit` vs direct command** — either document the dual path or consolidate. Recommendation: make `emit` the only way to send arbitrary events, and have named commands (`input`, `fork`, `message`, `close`, `cancel_task`, `reload_agents`) as the structured sugar. Document this clearly.

5. **Add a `ping`/`pong` keepalive** — useful for clients to detect dead connections without waiting for TCP timeout.

6. **Add sequence numbers to the event stream** — enables clients to detect gaps after reconnection and request replay (even if replay isn't implemented yet, the numbering is cheap and forward-compatible).

### Low Priority

7. **Add `cancel` command with `sessionId` parameter** — more useful than the current all-or-nothing `cancel_task`.

8. **Consider structured command responses** — currently `status` returns data but `subscribe` just returns `{type:"ok"}`. Consider returning the resolved filter set in the subscribe ack so clients can confirm what they're subscribed to.

9. **Add a `help` or `commands` introspection command** — returns the list of supported commands. Cheap to implement, helpful for interactive exploration.

---

## Summary

The socket API is **well-implemented** at the code level — clean protocol normalization, good separation of concerns, sensible transport design. The main gaps are:

- **Zero documentation** for the wire protocol (critical)
- **`shouldForward` filtering drops non-session events** (bug)
- **`cancel_task` name is misleading** (minor bug)
- **`emit` vs named command duality is confusing** (design clarity)

Overall: solid foundation, needs a protocol doc and a few targeted fixes.
