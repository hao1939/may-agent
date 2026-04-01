# May-Agent Architecture Redesign

## Core Concept

One integration point: the **EventBus**. Commands in, events out. Everything flows through it.

**DB** is a shared read store. Written only by the DB writer subscriber. Read by anyone who needs data.

**One write path**: component → bus → DB writer → SQLite.
**Multiple read paths**: anyone reads SQLite directly.

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

## Architecture

```
┌─────────────────────────────────────────────────┐
│              User Interfaces                     │
│                                                  │
│  Console ──┐                     ┌── Web UI ──┐ │
│  Telegram ──┼── Socket ──┐      │  (HTTP +   │ │
│             ┘            │      │  WebSocket)│ │
└──────────────────────────┼──────┼────────────┘ │
                           │      │               │
                      commands/ events            │
                      events   + DB reads         │
                           │      │               │
┌──────────────────────────┼──────┼───────────────┘
│                    ┌─────┴──────┴──────┐
│                    │     EventBus      │
│                    │ subscribe + emit  │
│                    └──┬───┬──────┬─────┘
│                       │   │      │
│                  ┌────┴┐ ┌┴────┐ ┌┴──────────┐
│                  │Core │ │ DB  │ │ Context   │
│                  │     │ │Write│ │ Learner   │
│                  └─────┘ └──┬──┘ └───────────┘
│                             │ writes
│                        ┌────┴────┐
│                        │ SQLite  │◀── reads: Web UI, Cron, Handlers
│                        └─────────┘
│
│                  ┌────────┐
│                  │  Cron  │── emits run commands + cron_fired
│                  │        │── reads DB for scheduling decisions
│                  │        │── runs JS handlers in-process
│                  └────────┘
└──────────────────────────────────────────────────
```

## Components

### Core

Subscribes to command events. Emits observation events. The multi-agent runtime.

```
Subscribes to: input, run, fork, steer, cancel
Emits: session_start, text, tool_call, tool_result, session_end, message_created
```

Contains: SubagentManager, tools, workflow engine, compaction, session persistence (JSONL on filesystem).

Does NOT access DB. Does NOT know about socket, console, telegram, cron.

### Socket Server

The boundary between user interfaces and the system.

```
Inbound: commands from console/telegram/web UI → emits to bus
Outbound: subscribes to bus → forwards events to connected clients
```

### User Interfaces (behind socket)

**Console**: readline → socket. Socket events → terminal.
**Telegram**: bot messages → socket. Socket events → telegram chat.
**Web UI**: WebSocket → socket for live events. HTTP reads DB for queries (history, stats, search). Enhanced because it has DB access.

### DB Writer (optional subscriber)

The only component that writes to SQLite. All writes flow through the bus.

```
Subscribes to: session_start, session_end, message_created, eval, cron_fired
Writes: sessions, requests, evaluations, cron_history tables
```

### Cron

Timer that emits commands. Reads DB for scheduling. Runs JS handlers.

```
Emits: run (agent heartbeats), cron_fired (tracking)
Reads DB: last run times, overlap detection
Runs: JS handlers in-process (evaluate-sessions, watchdog, daily-digest)
```

Cron never writes DB directly. It emits `cron_fired` events → DB writer persists them.

JS handlers are cron's implementation detail — internal functions that read DB and emit results to the bus.

### Context Learner (optional subscriber)

```
Subscribes to: session_end
Reads: session transcript from filesystem
Writes: agents/<name>/context.md
```

## Event Types

```typescript
type AgentEvent =
  // Commands (to core)
  | { type: "input"; agent: string; text: string; sessionId?: string }
  | { type: "run"; agent: string; task: string }
  | { type: "fork"; agent: string; task: string }
  | { type: "steer"; sessionId: string; text: string }
  | { type: "cancel"; sessionId: string }

  // Observations (from core)
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; outcome?: string }
  | { type: "message_created"; from: string; to: string; task: string }

  // Cron
  | { type: "cron_fired"; job: string; agent?: string; timestamp: number }

  // System
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };
```

## Data Flow Rules

| Action | Path |
|--------|------|
| Write anything | → bus.emit() → DB writer → SQLite |
| Read data | → SQLite directly |
| Send command to core | → bus.emit() |
| Receive events | → bus.subscribe() or socket |
| User interaction | → socket → bus |

## Startup

```typescript
const bus = new EventBus();

// Core (subscribes to commands, emits observations)
const core = new Core(bus, { persistDir, projectRoot });

// DB writer (subscribes to events, writes SQLite)
if (dbEnabled) new DbWriter(bus, dbPath);

// Socket server (bridges UI interfaces to bus)
new SocketServer(bus, db, socketPath);

// Cron (emits run commands, reads DB, runs handlers)
if (cronEnabled) new CronScheduler(bus, db, cronConfig);

// Context learner (subscribes to session_end)
if (contextLearnEnabled) new ContextLearner(bus, agentsRoot);

// Web UI (HTTP + WS, reads DB, connects to socket)
if (webEnabled) new WebUI(db, socketPath, webPort);
```

## Migration Path

### Phase 1: Unified EventBus
- 15-line EventBus replaces current class
- Core emits through it
- Command handling extracted into core subscriber
- Socket bridges to bus

### Phase 2: DB writes through bus
- Remove direct DB calls from core and cron
- DB writer subscriber handles all writes
- One write path: bus → DB writer → SQLite

### Phase 3: Thin startup
- Create bus → attach components → done
- Under 100 lines per mode
