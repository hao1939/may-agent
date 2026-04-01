# May-Agent Architecture Redesign

## Core Concept

Two paths. Simple rules.

- **EventBus**: async. Fire and forget. Commands and events. Results come back later as events.
- **DB**: sync reads. Query anytime. Dashboards, status, history.

| Need something to happen | → EventBus (async) |
|--------------------------|---------------------|
| Need data now | → DB read (sync) |

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

## Components

Every component takes the bus in its constructor. Subscribes to what it cares about. Emits what it produces.

```typescript
const bus = new EventBus();
const core = new Core(bus, { persistDir, projectRoot });
new ConsoleInterface(bus);
new SocketServer(bus, db, socketPath);
new DbWriter(bus, dbPath);
new CronScheduler(bus, cronConfig);
new TelegramBot(bus, botConfig);
new ContextLearner(bus, agentsRoot);
```

No component knows about any other component. They only know the bus and the event types.

### Core

Subscribes to commands. Emits observations.

```
Subscribes to: input, run, fork, steer, cancel
Emits: session_start, text, tool_call, tool_result, session_end, message_created
```

### Console

Emits commands from readline. Subscribes to render events.

```
Emits: input (user typed something)
Subscribes to: text, tool_call, session_end (render to terminal)
```

### Socket Server

Emits commands from network clients. Subscribes to forward events. Reads DB for queries.

```
Emits: input, fork, steer, cancel (from web UI / CLI clients)
Subscribes to: all events (forward to subscribed clients)
Reads DB: status, sessions, requests (sync queries from web UI)
```

### DB Writer

Subscribes only. Writes events to SQLite.

```
Subscribes to: session_start, session_end, message_created, eval
Writes to: sessions, requests, evaluations tables
```

### Cron

Emits run commands on schedule.

```
Emits: run (heartbeats, scheduled jobs)
```

### Telegram

Emits commands from chat messages. Subscribes to forward notifications.

```
Emits: input (user message)
Subscribes to: notification (forward to telegram chat)
```

### Context Learner

Subscribes only. Triggers learning after sessions end.

```
Subscribes to: session_end (runs extraction on completed sessions)
```

### Web UI

Not on the bus. Reads DB directly. Connects to socket for live events.

```
HTTP: reads DB (sessions, requests, stats, benchmarks)
WebSocket: connects to socket server (live event stream)
```

## Event Types

```typescript
type AgentEvent =
  // Commands (to core)
  | { type: "input"; agent: string; text: string; sessionId?: string; source?: string }
  | { type: "run"; agent: string; task: string }
  | { type: "fork"; agent: string; task: string }
  | { type: "steer"; sessionId: string; text: string }
  | { type: "cancel"; sessionId: string }
  | { type: "cancel_all" }

  // Observations (from core)
  | { type: "text"; sessionId: string; agent: string; text: string }
  | { type: "tool_call"; sessionId: string; agent: string; tool: string; args: unknown }
  | { type: "tool_result"; sessionId: string; agent: string; tool: string; preview: string; isError: boolean }
  | { type: "turn_end"; sessionId: string; agent: string; toolCalls: number; durationMs: number }
  | { type: "session_start"; sessionId: string; agent: string; task: string; parentSessionId?: string }
  | { type: "session_end"; sessionId: string; agent: string; status: string; error?: string; outcome?: string }
  | { type: "message_created"; from: string; to: string; task: string; requestId: string }

  // System
  | { type: "notification"; agent: string; text: string }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };
```

## Data Flow

```
User types "fix the build"
  Console → bus.emit({ type: "input", agent: "may", text: "fix the build" })
  Core picks up → starts session → bus.emit({ type: "session_start", ... })
  Core working → bus.emit({ type: "text", ... })
  Core done → bus.emit({ type: "session_end", ... })
  
  Console subscriber: renders text to terminal
  DB subscriber: writes session to SQLite  
  Socket subscriber: forwards to web UI
  Context learner: extracts knowledge

Web UI opens dashboard
  HTTP GET /api/stats → socket server reads DB → returns JSON
  WebSocket /ws → socket server forwards bus events in real-time
```

Write path (async): Component → bus → subscribers
Read path (sync): Component → DB → result

## Dependency Graph

```
                         ┌─────────────────────────┐
                         │        EventBus          │
                         │  subscribe() + emit()    │
                         └────┬──────────┬──────────┘
                              │          │
            emit commands     │          │  subscribe observations
         ┌────────────────────┤          ├────────────────────┐
         │          │         │          │         │          │
    ┌────┴───┐ ┌───┴───┐ ┌──┴───┐ ┌───┴────┐ ┌──┴───┐ ┌───┴──────┐
    │Console │ │Socket │ │ Cron │ │  Core  │ │  DB  │ │ Context  │
    │        │ │Server │ │      │ │        │ │Writer│ │ Learner  │
    └────────┘ └───┬───┘ └──────┘ └────────┘ └──┬───┘ └──────────┘
                   │                             │
              reads│                        writes│
                   │     ┌──────────┐            │
                   └────▶│  SQLite  │◀───────────┘
                         └─────┬────┘
                          reads│
                         ┌─────┴────┐
                         │  Web UI  │
                         │(HTTP+WS) │
                         └──────────┘
```

## Migration Path

### Phase 1: Unified EventBus
- Replace current EventBus class with 15-line version
- Core emits through it (already does mostly)
- Extract command handling from may.ts into core subscriber
- Interfaces emit commands through bus instead of calling handleInput

### Phase 2: Move DB writes to subscriber
- Remove direct DB calls from core
- DB subscriber handles session/request persistence
- Core depends only on EventBus + filesystem

### Phase 3: Thin may.ts
- Create bus → attach components → done
- Each mode (--chat, --cron, --oneshot) attaches different components
- Under 100 lines
