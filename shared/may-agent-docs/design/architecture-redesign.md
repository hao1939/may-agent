# May-Agent Architecture Redesign

## Core Concept

One integration point: the **EventBus**. Commands in, events out. Everything flows through it.

**DB is optional.** A subscriber that persists events to SQLite. Enables queries (dashboards, history). Without it, core still runs — events are ephemeral.

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

15 lines. Everyone subscribes. Everyone emits. No direct calls between components.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 User Interfaces                      │
│                                                      │
│  Console ──┐                                         │
│  Telegram ──┼── Socket ──┐         ┌── Web UI ──┐   │
│  (future) ──┘            │         │   (HTTP +   │   │
│                          │         │   WebSocket)│   │
└──────────────────────────┼─────────┼─────────────┘   │
                           │         │                  │
                      commands/   events +              │
                      events     DB reads               │
                           │         │                  │
┌──────────────────────────┼─────────┼──────────────────┘
│                    ┌─────┴─────────┴──────┐
│                    │      EventBus         │
│                    │  subscribe() + emit() │
│                    └──┬──────┬──────┬──────┘
│                       │      │      │
│                  ┌────┴──┐ ┌┴────┐ ┌┴──────────┐
│   Internal:      │ Core  │ │ DB  │ │ Context   │
│                  │       │ │Write│ │ Learner   │
│                  └───────┘ └──┬──┘ └───────────┘
│                               │
│                          ┌────┴────┐
│                          │ SQLite  │◀── Web UI reads
│                          └─────────┘
│
│                  ┌────────┐
│                  │  Cron  │── emits run commands
│                  └────────┘
└───────────────────────────────────────────────────────
```

## Components

### Socket Server

The boundary between user interfaces and the system. Bridges socket protocol to EventBus.

```
Inbound: receives commands from console/telegram/web UI → emits to bus
Outbound: subscribes to bus → forwards events to connected clients
```

Console and telegram connect via socket. They don't subscribe to the EventBus directly.

### User Interfaces

All behind the socket. Each is a client that sends commands and renders events.

**Console**: readline → socket commands. Socket events → terminal rendering.
**Telegram**: bot messages → socket commands. Socket events → telegram messages.
**Web UI**: HTTP + WebSocket. WebSocket connects to socket for live events. HTTP reads DB directly for queries (session history, stats, benchmarks).

Web UI is enhanced because it can query the DB — browse session history, search requests, view dashboards. Console and telegram only see live events.

### Core

Subscribes to command events. Emits observation events. The multi-agent runtime.

```
Subscribes to: input, run, fork, steer, cancel
Emits: session_start, text, tool_call, tool_result, session_end, message_created
```

Contains: SubagentManager, tools, workflow engine, compaction, session persistence (JSONL).

### DB Writer (optional subscriber)

Subscribes to observation events. Writes to SQLite.

```
Subscribes to: session_start, session_end, message_created, eval
Writes: sessions, requests, evaluations tables
```

Without this subscriber, core runs fine. No persistence, no queries. Add it when you need dashboards, history, or cross-restart state.

### Cron (optional)

Emits run commands on schedule. Reads cron.json for intervals.

```
Emits: run (heartbeats, scheduled jobs)
```

### Context Learner (optional subscriber)

Subscribes to session_end. Extracts knowledge. Writes to context.md.

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

  // System
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };
```

## Startup

```typescript
// Create the bus
const bus = new EventBus();

// Attach core (subscribes to commands, emits observations)
const core = new Core(bus, { persistDir, projectRoot });

// Attach optional subscribers
if (dbEnabled) new DbWriter(bus, dbPath);
if (contextLearnEnabled) new ContextLearner(bus, agentsRoot);

// Attach socket server (bridges to user interfaces)
new SocketServer(bus, db, socketPath);

// Attach cron (emits run commands on schedule)
if (cronEnabled) new CronScheduler(bus, cronConfig);

// Web UI is separate — HTTP server that reads DB + connects to socket
if (webEnabled) new WebUI(db, socketPath, webPort);
```

Each mode attaches different components:
- **--chat**: core + socket + console (via socket)
- **--cron**: core + socket + cron + DB writer
- **--oneshot**: core only (no socket, no cron, no DB)
- **full**: everything

## Migration Path

### Phase 1: Unified EventBus
- Replace current EventBus with 15-line version
- Core emits through it
- Extract command handling into core subscriber
- Socket bridges to bus instead of calling handleInput

### Phase 2: Move DB writes to subscriber
- Remove direct DB calls from core
- Core depends only on EventBus + filesystem

### Phase 3: Thin startup
- Create bus → attach components → done
- Under 100 lines per mode
