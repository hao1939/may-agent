# May-Agent Architecture Redesign

## Core Concept

One process. One EventBus. Everything connects through it.

**EventBus**: commands in, events out. All components subscribe and emit.
**DB**: optional subscriber that persists events to SQLite. Enables queries.

## EventBus

```typescript
class EventBus {
  private subscribers: Array<(event: AgentEvent) => void> = [];

  subscribe(fn: (event: AgentEvent) => void): () => void {
    this.subscribers.push(fn);
    return () => { this.subscribers = this.subscribers.filter(s => s !== fn); };
  }

  emit(event: AgentEvent): void {
    for (const fn of this.subscribers) {
      try { fn(event); } catch { /* never breaks anyone */ }
    }
  }
}
```

## Agent Cooperation Modes

Three modes, aligned between the agents tool and the EventBus:

| Mode | Behavior | EventBus | Inside core |
|------|----------|----------|-------------|
| `call` | Sync, blocks caller, child session | Not a bus command — internal to core | `await manager.callAgent()` |
| `fork` | Async, new session, caller continues | `{ type: "fork" }` | `manager.runAgent()` |
| `message` | Fire-and-forget, picked up later | `{ type: "message" }` | writes to request DB |

`call` is synchronous — it lives inside core's execution (agent tools, workflow steps). The caller awaits the result. The bus only sees the resulting session_start/session_end events.

`fork` and `message` are async — they go through the EventBus as commands.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    One Process                           │
│                                                          │
│  Console ──┐                          ┌── Web UI        │
│  Telegram ──┼── Socket ──┐           │  (HTTP + WS)    │
│             ┘            │           │  reads DB        │
│                     commands/     events                 │
│                     events                               │
│                          │           │                   │
│                    ┌─────┴───────────┴──────┐            │
│                    │       EventBus          │            │
│                    │   subscribe + emit      │            │
│                    └──┬──┬──────┬──────┬─────┘            │
│                       │  │      │      │                  │
│                  ┌────┴┐┌┴────┐┌┴────┐┌┴──────────┐      │
│                  │Core ││ DB  ││Cron ││ Context   │      │
│                  │     ││Write││     ││ Learner   │      │
│                  └─────┘└──┬──┘└─────┘└───────────┘      │
│                            │writes                        │
│                       ┌────┴────┐                         │
│                       │ SQLite  │◀── Web UI reads         │
│                       └─────────┘                         │
└──────────────────────────────────────────────────────────┘
```

## Components

### Core

Subscribes to `fork`, `message`, `input`, `steer`, `cancel` commands. Emits observation events. Multi-agent runtime.

`call` is internal — agents use it via the agents tool, workflows use it via `ctx.runAgent()`. It blocks the calling session, not the process.

All sessions run concurrently (async, non-blocking).

```
Subscribes to: fork, message, input, steer, cancel
Emits: session_start, text, tool_call, tool_result, session_end, message_created
Internal only: call (sync, blocks calling agent)
```

### Socket Server

Bridges user interfaces to the EventBus.

```
Inbound: commands from console/telegram/web UI → emits to bus
Outbound: subscribes to bus → forwards events to clients
```

### User Interfaces (behind socket)

- **Console**: readline → socket → bus. Bus → socket → terminal.
- **Telegram**: bot → socket → bus. Bus → socket → telegram chat.
- **Web UI**: WebSocket → socket for live events. HTTP reads DB for queries.

### DB Writer (optional subscriber)

Persists events to SQLite. The only component that writes to DB.

```
Subscribes to: session_start, session_end, message_created, eval, cron_fired
```

### Cron

Emits `fork` commands on schedule. Reads DB for job history.

```
Emits: fork (agent heartbeats), cron_fired (tracking)
Reads DB: last fire times, overlap detection
Runs: JS handlers in-process (evaluate-sessions, watchdog)
```

### Context Learner (optional subscriber)

```
Subscribes to: session_end
Writes: agents/<name>/context.md
```

## Event Types

```typescript
type AgentEvent =
  // Agent commands (to core)
  | { type: "fork"; agent: string; task: string; originSessionId?: string; opts?: { kind?: string; requestId?: string } }
  | { type: "message"; from: string; to: string; task: string }
  | { type: "input"; sessionId: string; text: string }
  | { type: "steer"; sessionId: string; text: string }
  | { type: "cancel"; sessionId: string }

  // Management commands (to core / launcher)
  | { type: "reload" }                    // core reloads agent configs from disk
  | { type: "restart" }                   // launcher kills process, restarts
  | { type: "shutdown" }                  // graceful shutdown, close all sessions

  // Observations (from core)
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; outcome?: string }
  | { type: "message_created"; from: string; to: string; task: string; requestId: string }

  // Cron
  | { type: "cron_fired"; job: string; agent?: string; timestamp: number }

  // System
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };
```

**Who handles what:**

| Command | Handler | What it does |
|---------|---------|-------------|
| fork | Core | Starts async session |
| message | Core | Writes request to DB via bus |
| input | Core | Sends text to existing session (wake if idle) |
| steer | Core | Injects text mid-turn |
| cancel | Core | Stops session |
| reload | Core | Reloads agent configs from disk |
| restart | Launcher | Kills process, restarts with new code |
| shutdown | Launcher | Graceful exit |

## Startup

```typescript
const bus = new EventBus();

