# Socket Protocol

Status: **Implemented** (2026-03-05)

## Overview

A may-agent process can optionally expose a Unix domain socket for external
control and observation. The socket is **not required** — agents function
fully without one. All core state (status, progress, result) is disk-based.
The socket adds real-time event streaming and in-flight control (steer,
cancel) that disk alone cannot provide.

```
.state/instances/<instance>/
  ├── identity.json       # PID, socket path, agent name, status
  ├── <agent>.pid         # plain-text PID file
  └── <agent>.sock        # Unix domain socket (this document) — optional
```

### When the socket is absent

| Capability | Without socket | With socket |
|---|---|---|
| Start/run/resume | Works (disk-based) | Works |
| Status/progress/result | Works (disk-based registry + JSONL) | Works + real-time events |
| Cancel detached agent | SIGTERM via PID | Graceful socket cancel, SIGTERM fallback |
| Steer detached agent | **Not available** | Works |
| Observe events in real-time | **Not available** | Works (`socket_watch`, `socat`) |
| Interactive human control | Terminal stdin only | Terminal + socket clients |

The socket is created when `--socket` is passed to `run/may.ts` (or
`run/launcher.ts`). It is absent when:

- The `--socket` flag is not passed (default — socket disabled)
- Another instance already owns the socket path (graceful degradation —
  process runs without socket and logs a warning)
- The process exits or crashes (socket file cleaned up)

### Audiences

When present, the socket serves three audiences:

1. **Humans** — interactive control via `socat READLINE UNIX-CONNECT:path`
2. **Detached agent control** — parent process cancels/steers child via socket
3. **Observation tools** — `socket_watch` connects as client to stream events

## Protocol

Newline-delimited JSON over Unix domain sockets. Each message is a single
JSON object terminated by `\n`. The protocol is asymmetric:

- **Server→Client**: `RunnerEvent` objects (see `run/event-bus.ts`)
- **Client→Server**: `SocketCommand` objects (see below)
- **Server→Client** (response): `SocketResponse` after each command

### Connection Lifecycle

```
Client connects
  ← server sends Welcome message
  ← server broadcasts RunnerEvents as they occur

Client sends SocketCommand + \n
  ← server sends SocketResponse + \n

Client disconnects (or server shuts down)
```

Multiple clients can connect simultaneously. Each receives the full event
stream. Commands from any client affect the same agent process.

### Welcome Message

Sent immediately on connection:

```json
{
  "type": "connected",
  "pid": 12345,
  "agent": "may",
  "instance": "default",
  "sessionId": "s_1741000000_0",
  "activeAgents": [
    { "agent": "may", "sessionId": "s_1741000000_0", "task": "Ready. Waiting..." }
  ]
}
```

### Events (Server → Client)

All `RunnerEvent` types are broadcast:

| Event Type | Key Fields | Description |
|---|---|---|
| `text` | `agent`, `text`, `channel?` | LLM text output (streaming deltas) |
| `tool_call` | `agent`, `tool`, `args` | Tool invocation |
| `tool_result` | `agent`, `tool`, `preview`, `isError` | Tool result |
| `session_start` | `agent`, `sessionId`, `task` | New session started |
| `session_end` | `agent`, `sessionId`, `status`, `error?` | Session completed |
| `workflow` | `agent`, `workflow`, `event`, `step?` | Workflow lifecycle |
| `eval` | `verdict`, `efficiency`, `quality` | Session evaluation |
| `info` | `message` | System/diagnostic message |
| `prompt` | `message` | Agent is idle, waiting for input |

Events carry an optional `channel` field: `"chat"` (user-facing) or
`"activity"` (background). Default is `"activity"`.

## Commands

### Session Targeting

Each may-agent process has one **interface agent session** (`sid` — the
primary chat session) and may run additional child sessions via `run`.
Commands target sessions differently:

| Command | Target | Mechanism |
|---|---|---|
| `input` | ChatSession | Parsed by handleInput() (commands, @agent, or chat) |
| `steer` | **Explicit session** | `sessionId` field in payload (required in V2) |
| `cancel` | **Explicit session** | `sessionId` field in payload |
| `cancel_task` | Interface agent session | Implicit — always `sid` |
| `cancel_all` | All running sessions | Iterates all |
| `run` | New session (any agent) | Creates fresh session |
| `status` | Process-level | Reports all sessions |
| `reload_agents` | Process-level | Reloads config |
| `close` | Interface agent session | Implicit — closes `sid` + shutdown |
| `restart` | Process-level | Exit code 100 |

