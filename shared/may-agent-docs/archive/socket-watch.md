# Socket Watch & Background Exec Tools

Status: **Implemented** (`src/lib/tools/socket-watch.ts`, `src/lib/tools/background-exec.ts`).
Tool presets: `"socket-watch"`, `"background-exec"`.

> **Note**: The design below was the original proposal. The implementation follows
> this design closely. `manager.followUp()` was later removed — the socket-watch
> tool now uses `manager.steer()` or `manager.input()` for injection. Refer to
> source code for current behavior.

## Problem

Agents need to interact with external processes — other may-agent instances, human interfaces, bridges to Telegram/web, etc. Currently, socket I/O is hardcoded in `run/may.ts` with bespoke wiring between the event bus, command handlers, and the interface agent's session. This makes it impossible for an agent to:

- Watch a subprocess it spawned (coaching pattern)
- Connect to multiple external sources simultaneously
- Receive and react to events from other systems

## Solution

Two new tools that give agents general-purpose process and socket I/O:

1. **`background_exec`** — spawn and manage long-lived child processes
2. **`socket_watch`** — connect to Unix sockets, receive events as followUp injections, send commands back

Plus a new public method on `SubagentManager`:

3. **`manager.followUp()`** — non-interrupting message injection into any session

## Design Principles

- **Source-agnostic**: The tool doesn't care whether the other end is a human, another agent, or an external system. It connects to sockets and moves messages.
- **Non-interrupting by default**: Incoming events are injected as `followUp` (wait for natural turn boundary). Optional `interrupt: true` per connection for urgent sources.
- **Multi-source**: An agent can connect to N sockets simultaneously. Events from all sources are labeled and batched.
- **Bidirectional**: Agent receives events AND sends commands through the same connection.

## `manager.followUp(sessionId, message)`

Non-interrupting counterpart to `steer()`. Injects a message into a session's followUp queue.

Behavior by session state:

| State | Action |
|---|---|
| `running` | `agent.followUp(msg)` — queued, delivered at next turn boundary. Persist to JSONL. |
| `idle` (persistent) | `agent.followUp(msg)` + `agent.continue()` — wakes the session. Persist to JSONL. Set status to `running`. Wire `.then()`/`.catch()` → `handleCompletion`. |
| `idle` (non-persistent) | Error — shouldn't happen. |
| not found / terminal | Throw. |

Difference from `send()`: `send()` uses `steer()` when the session is running (interrupts mid-turn, skips remaining tool calls). `followUp()` never interrupts — it queues and waits.

Difference from `steer()`: `steer()` only works on running sessions and always interrupts. `followUp()` works on both running and idle sessions and never interrupts.

## `background_exec` Tool

Long-lived child process management. Unlike the regular `exec` tool (which runs a command synchronously and returns output), `background_exec` spawns processes that run in the background while the agent continues working.

### Actions

**`spawn`** `(command, label?)`
- Spawns via `child_process.spawn("sh", ["-c", command])`
- Buffers stdout+stderr into a ring buffer (100KB cap)
- Applies same deny patterns as regular exec (no `find /`, no paths outside project root)
- Returns `{ pid, label }`
- Tracked per agent session — auto-cleaned on session end

**`output`** `(pid, lines?)`
- Returns buffered output since last read (drain semantics)
- Optional `lines` param limits to last N lines
- If no new output: returns `"(no new output)"`

**`input`** `(pid, text)`
- Writes to stdin of the child process
- Returns `{ written: true }` or error if process is dead

**`kill`** `(pid, signal?)`
- Sends signal (default SIGTERM) to process
- Removes from tracking
- Returns `{ killed: true }`

**`list`** `()`
- Returns all tracked processes: `{ pid, label, alive, exitCode? }`

### Cleanup

Processes are tracked in a `Map<number, ProcessEntry>` per session (keyed by PID). When the agent's session ends (via `handleCompletion`, `cancel`, or `close`), all tracked processes are killed via SIGTERM.

Implementation: `createBackgroundExecTool()` returns `{ tool, cleanup }`. The `cleanup(sessionId)` function kills all processes for that session.

### File: `src/background-exec.ts`

Exports:
- `createBackgroundExecTool(opts): { tool: AgentTool, cleanup: () => void }`
- Options: `{ cwd, denyPatterns?, denyMessage?, getSessionId: () => string }`

## `socket_watch` Tool

Multi-socket I/O with followUp injection. Connects to Unix sockets as a client, receives newline-delimited JSON events, debounces and injects them into the agent's session.

### Actions

**`connect`** `(socketPath, options?)`
- Opens `net.Socket` to Unix domain socket
- Options:
  - `label?: string` — human-readable name for this connection (shown in event batches)
  - `debounceMs?: number` — batch window (default: 3000ms). Events are buffered and delivered as a single followUp after this much silence.
  - `interrupt?: boolean` — if true, use `steer()` instead of `followUp()` for injection (default: false)
  - `filter?: string[]` — which event types to forward. Default: `["text", "tool_call", "tool_result", "info", "session_start", "session_end"]`. Set to `["*"]` for all.
- Returns `{ watchId, label }`

**`send`** `(watchId, data)`
- Sends JSON object to the socket (newline-terminated)
- `data` can be any valid socket protocol command
- Examples:
  - `{ "type": "input", "message": "implement feature X" }`
  - `{ "type": "steer", "message": "stop and reconsider" }`
  - `{ "type": "cancel_task" }`
  - `{ "type": "run", "agent": "coder", "message": "..." }`