new Core(bus, { persistDir, projectRoot });
if (dbEnabled) new DbWriter(bus, dbPath);
new SocketServer(bus, db, socketPath);
if (cronEnabled) new CronScheduler(bus, db, cronConfig);
if (contextLearnEnabled) new ContextLearner(bus, agentsRoot);
if (webEnabled) new WebUI(db, socketPath, webPort);
```

Each mode:
- **--chat**: core + DB + socket
- **--cron**: core + DB + socket + cron
- **--oneshot**: core + DB
- **full**: everything

## Migration Path

### Phase 1: Unified EventBus
- 15-line EventBus replaces current class
- Core subscribes for commands (fork, message, input, steer, cancel)
- Core emits observations
- Socket bridges to bus

### Phase 2: DB writes through subscriber
- Remove direct DB calls from core
- DB writer subscriber handles all writes

### Phase 3: Thin startup
- Create bus → attach components → done
- Under 100 lines total

## Design Clarifications (from review feedback)

### No request/response on the bus

The bus is fire-and-forget. No correlation IDs. No response events.

When an agent needs a sync response, it uses `call` — direct, blocks the caller, returns the result. That's what `call` is for. The bus is for async commands and observation events.

When infra needs data (status, session list), it reads DB directly. Not through the bus. DB is a shared read store.

| Need | Path |
|------|------|
| Agent needs sync response | `agents.call()` — internal to core |
| Agent needs async action | `agents.fork()` / `agents.message()` — bus command |
| Infra needs data now | Read DB directly |

### Infra errors don't reach agents

If the DB writer fails to persist a `session_end` event, that's an ops problem — not an agent problem. The agent's work is done. The bus catch block logs the error. Ops monitors DB health. The agent doesn't retry.

Agents never see infra errors. They see tool results and session outcomes. The bus subscriber error isolation (`try { fn(event) } catch {}`) is correct — a broken subscriber never breaks core or other subscribers.

### Shutdown is not a bus problem

The bus carries a `shutdown` event for notification. But ordering is handled by the startup code in reverse: stop cron → cancel sessions → close socket → exit. Same as today. The bus doesn't orchestrate shutdown — the process owner does.

### fork carries session options

The `fork` event includes an `opts` field for session configuration (kind, requestId, etc.). This ensures config doesn't get lost when cron or interfaces emit fork commands.

### DB is optional in code, required in production

The architecture allows running without DB (for gym, tests, oneshot). Production always enables it. This is a deployment decision, not an architecture constraint.