**Key implication**: `cancel` is the only command that can target a specific
child session by ID. `steer` and `input` always go to the interface agent.
You cannot steer a child session started via `run` through the socket.

For **detached processes** (one session each), this is not a problem — the
interface agent IS the only session. The parent process sends
`{ type: "steer", message }` and it reaches the right (only) session.

For the **main process** running child sessions, the limitation means child
sessions can only be cancelled (by ID), not steered, through the socket.
See [L1](#l1-steer-has-no-sessionid--assumes-one-session-per-process) for
the proposed fix.

### Command Envelope

Every command is a JSON object with a `type` field:

```json
{ "type": "<command>", ...params }
```

### Response Envelope

Every command gets exactly one response:

```json
{ "type": "ok", "command": "<command>", "result": <payload> }
```

or:

```json
{ "type": "error", "command": "<command>", "message": "<reason>" }
```

Invalid JSON gets:

```json
{ "type": "error", "message": "Invalid JSON: <first 100 chars>" }
```

### Command Reference

#### `input` — Send user input

Routes through the full input handler: parses slash commands (`cancel`,
`status`, `reload`, `/new`, etc.), `@agent` prefix for direct agent sessions,
or sends to the persistent chat session via `ChatSession.handleInput()`.
This is the primary command for human interaction.

```json
{ "type": "input", "message": "implement feature X" }
```

**Behavior**: Same as typing in the terminal. Routes through ChatSession:
built-in commands handled directly, @agent creates ephemeral session, normal
text goes to the persistent chat session.

#### `steer` — Interrupt mid-turn

Bypasses input parsing. Directly calls `manager.steer(sessionId, message)`.
Requires explicit `sessionId` (V2 change — no implicit targeting).
If the agent is streaming, the message is injected mid-generation (remaining
tool calls in the batch are skipped).

```json
{ "type": "steer", "sessionId": "s_1741000000_0", "message": "stop and reconsider the approach" }
```

**Failure**: If the session is not running (e.g., already done/error),
the error is logged but not returned to the client (see
[L5](#l5-steer-via-socket-silently-swallows-errors)).

#### `cancel` — Cancel a specific session

The only command that accepts an explicit `sessionId`. Works for any session
the process manages — the interface agent or any child session.

```json
{ "type": "cancel", "sessionId": "s_1741000000_0" }
```

#### `cancel_task` — Cancel the interface agent's current task

```json
{ "type": "cancel_task" }
```

Equivalent to typing `cancel` in the terminal. Cancels the interface agent's
session only.

#### `cancel_all` — Cancel all running sessions

```json
{ "type": "cancel_all" }
```

Cancels every running session managed by this process.

#### `run` — Start a new agent session

```json
{ "type": "run", "agent": "coder", "message": "fix the login bug" }
```

Starts a new `kind: "job"` session for the named agent. The session runs
concurrently. The agent must be registered. If in ChatSession mode, routes
through `@agent` handling instead.

#### `status` — Get active sessions

```json
{ "type": "status" }
```

Response includes session list (emitted as an `info` event to all clients,
not as a structured response — see [Limitations](#limitations)).

#### `reload_agents` — Hot-reload agent configs

```json
{ "type": "reload_agents" }
```

Re-reads `agents/*/agent.json` and updates registrations. New agents become
available; updated agents get new configs on next session.

#### `close` — Close session and shut down

```json
{ "type": "close" }
```

Closes the interface agent's chat session and initiates graceful shutdown.

#### `restart` — Hot restart

```json
{ "type": "restart" }
```

Exits with code 100. The launcher (`run/launcher.ts`) interprets this as
a restart request and re-spawns the process.

## Fire-and-Forget Client (`src/lib/socket-client.ts`)

`sendSocketCommand()` is a minimal client for cross-process control:

```typescript
sendSocketCommand(socketPath, { type: "cancel", sessionId: "..." })
sendSocketCommand(socketPath, { type: "steer", message: "..." })
```

**Current behavior**: Connect → write command → disconnect. Does not read the
response. The caller assumes success if the TCP connection succeeded.

**Used by**: `manager.ts` agents tool for detached cancel.

## Socket Watch Tool (`src/lib/tools/socket-watch.ts`)

Agent-side tool for observing another process's socket. Connects as a
persistent client, receives events, debounces, and injects batches into the
observing agent's session via `manager.followUp()` or `manager.steer()`.

See the source code (`src/lib/tools/socket-watch.ts`) for full implementation details.

**Protocol interaction**: The socket watch tool can also send commands back
to the observed process via `socket_watch send`:

```
socket_watch.send(watchId, { type: "input", message: "do X" })
socket_watch.send(watchId, { type: "steer", message: "stop" })
socket_watch.send(watchId, { type: "cancel_task" })
```

## Detached Agent Control Flow

When a parent agent steers or cancels a detached child, the socket is the
preferred channel but not required. Cancel works without a socket (SIGTERM
fallback). Steer requires a socket — without one, the parent cannot inject
messages into a running detached process.

```
Parent process                          Child (detached) process
─────────────                           ────────────────────────
subagents.steer(sid, msg)
  │
  ├── not in activeSessions
  ├── read identity.json → socket path
  │
  └── sendSocketCommand(path,           ──► socket server receives
        { type: "steer", message })           bus.command({ type: "steer", ... })
                                                manager.steer(sid, message)
                                                agent processes steer/followUp
```

Cancel has a two-tier fallback (socket is best-effort):

```
1. Try socket:  sendSocketCommand(path, { type: "cancel", sessionId })
2. If socket fails or absent: process.kill(pid, "SIGTERM")
3. If no PID: return error
```

## Limitations

### L3: Server response is not structured for all commands

Several commands (`status`, `cancel_all`, `cancel_task`, `close`, `restart`,
`reload_agents`) route through `handleInput()` which emits `info` events as
side effects. The socket server returns `{type: "ok"}` but the actual result
appears as a broadcast `info` event — not in the response.

For commands that route through `handleInput`, the `{type: "ok"}` response
acknowledges receipt. Clients that need the result should listen for the
corresponding `info` event in the broadcast stream. This is acceptable
because these commands are used interactively, not programmatically.

For `status` specifically (which could be used programmatically by monitoring
tools), a structured response would be useful:

```json
{
  "type": "ok",
  "command": "status",
  "result": {
    "sessions": [
      { "agent": "may", "sessionId": "...", "status": "idle", "task": "..." }
    ]
  }
}
```

## Resolved

The following limitations from the initial design have been addressed:

- **L1: `steer` has no sessionId** — Added optional `sessionId` field to the
  `steer` command type. Falls back to interface agent session when absent.
- **L2: Fire-and-forget client has no ack** — `sendSocketCommand()` now reads
  the server's response line. Rejects on `{type: "error"}`, resolves on
  `{type: "ok"}`. Falls back to success-on-close for backward compat.
- **L4: No command validation** — Server validates `cmd.type` against
  `VALID_COMMAND_TYPES` set. Unknown commands get `{type: "error"}` response.
  Command handler in `may.ts` has a `default` case returning error.
- **L5: Steer error propagation** — Command handler returns `CommandResult`
  with `ok: false` and error message. Socket server propagates as
  `{type: "error"}` response.
- **L6: Welcome metadata** — Welcome message now includes `pid`, `agent`,
  `instance`, and `sessionId`. Active agents include `status` field.

## Socket Lifecycle

### Creation

`attachSocketUI()` in `src/app/ui/socket.ts` creates a socket when `--socket` is passed:

```
.state/instances/<instance>/<agent>.sock
```

When `--socket` is not passed, no socket is created. The `socketUI` variable
is a no-op stub. The agent process is fully functional — it just lacks
real-time external control.

If the socket file already exists and is alive (another process owns it),
the process runs **without** a socket and logs a warning. The returned
`SocketUI` is a no-op stub (`close()` does nothing, `clientCount()` returns
0).

### When socket is absent

The process still writes `identity.json` with an empty `socket` field.
PID-based cancel (SIGTERM) still works. Steer is not available. Event
observation is not available.

Detached agents are spawned with `--socket` automatically (via
`spawnDetachedAgent()`) so the parent can steer/cancel them gracefully.
Production entry points (`may.sh`) pass `--socket`
alongside other feature flags (`--cron --telegram --console --socket`).

### Identity

The socket path is written to `identity.json` so other processes can discover
it:

```json
{
  "pid": 12345,
  "agent": "may",
  "instance": "default",
  "socket": "/home/hao/may-agent/.state/instances/default/may.sock",
  "startedAt": "2026-03-05T06:00:00Z",
  "startedBy": "human",
  "status": "running"
}
```

### Cleanup

On process exit: socket file is unlinked, PID file is removed.
On stale detection: if a socket file exists but no process is listening,
`attachSocketUI` unlinks the stale file and takes over.

## Testing

Socket tests live in `test/socket-watch.test.ts` (for the `socket_watch`
tool). The control socket itself is tested indirectly via integration tests
that use `attachSocketUI`.

For the fire-and-forget client, test with a mock server that verifies the
command was received and the client reads the ack.