- Returns `{ sent: true }`

**`disconnect`** `(watchId)`
- Close socket connection
- Flush any buffered events as final batch
- Remove from tracking
- Returns `{ disconnected: true }`

**`list`** `()`
- Returns all active connections: `{ watchId, label, connected, socketPath, eventsReceived }`

### Event Injection Flow

```
remote socket ──JSON lines──► socket_watch buffer
                                    │
                              (debounce timer)
                                    │
                              batch & format
                                    │
                              manager.followUp(coachSessionId, formattedBatch)
                                    │
                              agent processes at next turn boundary
                              (or wakes if idle)
```

### Event Batch Format

Injected as a single user message:

```
[socket_watch: <label>] Event batch (<N> events):

[tool_call] exec: {"command":"npm run test"}
[tool_result] exec: Tests passed (3/3)
[text] I'll now implement the fix for...
[tool_call] write: {"path":"/home/hao/may-agent/src/foo.ts","content":"..."}
[tool_result] write: Written 245 bytes
```

Text deltas are concatenated into coherent chunks rather than individual delta events.

### Filtering

Default filter includes the useful event types. The `connected` welcome message from the remote socket is always forwarded (contains session state). Raw `message_start`, `message_update` events with `text_delta` are collapsed into `[text]` lines.

### Cleanup

Connections tracked in a `Map<string, WatchEntry>` per session. Cleanup on session end kills all connections.

Implementation: `createSocketWatchTool()` returns `{ tool, cleanup }`. 

### File: `src/socket-watch.ts`

Exports:
- `createSocketWatchTool(opts): { tool: AgentTool, cleanup: () => void }`
- Options: `{ manager: SubagentManager, getSessionId: () => string }`

## Agent Loader Integration

Two new tool presets in `run/agent-loader.ts`:

| Preset | Tool | Notes |
|---|---|---|
| `"background-exec"` | `createBackgroundExecTool()` | Same base deny patterns as regular exec |
| `"socket-watch"` | `createSocketWatchTool()` | Needs manager + session ID |

Cleanup wiring: the agent-loader maintains a `Map<string, Array<() => void>>` of cleanup functions per agent name. When building tools, it collects cleanup functions from tool factories that return `{ tool, cleanup }`. These are invoked by subscribing to agent session events — specifically, when a session transitions to a terminal state or idle, the cleanup runs.

Simpler approach: `SubagentDefinition` gets an optional `onSessionEnd?: () => void` callback. The manager calls it in `handleCompletion()` (for non-persistent) and `close()`. The agent-loader wires cleanup functions into this.

## Coach Agent

### Registration

`agents/coach/agent.json`:
```json
{
  "name": "coach",
  "description": "Supervises and trains a coachee agent through process-isolated coaching sessions",
  "domain": "agent coaching and training",
  "model": "opus",
  "tools": ["read-only", "exec-readonly", "background-exec", "socket-watch"],
  "systemPromptFiles": [
    "knowledge/domain.md",
    "tools/INDEX.md"
  ],
  "maxTurns": 100,
  "memoryLimit": 10
}
```

Tools rationale:
- `read-only` — read source files, knowledge files, evaluation reports
- `exec-readonly` — run read-only commands (git log, grep, check file existence)
- `background-exec` — spawn coachee may-agent process
- `socket-watch` — connect to coachee's socket, observe and steer

No `write`, no `subagents`. Coach interacts with the coachee exclusively through the socket.

### Coach Workflow (domain.md)

The coaching loop:

1. **Spawn coachee process**
   ```
   background_exec.spawn("cd /home/hao/may-agent && STATE_DIR=.state/coaching AGENT=coder npx tsx run/may.ts")
   ```
   Wait for daemon startup by polling `background_exec.output(pid)` until socket ready message appears.

2. **Connect to coachee socket**
   ```
   socket_watch.connect(".state/coaching/coder.sock", { label: "coachee", debounceMs: 5000 })
   ```

3. **Send task to coachee**
   ```
   socket_watch.send(watchId, { type: "input", message: "<task description>" })
   ```

4. **Observe and intervene** — events arrive as followUp batches. For each batch:
   - Analyze coachee behavior against coaching objectives
   - If on track: do nothing (let next batch arrive)
   - If drifting: steer via `socket_watch.send(watchId, { type: "steer", message: "..." })`
   - If stuck: cancel and re-task via `socket_watch.send(watchId, { type: "cancel_task" })` then new input
   - If done: evaluate results

5. **Evaluate results** — read output files, run tests, check quality

6. **Iterate or conclude** — if quality insufficient, send new task with feedback. If good, record learnings.

7. **Cleanup**
   ```
   socket_watch.disconnect(watchId)
   background_exec.kill(pid)
   ```

## Implementation Order

1. `manager.followUp()` — add to `src/manager.ts`
2. `src/background-exec.ts` — `createBackgroundExecTool()`
3. `src/socket-watch.ts` — `createSocketWatchTool()`
4. Export from `src/index.ts`
5. Add presets to `run/agent-loader.ts` (with cleanup wiring)
6. Create `agents/coach/` (agent.json, knowledge/domain.md, tools/INDEX.md)
7. Tests for each piece
8. `npm run check`
9. End-to-end coaching test
