# May-Agent Architecture Redesign

## Core Concept

Two systems, one shared DB.

**Core system**: EventBus-based. Commands in, events out. Real-time.
**Cron system**: Standalone. Timers + DB + spawn. No EventBus.

They share SQLite. That's the only integration point between them.

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
┌─────────────────────────────────────────────────────────────┐
│                    Core System (one process)                  │
│                                                              │
│  Console ──┐                          ┌── Web UI            │
│  Telegram ──┼── Socket ──┐           │  (HTTP + WS)        │
│             ┘            │           │                      │
│                     commands/     events +                   │
│                     events      DB reads                    │
│                          │           │                      │
│                    ┌─────┴───────────┴──────┐               │
│                    │       EventBus          │               │
│                    │   subscribe + emit      │               │
│                    └──┬──────┬──────┬────────┘               │
│                       │      │      │                        │
│                  ┌────┴┐  ┌──┴──┐  ┌┴──────────┐            │
│                  │Core │  │ DB  │  │ Context   │            │
│                  │     │  │Write│  │ Learner   │            │
│                  └─────┘  └──┬──┘  └───────────┘            │
│                              │writes                         │
└──────────────────────────────┼───────────────────────────────┘
                               │
                          ┌────┴────┐
                          │ SQLite  │
                          └────┬────┘
                               │
┌──────────────────────────────┼───────────────────────────────┐
│                    Cron System (standalone)                    │
│                                                              │
│  ┌────────────┐     reads/writes     ┌─────────────────┐    │
│  │ Scheduler  │◀────────────────────▶│    SQLite        │    │
│  │            │                      │ (job history,    │    │
│  │ - timers   │                      │  messages,       │    │
│  │ - cron.json│                      │  request queue)  │    │
│  └─────┬──────┘                                              │
│        │ spawns                                              │
│  ┌─────┴──────────────┐                                      │
│  │ may-agent --oneshot │  (each is an independent process    │
│  │ may-agent --oneshot │   with its own EventBus + DB writer)│
│  │ may-agent --oneshot │                                      │
│  └─────────────────────┘                                      │
│                                                              │
│  ┌─────────────────────┐                                      │
│  │ JS Handlers          │  (in-process: evaluate-sessions,   │
│  │ (read/write DB)      │   watchdog, daily-digest)          │
│  └──────────────────────┘                                     │
└───────────────────────────────────────────────────────────────┘
```

## Components

### Core System

One long-running process. EventBus connects everything inside it.

**Core**: subscribes to commands, emits observations. Multi-agent runtime.
```
Subscribes to: input, run, fork, steer, cancel
Emits: session_start, text, tool_call, tool_result, session_end, message_created
```

**Socket server**: bridges user interfaces to EventBus.
```
Inbound: commands from console/telegram/web UI → emits to bus
Outbound: subscribes to bus → forwards events to clients
```

**DB writer** (optional subscriber): persists events to SQLite.
```
Subscribes to: session_start, session_end, message_created, eval
Writes: sessions, requests, evaluations tables
```

**Context learner** (optional subscriber): post-session knowledge extraction.
```
Subscribes to: session_end
Writes: agents/<name>/context.md
```

**User interfaces** (behind socket):
- Console: readline → socket → bus. Bus → socket → terminal.
- Telegram: bot → socket → bus. Bus → socket → telegram chat.
- Web UI: WebSocket → socket for live events. HTTP reads DB for queries.

### Cron System

Standalone. No EventBus. Reads/writes DB directly. Spawns processes.

**Scheduler**: reads cron.json, manages intervals, tracks job history in DB.
```
Reads DB: last fire times, job status, overlap detection
Writes DB: job history (fired_at, status, duration)
Spawns: may-agent --oneshot for agent tasks
Runs: JS handlers in-process for lightweight jobs
```

**Spawned processes**: each `may-agent --oneshot` is independent.
- Has its own EventBus + core + DB writer
- Runs one task, writes results to DB, exits
- Cron checks DB later to see what happened

**JS handlers**: internal functions for plumbing.
- evaluate-sessions: reads session transcripts, writes evaluations to DB
- watchdog: reads active sessions, cancels stuck ones
- daily-digest: reads DB, produces summary

### Shared DB (SQLite)

The integration point between core system and cron system.

**Written by:**
- DB writer subscriber (inside core system, via EventBus)
- Cron scheduler (job history, direct writes)
- JS handlers (evaluations, direct writes)
- Spawned oneshot processes (via their own DB writer)

**Read by:**
- Web UI (dashboards, history, search)
- Cron scheduler (last fire times, overlap)
- JS handlers (session data for evaluation)
- Agent tools (system_status, requests)

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

## Startup Modes

**Full system** (core + cron in one process):
```typescript
const bus = new EventBus();
const core = new Core(bus, { persistDir, projectRoot });
new DbWriter(bus, dbPath);
new SocketServer(bus, db, socketPath);
new ContextLearner(bus, agentsRoot);
new CronScheduler(db, cronConfig, spawnCmd);
new WebUI(db, socketPath, webPort);
```

**Core only** (interactive, no cron):
```typescript
const bus = new EventBus();
const core = new Core(bus, { persistDir, projectRoot });
new DbWriter(bus, dbPath);
new SocketServer(bus, db, socketPath);
```

**Oneshot** (single task, exits):
```typescript
const bus = new EventBus();
const core = new Core(bus, { persistDir, projectRoot });
new DbWriter(bus, dbPath);
core.run(agent, task);
```

**Cron standalone** (no core, just scheduling):
```typescript
new CronScheduler(db, cronConfig, "may-agent --oneshot");
```

## Migration Path

### Phase 1: Unified EventBus
- 15-line EventBus replaces current class
- Core emits through it, subscribes for commands
- Socket bridges to bus

### Phase 2: DB writes through subscriber
- Remove direct DB calls from core
- DB writer subscriber handles all core-system writes
- Cron keeps direct DB access (it's standalone)

### Phase 3: Extract cron
- Cron becomes standalone module
- Spawns may-agent --oneshot instead of running in-process
- Or runs in-process as today (both modes supported)

### Phase 4: Thin startup
- Under 100 lines per mode
- Create bus → attach components → done
