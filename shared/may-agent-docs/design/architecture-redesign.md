# May-Agent Architecture Redesign

## Core Concept

One process. One EventBus. Everything connects through it.

**EventBus**: commands in, events out. All components subscribe and emit.
**DB**: optional subscriber that persists events to SQLite. Enables queries.
**Cron**: emits `run` commands on schedule. Runs in the same process.

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

Subscribes to command events. Emits observation events. Multi-agent runtime.

All sessions run concurrently in the same process — async, non-blocking. 10 agents can run heartbeats simultaneously.

```
Subscribes to: input, run, fork, steer, cancel
Emits: session_start, text, tool_call, tool_result, session_end, message_created
```

Contains: SubagentManager, tools, workflow engine, compaction, session persistence (JSONL).

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

Without it, core runs fine. Events are ephemeral.

### Cron

Emits `run` commands on schedule. Reads DB for job history. Runs JS handlers in-process.

```
Emits: run (agent heartbeats), cron_fired (tracking)
Reads DB: last fire times, overlap detection
Runs: JS handlers in-process (evaluate-sessions, watchdog)
```

Non-blocking — `bus.emit({ type: "run" })` returns immediately. Core starts the session async. Cron continues scheduling.

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

## Startup

```typescript
const bus = new EventBus();

// Core (subscribes to commands, emits observations)
new Core(bus, { persistDir, projectRoot });

// DB writer (optional — persists events to SQLite)
const db = dbEnabled ? new DbWriter(bus, dbPath) : null;

// Socket server (bridges user interfaces)
new SocketServer(bus, db, socketPath);

// Cron (emits run commands on schedule)
if (cronEnabled) new CronScheduler(bus, db, cronConfig);

// Context learner (post-session knowledge extraction)
if (contextLearnEnabled) new ContextLearner(bus, agentsRoot);

// Web UI (HTTP + WS, reads DB)
if (webEnabled) new WebUI(db, socketPath, webPort);
```

Startup is under 20 lines. Each mode attaches different components:
- **--chat**: core + DB + socket
- **--cron**: core + DB + socket + cron
- **--oneshot**: core + DB
- **full**: everything

## Migration Path

### Phase 1: Unified EventBus
- 15-line EventBus replaces current class
- Core emits through it, subscribes for commands
- Socket bridges to bus

### Phase 2: DB writes through subscriber
- Remove direct DB calls from core
- DB writer subscriber handles all writes

### Phase 3: Thin startup
- Create bus → attach components → done
- Under 100 lines total
